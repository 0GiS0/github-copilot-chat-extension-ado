import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import chalk from "chalk";
import { CopilotClient, CopilotSession, type SessionEvent } from "@github/copilot-sdk";

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

    // Banner
    banner: () => {
        console.log("");
        console.log(chalk.cyan("╔═══════════════════════════════════════════════════════════╗"));
        console.log(chalk.cyan("║") + chalk.white.bold("   🚀 Copilot Proxy Server                                 ") + chalk.cyan("║"));
        console.log(chalk.cyan("║") + chalk.gray("   Bridging Azure DevOps Extension with GitHub Copilot     ") + chalk.cyan("║"));
        console.log(chalk.cyan("╚═══════════════════════════════════════════════════════════╝"));
        console.log("");
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3001;

// ─────────────────────────────────────────────────────────────────────────────
// 🔧 CLI Mode Configuration (set via CLI_MODE env var or .env file)
// ─────────────────────────────────────────────────────────────────────────────
// CLI_MODE=local  → SDK spawns and manages CLI process
// CLI_MODE=remote → Connects to external CLI server (requires COPILOT_CLI_URL)
// ─────────────────────────────────────────────────────────────────────────────
const USE_LOCAL_CLI = process.env.CLI_MODE !== "remote";
const COPILOT_CLI_URL = process.env.COPILOT_CLI_URL || "localhost:4321";
// ─────────────────────────────────────────────────────────────────────────────

const app = express();

// Middleware
app.use(cors({
    origin: true, // Allow all origins in development
    credentials: true,
}));
app.use(express.json());

// Copilot client singleton
let copilotClient: CopilotClient | null = null;
let isClientReady = false;

// Session storage (in production, use proper session management)
const sessions = new Map<string, CopilotSession>();

/**
 * Initialize Copilot client
 */
async function initializeCopilotClient(): Promise<void> {
    if (copilotClient && isClientReady) {
        return;
    }

    try {
        if (USE_LOCAL_CLI) {
            // Local mode: SDK spawns and manages the CLI process
            log.info("Iniciando Copilot CLI en modo local...");
            copilotClient = new CopilotClient({
                // No cliUrl = SDK spawns CLI locally
                autoStart: true,
                autoRestart: true,
            });
        } else {
            // Remote mode: Connect to external CLI server
            const cliUrl = process.env.COPILOT_CLI_URL || "localhost:4321";
            log.info(`Conectando a CLI remoto en ${chalk.cyan(cliUrl)}...`);
            copilotClient = new CopilotClient({
                cliUrl: cliUrl,
            });
        }

        await copilotClient.start();
        isClientReady = true;

        if (USE_LOCAL_CLI) {
            log.copilot("CLI local iniciado y listo ✨");
        } else {
            log.copilot(`Conectado a CLI remoto`);
        }
    } catch (error) {
        log.error(`No se pudo iniciar Copilot CLI: ${error}`);
        throw error;
    }
}

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

function getSystemMessage(language: string): string {
    const langPrompt = LANGUAGE_PROMPTS[language] || LANGUAGE_PROMPTS["en"];
    return `Eres un asistente experto en Azure DevOps integrado con GitHub Copilot. 
Ayudas a los usuarios con:
- Configuración y gestión de proyectos en Azure DevOps
- Creación y optimización de pipelines CI/CD
- Gestión de work items, sprints y backlogs
- Mejores prácticas para Azure Repos y code reviews
- Seguridad y permisos en Azure DevOps
- Automatización y extensiones

${langPrompt} Usa emojis cuando sea apropiado para hacer las respuestas más amigables.`;
}

/**
 * Create or get a session for a user
 */
async function getOrCreateSession(sessionId: string, language = "es"): Promise<CopilotSession> {
    if (!copilotClient || !isClientReady) {
        await initializeCopilotClient();
    }

    if (!copilotClient) {
        throw new Error("Copilot client not initialized");
    }

    let session = sessions.get(sessionId);

    if (!session) {
        session = await copilotClient.createSession({
            model: "gpt-4.1",
            streaming: true,
            systemMessage: {
                content: getSystemMessage(language),
            },
            mcpServers: {
                ado: {
                    "type": "local",
                    "command": "npx",
                    "tools": [
                        "*"
                    ],
                    "args": [
                        "-y",
                        "@azure-devops/mcp",
                        "returngisorg",
                        "--authentication",
                        "envvar"
                    ],
                    "env": {
                        "ADO_MCP_AUTH_TOKEN": "${ADO_MCP_AUTH_TOKEN}"
                    }
                }
            }
        });
        sessions.set(sessionId, session);
        log.session("created", sessionId);
        log.info(`Idioma configurado: ${chalk.cyan(language.toUpperCase())}`);
    }

    return session;
}

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
    log.request("GET", "/health");
    res.json({
        status: "ok",
        copilotConnected: isClientReady,
        activeSessions: sessions.size,
    });
});

// Chat endpoint with Server-Sent Events for streaming
app.post("/chat", async (req: Request, res: Response) => {
    const { message, sessionId = "default", language = "es" } = req.body;
    const startTime = Date.now();

    log.request("POST", "/chat");
    log.question(sessionId, message);

    if (!message) {
        log.warn("Mensaje vacío recibido");
        res.status(400).json({ error: "Message is required" });
        return;
    }

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
    res.flushHeaders();

    try {
        const session = await getOrCreateSession(sessionId, language);
        log.streaming(sessionId);

        let fullContent = "";
        let chunkCount = 0;

        // Set up event handler for this request
        const eventHandler = (event: SessionEvent) => {
            switch (event.type) {
                case "assistant.message_delta":
                    const delta = event.data.deltaContent || "";
                    fullContent += delta;
                    chunkCount++;
                    // Send SSE event
                    res.write(`data: ${JSON.stringify({ type: "delta", content: delta })}\n\n`);
                    break;

                case "session.idle":
                    // Log completion
                    const duration = Date.now() - startTime;
                    log.answer(sessionId, fullContent.length);
                    log.complete(sessionId, duration);
                    log.debug(`Chunks: ${chunkCount} | Chars: ${fullContent.length}`);

                    // Send completion event
                    res.write(`data: ${JSON.stringify({ type: "complete", content: fullContent })}\n\n`);
                    res.write("data: [DONE]\n\n");
                    res.end();
                    break;

                case "session.error":
                    log.error(`Error en sesión ${sessionId}: ${event.data?.message}`);
                    res.write(`data: ${JSON.stringify({ type: "error", error: event.data?.message || "Unknown error" })}\n\n`);
                    res.end();
                    break;
            }
        };

        session.on(eventHandler);

        // Send message
        await session.send({ prompt: message });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        log.error(`Chat error: ${errorMessage}`);
        res.write(`data: ${JSON.stringify({ type: "error", error: errorMessage })}\n\n`);
        res.end();
    }
});

// Non-streaming chat endpoint (for simpler clients)
app.post("/chat/sync", async (req: Request, res: Response) => {
    const { message, sessionId = "default", language = "es" } = req.body;
    const startTime = Date.now();

    log.request("POST", "/chat/sync");
    log.question(sessionId, message);

    if (!message) {
        log.warn("Mensaje vacío recibido");
        res.status(400).json({ error: "Message is required" });
        return;
    }

    try {
        const session = await getOrCreateSession(sessionId, language);
        const response = await session.sendAndWait({ prompt: message });
        const duration = Date.now() - startTime;

        const content = response?.data.content || "";
        log.answer(sessionId, content.length);
        log.complete(sessionId, duration);

        res.json({
            content,
            sessionId,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        log.error(`Sync chat error: ${errorMessage}`);
        res.status(500).json({ error: errorMessage });
    }
});

// Delete session endpoint
app.delete("/session/:sessionId", async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    log.request("DELETE", `/session/${sessionId}`);

    const session = sessions.get(sessionId);
    if (session) {
        await session.destroy();
        sessions.delete(sessionId);
        log.session("destroyed", sessionId);
    }

    res.json({ success: true });
});

// Start server
app.listen(PORT, async () => {
    log.banner();
    log.server(`Servidor ejecutándose en ${chalk.cyan(`http://localhost:${PORT}`)}`);

    if (USE_LOCAL_CLI) {
        log.info("Modo: CLI Local (SDK gestiona el proceso)");
    } else {
        const cliUrl = process.env.COPILOT_CLI_URL || "localhost:4321";
        log.info(`Modo: CLI Remoto (${chalk.cyan(cliUrl)})`);
    }

    try {
        await initializeCopilotClient();
        log.success("¡Listo para recibir peticiones! 🎉");
    } catch (error) {
        if (USE_LOCAL_CLI) {
            log.warn("No se pudo iniciar el CLI local. Verifica la instalación:");
            log.info(chalk.yellow("  npm install -g @anthropic-ai/claude-code"));
        } else {
            log.warn("No se pudo conectar a Copilot CLI. Asegúrate de que esté ejecutándose:");
            log.info(chalk.yellow("  copilot --server --port 4321"));
        }
    }
});

// Graceful shutdown
process.on("SIGINT", async () => {
    console.log("");
    log.warn("Apagando servidor...");

    // Destroy all sessions
    const sessionEntries = Array.from(sessions.entries());
    for (const [id, session] of sessionEntries) {
        await session.destroy();
        log.session("destroyed", id);
    }

    // Stop client
    if (copilotClient) {
        await copilotClient.stop();
        log.copilot("Cliente detenido");
    }

    log.success("¡Hasta pronto! 👋");
    process.exit(0);
});
