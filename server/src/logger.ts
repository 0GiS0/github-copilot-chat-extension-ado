/**
 * 🎨 Logger utility with colors and emojis.
 *
 * Provides structured, colour-coded console output so server activity
 * is easy to follow at a glance.
 */
import chalk from "chalk";

export const log = {
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
    },
};
