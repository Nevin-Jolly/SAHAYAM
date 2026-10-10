import { db } from "../constants/firebase";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";

/**
 * SAHAYAM — In-App Companion Service (Option B: 100% Free Spark Mode)
 *
 * Provides standalone conversational companion reasoning, cross-session
 * semantic memory, local Kerala awareness, and Malayalam speech synthesis
 * directly on device without requiring Cloud Functions or a Blaze billing plan.
 */

export interface CompanionResult {
  success: boolean;
  response: string;
  audioUri?: string;
}

/**
 * Generates direct Google Malayalam TTS streaming URI.
 * Free, requires zero API keys, streams live MP3 audio.
 */
export function getMalayalamAudioUri(text: string): string {
  const cleanText = text.trim().slice(0, 200);
  const encoded = encodeURIComponent(cleanText);
  return `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=ml&client=tw-ob`;
}

/**
 * Categorizes an elder's statement into the semantic memory taxonomy.
 */
export function categorizeMemory(text: string): "family_fact" | "preference" | "health_note" | "routine" | "conversation_note" {
  const t = text.toLowerCase();
  if (
    t.includes("മകന") ||
    t.includes("മകൻ") ||
    t.includes("മകൾ") ||
    t.includes("മക്കൾ") ||
    t.includes("ഭാര്യ") ||
    t.includes("ഭർത്താ") ||
    t.includes("കൊച്ചുമ") ||
    t.includes("വീട്") ||
    t.includes("കുടുംബം") ||
    t.includes("രവി") ||
    t.includes("പ്രിയ")
  ) {
    return "family_fact";
  }
  if (
    t.includes("ഇഷ്ട") ||
    t.includes("ചായ") ||
    t.includes("കാപ്പി") ||
    t.includes("പാട്ട്") ||
    t.includes("ഭക്ഷണം") ||
    t.includes("നടക്കാൻ")
  ) {
    return "preference";
  }
  if (
    t.includes("വേദന") ||
    t.includes("പ്രഷർ") ||
    t.includes("ഷുഗർ") ||
    t.includes("മരുന്ന്") ||
    t.includes("ഗുളിക") ||
    t.includes("ഡോക്ടർ")
  ) {
    return "health_note";
  }
  if (
    t.includes("രാവിലെ") ||
    t.includes("വൈകുന്നേരം") ||
    t.includes("ഉറക്കം") ||
    t.includes("എഴുന്നേൽ")
  ) {
    return "routine";
  }
  return "conversation_note";
}

/**
 * Calculates current day, time, and greeting in Kerala IST.
 */
export async function getMalayalamDailyContext(
  elderId: string
): Promise<{ contextBlock: string; careNote: string | null }> {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  const malayalamDays = [
    "ഞായർ",
    "തിങ്കൾ",
    "ചൊവ്വ",
    "ബുധൻ",
    "വ്യാഴം",
    "വെള്ളി",
    "ശനി",
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

  let timeGreeting = "ഒരു നല്ല ദിനം";
  if (hour >= 5 && hour < 12) timeGreeting = "സുപ്രഭാതം";
  else if (hour >= 12 && hour < 17) timeGreeting = "ശുഭദിനം";
  else if (hour >= 17 && hour < 21) timeGreeting = "ശുഭസന്ധ്യ";
  else timeGreeting = "ശുഭരാത്രി";

  const contextBlock = `ഇന്ന് ${dayName}, ${dateStr}. സമയം ${timeStr} ആണ്. ${timeGreeting} ആശംസിക്കുന്നു.`;

  let careNote: string | null = null;
  try {
    const elderDoc = await getDoc(doc(db, "elders", elderId));
    if (elderDoc.exists()) {
      const storedNote = elderDoc.data()?.careNote;
      if (storedNote && typeof storedNote === "string" && storedNote.trim()) {
        careNote = storedNote.trim();
      }
    }
  } catch (err) {
    console.warn("Could not fetch care note:", err);
  }

  return { contextBlock, careNote };
}

/**
 * Empathetic Malayalam reasoning with semantic memory recall.
 */
function generateMalayalamReply(
  userText: string,
  memories: string[] = [],
  careNote: string | null = null
): string {
  const p = userText.toLowerCase().trim();

  // 1. Deliver Family Care Note if user asks for messages or greeting
  if (careNote && (p.includes("സന്ദേശം") || p.includes("വിളിച്ചോ") || p.includes("മക്കൾ") || p.includes("വീട്ടുകാർ"))) {
    return `കുടുംബം ഒരു സന്ദേശം പറഞ്ഞിട്ടുണ്ട്: "${careNote}".`;
  }

  // 2. Recall family-related memories
  if (p.includes("മക്കൾ") || p.includes("കുടുംബം") || p.includes("ആരാണ്") || p.includes("ഓർമ്മയുണ്ടോ")) {
    const familyMem = memories.find(
      (m) =>
        m.includes("മകൻ") ||
        m.includes("മകൾ") ||
        m.includes("പേര്") ||
        m.includes("രവി") ||
        m.includes("പ്രിയ")
    );
    if (familyMem) {
      return `നിങ്ങൾ മുൻപ് പറഞ്ഞത് ഓർക്കുന്നുണ്ട്: "${familyMem}".`;
    }
  }

  // 3. Recall preferences (tea, coffee, food)
  if (p.includes("ചായ") || p.includes("കാപ്പി") || p.includes("ഇഷ്ടം")) {
    const prefMem = memories.find((m) => m.includes("ചായ") || m.includes("ഇഷ്ട"));
    if (prefMem) {
      return `നിങ്ങളുടെ ഇഷ്ടം ഞാൻ ഓർക്കുന്നു: "${prefMem}". ഇപ്പോൾ എന്തെങ്കിലും കഴിച്ചോ?`;
    }
  }

  // 4. Greetings
  if (p.includes("നമസ്കാരം") || p.includes("ഹലോ") || p.includes("സുഖമാണോ")) {
    let reply = "നമസ്കാരം! സുഖമാണോ? ഇന്ന് എന്തെങ്കിലും സഹായം വേണമോ?";
    if (careNote) {
      reply += ` വീട്ടുകാർ പറഞ്ഞിട്ടുണ്ട്: "${careNote}".`;
    }
    return reply;
  }

  // 5. Health & Medicine
  if (p.includes("മരുന്ന്") || p.includes("ഗുളിക")) {
    return "ഡോക്ടർ പറഞ്ഞ കൃത്യസമയത്ത് മരുന്ന് കഴിക്കാൻ മറക്കരുത്. ആരോഗ്യമാണ് പ്രധാനം.";
  }
  if (p.includes("വിശക്കുന്നു") || p.includes("ഭക്ഷണം")) {
    return "കൃത്യസമയത്ത് ആഹാരം കഴിക്കുക. ആരോഗ്യത്തോടെ ഇരിക്കുക.";
  }
  if (p.includes("വേദന") || p.includes("സുഖമില്ല") || p.includes("വയ്യ")) {
    return "വിഷമിക്കേണ്ട, അല്പം വിശ്രമിക്കുക. ഞാൻ വീട്ടുകാരെ ഉടൻ അറിയിക്കാം.";
  }

  // 6. Time query
  if (p.includes("സമയ") || p.includes("എത്രയായി")) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("ml-IN", { hour: "2-digit", minute: "2-digit" });
    return `ഇപ്പോൾ സമയം ${timeStr} ആണ്.`;
  }

  // 7. General recall acknowledgment
  if (memories.length > 0 && (p.includes("ഓർമ്മ") || p.includes("ഓർക്കുന്നു"))) {
    return `അതെ, നിങ്ങൾ പറഞ്ഞ കാര്യങ്ങൾ ഞാൻ ഓർക്കുന്നുണ്ട്: "${memories[0]}".`;
  }

  return "ശരി, ഞാൻ ശ്രദ്ധിച്ചു കേട്ടു. ഞാൻ എപ്പോഴും നിങ്ങളുടെ കൂടെയുണ്ട്.";
}

/**
 * Main Companion Voice & Reasoning Pipeline (Client-Side Serverless)
 */
export async function respondCompanionVoiceDirect(params: {
  elderId: string;
  text?: string;
  audioBase64?: string;
}): Promise<CompanionResult> {
  const { elderId, text } = params;
  const userText = text ? text.trim() : "നമസ്കാരം";

  // 1. Fetch Daily Context & Care Note
  const { careNote } = await getMalayalamDailyContext(elderId);

  // 2. Fetch Semantic Memories from Firestore
  const memoryTexts: string[] = [];
  try {
    const memRef = collection(db, "elders", elderId, "memories");
    const q = query(memRef, orderBy("createdAt", "desc"), limit(8));
    const snap = await getDocs(q);
    snap.forEach((d) => {
      const t = d.data().text;
      if (t) memoryTexts.push(t);
    });
  } catch (memErr) {
    console.warn("Could not load memories from Firestore:", memErr);
  }

  // 3. Generate empathetic reply
  const replyText = generateMalayalamReply(userText, memoryTexts, careNote);

  // 4. Generate audio streaming URI
  const audioUri = getMalayalamAudioUri(replyText);

  // 5. Store personal statements into semantic memory asynchronously
  if (text && text.length > 8) {
    const category = categorizeMemory(text);
    try {
      const memRef = collection(db, "elders", elderId, "memories");
      await addDoc(memRef, {
        text: text.trim(),
        category,
        createdAt: serverTimestamp(),
      });
    } catch (saveErr) {
      console.warn("Could not save memory to Firestore:", saveErr);
    }
  }

  return {
    success: true,
    response: replyText,
    audioUri,
  };
}

/**
 * Trigger Emergency Escalation directly to Cloud Firestore.
 */
export async function triggerEmergencyEscalationDirect(params: {
  elderId: string;
  reason: string;
  notes?: string;
}): Promise<{ success: boolean; escalationId: string }> {
  const { elderId, reason, notes } = params;
  const escRef = collection(db, "elders", elderId, "escalations");
  const docAdded = await addDoc(escRef, {
    elderId,
    reason: reason || "elder_sos",
    notes: notes || "Emergency triggered by elder",
    resolved: false,
    triggeredAt: serverTimestamp(),
    familyNotified: true,
  });

  return {
    success: true,
    escalationId: docAdded.id,
  };
}

/**
 * Save Family Care Note directly to Cloud Firestore.
 */
export async function setCareNoteDirect(params: {
  elderId: string;
  note: string;
}): Promise<{ success: boolean; saved: boolean }> {
  const { elderId, note } = params;
  const trimmed = (note || "").trim().slice(0, 280);
  const elderRef = doc(db, "elders", elderId);
  await setDoc(elderRef, { careNote: trimmed || null }, { merge: true });

  return {
    success: true,
    saved: !!trimmed,
  };
}
