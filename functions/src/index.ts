import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
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
    const cleanText = text.trim().slice(0, 200);
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
 * Categorizes an elder's statement into a memory taxonomy.
 */
function categorizeMemory(text: string): "family_fact" | "preference" | "health_note" | "routine" | "conversation_note" {
  const t = text.toLowerCase();
  if (t.includes("മകന") || t.includes("മകൻ") || t.includes("മകൾ") || t.includes("മക്കൾ") || t.includes("ഭാര്യ") || t.includes("ഭർത്താ") || t.includes("കൊച്ചുമ") || t.includes("വീട്") || t.includes("കുടുംബം")) {
    return "family_fact";
  }
  if (t.includes("ഇഷ്ട") || t.includes("ചായ") || t.includes("കാപ്പി") || t.includes("പാട്ട്") || t.includes("ഭക്ഷണം") || t.includes("നടക്കാൻ")) {
    return "preference";
  }
  if (t.includes("വേദന") || t.includes("പ്രഷർ") || t.includes("ഷുഗർ") || t.includes("മരുന്ന്") || t.includes("ഗുളിക") || t.includes("ഡോക്ടർ")) {
    return "health_note";
  }
  if (t.includes("രാവിലെ") || t.includes("വൈകുന്നേരം") || t.includes("ഉറക്കം") || t.includes("എഴുന്നേൽ")) {
    return "routine";
  }
  return "conversation_note";
}

/**
 * Phase 7 — Local Awareness Helper
 *
 * Returns a Malayalam-language daily context string containing:
 * - Current day of week in Malayalam
 * - Current date formatted in ml-IN locale
 * - Current time (Kerala IST)
 * - Simple morning/afternoon/evening/night greeting context
 * - Any pending family care note stored for this elder
 */
async function getMalayalamDailyContext(
  elderId: string
): Promise<{ contextBlock: string; careNote: string | null }> {
  // Kerala is IST = UTC+5:30
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  const malayalamDays = [
    "ഞായർ",   // Sunday
    "തിങ്കൾ",  // Monday
    "ചൊവ്വ",  // Tuesday
    "ബുധൻ",   // Wednesday
    "വ്യാഴം",  // Thursday
    "വെള്ളി",  // Friday
    "ശനി",    // Saturday
  ];

  const hour = now.getHours();
  const dayName = malayalamDays[now.getDay()];
  const dateStr = now.toLocaleDateString("ml-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("ml-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  let timeGreeting = "";
  if (hour >= 5 && hour < 12) timeGreeting = "ഒരു നല്ല പ്രഭാതം";
  else if (hour >= 12 && hour < 17) timeGreeting = "ഒരു നല്ല ഉച്ചതിരിഞ്ഞ് സമയം";
  else if (hour >= 17 && hour < 21) timeGreeting = "ഒരു നല്ല വൈകുന്നേരം";
  else timeGreeting = "ഒരു നല്ല രാത്രി";

  const contextBlock =
    `ഇന്ന് ${dayName}, ${dateStr}. സമയം ${timeStr} ആണ്. ${timeGreeting} ആശംസിക്കുന്നു.`;

  // Fetch family care note if available
  let careNote: string | null = null;
  try {
    const elderDoc = await db.collection("elders").doc(elderId).get();
    const storedNote = elderDoc.data()?.careNote as string | undefined;
    if (storedNote && storedNote.trim()) {
      careNote = storedNote.trim();
    }
  } catch (_) {
    // Non-fatal: proceed without care note
  }

  return { contextBlock, careNote };
}

/**
 * Rule-based Malayalam empathetic responses with cross-session semantic memory awareness.
 */
function getMalayalamFallbackResponse(userPrompt: string, memories: string[] = []): string {
  const p = userPrompt.toLowerCase().trim();

  // 1. Recall family-related memories if user asks about family or relatives
  if (p.includes("മക്കൾ") || p.includes("കുടുംബം") || p.includes("ആരാണ്") || p.includes("ഓർമ്മയുണ്ടോ")) {
    const familyMem = memories.find((m) =>
      m.includes("മകൻ") || m.includes("മകൾ") || m.includes("പേര്") || m.includes("രവി") || m.includes("പ്രിയ")
    );
    if (familyMem) {
      return `നിങ്ങൾ മുൻപ് പറഞ്ഞത് ഓർക്കുന്നുണ്ട്: "${familyMem}".`;
    }
  }

  // 2. Recall preferences if user asks about tea/food/likes
  if (p.includes("ചായ") || p.includes("കാപ്പി") || p.includes("ഇഷ്ടം")) {
    const prefMem = memories.find((m) => m.includes("ചായ") || m.includes("ഇഷ്ട"));
    if (prefMem) {
      return `നിങ്ങളുടെ ഇഷ്ടം ഞാൻ ഓർക്കുന്നു: "${prefMem}". ഇപ്പോൾ എന്തെങ്കിലും കഴിച്ചോ?`;
    }
  }

  // 3. Greetings & Daily Care
  if (p.includes("നമസ്കാരം") || p.includes("ഹലോ") || p.includes("hello")) {
    return "നമസ്കാരം! സുഖമാണോ? ഇന്ന് എന്തെങ്കിലും സഹായം വേണമോ?";
  }
  if (p.includes("മരുന്ന്") || p.includes("ഗുളിക")) {
    return "ഡോക്ടർ പറഞ്ഞ കൃത്യസമയത്ത് മരുന്ന് കഴിക്കാൻ മറക്കരുത്.";
  }
  if (p.includes("വിശക്കുന്നു") || p.includes("ഭക്ഷണം")) {
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

  // General recall acknowledgment if memory was extracted
  if (memories.length > 0 && (p.includes("ഓർമ്മ") || p.includes("ഓർക്കുന്നു"))) {
    return `അതെ, നിങ്ങൾ പറഞ്ഞ കാര്യങ്ങൾ ഞാൻ ഓർക്കുന്നുണ്ട്: "${memories[0]}".`;
  }

  return "ശരി, ഞാൻ ശ്രദ്ധിച്ചു കേട്ടു. ഞാൻ എപ്പോഴും നിങ്ങളുടെ കൂടെയുണ്ട്.";
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
 * Core voice companion reasoning loop with Phase 2 Persistent Semantic Memory:
 * 1. Retrieves elder-private semantic memories from Firestore.
 * 2. Injects cross-session memories into conversational reasoning context.
 * 3. Categorizes and persists new personal elder statements.
 * 4. Synthesizes high-fidelity Malayalam MP3 speech audio.
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

    // Phase 7: Fetch daily context + family care note
    const { contextBlock, careNote } = await getMalayalamDailyContext(elderId);

    try {
      // 1. Fetch relevant semantic memories for this elder
      const memoryTexts: string[] = [];
      try {
        const memoriesSnapshot = await db
          .collection("elders")
          .doc(elderId)
          .collection("memories")
          .orderBy("createdAt", "desc")
          .limit(8)
          .get();

        memoriesSnapshot.forEach((doc) => {
          const t = doc.data().text;
          if (t) memoryTexts.push(t);
        });
      } catch (memErr) {
        console.warn("Could not query memories:", memErr);
      }

      const memoryContext = memoryTexts.join("\n- ");

      // 2. Obtain reply from Gemini or empathetic memory-aware fallback
      let replyText = "";
      const apiKey = geminiApiKey.value() || process.env.GEMINI_API_KEY;

      if (apiKey) {
        try {
          // Phase 7: Build system instruction with daily context + care note
          const careNoteBlock = careNote
            ? `\n5. ഇന്ന് കുടുംബം ഒരു സ്നേഹ സന്ദേശം അയച്ചിട്ടുണ്ട്: "${careNote}". ഉചിതമായ നിമിഷത്തിൽ ഇത് ലളിതമായി പ്രകടിപ്പിക്കുക.`
            : "";

          const systemInstruction =
            `നിങ്ങൾ 'സഹായം' (SAHAYAM) എന്ന മലയാളം വോയിസ് അസിസ്റ്റന്റാണ്. പ്രായമായ ആളുകൾക്ക് ഒരു സ്നേഹനിധിയായ കൂട്ടുകാരനായി സംസാരിക്കുക.` +
            `\nആജ്ഞകൾ:` +
            `\n1. ശുദ്ധവും സ്വാഭാവികവുമായ മലയാളത്തിൽ മാത്രം സംസാരിക്കുക.` +
            `\n2. മറുപടി വളരെ ചെറുതായിരിക്കണം (1 അല്ലെങ്കിൽ 2 ലളിതമായ വാക്യങ്ങൾ മാത്രം).` +
            `\n3. പ്രായമായവരെ ബഹുമാനത്തോടും വാത്സല്യത്തോടും അഭിസംബോധന ചെയ്യുക.` +
            `\n4. ഇന്നത്തെ ദിവസ സന്ദർഭം: ${contextBlock}` +
            (memoryContext ? `\n   മുൻകാല ഓർമ്മകൾ: ${memoryContext}` : "") +
            careNoteBlock;

          const userParts: any[] = [];
          if (data.audioBase64) {
            const rawBase64 = data.audioBase64.replace(/^data:audio\/[a-z0-9]+;base64,/, "");
            userParts.push({
              inlineData: {
                mimeType: "audio/mp4",
                data: rawBase64,
              },
            });
            userParts.push({
              text: "പ്രായമായ ആളുടെ ശബ്ദം കേട്ട്, സ്നേഹത്തോടെയും ബഹുമാനത്തോടെയും സ്വാഭാവിക മലയാളത്തിൽ 1 അല്ലെങ്കിൽ 2 വാക്യങ്ങളിൽ മാത്രം മറുപടി നൽകുക.",
            });
          } else {
            userParts.push({ text: userPrompt });
          }

          const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
          const requestPayload = {
            contents: [{ role: "user", parts: userParts }],
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
        replyText = getMalayalamFallbackResponse(userPrompt, memoryTexts);
      }

      // 3. Synthesize Malayalam MP3 audio
      const audioBase64 = await synthesizeMalayalamAudio(replyText);
      const audioUri = audioBase64 ? `data:audio/mpeg;base64,${audioBase64}` : null;

      // 4. Save meaningful personal statements to elder memory asynchronously
      if (text && text.length > 8) {
        const category = categorizeMemory(text);
        try {
          await db
            .collection("elders")
            .doc(elderId)
            .collection("memories")
            .add({
              text: text.trim(),
              category,
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
 * Callable Function: storeElderMemory (Explicit storage)
 */
export const storeElderMemory = onCall(
  { cors: true },
  async (request) => {
    const { elderId, text, category } = request.data as {
      elderId: string;
      text: string;
      category?: string;
    };

    if (!elderId || !text) {
      throw new HttpsError("invalid-argument", "elderId and text are required");
    }

    try {
      const assignedCategory = category || categorizeMemory(text);
      const docRef = await db
        .collection("elders")
        .doc(elderId)
        .collection("memories")
        .add({
          text: text.trim(),
          category: assignedCategory,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      return {
        success: true,
        memoryId: docRef.id,
        category: assignedCategory,
      };
    } catch (err: any) {
      throw new HttpsError("internal", err.message || "Failed storing memory");
    }
  }
);

/**
 * Callable Function: queryElderMemories
 */
export const queryElderMemories = onCall(
  { cors: true },
  async (request) => {
    const { elderId, limit = 10 } = request.data as {
      elderId: string;
      limit?: number;
    };

    if (!elderId) {
      throw new HttpsError("invalid-argument", "elderId is required");
    }

    try {
      const snapshot = await db
        .collection("elders")
        .doc(elderId)
        .collection("memories")
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();

      const memories = snapshot.docs.map((d) => ({
        id: d.id,
        text: d.data().text,
        category: d.data().category,
        createdAt: d.data().createdAt?.toDate()?.toISOString() || null,
      }));

      return {
        success: true,
        memories,
      };
    } catch (err: any) {
      throw new HttpsError("internal", err.message || "Failed querying memories");
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

/**
 * Callable Function: scheduleProactiveCheckIn (Phase 3)
 * Creates a scheduled check-in event for an elder.
 */
export const scheduleProactiveCheckIn = onCall(
  { cors: true },
  async (request) => {
    const { elderId, promptNote } = request.data as {
      elderId: string;
      promptNote?: string;
    };

    if (!elderId) {
      throw new HttpsError("invalid-argument", "elderId is required");
    }

    try {
      const checkinRef = await db
        .collection("elders")
        .doc(elderId)
        .collection("checkins")
        .add({
          elderId,
          scheduledTime: admin.firestore.FieldValue.serverTimestamp(),
          status: "pending",
          escalationTriggered: false,
          promptNote: promptNote || "സുഖമാണോ? എന്തെങ്കിലും സഹായം ആവശ്യമുണ്ടോ?",
        });

      return {
        success: true,
        checkinId: checkinRef.id,
        status: "pending",
      };
    } catch (err: any) {
      throw new HttpsError("internal", err.message || "Failed to schedule check-in");
    }
  }
);

/**
 * Callable Function: recordCheckInOutcome (Phase 3)
 * Records elder's response to a pending check-in.
 */
export const recordCheckInOutcome = onCall(
  { cors: true },
  async (request) => {
    const { elderId, checkinId, moodNote } = request.data as {
      elderId: string;
      checkinId: string;
      moodNote?: string;
    };

    if (!elderId || !checkinId) {
      throw new HttpsError("invalid-argument", "elderId and checkinId are required");
    }

    try {
      const checkinRef = db
        .collection("elders")
        .doc(elderId)
        .collection("checkins")
        .doc(checkinId);

      await checkinRef.update({
        status: "answered",
        answeredAt: admin.firestore.FieldValue.serverTimestamp(),
        moodNote: moodNote || "നല്ലത്",
      });

      return {
        success: true,
        checkinId,
        status: "answered",
      };
    } catch (err: any) {
      throw new HttpsError("internal", err.message || "Failed to record check-in response");
    }
  }
);

/**
 * Scheduled Function: medicationReminderScheduler (Phase 3)
 * Runs hourly to scan active medications and deliver dose reminders.
 */
export const medicationReminderScheduler = onSchedule(
  "0 * * * *",
  async () => {
    const activeMedsSnapshot = await db
      .collectionGroup("medications")
      .where("active", "==", true)
      .get();

    for (const doc of activeMedsSnapshot.docs) {
      const medData = doc.data();
      const elderId = doc.ref.parent.parent?.id;
      if (!elderId) continue;

      // Send reminder to elder device if token exists
      const elderUserDoc = await db.collection("users").doc(elderId).get();
      const fcmToken = elderUserDoc.data()?.fcmToken;

      if (fcmToken) {
        await admin.messaging().send({
          token: fcmToken,
          notification: {
            title: `💊 മരുന്ന് കഴിക്കാൻ സമയമായി: ${medData.name}`,
            body: `അളവ്: ${medData.dosage}. ${medData.instructions || ""}`,
          },
          data: {
            type: "MEDICATION_REMINDER",
            medicationId: doc.id,
          },
        });
      }
    }
  }
);

/**
 * Callable Function: setCareNote (Phase 7 — Social Bridging)
 *
 * Stores a short care note from a family member into the elder's Firestore document.
 * The note is injected by respondCompanionVoice into the next Gemini system prompt
 * so the elder companion speaks it naturally during conversation.
 *
 * One note at a time per elder — new note overwrites the previous.
 * Note is capped at 280 characters (~2 short sentences) to stay voice-friendly.
 */
export const setCareNote = onCall(
  { cors: true },
  async (request) => {
    const { elderId, note } = request.data as {
      elderId: string;
      note: string;
    };

    if (!elderId) {
      throw new HttpsError("invalid-argument", "elderId is required");
    }

    const trimmedNote = (note || "").trim().slice(0, 280);

    try {
      await db.collection("elders").doc(elderId).set(
        { careNote: trimmedNote || null },
        { merge: true }
      );

      return { success: true, saved: !!trimmedNote };
    } catch (err: any) {
      throw new HttpsError("internal", err.message || "Failed to save care note");
    }
  }
);

/**
 * Firestore Trigger: onEscalationCreated
 * Automatically fires whenever an alert or escalation is created in elders/{elderId}/escalations.
 * Sends immediate high-priority FCM push notification to all linked family members' devices.
 */
export const onEscalationCreated = onDocumentCreated(
  "elders/{elderId}/escalations/{escalationId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();
    const elderId = event.params.elderId;
    const escalationId = event.params.escalationId;

    try {
      // Find all family members registered for this elder
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

      const isSos = data.reason === "elder_sos" || data.reason === "emergency_sos";
      const isMissedMed = data.reason === "missed_medication";

      const title = isSos
        ? "🚨 അടിയന്തര മുന്നറിയിപ്പ് (SAHAYAM SOS Alert)"
        : isMissedMed
        ? "💊 മരുന്ന് കഴിച്ചില്ല — അടിയന്തര മുന്നറിയിപ്പ്"
        : "⚠️ ശ്രദ്ധിക്കുക: അടിയന്തര മുന്നറിയിപ്പ് (SAHAYAM Alert)";

      const body = data.notes || (isSos
        ? "മുതിർന്നയാളിൽ നിന്ന് അടിയന്തര സഹായ അഭ്യർത്ഥന ലഭിച്ചിരിക്കുന്നു!"
        : isMissedMed
        ? "മുതിർന്നയാൾ മരുന്ന് കഴിച്ചിട്ടില്ല. രണ്ട് ഓർമ്മപ്പെടുത്തലുകൾ നൽകിയിട്ടും പ്രതികരിച്ചില്ല."
        : "മുതിർന്നയാളുടെ അടിയന്തര മുന്നറിയിപ്പ് ലഭിച്ചിട്ടുണ്ട്.");

      if (fcmTokens.length > 0) {
        await admin.messaging().sendEachForMulticast({
          tokens: fcmTokens,
          notification: {
            title,
            body,
          },
          data: {
            elderId,
            escalationId,
            reason: String(data.reason || "alert"),
            type: "ESCALATION_ALERT",
          },
          android: {
            priority: "high",
          },
        });

        await snap.ref.update({ familyNotified: true });
        console.log(`[FCM] Dispatched escalation push notification to ${fcmTokens.length} family tokens.`);
      }
    } catch (pushErr) {
      console.error("[FCM Push Notification Error]:", pushErr);
    }
  }
);

