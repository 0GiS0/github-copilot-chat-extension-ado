/**
 * 🏥 Health check route — /health
 */
import { Router, Request, Response } from "express";
import { config } from "../config.js";
import { log } from "../logger.js";

export const healthRouter = Router();

healthRouter.get("/", (_req: Request, res: Response) => {
    log.request("GET", "/health");
    res.json({
        status: "ok",
        authMode: "per-user-github-token",
        githubClientIdConfigured: !!config.githubClientId,
    });
});
