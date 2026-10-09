/**
 * SAHAYAM — API constants & request helpers
 *
 * Firebase Project: sahayam-33cd4
 */

import { functions } from "./firebase";
import { httpsCallable } from "firebase/functions";

export const BASE_URL = "https://us-central1-sahayam-33cd4.cloudfunctions.net";

/**
 * Type definitions for Companion Interaction
 */
export interface CompanionResponse {
  success: boolean;
  response: string;
  audioBase64?: string;
  audioUri?: string;
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
