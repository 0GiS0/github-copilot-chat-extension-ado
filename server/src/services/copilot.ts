/**
 * 🧠 Copilot SDK client — lazy-loaded because @github/copilot-sdk is ESM-only.
 */

let _CopilotClient: any;
let _approveAll: any;

export async function getCopilotClient(): Promise<any> {
    if (!_CopilotClient) {
        const sdk = await import("@github/copilot-sdk");
        _CopilotClient = sdk.CopilotClient;
        _approveAll = sdk.approveAll;
    }
    return _CopilotClient;
}

export async function getApproveAll(): Promise<any> {
    if (!_approveAll) {
        await getCopilotClient(); // triggers lazy load
    }
    return _approveAll;
}
