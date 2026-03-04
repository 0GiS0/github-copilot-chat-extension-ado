/**
 * 🤖 Model listing route — /models
 */
import { Router, Request, Response } from "express";
import { log } from "../logger.js";
import { getGitHubToken } from "../middleware/auth.js";
import { getCopilotClient } from "../services/copilot.js";

export const modelsRouter = Router();

modelsRouter.get("/", async (req: Request, res: Response) => {
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
