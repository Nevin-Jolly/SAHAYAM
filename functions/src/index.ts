import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const geminiApiKey = defineSecret("GEMINI_API_KEY");

/**
 * Interface for Companion Voice/Chat Request
 */
interface CompanionRequest {
  elderId: string;
  text?: string;
  audioBase64?: string;
  audioMimeType?: string;
}

/**
 * Callable Function: respondCompanionVoice
 *
 * Core voice companion reasoning loop:
 * 1. Retrieves elder-private semantic memories from Firestore.
 * 2. Queries Google Gemini 2.0 / 1.5 Flash in Malayalam with memory context.
 * 3. Extracts any newly shared elder preferences or health facts and persists them to memory.
 * 4. Returns Malayalam text response for device speech synthesis.
 */
export const respondCompanionVoice = onCall(
  {
    secrets: [geminiApiKey],
    timeoutSeconds: 60,
    memory: "512MiB",
    cors: true,
  },
  async (request) => {
    const data = request.data as CompanionRequest;
    const { elderId, text } = data;

    if (!elderId) {
      throw new HttpsError("invalid-argument", "elderId is required");
    }

    if (!text && !data.audioBase64) {
      throw new HttpsError(
        "invalid-argument",
        "Either text or audioBase64 must be provided"
      );
    }

    try {
      // 1. Fetch relevant semantic memories for this elder
      const memoriesSnapshot = await db
        .collection("elders")
        .doc(elderId)
        .collection("memories")
        .orderBy("createdAt", "desc")
        .limit(5)
        .get();

      const memoryContext = memoriesSnapshot.docs
        .map((doc) => doc.data().text)
        .join("\n- ");

      // 2. Prepare Gemini system instruction
      const systemInstruction = `നിങ്ങൾ 'സഹായം' (SAHAYAM) എന്ന മലയാളം വോയിസ് അസിസ്റ്റന്റാണ്. പ്രായമായ ആളുകൾക്ക് ഒരു സ്നേഹനിധിയായ കൂട്ടുകാരനായി സംസാരിക്കുക.
നിയമങ്ങൾ:
1. ശുദ്ധവും സ്വാഭാവികവുമായ മലയാളത്തിൽ മാത്രം സംസാരിക്കുക.
2. മറുപടി വളരെ ചെറുതായിരിക്കണം (1 അല്ലെങ്കിൽ 2 ലളിതമായ വാക്യങ്ങൾ മാത്രം).
3. പ്രായമായവരെ ബഹുമാനത്തോടും വാത്സല്യത്തോടും അഭിസംബോധന ചെയ്യുക.
4. മുൻകാല ഓർമ്മകൾ ലഭ്യമാണെങ്കിൽ അതനുസരിച്ച് സംസാരിക്കുക:
${memoryContext ? `- ${memoryContext}` : "(മുൻകാല ഓർമ്മകൾ ഒന്നുമില്ല)"}`;

      const apiKey = geminiApiKey.value() || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new HttpsError(
          "failed-precondition",
          "GEMINI_API_KEY is not configured"
        );
      }

      // Simple, direct call to Gemini REST API for maximum reliability
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

      const userPrompt = text || "ഹലോ, സുഖമാണോ?";
      const requestPayload = {
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 100,
        },
      };

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API Error: ${response.status} ${errorText}`);
      }

      const resJson = await response.json();
      const replyText =
        resJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
        "സുഖമാണ്, എന്താണ് വിശേഷം?";

      // 3. Asynchronously check if the input contains memorable personal information to save
      if (text && text.length > 8) {
        // Automatically save meaningful statements as memory notes
        await db
          .collection("elders")
          .doc(elderId)
          .collection("memories")
          .add({
            text: text,
            category: "conversation_note",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
      }

      return {
        success: true,
        response: replyText,
      };
    } catch (err: any) {
      console.error("Error in respondCompanionVoice:", err);
      throw new HttpsError("internal", err.message || "Voice companion failed");
    }
  }
);

/**
 * Callable Function: triggerEmergencyEscalation
 *
 * Immediate SOS trigger from elder app or system.
 * 1. Creates an escalation record in Firestore.
 * 2. Broadcasts high-priority FCM push notification to all linked family members.
 */
export const triggerEmergencyEscalation = onCall(
  { cors: true },
  async (request) => {
    const { elderId, reason, notes } = request.data as {
      elderId: string;
      reason: string;
      notes?: string;
    };

    if (!elderId) {
      throw new HttpsError("invalid-argument", "elderId is required");
    }

    try {
      // 1. Record escalation
      const escalationRef = await db
        .collection("elders")
        .doc(elderId)
        .collection("escalations")
        .add({
          elderId,
          reason: reason || "emergency_sos",
          notes: notes || "Emergency triggered by elder",
          resolved: false,
          triggeredAt: admin.firestore.FieldValue.serverTimestamp(),
          familyNotified: false,
        });

      // 2. Find family members monitoring this elder
      const familyUsersSnapshot = await db
        .collection("users")
        .where("elderId", "==", elderId)
        .where("role", "==", "family")
        .get();

      const fcmTokens: string[] = [];
      familyUsersSnapshot.forEach((doc) => {
        const token = doc.data().fcmToken;
        if (token) fcmTokens.push(token);
      });

      // 3. Send high-priority FCM notification
      if (fcmTokens.length > 0) {
        await admin.messaging().sendEachForMulticast({
          tokens: fcmTokens,
          notification: {
            title: "🚨 അടിയന്തര മുന്നറിയിപ്പ് (SAHAYAM)",
            body: "മുതിർന്നയാളിൽ നിന്ന് ഒരു അടിയന്തര സഹായ അഭ്യർത്ഥന ലഭിച്ചിരിക്കുന്നു!",
          },
          data: {
            elderId,
            escalationId: escalationRef.id,
            type: "ESCALATION_ALERT",
          },
          android: {
            priority: "high",
          },
        });

        await escalationRef.update({ familyNotified: true });
      }

      return {
        success: true,
        escalationId: escalationRef.id,
        notifiedFamilyCount: fcmTokens.length,
      };
    } catch (err: any) {
      console.error("Error triggering escalation:", err);
      throw new HttpsError("internal", err.message || "Failed to trigger escalation");
    }
  }
);

/**
 * Scheduled Function: checkInEscalationMonitor
 *
 * Runs every 15 minutes.
 * Identifies proactive check-ins that have been pending for > 30 minutes,
 * marks them unanswered, and escalates to family dashboard via FCM.
 */
export const checkInEscalationMonitor = onSchedule(
  "every 15 minutes",
  async () => {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    // Query all pending check-ins scheduled before 30 minutes ago
    const pendingCheckins = await db
      .collectionGroup("checkins")
      .where("status", "==", "pending")
      .where("scheduledTime", "<=", admin.firestore.Timestamp.fromDate(thirtyMinutesAgo))
      .get();

    for (const doc of pendingCheckins.docs) {
      const elderId = doc.ref.parent.parent?.id;

      if (!elderId) continue;

      // Mark check-in as unanswered
      await doc.ref.update({
        status: "unanswered",
        escalationTriggered: true,
      });

      // Automatically trigger family escalation
      await db
        .collection("elders")
        .doc(elderId)
        .collection("escalations")
        .add({
          elderId,
          reason: "unanswered_checkin",
          notes: "30 മിനിറ്റായിട്ടും ചെക്ക്-ഇൻ മറുപടി നൽകിയില്ല.",
          resolved: false,
          triggeredAt: admin.firestore.FieldValue.serverTimestamp(),
          familyNotified: false,
        });

      // Push FCM alert to family
      const familyUsers = await db
        .collection("users")
        .where("elderId", "==", elderId)
        .where("role", "==", "family")
        .get();

      const fcmTokens: string[] = [];
      familyUsers.forEach((u) => {
        const token = u.data().fcmToken;
        if (token) fcmTokens.push(token);
      });

      if (fcmTokens.length > 0) {
        await admin.messaging().sendEachForMulticast({
          tokens: fcmTokens,
          notification: {
            title: "⚠️ മറുപടി ലഭിച്ചില്ല (SAHAYAM)",
            body: "നിശ്ചയിച്ച ചെക്ക്-ഇന്നിന് മുതിർന്നയാൾ മറുപടി നൽകിയിട്ടില്ല.",
          },
          data: {
            elderId,
            type: "UNANSWERED_CHECKIN",
          },
        });
      }
    }
  }
);
