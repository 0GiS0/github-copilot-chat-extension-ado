export interface IChatHistoryStorageContext {
    orgName: string;
    projectId: string | null;
    projectName: string | null;
    userId: string;
}

export interface IStoredChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: string;
}

export interface IStoredChatHistory {
    messages: IStoredChatMessage[];
    selectedLanguageCode: string;
    selectedModel: string;
    sessionId: string | null;
}

interface IStoredChatHistoryRecord extends IStoredChatHistory {
    version: number;
}

const STORAGE_KEY_PREFIX = "copilot_chat_history";
const STORAGE_VERSION = 1;

class StorageService {
    public loadChatHistory(
        context: IChatHistoryStorageContext,
    ): IStoredChatHistory | null {
        try {
            const rawValue = localStorage.getItem(this.getStorageKey(context));
            if (!rawValue) {
                return null;
            }

            const parsedValue = JSON.parse(rawValue) as Partial<IStoredChatHistoryRecord>;
            if (
                parsedValue.version !== STORAGE_VERSION ||
                !Array.isArray(parsedValue.messages) ||
                typeof parsedValue.selectedLanguageCode !== "string" ||
                typeof parsedValue.selectedModel !== "string"
            ) {
                return null;
            }

            const messages = parsedValue.messages.filter(
                (message): message is IStoredChatMessage =>
                    typeof message?.id === "string" &&
                    (message.role === "user" || message.role === "assistant") &&
                    typeof message.content === "string" &&
                    typeof message.timestamp === "string",
            );

            return {
                messages,
                selectedLanguageCode: parsedValue.selectedLanguageCode,
                selectedModel: parsedValue.selectedModel,
                sessionId:
                    typeof parsedValue.sessionId === "string"
                        ? parsedValue.sessionId
                        : null,
            };
        } catch (error) {
            console.warn("[StorageService] Failed to load chat history:", error);
            return null;
        }
    }

    public saveChatHistory(
        context: IChatHistoryStorageContext,
        history: IStoredChatHistory,
    ): void {
        try {
            const payload: IStoredChatHistoryRecord = {
                version: STORAGE_VERSION,
                ...history,
            };

            localStorage.setItem(
                this.getStorageKey(context),
                JSON.stringify(payload),
            );
        } catch (error) {
            console.warn("[StorageService] Failed to save chat history:", error);
        }
    }

    public clearChatHistory(context: IChatHistoryStorageContext): void {
        try {
            localStorage.removeItem(this.getStorageKey(context));
        } catch (error) {
            console.warn("[StorageService] Failed to clear chat history:", error);
        }
    }

    private getStorageKey(context: IChatHistoryStorageContext): string {
        const projectKey = context.projectId || context.projectName || "organization";

        return [
            STORAGE_KEY_PREFIX,
            encodeURIComponent(context.orgName),
            encodeURIComponent(projectKey),
            encodeURIComponent(context.userId),
        ].join(":");
    }
}

export const storageService = new StorageService();
