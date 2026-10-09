/**
 * SAHAYAM — API constants & request helpers
 *
 * BASE_URL must be updated each time ngrok restarts, since ngrok generates
 * a new public URL per session. This is a known limitation (Risk 1 in plan).
 *
 * How to update:
 *   1. Run: python backend/ngrok_start.py
 *   2. Copy the printed URL
 *   3. Paste it here and save
 *   4. Reload the Expo app
 *
 * Phase 6: roleHeaders(role) added — pass to every fetch() call so the
 * backend RBAC dependency (auth.py) can enforce endpoint access control.
 */

// Replace with the URL printed by ngrok_start.py before each demo session
export const BASE_URL = "https://slapping-concert-gem.ngrok-free.dev";

export const API = {
  health: `${BASE_URL}/health`,
  voice: {
    transcribe: `${BASE_URL}/voice/transcribe`,
    synthesize: `${BASE_URL}/voice/synthesize`,
  },
  chat: {
    respond: `${BASE_URL}/chat/respond`,
  },
  medications: `${BASE_URL}/medications`,
  checkins: `${BASE_URL}/checkins`,
  escalations: `${BASE_URL}/escalations`,
  dashboard: (familyId: string) => `${BASE_URL}/dashboard/${familyId}`,
  memory: {
    store: `${BASE_URL}/memory/store`,
    query: `${BASE_URL}/memory/query`,
  },
};

/**
 * Returns headers with Content-Type + X-Role for JSON endpoints.
 *
 * Usage:
 *   fetch(API.chat.respond, {
 *     method: "POST",
 *     headers: roleHeaders("elder"),
 *     body: JSON.stringify({ ... }),
 *   });
 */
export function roleHeaders(role: "elder" | "family"): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Role": role,
    "ngrok-skip-browser-warning": "true",
  };
}

/**
 * Returns headers with X-Role only (for multipart/form-data or non-JSON endpoints
 * where Content-Type is set automatically by fetch/FormData).
 *
 * Usage:
 *   const form = new FormData();
 *   form.append("audio", { ... });
 *   fetch(API.voice.transcribe, {
 *     method: "POST",
 *     headers: roleHeadersOnly("elder"),
 *     body: form,
 *   });
 */
export function roleHeadersOnly(role: "elder" | "family"): Record<string, string> {
  return {
    "X-Role": role,
    "ngrok-skip-browser-warning": "true",
  };
}
