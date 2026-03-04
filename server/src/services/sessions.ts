/**
 * 📋 Per-user session management.
 *
 * Stores only the sessionId per user — the CopilotClient is created fresh
 * per HTTP request (and destroyed after), matching the SDK's intended pattern.
 * Session continuity (conversation context) is maintained by the SDK server-side
 * via the sessionId; the local client is just a thin wrapper.
 */
import { config } from "../config.js";
import { log } from "../logger.js";

interface SessionEntry {
    sessionId: string;
    lastActivity: number;
}

const userSessionIds = new Map<string, SessionEntry>();

/** Retrieve the stored session entry for a user key, if it exists. */
export function getSession(key: string): SessionEntry | undefined {
    return userSessionIds.get(key);
}

/** Store or update a session entry. */
export function setSession(key: string, sessionId: string): void {
    userSessionIds.set(key, { sessionId, lastActivity: Date.now() });
}

/** Touch the last-activity timestamp for an existing session. */
export function touchSession(key: string): void {
    const entry = userSessionIds.get(key);
    if (entry) {
        entry.lastActivity = Date.now();
    }
}

/** Delete a session entry (e.g. on error). */
export function deleteSession(key: string): void {
    userSessionIds.delete(key);
}

/** Clear all sessions (used during graceful shutdown). */
export function clearAllSessions(): void {
    userSessionIds.clear();
}

/** Start the periodic cleanup of stale sessions. */
export function startSessionCleanup(): void {
    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of userSessionIds.entries()) {
            if (now - entry.lastActivity > config.sessionTtlMs) {
                log.info(`Cleaning up stale session ID for user ${key.substring(0, 6)}...`);
                userSessionIds.delete(key);
            }
        }
    }, config.sessionCleanupIntervalMs);
}
