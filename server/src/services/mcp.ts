/**
 * 🔧 MCP server configuration builder.
 *
 * Returns the MCP servers config object consumed by CopilotClient sessions.
 */
import { config } from "../config.js";

export function getMcpConfig(adoToken?: string, adoOrgName?: string) {
    const resolvedOrg = (adoOrgName || config.adoOrg || "").trim();
    if (!resolvedOrg) {
        return {};
    }

    return {
        ado: {
            type: "local" as const,
            command: "npx",
            tools: ["*"],
            args: [
                "-y",
                "@azure-devops/mcp",
                resolvedOrg,
                "--authentication",
                "envvar",
            ],
            env: {
                ADO_MCP_AUTH_TOKEN: adoToken || config.adoMcpAuthToken,
            },
        },
    };
}
