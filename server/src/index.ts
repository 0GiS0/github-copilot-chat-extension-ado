import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import chalk from "chalk";
import { quickstartsExpertAgent } from "./agents/index.js";
import { createAdoProjectTools } from "./tools/index.js";

// @github/copilot-sdk is ESM-only; we lazy-load with dynamic import().
let _CopilotClient: any;
let _approveAll: any;
async function getCopilotClient(): Promise<any> {
    if (!_CopilotClient) {
        const sdk = await import("@github/copilot-sdk");
        _CopilotClient = sdk.CopilotClient;
        _approveAll = sdk.approveAll;
    }
    return _CopilotClient;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 Logger utility with colors and emojis
// ═══════════════════════════════════════════════════════════════════════════════

const log = {
    info: (msg: string) => console.log(chalk.blue("ℹ️  INFO  │") + " " + msg),
    success: (msg: string) => console.log(chalk.green("✅ OK    │") + " " + msg),
    warn: (msg: string) => console.log(chalk.yellow("⚠️  WARN  │") + " " + msg),
    error: (msg: string) => console.log(chalk.red("❌ ERROR │") + " " + msg),
    debug: (msg: string) => console.log(chalk.gray("🔍 DEBUG │") + " " + msg),

    // Chat-specific logs
    question: (sessionId: string, msg: string) => {
        const truncated = msg.length > 80 ? msg.substring(0, 80) + "..." : msg;
        console.log(chalk.cyan("💬 ASK   │") + " " + chalk.dim(`[${sessionId}]`) + " " + chalk.white(truncated));
    },
    answer: (sessionId: string, tokens: number) => {
        console.log(chalk.magenta("🤖 REPLY │") + " " + chalk.dim(`[${sessionId}]`) + " " + chalk.white(`${tokens} caracteres generados`));
    },
    streaming: (sessionId: string) => {
        console.log(chalk.yellow("📡 STREAM│") + " " + chalk.dim(`[${sessionId}]`) + " " + chalk.white("Streaming respuesta..."));
    },
    complete: (sessionId: string, duration: number) => {
        console.log(chalk.green("✨ DONE  │") + " " + chalk.dim(`[${sessionId}]`) + " " + chalk.white(`Completado en ${duration}ms`));
    },

    // Server lifecycle
    server: (msg: string) => console.log(chalk.bgBlue.white(" SERVER ") + " " + msg),
    copilot: (msg: string) => console.log(chalk.bgMagenta.white(" COPILOT ") + " " + msg),
    session: (action: string, sessionId: string) => {
        const icon = action === "created" ? "🆕" : action === "destroyed" ? "🗑️" : "📋";
        console.log(chalk.bgCyan.black(` SESSION `) + ` ${icon} ${action}: ${chalk.dim(sessionId)}`);
    },

    // Request logging
    request: (method: string, path: string) => {
        const methodColor = method === "GET" ? chalk.green : method === "POST" ? chalk.blue : chalk.yellow;
        console.log(chalk.gray("→ ") + methodColor(method.padEnd(6)) + " " + path);
    },

    // Auth logging
    auth: (msg: string) => console.log(chalk.bgGreen.black(" AUTH ") + " " + msg),

    // Banner
    banner: () => {
        console.log("");
        console.log(chalk.cyan("╔═══════════════════════════════════════════════════════════╗"));
        console.log(chalk.cyan("║") + chalk.white.bold("   🚀 Copilot Proxy Server                                 ") + chalk.cyan("║"));
        console.log(chalk.cyan("║") + chalk.gray("   Bridging Azure DevOps Extension with GitHub Copilot     ") + chalk.cyan("║"));
        console.log(chalk.cyan("║") + chalk.green("   🔐 Per-user GitHub authentication                       ") + chalk.cyan("║"));
        console.log(chalk.cyan("╚═══════════════════════════════════════════════════════════╝"));
        console.log("");
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3001;
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "";

const app = express();

// Middleware
app.use(cors({
    origin: true, // Allow all origins in development
    credentials: true,
}));
app.use(express.json());

// ═══════════════════════════════════════════════════════════════════════════════
// � Per-user session management
// ═══════════════════════════════════════════════════════════════════════════════

// We store only the sessionId per user — the CopilotClient is created fresh
// per HTTP request (and destroyed after), matching the SDK's intended pattern.
// Session continuity (conversation context) is maintained by the SDK server-side
// via the sessionId; the local client is just a thin wrapper.
const userSessionIds = new Map<string, { sessionId: string; lastActivity: number }>();

// Simple hash to use as map key (avoid storing full tokens)
function tokenKey(token: string): string {
    return token.substring(0, 16);
}

// Cleanup stale session IDs after 30 minutes
const SESSION_TTL_MS = 30 * 60 * 1000;
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of userSessionIds.entries()) {
        if (now - entry.lastActivity > SESSION_TTL_MS) {
            log.info(`Cleaning up stale session ID for user ${key.substring(0, 6)}...`);
            userSessionIds.delete(key);
        }
    }
}, 5 * 60 * 1000); // Check every 5 minutes

function getMcpConfig(adoToken?: string) {
    return {
        ado: {
            type: "local" as const,
            command: "npx",
            tools: ["*"],
            args: [
                "-y",
                "@azure-devops/mcp",
                "returngisorg",
                "--authentication",
                "envvar",
            ],
            env: {
                ADO_MCP_AUTH_TOKEN: adoToken || process.env.ADO_MCP_AUTH_TOKEN || "",
            },
        },
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// �🔐 GitHub OAuth Device Flow endpoints
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Initiate GitHub OAuth Device Flow.
 * Returns device_code, user_code, and verification_uri for the user to authenticate.
 */
app.post("/auth/device-code", async (_req: Request, res: Response) => {
    log.request("POST", "/auth/device-code");

    if (!GITHUB_CLIENT_ID) {
        log.error("GITHUB_CLIENT_ID not configured");
        res.status(500).json({ error: "GitHub OAuth App not configured. Set GITHUB_CLIENT_ID in .env" });
        return;
    }

    try {
        const response = await fetch("https://github.com/login/device/code", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            body: JSON.stringify({
                client_id: GITHUB_CLIENT_ID,
                scope: "read:user copilot",
            }),
        });

        if (!response.ok) {
            throw new Error(`GitHub returned ${response.status}`);
        }

        const data = await response.json() as {
            device_code: string;
            user_code: string;
            verification_uri: string;
            expires_in: number;
            interval: number;
        };

        log.auth(`Device code generated: ${data.user_code}`);
        res.json({
            deviceCode: data.device_code,
            userCode: data.user_code,
            verificationUri: data.verification_uri,
            expiresIn: data.expires_in,
            interval: data.interval,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        log.error(`Device code error: ${errorMessage}`);
        res.status(500).json({ error: "Failed to initiate GitHub authentication" });
    }
});

/**
 * Poll for the GitHub OAuth token after user has entered the device code.
 */
app.post("/auth/poll-token", async (req: Request, res: Response) => {
    log.request("POST", "/auth/poll-token");

    const { deviceCode } = req.body;

    if (!deviceCode) {
        res.status(400).json({ error: "deviceCode is required" });
        return;
    }

    try {
        const response = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            body: JSON.stringify({
                client_id: GITHUB_CLIENT_ID,
                device_code: deviceCode,
                grant_type: "urn:ietf:params:oauth:grant-type:device_code",
            }),
        });

        if (!response.ok) {
            throw new Error(`GitHub returned ${response.status}`);
        }

        const data = await response.json() as {
            access_token?: string;
            token_type?: string;
            scope?: string;
            error?: string;
            error_description?: string;
            interval?: number;
        };

        // Debug: log the full response from GitHub (masking token)
        log.debug(`GitHub poll response: ${JSON.stringify({
            ...data,
            access_token: data.access_token ? `${data.access_token.substring(0, 8)}...` : undefined,
        })}`);

        if (data.error) {
            // "authorization_pending" is expected while user hasn't authorized yet
            if (data.error === "authorization_pending") {
                log.debug("Poll: authorization_pending (user hasn't authorized yet)");
                res.json({ status: "pending" });
            } else if (data.error === "slow_down") {
                const newInterval = data.interval || 10;
                log.debug(`Poll: slow_down (new interval: ${newInterval}s)`);
                res.json({ status: "slow_down", interval: newInterval });
            } else if (data.error === "expired_token") {
                log.warn("Poll: device code expired");
                res.json({ status: "expired" });
            } else {
                log.error(`OAuth error: ${data.error} - ${data.error_description}`);
                res.json({ status: "error", error: data.error_description || data.error });
            }
            return;
        }

        if (data.access_token) {
            log.auth(`GitHub token obtained successfully ✨ (scope: ${data.scope || 'none'}, type: ${data.token_type || 'unknown'})`);
            res.json({
                status: "complete",
                accessToken: data.access_token,
            });
        } else {
            log.error(`Unexpected GitHub response (no token, no error): ${JSON.stringify(data)}`);
            res.json({ status: "error", error: "No access token in response" });
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        log.error(`Poll token error: ${errorMessage}`);
        res.status(500).json({ error: "Failed to poll GitHub token" });
    }
});

/**
 * Verify a GitHub token is valid by fetching the user profile.
 */
app.get("/auth/verify", async (req: Request, res: Response) => {
    log.request("GET", "/auth/verify");

    const githubToken = getGitHubToken(req);
    if (!githubToken) {
        res.status(401).json({ error: "Missing X-GitHub-Token header" });
        return;
    }

    try {
        const response = await fetch("https://api.github.com/user", {
            headers: {
                "Authorization": `Bearer ${githubToken}`,
                "Accept": "application/vnd.github+json",
                "User-Agent": "copilot-ado-extension",
            },
        });

        if (!response.ok) {
            log.error(`Token verification failed: GitHub returned ${response.status}`);
            res.status(401).json({ error: "Invalid GitHub token", githubStatus: response.status });
            return;
        }

        const user = await response.json() as { login: string; name: string; avatar_url: string };
        log.auth(`Token verified for user: ${user.login} (${user.name})`);
        res.json({
            valid: true,
            login: user.login,
            name: user.name,
            avatarUrl: user.avatar_url,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        log.error(`Token verification error: ${errorMessage}`);
        res.status(500).json({ error: "Failed to verify token" });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🌍 Language configuration for system messages
// ═══════════════════════════════════════════════════════════════════════════════

const LANGUAGE_PROMPTS: { [key: string]: string } = {
    es: "Responde siempre en español de forma clara y concisa.",
    en: "Always respond in English in a clear and concise manner.",
    fr: "Réponds toujours en français de manière claire et concise.",
    de: "Antworte immer auf Deutsch klar und präzise.",
    pt: "Responda sempre em português de forma clara e concisa.",
    zh: "请始终用中文清晰简洁地回答。",
    ja: "常に日本語で明確かつ簡潔に回答してください。",
    it: "Rispondi sempre in italiano in modo chiaro e conciso.",
};

interface AdoContext {
    orgName: string;
    projectName: string | null;
    projectId: string | null;
    teamName: string | null;
    teamId: string | null;
}

function getSystemMessage(language: string, adoContext?: AdoContext): string {
    const langPrompt = LANGUAGE_PROMPTS[language] || LANGUAGE_PROMPTS["en"];

    // Build context section if available
    let contextSection = "";
    if (adoContext) {
        const parts: string[] = [];
        parts.push(`- **Organización:** ${adoContext.orgName}`);
        if (adoContext.projectName) {
            parts.push(`- **Proyecto actual:** ${adoContext.projectName} (ID: ${adoContext.projectId})`);
        }
        if (adoContext.teamName) {
            parts.push(`- **Equipo actual:** ${adoContext.teamName}`);
        }
        contextSection = `\n\n## Contexto de navegación del usuario\n\nEl usuario está navegando actualmente en:\n${parts.join("\n")}\n\nCuando el usuario pregunte sobre "este proyecto", "el proyecto actual", "dónde estoy" o similares, usa esta información para dar respuestas contextualizadas. Puedes usar las herramientas de Azure DevOps para obtener más detalles del proyecto si es necesario.`;
    }

    return `Eres un asistente experto en Azure DevOps integrado con GitHub Copilot. 
Ayudas a los usuarios con:
- Configuración y gestión de proyectos en Azure DevOps
- Creación y optimización de pipelines CI/CD
- Gestión de work items, sprints y backlogs
- Mejores prácticas para Azure Repos y code reviews
- Seguridad y permisos en Azure DevOps
- Automatización y extensiones${contextSection}

## REGLA CRÍTICA — Creación de proyectos y Quickstarts

La organización (returngisorg) tiene un proyecto llamado **"Quickstarts"** en Azure DevOps que contiene repositorios plantilla para diferentes tecnologías.

**Cuando un usuario quiera crear un nuevo proyecto o pregunte por plantillas/templates:**
1. **SIEMPRE** usa las herramientas MCP de Azure DevOps para listar los repositorios del proyecto "Quickstarts" ANTES de responder.
2. **NUNCA** sugieras crear un proyecto desde cero. Todo nuevo proyecto DEBE basarse en una plantilla del proyecto Quickstarts.
3. Si no hay un Quickstart adecuado, muestra los que hay disponibles, sugiere el más cercano y recomienda crear primero un nuevo Quickstart.
4. El flujo obligatorio es: Entender necesidades → Listar Quickstarts disponibles → Recomendar plantilla → Confirmar selección → Usar las tools (create_ado_project → create_ado_repo → import_quickstart_repo) para crear el proyecto.

**Triggers para consultar Quickstarts:** cualquier mención de "plantilla", "template", "proyecto nuevo", "crear proyecto", "quickstart", "starter", "arrancar", "empezar un proyecto", o preguntas sobre qué tecnologías/frameworks están disponibles.

${langPrompt} Usa emojis cuando sea apropiado para hacer las respuestas más amigables.`;
}

/**
 * Extract and validate the GitHub token from request headers.
 */
function getGitHubToken(req: Request): string | null {
    return (req.headers["x-github-token"] as string) || null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📡 API Endpoints (per-user GitHub token)
// ═══════════════════════════════════════════════════════════════════════════════

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
    log.request("GET", "/health");
    res.json({
        status: "ok",
        authMode: "per-user-github-token",
        githubClientIdConfigured: !!GITHUB_CLIENT_ID,
    });
});

// ── GET /models ── List available Copilot models for the user
app.get("/models", async (req: Request, res: Response) => {
    log.request("GET", "/models");

    const githubToken = getGitHubToken(req);
    if (!githubToken) {
        res.status(401).json({ error: "Missing X-GitHub-Token header" });
        return;
    }

    try {
        const ClientClass = await getCopilotClient();
        const client = new ClientClass({ githubToken });
        await client.start();

        const models = await client.listModels();
        const available = models
            .filter((m: any) => m.policy?.state !== "disabled")
            .map((m: any) => ({
                id: m.id,
                name: m.name,
                premiumRequests: m.billing?.multiplier ?? 1,
            }));

        await client.stop();
        log.info(`[models] Listed ${available.length} available models`);
        res.json(available);
    } catch (err: any) {
        log.error(`[models] Failed to list models: ${err.message}`);
        res.status(500).json({ error: "Failed to list models" });
    }
});

// ── POST /chat ── Chat endpoint with SSE streaming (per-user token)
app.post("/chat", async (req: Request, res: Response) => {
    const githubToken = getGitHubToken(req);
    if (!githubToken) {
        res.status(401).json({ error: "Missing X-GitHub-Token header" });
        return;
    }

    const { message, language = "es", model: requestedModel, adoContext } = req.body;
    const adoToken = req.headers["x-ado-token"] as string | undefined;
    const startTime = Date.now();

    log.request("POST", "/chat");

    if (!message) {
        log.warn("Mensaje vacío recibido");
        res.status(400).json({ error: "Message is required" });
        return;
    }

    const model = requestedModel || "gpt-4.1";

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

    // Fresh client per request — avoids accumulated event listeners
    let client: any = null;
    let session: any = null;

    try {
        const key = tokenKey(githubToken);
        const existing = userSessionIds.get(key);
        const mcpConfig = getMcpConfig(adoToken);

        const ClientClass = await getCopilotClient();
        client = new ClientClass({ githubToken });
        await client.start();

        // Create per-request tools that capture the user's ADO token
        const adoTools = adoToken ? await createAdoProjectTools(adoToken) : [];

        let sessionId: string;
        let isNew: boolean;

        if (existing) {
            try {
                sessionId = existing.sessionId;
                session = await client.resumeSession(sessionId, {
                    model,
                    streaming: true,
                    onPermissionRequest: _approveAll,
                    systemMessage: { content: getSystemMessage(language, adoContext) },
                    mcpServers: mcpConfig,
                    customAgents: [quickstartsExpertAgent],
                    tools: adoTools,
                });
                existing.lastActivity = Date.now();
                isNew = false;
                log.session("resumed", sessionId);
            } catch (err) {
                log.warn(`Failed to resume session ${existing.sessionId}, creating new one`);
                userSessionIds.delete(key);
                // Create fresh session below
                sessionId = `ado-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                session = await client.createSession({
                    sessionId,
                    model,
                    streaming: true,
                    onPermissionRequest: _approveAll,
                    systemMessage: { content: getSystemMessage(language, adoContext) },
                    mcpServers: mcpConfig,
                    customAgents: [quickstartsExpertAgent],
                    tools: adoTools,
                });
                userSessionIds.set(key, { sessionId, lastActivity: Date.now() });
                isNew = true;
                log.session("created", sessionId);
            }
        } else {
            sessionId = `ado-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            session = await client.createSession({
                sessionId,
                model,
                streaming: true,
                onPermissionRequest: _approveAll,
                systemMessage: { content: getSystemMessage(language, adoContext) },
                mcpServers: mcpConfig,
                customAgents: [quickstartsExpertAgent],
                tools: adoTools,
            });
            userSessionIds.set(key, { sessionId, lastActivity: Date.now() });
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
            // Skip high-frequency delta events
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
            // Log full event data for debugging
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
        await session.sendAndWait({ prompt: message }, 300_000);

        completed = true;
        cleanupSubscriptions();
        req.off("close", onClose);

        const duration = Date.now() - startTime;
        log.answer(sessionId, fullContent.length);
        log.complete(sessionId, duration);
        log.debug(`Chunks: ${chunkCount} | Chars: ${fullContent.length}`);

        // Destroy session and stop client — session will be resumed by ID next time
        await session.destroy();
        await client.stop();

        res.write(`data: ${JSON.stringify({ type: "complete", content: fullContent })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        log.error(`Chat error: ${errorMessage}`);

        // On error, clean up and reset session so next request starts fresh
        const key = tokenKey(githubToken);
        userSessionIds.delete(key);

        try { if (session) await session.destroy(); } catch { /* ignore */ }
        try { if (client) await client.stop(); } catch { /* ignore */ }

        res.write(`data: ${JSON.stringify({ type: "error", error: errorMessage, resetSession: true })}\n\n`);
        res.end();
    }
});

// Non-streaming chat endpoint (for simpler clients)
app.post("/chat/sync", async (req: Request, res: Response) => {
    const githubToken = getGitHubToken(req);
    if (!githubToken) {
        res.status(401).json({ error: "Missing X-GitHub-Token header" });
        return;
    }

    const { message, sessionId = "default", language = "es", model: requestedModel, adoContext } = req.body;
    const startTime = Date.now();

    log.request("POST", "/chat/sync");
    log.question(sessionId, message);

    if (!message) {
        log.warn("Mensaje vacío recibido");
        res.status(400).json({ error: "Message is required" });
        return;
    }

    const model = requestedModel || "gpt-5.2";
    const adoToken = req.headers["x-ado-token"] as string | undefined;

    let client: any = null;
    let session: any = null;

    try {
        const key = tokenKey(githubToken);
        const existing = userSessionIds.get(key);
        const mcpConfig = getMcpConfig(adoToken);

        const ClientClass = await getCopilotClient();
        client = new ClientClass({ githubToken });
        await client.start();

        // Create per-request tools that capture the user's ADO token
        const adoTools = adoToken ? await createAdoProjectTools(adoToken) : [];

        let sessionId: string;

        if (existing) {
            sessionId = existing.sessionId;
            session = await client.resumeSession(sessionId, {
                model,
                streaming: true,
                onPermissionRequest: _approveAll,
                systemMessage: { content: getSystemMessage(language, adoContext) },
                mcpServers: mcpConfig,
                customAgents: [quickstartsExpertAgent],
                tools: adoTools,
            });
            existing.lastActivity = Date.now();
        } else {
            sessionId = `ado-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            session = await client.createSession({
                sessionId,
                model,
                streaming: true,
                onPermissionRequest: _approveAll,
                systemMessage: { content: getSystemMessage(language, adoContext) },
                mcpServers: mcpConfig,
                customAgents: [quickstartsExpertAgent],
                tools: adoTools,
            });
            userSessionIds.set(key, { sessionId, lastActivity: Date.now() });
        }

        const response = await session.sendAndWait({ prompt: message }, 300_000);
        const duration = Date.now() - startTime;

        const content = response?.data?.content || "";
        log.answer(sessionId, content.length);
        log.complete(sessionId, duration);

        await session.destroy();
        await client.stop();

        res.json({ content, sessionId });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        log.error(`Sync chat error: ${errorMessage}`);

        // Clean up and reset session on error
        const key = tokenKey(githubToken);
        userSessionIds.delete(key);

        try { if (session) await session.destroy(); } catch { /* ignore */ }
        try { if (client) await client.stop(); } catch { /* ignore */ }

        res.status(500).json({ error: errorMessage });
    }
});

// Start server
app.listen(PORT, () => {
    log.banner();
    log.server(`Servidor ejecutándose en ${chalk.cyan(`http://localhost:${PORT}`)}`);
    log.info(`Modo autenticación: ${chalk.green("Per-user GitHub token")}`);

    if (GITHUB_CLIENT_ID) {
        log.success(`GitHub OAuth App configurada (Client ID: ${chalk.cyan(GITHUB_CLIENT_ID.substring(0, 8))}...)`);
    } else {
        log.warn("GITHUB_CLIENT_ID no configurado. La autenticación Device Flow no funcionará.");
        log.info(chalk.yellow("  Configura GITHUB_CLIENT_ID en el archivo .env"));
    }

    log.success("¡Listo para recibir peticiones! 🎉");
});

// Graceful shutdown
process.on("SIGINT", async () => {
    console.log("");
    log.warn("Apagando servidor...");

    // Clear stored session IDs
    userSessionIds.clear();

    log.success("¡Hasta pronto! 👋");
    process.exit(0);
});
