/**
 * SAHAYAM — API constants & request helpers
 *
 * Firebase Project: sahayam-33cd4
 */

import { functions } from "./firebase";
import { httpsCallable } from "firebase/functions";

// Local Companion Server running on LAN with Gemini Multimodal AI
export const BASE_URL = "http://172.20.188.69:5001";

/**
 * Type definitions for Companion Interaction
 */
export interface CompanionResponse {
  success: boolean;
  transcript?: string;
  response: string;
  audioBase64?: string;
  audioUri?: string;
}

/**
 * Sends multimodal audio or text directly to the companion AI server.
 */
export async function requestCompanionVoice(params: {
  elderId: string;
  text?: string;
  audioBase64?: string;
  mimeType?: string;
  medications?: any[];
}): Promise<CompanionResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout for multimodal audio upload + LLM reasoning

  try {
    const res = await fetch(`${BASE_URL}/respondCompanionVoice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Companion server returned status ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Requests an AI-initiated proactive check-in speech prompt.
 */
export async function requestProactiveVoice(params: {
  elderId: string;
  type?: string;
}): Promise<CompanionResponse> {
  const { elderId, type = "daily_checkin" } = params;
  const res = await fetch(
    `${BASE_URL}/checkin/proactive?elderId=${encodeURIComponent(elderId)}&type=${encodeURIComponent(type)}`
  );
  if (!res.ok) throw new Error(`Companion server returned status ${res.status}`);
  return await res.json();
}

/**
 * Callable Functions (Firebase SDK native)
 */
export const callRespondCompanionVoice = httpsCallable<
  { elderId: string; text?: string; audioBase64?: string },
  CompanionResponse
>(functions, "respondCompanionVoice");

export const callTriggerEmergencyEscalation = httpsCallable<
  { elderId: string; reason: string; notes?: string },
  { success: boolean; escalationId: string }
>(functions, "triggerEmergencyEscalation");

export const callSetCareNote = httpsCallable<
  { elderId: string; note: string },
  { success: boolean; saved: boolean }
>(functions, "setCareNote");

/**
 * REST / HTTP API endpoints
 */
export const API = {
  health: `${BASE_URL}/health`,
  voice: {
    transcribe: `${BASE_URL}/transcribe`,
    synthesize: `${BASE_URL}/synthesize`,
  },
  chat: {
    respond: `${BASE_URL}/respondCompanionVoice`,
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
 */
export function roleHeaders(role: "elder" | "family"): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Role": role,
    "ngrok-skip-browser-warning": "true",
  };
}

/**
 * Returns headers with X-Role only for multipart/form-data or non-JSON endpoints.
 */
export function roleHeadersOnly(role: "elder" | "family"): Record<string, string> {
  return {
    "X-Role": role,
    "ngrok-skip-browser-warning": "true",
  };
}
