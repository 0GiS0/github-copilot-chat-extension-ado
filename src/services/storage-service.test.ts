import {
    storageService,
    IChatHistoryStorageContext,
} from "./storage-service";

describe("storageService", () => {
    const context: IChatHistoryStorageContext = {
        orgName: "returngisorg",
        projectId: "project-123",
        projectName: "Demo",
        userId: "user-456",
    };

    beforeEach(() => {
        localStorage.clear();
    });

    it("saves and restores chat history for the same user and project", () => {
        storageService.saveChatHistory(context, {
            messages: [
                {
                    id: "welcome",
                    role: "assistant",
                    content: "Hello there",
                    timestamp: "2026-07-04T14:00:00.000Z",
                },
            ],
            selectedLanguageCode: "en",
            selectedModel: "model-a",
            sessionId: "session-1",
        });

        expect(storageService.loadChatHistory(context)).toEqual({
            messages: [
                {
                    id: "welcome",
                    role: "assistant",
                    content: "Hello there",
                    timestamp: "2026-07-04T14:00:00.000Z",
                },
            ],
            selectedLanguageCode: "en",
            selectedModel: "model-a",
            sessionId: "session-1",
        });
    });

    it("keeps histories isolated by project and user", () => {
        storageService.saveChatHistory(context, {
            messages: [],
            selectedLanguageCode: "en",
            selectedModel: "model-a",
            sessionId: null,
        });

        expect(storageService.loadChatHistory({
            ...context,
            projectId: "project-999",
        })).toBeNull();
        expect(storageService.loadChatHistory({
            ...context,
            userId: "other-user",
        })).toBeNull();
    });

    it("clears a saved history entry", () => {
        storageService.saveChatHistory(context, {
            messages: [],
            selectedLanguageCode: "en",
            selectedModel: "model-a",
            sessionId: null,
        });

        storageService.clearChatHistory(context);

        expect(storageService.loadChatHistory(context)).toBeNull();
    });
});
