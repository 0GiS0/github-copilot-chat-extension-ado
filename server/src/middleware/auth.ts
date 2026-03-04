/**
 * 🔐 Authentication middleware — extracts and validates tokens from request headers.
 */
import { Request } from "express";

/**
 * Extract the GitHub token from the `X-GitHub-Token` request header.
 * Returns `null` when the header is missing.
 */
export function getGitHubToken(req: Request): string | null {
    return (req.headers["x-github-token"] as string) || null;
}

/**
 * Derive a short key from a token (used as a Map key to avoid storing full tokens).
 */
export function tokenKey(token: string): string {
    return token.substring(0, 16);
}
