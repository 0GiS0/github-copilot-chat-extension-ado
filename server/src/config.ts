/**
 * ⚙️ Server configuration — reads from environment variables.
 *
 * All configurable values live here so they are easy to find and override.
 * Sensitive defaults are intentionally left empty to force explicit configuration.
 */
import "dotenv/config";

export const config = {
    /** HTTP port the server listens on */
    port: process.env.PORT || 3001,

    /** GitHub OAuth App client ID (required for Device Flow auth) */
    githubClientId: process.env.GITHUB_CLIENT_ID || "",

    /** Azure DevOps organization name (e.g. "myorg") — used by MCP and az CLI tools */
    adoOrg: process.env.ADO_ORG || "",

    /** Azure DevOps MCP auth token (fallback when per-user token is not available) */
    adoMcpAuthToken: process.env.ADO_MCP_AUTH_TOKEN || "",

    /** Session time-to-live in milliseconds (default 30 min) */
    sessionTtlMs: 30 * 60 * 1000,

    /** How often to check for stale sessions (default 5 min) */
    sessionCleanupIntervalMs: 5 * 60 * 1000,

    /** Full Azure DevOps organization URL */
    get adoOrgUrl(): string {
        return `https://dev.azure.com/${this.adoOrg}`;
    },
} as const;
