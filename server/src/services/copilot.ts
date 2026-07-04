/**
 * 🧠 Copilot SDK runtime — lazy-loaded because @github/copilot-sdk is ESM-only.
 */

let _runtime: { CopilotClient: any; approveAll: any } | null = null;

export async function getCopilotRuntime(): Promise<{ CopilotClient: any; approveAll: any }> {
    if (!_runtime) {
        const sdk = await import("@github/copilot-sdk");
        _runtime = {
            CopilotClient: sdk.CopilotClient,
            approveAll: sdk.approveAll,
        };
    }

    return _runtime;
}
