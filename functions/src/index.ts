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
 * Synthesizes Malayalam text to MP3 audio using Google TTS.
 * Returns a base64 encoded MP3 string.
 */
async function synthesizeMalayalamAudio(text: string): Promise<string | null> {
  try {
    if (!text || !text.trim()) return null;
    const cleanText = text.trim().slice(0, 200); // Keep voice chunks compact and clear
    const encoded = encodeURIComponent(cleanText);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=ml&client=tw-ob`;

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      console.warn(`TTS fetch failed with status ${res.status}`);
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer).toString("base64");
  } catch (err) {
    console.error("Malayalam TTS synthesis error:", err);
    return null;
  }
}

/**
 * Rule-based Malayalam empathetic responses for fallback/offline demo.
 */
function getMalayalamFallbackResponse(userPrompt: string): string {
  const p = userPrompt.toLowerCase().trim();
  if (p.includes("നമസ്കാരം") || p.includes("ഹലോ") || p.includes("hello")) {
    return "നമസ്കാരം! സുഖമാണോ? ഇന്ന് എന്തെങ്കിലും സഹായം വേണമോ?";
  }
  if (p.includes("മരുന്ന്") || p.includes("ഗുളിക")) {
    return "ഡോക്ടർ പറഞ്ഞ കൃത്യസമയത്ത് മരുന്ന് കഴിക്കാൻ മറക്കരുത്.";
  }
  if (p.includes("വിശക്കുന്നു") || p.includes("ഭക്ഷണം") || p.includes("ചായ")) {
    return "കൃത്യസമയത്ത് ആഹാരം കഴിക്കുക. ആരോഗ്യമാണ് പ്രധാനം.";
  }
  if (p.includes("വേദന") || p.includes("സുഖമില്ല") || p.includes("വയ്യ")) {
    return "വിഷമിക്കേണ്ട, അല്പം വിശ്രമിക്കുക. ഞാൻ വീട്ടുകാരെ അറിയിക്കാം.";
  }
  if (p.includes("സമയ") || p.includes("എത്രയായി")) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("ml-IN", { hour: "2-digit", minute: "2-digit" });
    return `ഇപ്പോൾ സമയം ${timeStr} ആണ്.`;
  }
  return "ശരി, ഞാൻ കേട്ടു. ഞാൻ എപ്പോഴും നിങ്ങളുടെ കൂടെയുണ്ട്.";
}

/**
 * Interface for Companion Voice/Chat Request
 */
interface CompanionRequest {
  elderId: string;
  text?: string;
  audioBase64?: string;
}

/**
 * Callable Function: respondCompanionVoice
 *
 * Core voice companion reasoning loop:
 * 1. Retrieves elder-private semantic memories from Firestore.
 * 2. Queries Google Gemini 2.0 / 1.5 Flash in Malayalam with memory context.
 * 3. Falls back gracefully to curated empathetic Malayalam responses if API key is not configured.
 * 4. Synthesizes high-fidelity Malayalam MP3 speech audio.
 * 5. Returns both Malayalam text and base64 audio URI for immediate playback.
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

    const userPrompt = text ? text.trim() : "നമസ്കാരം";

    try {
      // 1. Fetch relevant semantic memories for this elder
      let memoryContext = "";
      try {
        const memoriesSnapshot = await db
          .collection("elders")
          .doc(elderId)
          .collection("memories")
          .orderBy("createdAt", "desc")
          .limit(5)
          .get();

        memoryContext = memoriesSnapshot.docs
          .map((doc) => doc.data().text)
          .join("\n- ");
      } catch (memErr) {
        console.warn("Could not query memories:", memErr);
      }

      // 2. Obtain reply from Gemini or empathetic fallback
      let replyText = "";
      const apiKey = geminiApiKey.value() || process.env.GEMINI_API_KEY;

      if (apiKey) {
        try {
          const systemInstruction = `നിങ്ങൾ 'സഹായം' (SAHAYAM) എന്ന മലയാളം വോയിസ് അസിസ്റ്റന്റാണ്. പ്രായമായ ആളുകൾക്ക് ഒരു സ്നേഹനിധിയായ കൂട്ടുകാരനായി സംസാരിക്കുക.
നിയമങ്ങൾ:
1. ശുദ്ധവും സ്വാഭാവികവുമായ മലയാളത്തിൽ മാത്രം സംസാരിക്കുക.
2. മറുപടി വളരെ ചെറുതായിരിക്കണം (1 അല്ലെങ്കിൽ 2 ലളിതമായ വാക്യങ്ങൾ മാത്രം).
3. പ്രായമായവരെ ബഹുമാനത്തോടും വാത്സല്യത്തോടും അഭിസംബോധന ചെയ്യുക.
4. മുൻകാല ഓർമ്മകൾ ലഭ്യമാണെങ്കിൽ അതനുസരിച്ച് സംസാരിക്കുക:
${memoryContext ? `- ${memoryContext}` : "(മുൻകാല ഓർമ്മകൾ ഒന്നുമില്ല)"}`;

          const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
          const requestPayload = {
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: { temperature: 0.7, maxOutputTokens: 100 },
          };

          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestPayload),
          });

          if (response.ok) {
            const resJson = await response.json();
            replyText =
              resJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
          }
        } catch (apiErr) {
          console.error("Gemini call error, using fallback:", apiErr);
        }
      }

      if (!replyText) {
        replyText = getMalayalamFallbackResponse(userPrompt);
      }

      // 3. Synthesize Malayalam MP3 audio
      const audioBase64 = await synthesizeMalayalamAudio(replyText);
      const audioUri = audioBase64 ? `data:audio/mpeg;base64,${audioBase64}` : null;

      // 4. Save meaningful personal statements to elder memory asynchronously
      if (text && text.length > 8) {
        try {
          await db
            .collection("elders")
            .doc(elderId)
            .collection("memories")
            .add({
              text: text,
              category: "conversation_note",
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        } catch (saveErr) {
          console.warn("Failed saving memory:", saveErr);
        }
      }

      return {
        success: true,
        response: replyText,
        audioBase64,
        audioUri,
      };
    } catch (err: any) {
      console.error("Error in respondCompanionVoice:", err);
      throw new HttpsError("internal", err.message || "Voice companion failed");
    }
  }
);

/**
 * Callable Function: triggerEmergencyEscalation
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
 */
export const checkInEscalationMonitor = onSchedule(
  "every 15 minutes",
  async () => {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const pendingCheckins = await db
      .collectionGroup("checkins")
      .where("status", "==", "pending")
      .where("scheduledTime", "<=", admin.firestore.Timestamp.fromDate(thirtyMinutesAgo))
      .get();

    for (const doc of pendingCheckins.docs) {
      const elderId = doc.ref.parent.parent?.id;
      if (!elderId) continue;

      await doc.ref.update({
        status: "unanswered",
        escalationTriggered: true,
      });

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
