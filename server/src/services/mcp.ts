/**
 * 🔧 MCP server configuration builder.
 *
 * Returns the MCP servers config object consumed by CopilotClient sessions.
 */
import { config } from "../config.js";

export function getMcpConfig(adoToken?: string) {
    return {
        ado: {
            type: "local" as const,
            command: "npx",
            tools: ["*"],
            args: [
                "-y",
                "@azure-devops/mcp",
                config.adoOrg,
                "--authentication",
                "envvar",
            ],
            env: {
                ADO_MCP_AUTH_TOKEN: adoToken || config.adoMcpAuthToken,
            },
        },
    };
}
