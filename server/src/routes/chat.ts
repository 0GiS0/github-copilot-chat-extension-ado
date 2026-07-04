/**
 * 💬 Chat routes — /chat (streaming) and /chat/sync (non-streaming)
 */
import { mkdtemp, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { Router, Request, Response } from "express";
import { log } from "../logger.js";
import { getGitHubToken, tokenKey } from "../middleware/auth.js";
import { getCopilotClient, getApproveAll } from "../services/copilot.js";
import { getMcpConfig } from "../services/mcp.js";
import { getSession, setSession, deleteSession } from "../services/sessions.js";
import { getSystemMessage, AdoContext } from "../prompts/system.js";
import { quickstartsExpertAgent, productDefinitionExpert } from "../agents/index.js";
import { createAdoProjectTools } from "../tools/index.js";

export const chatRouter = Router();

interface IncomingAttachment {
    name?: string;
    mimeType?: string;
    dataUrl?: string;
}

type KnowledgeBaseOption = "sharepoint" | "confluence" | "azure-devops-wiki";

function parseDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
        throw new Error("Invalid attachment payload.");
    }

    return {
        mimeType: match[1],
        buffer: Buffer.from(match[2], "base64"),
    };
}

async function materializeAttachments(
    attachments: IncomingAttachment[] | undefined,
): Promise<{ tempDir: string | null; sdkAttachments: Array<{ type: "file"; path: string; displayName?: string }> }> {
    if (!attachments || attachments.length === 0) {
        return { tempDir: null, sdkAttachments: [] };
    }

    const tempDir = await mkdtemp(path.join(os.tmpdir(), "product-definition-"));
    const sdkAttachments: Array<{ type: "file"; path: string; displayName?: string }> = [];

    for (let index = 0; index < attachments.length; index += 1) {
        const attachment = attachments[index];
        if (!attachment?.dataUrl) {
            continue;
        }

        const { mimeType, buffer } = parseDataUrl(attachment.dataUrl);
        if (!mimeType.startsWith("image/")) {
            throw new Error("Only image attachments are supported.");
        }

        const ext = mimeType.split("/")[1] || "png";
        const safeBaseName = (attachment.name || `image-${index + 1}`)
            .replace(/[^\w.-]+/g, "-")
            .replace(/^-+|-+$/g, "");
        const fileName = safeBaseName.includes(".") ? safeBaseName : `${safeBaseName || `image-${index + 1}`}.${ext}`;
        const filePath = path.join(tempDir, fileName);
        await writeFile(filePath, buffer);
        sdkAttachments.push({
            type: "file",
            path: filePath,
            displayName: attachment.name || fileName,
        });
    }

    return { tempDir, sdkAttachments };
}

function buildPromptWithKnowledgeBase(message: string, knowledgeBase?: KnowledgeBaseOption): string {
    if (!knowledgeBase) {
        return message;
    }

    const knowledgeBaseLabels: Record<KnowledgeBaseOption, string> = {
        sharepoint: "SharePoint",
        confluence: "Confluence",
        "azure-devops-wiki": "Azure DevOps Wiki",
    };

    const selectedKnowledgeBase = knowledgeBaseLabels[knowledgeBase];
    return [
        `Selected customer knowledge base: ${selectedKnowledgeBase}.`,
        `Use it as the preferred source of product context when relevant. If that knowledge base is not available in the current conversation or tools, say so explicitly and ask for the relevant excerpt, page, or link instead of inventing details.`,
        "",
        message,
    ].join("\n");
}

// ── POST /chat — SSE streaming chat ────────────────────────────
chatRouter.post("/", async (req: Request, res: Response) => {
    const githubToken = getGitHubToken(req);
    if (!githubToken) {
        res.status(401).json({ error: "Missing X-GitHub-Token header" });
        return;
    }

    const { message, language = "es", model: requestedModel, knowledgeBase, adoContext, attachments } = req.body as {
        message?: string;
        language?: string;
        model?: string;
        knowledgeBase?: KnowledgeBaseOption;
        adoContext?: AdoContext;
        attachments?: IncomingAttachment[];
    };
    const adoToken = req.headers["x-ado-token"] as string | undefined;
    const startTime = Date.now();

    log.request("POST", "/chat");

    if (!message) {
        log.warn("Mensaje vacío recibido");
        res.status(400).json({ error: "Message is required" });
        return;
    }

    const model = requestedModel || "gpt-5.2";

    log.question("pending", message);
    if (adoContext?.projectName) {
        log.info(`[chat] ADO context: org=${adoContext.orgName}, project=${adoContext.projectName}`);
    }

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    let client: any = null;
    let session: any = null;
    let tempAttachmentDir: string | null = null;

    try {
        const key = tokenKey(githubToken);
        const existing = getSession(key);
        const mcpConfig = getMcpConfig(adoToken, adoContext?.orgName || undefined);
        const approveAll = await getApproveAll();

        const ClientClass = await getCopilotClient();
        client = new ClientClass({ githubToken });
        await client.start();

        // Create per-request tools that capture the user's ADO token
        const adoTools = adoToken
            ? await createAdoProjectTools(adoToken)
            : [];

        let sessionId: string;
        let isNew: boolean;

        const sessionOpts = {
            model,
            streaming: true,
            onPermissionRequest: approveAll,
            systemMessage: { content: getSystemMessage(language, adoContext) },
            mcpServers: mcpConfig,
            customAgents: [quickstartsExpertAgent, productDefinitionExpert],
            tools: adoTools,
        };

        if (existing) {
            try {
                sessionId = existing.sessionId;
                session = await client.resumeSession(sessionId, sessionOpts);
                isNew = false;
                log.session("resumed", sessionId);
            } catch (_err) {
                log.warn(`Failed to resume session ${existing.sessionId}, creating new one`);
                deleteSession(key);
                sessionId = `ado-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                session = await client.createSession({ sessionId, ...sessionOpts });
                setSession(key, sessionId);
                isNew = true;
                log.session("created", sessionId);
            }
        } else {
            sessionId = `ado-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            session = await client.createSession({ sessionId, ...sessionOpts });
            setSession(key, sessionId);
            isNew = true;
            log.session("created", sessionId);
        }

        log.copilot(`Client ready for user (model: ${model}, ${isNew ? "new" : "resumed"} session)`);
        log.streaming(sessionId);

        // Send session ID to client
        res.write(`data: ${JSON.stringify({ type: "session", sessionId })}\n\n`);

        let fullContent = "";
        let chunkCount = 0;
        let completed = false;

        // ── Debug: log ALL session events to discover field names ──
        const unsubscribeAllEvents = session.on((event: any) => {
            if (completed) return;
            const type = event?.type || "?";
            if (type === "assistant.message_delta") return;
            log.debug(`📨 Event [${type}]: ${JSON.stringify(event.data || {}).substring(0, 300)}`);
        });

        // ── Subscribe to tool execution events for progress feedback ──
        const extractToolName = (eventData: any): string => {
            return eventData?.mcpToolName
                || eventData?.toolName
                || eventData?.name
                || eventData?.tool?.name
                || eventData?.tool
                || "unknown";
        };

        const unsubscribeToolStart = session.on("tool.execution_start", (event: any) => {
            if (completed) return;
            const toolName = extractToolName(event.data);
            log.debug(`🔧 Tool started: ${toolName}`);
            log.debug(`   Event data keys: ${JSON.stringify(Object.keys(event.data || {}))}`);
            res.write(`data: ${JSON.stringify({ type: "progress", action: "tool_start", tool: toolName })}\n\n`);
        });

        const unsubscribeToolEnd = session.on("tool.execution_complete", (event: any) => {
            if (completed) return;
            const toolName = extractToolName(event.data);
            const success = event.data?.success ?? true;
            const errorMsg = event.data?.error || event.data?.errorMessage || event.data?.result?.error || "";
            if (success) {
                log.debug(`🔧 Tool completed: ${toolName} (✅)`);
            } else {
                log.error(`🔧 Tool FAILED: ${toolName} ❌ — ${errorMsg || "(no error detail in event)"}`);
                log.debug(`   Full event data: ${JSON.stringify(event.data)}`);
            }
            res.write(`data: ${JSON.stringify({ type: "progress", action: "tool_end", tool: toolName, success })}\n\n`);
        });

        const unsubscribeAgentStart = session.on("subagent.started", (event: any) => {
            if (completed) return;
            const agentName = event.data?.agentDisplayName || event.data?.agentName || "agent";
            log.debug(`🤖 Agent started: ${agentName}`);
            res.write(`data: ${JSON.stringify({ type: "progress", action: "agent_start", agent: agentName })}\n\n`);
        });

        const unsubscribeAgentEnd = session.on("subagent.completed", (event: any) => {
            if (completed) return;
            const agentName = event.data?.agentDisplayName || event.data?.agentName || "agent";
            log.debug(`🤖 Agent completed: ${agentName}`);
            res.write(`data: ${JSON.stringify({ type: "progress", action: "agent_end", agent: agentName })}\n\n`);
        });

        const unsubscribeDelta = session.on("assistant.message_delta", (event: any) => {
            if (completed) return;
            const delta = event.data?.deltaContent ?? "";
            fullContent += delta;
            chunkCount++;
            res.write(`data: ${JSON.stringify({ type: "delta", content: delta })}\n\n`);
        });

        const cleanupSubscriptions = () => {
            unsubscribeAllEvents();
            unsubscribeDelta();
            unsubscribeToolStart();
            unsubscribeToolEnd();
            unsubscribeAgentStart();
            unsubscribeAgentEnd();
        };

        const onClose = () => {
            if (!completed) {
                log.warn("Client disconnected");
                cleanupSubscriptions();
                req.off("close", onClose);
                session?.destroy().catch(() => {});
                client?.stop().catch(() => {});
            }
        };
        req.on("close", onClose);

        // Send message and wait for full response (5 min timeout for MCP tool operations)
        const attachmentPayload = await materializeAttachments(attachments);
        tempAttachmentDir = attachmentPayload.tempDir;
        const prompt = buildPromptWithKnowledgeBase(message, knowledgeBase);
        await session.sendAndWait({ prompt, attachments: attachmentPayload.sdkAttachments }, 300_000);

        completed = true;
        cleanupSubscriptions();
        req.off("close", onClose);

        const duration = Date.now() - startTime;
        log.answer(sessionId, fullContent.length);
        log.complete(sessionId, duration);
        log.debug(`Chunks: ${chunkCount} | Chars: ${fullContent.length}`);

        await session.destroy();
        await client.stop();
        if (tempAttachmentDir) {
            await rm(tempAttachmentDir, { recursive: true, force: true });
        }

        res.write(`data: ${JSON.stringify({ type: "complete", content: fullContent })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        log.error(`Chat error: ${errorMessage}`);

        const key = tokenKey(githubToken);
        deleteSession(key);

        try { if (session) await session.destroy(); } catch { /* ignore */ }
        try { if (client) await client.stop(); } catch { /* ignore */ }
        try { if (tempAttachmentDir) await rm(tempAttachmentDir, { recursive: true, force: true }); } catch { /* ignore */ }

        res.write(`data: ${JSON.stringify({ type: "error", error: errorMessage, resetSession: true })}\n\n`);
        res.end();
    }
});

// ── POST /chat/sync — Non-streaming chat ────────────────────────
chatRouter.post("/sync", async (req: Request, res: Response) => {
    const githubToken = getGitHubToken(req);
    if (!githubToken) {
        res.status(401).json({ error: "Missing X-GitHub-Token header" });
        return;
    }

    const {
        message,
        sessionId: _unusedSessionId = "default",
        language = "es",
        model: requestedModel,
        knowledgeBase,
        adoContext,
        attachments,
    } = req.body as {
        message?: string;
        sessionId?: string;
        language?: string;
        model?: string;
        knowledgeBase?: KnowledgeBaseOption;
        adoContext?: AdoContext;
        attachments?: IncomingAttachment[];
    };
    const startTime = Date.now();

    log.request("POST", "/chat/sync");

    if (!message) {
        log.warn("Mensaje vacío recibido");
        res.status(400).json({ error: "Message is required" });
        return;
    }

    log.question(_unusedSessionId, message);

    const model = requestedModel || "gpt-5.2";
    const adoToken = req.headers["x-ado-token"] as string | undefined;

    let client: any = null;
    let session: any = null;
    let tempAttachmentDir: string | null = null;

    try {
        const key = tokenKey(githubToken);
        const existing = getSession(key);
        const mcpConfig = getMcpConfig(adoToken, adoContext?.orgName || undefined);
        const approveAll = await getApproveAll();

        const ClientClass = await getCopilotClient();
        client = new ClientClass({ githubToken });
        await client.start();

        const adoTools = adoToken
            ? await createAdoProjectTools(adoToken)
            : [];

        const sessionOpts = {
            model,
            streaming: true,
            onPermissionRequest: approveAll,
            systemMessage: { content: getSystemMessage(language, adoContext) },
            mcpServers: mcpConfig,
            customAgents: [quickstartsExpertAgent, productDefinitionExpert],
            tools: adoTools,
        };

        let sessionId: string;

        if (existing) {
            sessionId = existing.sessionId;
            session = await client.resumeSession(sessionId, sessionOpts);
        } else {
            sessionId = `ado-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            session = await client.createSession({ sessionId, ...sessionOpts });
            setSession(key, sessionId);
        }

        const attachmentPayload = await materializeAttachments(attachments);
        tempAttachmentDir = attachmentPayload.tempDir;
        const prompt = buildPromptWithKnowledgeBase(message, knowledgeBase);
        const response = await session.sendAndWait({ prompt, attachments: attachmentPayload.sdkAttachments }, 300_000);
        const duration = Date.now() - startTime;

        const content = response?.data?.content || "";
        log.answer(sessionId, content.length);
        log.complete(sessionId, duration);

        await session.destroy();
        await client.stop();
        if (tempAttachmentDir) {
            await rm(tempAttachmentDir, { recursive: true, force: true });
        }

        res.json({ content, sessionId });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        log.error(`Sync chat error: ${errorMessage}`);

        const key = tokenKey(githubToken);
        deleteSession(key);

        try { if (session) await session.destroy(); } catch { /* ignore */ }
        try { if (client) await client.stop(); } catch { /* ignore */ }
        try { if (tempAttachmentDir) await rm(tempAttachmentDir, { recursive: true, force: true }); } catch { /* ignore */ }

        res.status(500).json({ error: errorMessage });
    }
});
