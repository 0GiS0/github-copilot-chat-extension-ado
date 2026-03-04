/**
 * 🚀 Entry point — starts Express and mounts routers.
 *
 * All business logic lives in dedicated modules under routes/, services/,
 * middleware/, and prompts/.  This file only wires things together.
 */
import express from "express";
import cors from "cors";
import chalk from "chalk";

import { config } from "./config.js";
import { log } from "./logger.js";
import { startSessionCleanup, clearAllSessions } from "./services/sessions.js";

// Routes
import { authRouter } from "./routes/auth.js";
import { chatRouter } from "./routes/chat.js";
import { healthRouter } from "./routes/health.js";
import { modelsRouter } from "./routes/models.js";

const app = express();

// ── Global middleware ───────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// ── Mount routers ───────────────────────────────────────────────
app.use("/auth", authRouter);
app.use("/chat", chatRouter);
app.use("/health", healthRouter);
app.use("/models", modelsRouter);

// ── Session cleanup ─────────────────────────────────────────────
startSessionCleanup();

// ── Start server ────────────────────────────────────────────────
app.listen(config.port, () => {
    log.banner();
    log.server(`Servidor ejecutándose en ${chalk.cyan(`http://localhost:${config.port}`)}`);
    log.info(`Modo autenticación: ${chalk.green("Per-user GitHub token")}`);

    if (config.githubClientId) {
        log.success(`GitHub OAuth App configurada (Client ID: ${chalk.cyan(config.githubClientId.substring(0, 8))}...)`);
    } else {
        log.warn("GITHUB_CLIENT_ID no configurado. La autenticación Device Flow no funcionará.");
        log.info(chalk.yellow("  Configura GITHUB_CLIENT_ID en el archivo .env"));
    }

    if (config.adoOrg) {
        log.success(`Azure DevOps org: ${chalk.cyan(config.adoOrg)}`);
    } else {
        log.warn("ADO_ORG no configurado. Las herramientas de Azure DevOps no funcionarán.");
        log.info(chalk.yellow("  Configura ADO_ORG en el archivo .env"));
    }

    log.success("¡Listo para recibir peticiones! 🎉");
});

// ── Graceful shutdown ───────────────────────────────────────────
process.on("SIGINT", async () => {
    console.log("");
    log.warn("Apagando servidor...");
    clearAllSessions();
    log.success("¡Hasta pronto! 👋");
    process.exit(0);
});
