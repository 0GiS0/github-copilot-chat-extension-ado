// Configuration for the proxy server
const PROXY_BASE_URL = "http://localhost:3001";

// Callback types for streaming content
export type StreamCallback = (deltaContent: string) => void;
export type CompleteCallback = (fullContent: string) => void;
export type ErrorCallback = (error: Error) => void;

interface SSEEvent {
    type: "delta" | "complete" | "error";
    content?: string;
    error?: string;
}

class CopilotService {
    private sessionId: string;
    private isInitialized = false;
    private language = "es"; // Default language

    constructor() {
        // Generate a unique session ID for this browser session
        this.sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Set the language for Copilot responses
     */
    setLanguage(langCode: string): void {
        this.language = langCode;
        console.log(`[CopilotService] Language set to: ${langCode}`);
        // Destroy current session to create a new one with the new language
        this.destroySession();
    }

    /**
     * Get current language
     */
    getLanguage(): string {
        return this.language;
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

            const health = await response.json();

            if (!health.copilotConnected) {
                throw new Error("Proxy server is not connected to Copilot CLI");
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
     * Send a message and receive streaming response via Server-Sent Events
     */
    async sendMessage(
        prompt: string,
        onDelta: StreamCallback,
        onComplete: CompleteCallback,
        onError: ErrorCallback
    ): Promise<void> {
        try {
            const response = await fetch(`${PROXY_BASE_URL}/chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: prompt,
                    sessionId: this.sessionId,
                    language: this.language,
                }),
            });

            if (!response.ok) {
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
                                case "delta":
                                    if (event.content) {
                                        fullContent += event.content;
                                        onDelta(event.content);
                                    }
                                    break;

                                case "complete":
                                    onComplete(event.content || fullContent);
                                    return;

                                case "error":
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
    async sendAndWait(prompt: string): Promise<string> {
        const response = await fetch(`${PROXY_BASE_URL}/chat/sync`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message: prompt,
                sessionId: this.sessionId,
            }),
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();
        return data.content || "";
    }

    /**
     * Destroy the current session on the server
     */
    async destroySession(): Promise<void> {
        try {
            await fetch(`${PROXY_BASE_URL}/session/${this.sessionId}`, {
                method: "DELETE",
            });
            console.log("[CopilotService] Session destroyed");
        } catch (error) {
            console.warn("[CopilotService] Failed to destroy session:", error);
        }
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
    getSessionId(): string {
        return this.sessionId;
    }
}

// Export a singleton instance
export const copilotService = new CopilotService();
