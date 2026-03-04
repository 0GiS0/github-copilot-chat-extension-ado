/**
 * 🔑 GitHub OAuth Device Flow routes — /auth/*
 */
import { Router, Request, Response } from "express";
import { config } from "../config.js";
import { log } from "../logger.js";
import { getGitHubToken } from "../middleware/auth.js";

export const authRouter = Router();

/**
 * POST /auth/device-code
 * Initiate GitHub OAuth Device Flow.
 */
authRouter.post("/device-code", async (_req: Request, res: Response) => {
    log.request("POST", "/auth/device-code");

    if (!config.githubClientId) {
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
                client_id: config.githubClientId,
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
 * POST /auth/poll-token
 * Poll for the GitHub OAuth token after user has entered the device code.
 */
authRouter.post("/poll-token", async (req: Request, res: Response) => {
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
                client_id: config.githubClientId,
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
 * GET /auth/verify
 * Verify a GitHub token is valid by fetching the user profile.
 */
authRouter.get("/verify", async (req: Request, res: Response) => {
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
