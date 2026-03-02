// Configuration for the proxy server
const PROXY_BASE_URL = "http://localhost:3001";

// Session storage key for GitHub token
const GITHUB_TOKEN_KEY = "copilot_github_token";

// Callback types for streaming content
export type StreamCallback = (deltaContent: string) => void;
export type CompleteCallback = (fullContent: string) => void;
export type ErrorCallback = (error: Error) => void;
export type ProgressCallback = (action: string, detail: string) => void;

interface SSEEvent {
    type: "session" | "delta" | "complete" | "error" | "progress";
    content?: string;
    error?: string;
    sessionId?: string;
    resetSession?: boolean;
    action?: string;
    tool?: string;
    agent?: string;
    success?: boolean;
}

interface DeviceCodeResponse {
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    expiresIn: number;
    interval: number;
}

interface PollTokenResponse {
    status: "pending" | "slow_down" | "expired" | "error" | "complete";
    accessToken?: string;
    error?: string;
    interval?: number;
}

export interface CopilotModel {
    id: string;
    name: string;
    premiumRequests: number;
}

class CopilotService {
    private sessionId: string | null = null;
    private isInitialized = false;
    private language = "es"; // Default language
    private githubToken: string | null = null;
    private adoToken: string | null = null;

    constructor() {
        // Try to restore token from sessionStorage
        this.githubToken = this.getStoredToken();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 🔐 GitHub Authentication (Device Flow)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Check if the user is authenticated with GitHub
     */
    isAuthenticated(): boolean {
        return !!this.githubToken;
    }

    /**
     * Get the stored GitHub token from sessionStorage
     */
    private getStoredToken(): string | null {
        try {
            return sessionStorage.getItem(GITHUB_TOKEN_KEY);
        } catch {
            return null;
        }
    }

    /**
     * Store the GitHub token in sessionStorage
     */
    private storeToken(token: string): void {
        try {
            sessionStorage.setItem(GITHUB_TOKEN_KEY, token);
        } catch {
            console.warn("[CopilotService] Failed to store token in sessionStorage");
        }
    }

    /**
     * Clear the stored GitHub token
     */
    clearToken(): void {
        this.githubToken = null;
        this.sessionId = null;
        try {
            sessionStorage.removeItem(GITHUB_TOKEN_KEY);
        } catch {
            // ignore
        }
    }

    /**
     * Set the GitHub token directly (e.g., if obtained externally)
     */
    setGitHubToken(token: string): void {
        this.githubToken = token;
        this.storeToken(token);
        this.sessionId = null; // Reset session for new token
        console.log("[CopilotService] GitHub token set");
    }

    /**
     * Get the current GitHub token
     */
    getGitHubToken(): string | null {
        return this.githubToken;
    }

    /**
     * Initiate GitHub Device Flow authentication.
     * Returns the device code info for the UI to display.
     */
    async initiateDeviceFlow(): Promise<DeviceCodeResponse> {
        const response = await fetch(`${PROXY_BASE_URL}/auth/device-code`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Server returned ${response.status}`);
        }

        return response.json();
    }

    /**
     * Poll for the GitHub token after user enters device code.
     * Returns the token when ready, null if still pending.
     */
    async pollForToken(deviceCode: string): Promise<PollTokenResponse> {
        const response = await fetch(`${PROXY_BASE_URL}/auth/poll-token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deviceCode }),
        });

        if (!response.ok) {
            console.error(`[CopilotService] poll-token returned ${response.status}`);
            throw new Error(`Server returned ${response.status}`);
        }

        const data: PollTokenResponse = await response.json();
        console.log(`[CopilotService] Poll result: status=${data.status}, hasToken=${!!data.accessToken}`);

        if (data.status === "complete" && data.accessToken) {
            console.log(`[CopilotService] Token received! Setting token...`);
            this.setGitHubToken(data.accessToken);
        }

        return data;
    }

    /**
     * Verify the current token is valid by calling GitHub API
     */
    async verifyToken(): Promise<{ valid: boolean; login?: string; name?: string; avatarUrl?: string }> {
        if (!this.githubToken) {
            return { valid: false };
        }

        try {
            const response = await fetch(`${PROXY_BASE_URL}/auth/verify`, {
                headers: this.getAuthHeaders(),
            });

            if (!response.ok) {
                console.warn(`[CopilotService] Token verification failed: ${response.status}`);
                this.clearToken();
                return { valid: false };
            }

            const data = await response.json();
            console.log(`[CopilotService] Token verified for: ${data.login}`);
            return data;
        } catch (error) {
            console.error("[CopilotService] Token verification error:", error);
            return { valid: false };
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 🌍 Language & Session
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Set the language for Copilot responses
     */
    setLanguage(langCode: string): void {
        this.language = langCode;
        console.log(`[CopilotService] Language set to: ${langCode}`);
        // Reset session to apply new language
        this.sessionId = null;
    }

    /**
     * Get current language
     */
    getLanguage(): string {
        return this.language;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 📡 API Methods
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Set the Azure DevOps access token
     */
    setAdoToken(token: string): void {
        this.adoToken = token;
        console.log("[CopilotService] ADO token set");
    }

    /**
     * Get auth headers including the user's GitHub token and ADO token
     */
    private getAuthHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (this.githubToken) {
            headers["X-GitHub-Token"] = this.githubToken;
        }
        if (this.adoToken) {
            headers["X-ADO-Token"] = this.adoToken;
        }
        return headers;
    }

    /**
     * Initialize the service by checking connection to the proxy server
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            const response = await fetch(`${PROXY_BASE_URL}/health`);

            if (!response.ok) {
                throw new Error(`Proxy server returned ${response.status}`);
            }

            this.isInitialized = true;
            console.log("[CopilotService] Connected to proxy server");
        } catch (error) {
            console.error("[CopilotService] Failed to connect to proxy:", error);
            throw new Error(
                `No se pudo conectar con el servidor proxy. Asegúrate de que esté ejecutándose: cd server && npm run dev`
            );
        }
    }

    /**
     * Fetch available Copilot models for the authenticated user
     */
    async fetchModels(): Promise<CopilotModel[]> {
        if (!this.githubToken) {
            throw new Error("Not authenticated with GitHub");
        }

        const response = await fetch(`${PROXY_BASE_URL}/models`, {
            headers: this.getAuthHeaders(),
        });

        if (!response.ok) {
            if (response.status === 401) {
                this.clearToken();
                throw new Error("GitHub token expired. Please re-authenticate.");
            }
            throw new Error(`Server returned ${response.status}`);
        }

        return response.json();
    }

    /**
     * Send a message and receive streaming response via Server-Sent Events
     */
    async sendMessage(
        prompt: string,
        onDelta: StreamCallback,
        onComplete: CompleteCallback,
        onError: ErrorCallback,
        model?: string,
        onProgress?: ProgressCallback
    ): Promise<void> {
        if (!this.githubToken) {
            onError(new Error("Not authenticated with GitHub. Please sign in first."));
            return;
        }

        try {
            const response = await fetch(`${PROXY_BASE_URL}/chat`, {
                method: "POST",
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    message: prompt,
                    sessionId: this.sessionId,
                    language: this.language,
                    model: model,
                }),
            });

            if (!response.ok) {
                if (response.status === 401) {
                    this.clearToken();
                    throw new Error("GitHub token expired. Please re-authenticate.");
                }
                throw new Error(`Server returned ${response.status}`);
            }

            if (!response.body) {
                throw new Error("No response body");
            }

            // Read the SSE stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let fullContent = "";

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                buffer += decoder.decode(value, { stream: true });

                // Process complete SSE events
                const lines = buffer.split("\n");
                buffer = lines.pop() || ""; // Keep incomplete line in buffer

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = line.slice(6).trim();

                        if (data === "[DONE]") {
                            onComplete(fullContent);
                            return;
                        }

                        try {
                            const event: SSEEvent = JSON.parse(data);

                            switch (event.type) {
                                case "session":
                                    // Store the session ID from the server
                                    if (event.sessionId) {
                                        this.sessionId = event.sessionId;
                                    }
                                    break;

                                case "delta":
                                    if (event.content) {
                                        fullContent += event.content;
                                        onDelta(event.content);
                                    }
                                    break;

                                case "complete":
                                    onComplete(event.content || fullContent);
                                    return;

                                case "progress":
                                    if (onProgress && event.action) {
                                        const detail = event.tool || event.agent || "";
                                        onProgress(event.action, detail);
                                    }
                                    break;

                                case "error":
                                    if (event.resetSession) {
                                        this.sessionId = null;
                                    }
                                    onError(new Error(event.error || "Unknown error"));
                                    return;
                            }
                        } catch (parseError) {
                            console.warn("[CopilotService] Failed to parse SSE event:", data);
                        }
                    }
                }
            }

            // If we get here without a complete event, call complete with what we have
            if (fullContent) {
                onComplete(fullContent);
            }
        } catch (error) {
            onError(error instanceof Error ? error : new Error(String(error)));
        }
    }

    /**
     * Send a message and wait for complete response (non-streaming)
     */
    async sendAndWait(prompt: string, model?: string): Promise<string> {
        if (!this.githubToken) {
            throw new Error("Not authenticated with GitHub");
        }

        const response = await fetch(`${PROXY_BASE_URL}/chat/sync`, {
            method: "POST",
            headers: this.getAuthHeaders(),
            body: JSON.stringify({
                message: prompt,
                sessionId: this.sessionId,
                language: this.language,
                model: model,
            }),
        });

        if (!response.ok) {
            if (response.status === 401) {
                this.clearToken();
                throw new Error("GitHub token expired. Please re-authenticate.");
            }
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();
        return data.content || "";
    }

    /**
     * Reset the current conversation session (e.g. when switching models)
     */
    resetSession(): void {
        this.sessionId = null;
        console.log("[CopilotService] Session reset");
    }

    /**
     * Check if the service is initialized
     */
    isReady(): boolean {
        return this.isInitialized;
    }

    /**
     * Get the current session ID
     */
    getSessionId(): string | null {
        return this.sessionId;
    }
}

// Export a singleton instance
export const copilotService = new CopilotService();
