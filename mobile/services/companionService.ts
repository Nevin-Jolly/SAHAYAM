import { db } from "../constants/firebase";
import { BASE_URL } from "../constants/api";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
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

  // Use cached care note from real-time listener if available
  let careNote: string | null = cachedCareNote;

  if (!careNote) {
    try {
      const res = await fetch(`${BASE_URL}/carenote?elderId=${encodeURIComponent(elderId)}`);
      if (res.ok) {
        const data = await res.json();
        if (typeof data?.note === "string" && data.note.trim()) {
          careNote = data.note.trim();
          cachedCareNote = careNote;
        }
      }
    } catch (_) {}
  }

  if (!careNote) {
    try {
      const elderDoc = await getDoc(doc(db, "elders", elderId));
      if (elderDoc.exists()) {
        const storedNote = elderDoc.data()?.careNote;
        if (storedNote && typeof storedNote === "string" && storedNote.trim()) {
          careNote = storedNote.trim();
          cachedCareNote = careNote;
        }
      }
    } catch (_) {
      // In offline state, silently use cached note or null without noisy logs
    }
  }

  return { contextBlock, careNote };
}

let cachedCareNote: string | null = null;
let careNoteUnsub: (() => void) | null = null;

/**
 * Subscribes to real-time care notes from family for an elder.
 */
export function subscribeCareNote(elderId: string): () => void {
  if (careNoteUnsub) {
    try { careNoteUnsub(); } catch (_) {}
  }

  let isMounted = true;

  // Poll Companion Server (LAN) for instant real-time sync across devices
  const fetchServerCareNote = async () => {
    try {
      const res = await fetch(`${BASE_URL}/carenote?elderId=${encodeURIComponent(elderId)}`);
      if (res.ok) {
        const data = await res.json();
        if (isMounted) {
          cachedCareNote = typeof data?.note === "string" && data.note.trim() ? data.note.trim() : null;
        }
      }
    } catch (_) {}
  };

  fetchServerCareNote();
  const pollTimer = setInterval(fetchServerCareNote, 2500);

  let firestoreUnsub = () => {};
  try {
    const elderRef = doc(db, "elders", elderId);
    firestoreUnsub = onSnapshot(
      elderRef,
      (snap) => {
        if (snap.exists() && isMounted) {
          const note = snap.data()?.careNote;
          if (typeof note === "string" && note.trim()) {
            cachedCareNote = note.trim();
          }
        }
      },
      () => {
        // Keep cached value on offline state
      }
    );
  } catch (_) {}

  careNoteUnsub = () => {
    isMounted = false;
    clearInterval(pollTimer);
    try { firestoreUnsub(); } catch (_) {}
  };

  return () => {
    if (careNoteUnsub) {
      careNoteUnsub();
      careNoteUnsub = null;
    }
  };
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

  // 0. Emergency & Distress Detection
  if (
    p.includes("സഹായം") ||
    p.includes("രക്ഷിക്കൂ") ||
    p.includes("അടിയന്തരം") ||
    p.includes("നെഞ്ചുവേദന") ||
    p.includes("വീണു") ||
    p.includes("വയ്യ") ||
    p.includes("സുഖമില്ല") ||
    p.includes("വേദന") ||
    p.includes("help") ||
    p.includes("emergency")
  ) {
    return "വിഷമിക്കേണ്ട നിവിൻ ചേട്ടാ, അടിയന്തര വിവരം വീട്ടുകാരെ ഉടൻ അറിയിച്ചിട്ടുണ്ട്. സഹായം ഉടൻ എത്തും, വിശ്രമിക്കൂ.";
  }

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

  // 4. Greetings & Welfare Responses
  if (p.includes("സുഖമായിരിക്കുന്നു") || p.includes("സുഖമാണ്") || p.includes("നല്ലത്")) {
    let reply = "കേട്ടതിൽ വളരെ സന്തോഷം നിവിൻ ചേട്ടാ! ഇന്നത്തെ ദിവസം നല്ലതായിരിക്കട്ടെ.";
    if (careNote) {
      reply += ` വീട്ടുകാർ പറഞ്ഞിട്ടുണ്ട്: "${careNote}".`;
    }
    return reply;
  }

  if (p.includes("നമസ്കാരം") || p.includes("ഹലോ") || p.includes("സുഖമാണോ")) {
    let reply = "നമസ്കാരം! സുഖമാണോ? ഇന്ന് എന്തെങ്കിലും സഹായം വേണമോ?";
    if (careNote) {
      reply += ` വീട്ടുകാർ പറഞ്ഞിട്ടുണ്ട്: "${careNote}".`;
    }
    return reply;
  }

  // 5. Health & Medicine
  if (p.includes("മരുന്ന്") || p.includes("ഗുളിക")) {
    if (p.includes("കഴിച്ചു")) {
      return "നല്ല കാര്യം നിവിൻ ചേട്ടാ! മരുന്ന് കൃത്യമായി കഴിച്ചതിൽ സന്തോഷം.";
    }
    return "ഡോക്ടർ പറഞ്ഞ കൃത്യസമയത്ത് മരുന്ന് കഴിക്കാൻ മറക്കരുത്. ആരോഗ്യമാണ് പ്രധാനം.";
  }
  if (p.includes("വിശക്കുന്നു") || p.includes("ഭക്ഷണം")) {
    return "കൃത്യസമയത്ത് ആഹാരം കഴിക്കുക. ആരോഗ്യത്തോടെ ഇരിക്കുക.";
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
  const p = userText.toLowerCase();

  // Check for emergency / distress triggers in spoken text
  const isEmergencySpoken =
    p.includes("സഹായം") ||
    p.includes("രക്ഷിക്കൂ") ||
    p.includes("അടിയന്തരം") ||
    p.includes("നെഞ്ചുവേദന") ||
    p.includes("വീണു") ||
    p.includes("വയ്യ") ||
    p.includes("സുഖമില്ല") ||
    p.includes("വേദന") ||
    p.includes("help") ||
    p.includes("emergency");

  if (isEmergencySpoken) {
    try {
      await triggerEmergencyEscalationDirect({
        elderId,
        reason: "elder_sos",
        notes: `മുതിർന്ന വ്യക്തി വോയിസ് വഴി അടിയന്തര സഹായം ആവശ്യപ്പെട്ടു: "${userText}"`,
      });
    } catch (e) {
      console.warn("Spoken emergency escalation trigger notice:", e);
    }
  } else if (p.includes("സുഖമായിരിക്കുന്നു") || p.includes("സുഖമാണ്") || p.includes("നല്ലത്")) {
    // Record successful check-in
    try {
      await recordWelfareCheckinDirect({
        elderId,
        status: "answered",
        note: `വോയിസ് സ്ഥിരീകരണം: "${userText}"`,
      });
    } catch (e) {
      console.warn("Welfare checkin record notice:", e);
    }
  }

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
    console.log("Could not load memories from Firestore:", memErr);
  }

  // 3. Generate empathetic reply
  const replyText = generateMalayalamReply(userText, memoryTexts, careNote);

  // 4. Generate audio streaming URI
  const audioUri = getMalayalamAudioUri(replyText);

  // 5. Store personal statements into semantic memory asynchronously
  if (text && text.length > 8 && !isEmergencySpoken) {
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
 * Records a general daily welfare check-in directly to Companion Server & Cloud Firestore.
 * Updates Family Dashboard across devices in real time.
 */
export async function recordWelfareCheckinDirect(params: {
  elderId: string;
  status: "answered" | "unanswered" | "pending";
  note?: string;
  escalationTriggered?: boolean;
}): Promise<void> {
  const { elderId, status, note, escalationTriggered } = params;
  const nowIso = new Date().toISOString();

  // Instant sync to Companion Server (LAN)
  fetch(`${BASE_URL}/checkins`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }).catch(() => {});

  try {
    const checkinRef = collection(db, "elders", elderId, "checkins");
    await addDoc(checkinRef, {
      elderId,
      elder_id: elderId,
      status,
      scheduledTime: nowIso,
      answeredAt: status === "answered" ? nowIso : null,
      moodNote: note || (status === "answered" ? "സുഖമായിരിക്കുന്നു (Elder responded)" : "ചെക്ക്-ഇൻ വിട്ടുപോയി"),
      escalationTriggered: !!escalationTriggered,
      createdAt: serverTimestamp(),
      type: "daily_checkin",
    });
  } catch (err) {
    console.warn("recordWelfareCheckinDirect warning:", err);
  }
}

/**
 * Trigger Emergency Escalation directly to Companion Server & Cloud Firestore.
 * Writes to escalations collection AND creates an emergency check-in record
 * so Family Dashboard on other devices receives push banners and status updates.
 */
export async function triggerEmergencyEscalationDirect(params: {
  elderId: string;
  reason: string;
  notes?: string;
}): Promise<{ success: boolean; escalationId: string }> {
  const { elderId, reason, notes } = params;
  const nowIso = new Date().toISOString();
  let serverEscId = `esc_${Date.now()}`;

  // Instant sync to Companion Server (LAN) for immediate alert on all devices
  fetch(`${BASE_URL}/escalations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ elderId, reason, notes }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data?.escalationId) serverEscId = data.escalationId;
    })
    .catch(() => {});

  let firestoreEscId = serverEscId;
  try {
    const escRef = collection(db, "elders", elderId, "escalations");
    const docAdded = await addDoc(escRef, {
      elderId,
      elder_id: elderId,
      reason: reason || "elder_sos",
      notes: notes || "മുതിർന്ന വ്യക്തി അടിയന്തര SOS സഹായം ആവശ്യപ്പെട്ടു (Elder pressed emergency SOS on screen)",
      resolved: false,
      triggeredAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      familyNotified: true,
    });
    firestoreEscId = docAdded.id;

    // Also log the emergency check-in record so Check-ins Tab and Overview Tab record it immediately
    const checkinRef = collection(db, "elders", elderId, "checkins");
    await addDoc(checkinRef, {
      elderId,
      elder_id: elderId,
      status: "unanswered",
      scheduledTime: nowIso,
      answeredAt: null,
      moodNote: `🚨 ${notes || "അടിയന്തര മുന്നറിയിപ്പ് (Emergency SOS Triggered)"}`,
      escalationTriggered: true,
      escalationId: docAdded.id,
      createdAt: serverTimestamp(),
      type: "emergency_sos",
    });
  } catch (checkinErr) {
    console.warn("Emergency Firestore write notice:", checkinErr);
  }

  return {
    success: true,
    escalationId: firestoreEscId,
  };
}

/**
 * Resolves an active emergency escalation across all devices.
 */
export async function resolveEmergencyEscalationDirect(
  elderId: string,
  escalationId: string
): Promise<void> {
  // Sync to Companion Server (LAN) with quick timeout
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    await fetch(`${BASE_URL}/escalations/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ elderId, escalationId }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (err) {
    console.warn("Companion server resolve warning:", err);
  }

  // Update Firestore in background without blocking UI
  try {
    if (escalationId && !escalationId.startsWith("esc_")) {
      const ref = doc(db, "elders", elderId, "escalations", escalationId);
      updateDoc(ref, {
        resolved: true,
        resolvedAt: serverTimestamp(),
      }).catch(() => {});
    } else {
      // If escalationId is from LAN server or general, also resolve any open escalations in Firestore
      const escCol = collection(db, "elders", elderId, "escalations");
      const unresEsc = await getDocs(query(escCol, where("resolved", "==", false), limit(5)));
      unresEsc.forEach((d) => {
        updateDoc(doc(db, "elders", elderId, "escalations", d.id), {
          resolved: true,
          resolvedAt: serverTimestamp(),
        }).catch(() => {});
      });
    }

    // Also mark linked checkins as answered in Firestore so Family Overview & Check-ins show safe status
    const checkinRef = collection(db, "elders", elderId, "checkins");
    const checkinDocs = await getDocs(
      query(checkinRef, where("status", "==", "unanswered"), limit(10))
    );
    checkinDocs.forEach((d) => {
      const data = d.data();
      if (
        data.escalationTriggered ||
        data.type === "emergency_sos" ||
        data.escalationId === escalationId
      ) {
        updateDoc(doc(db, "elders", elderId, "checkins", d.id), {
          status: "answered",
          answeredAt: serverTimestamp(),
          resolved: true,
          moodNote: "പരിഹരിച്ചു — കുടുംബം സ്ഥിരീകരിച്ചു (Resolved by Family)",
        }).catch(() => {});
      }
    });
  } catch (firestoreErr) {
    console.warn("resolveEmergencyEscalationDirect Firestore notice:", firestoreErr);
  }
}

/**
 * Save Family Care Note directly to Companion Server & Cloud Firestore.
 */
export async function setCareNoteDirect(params: {
  elderId: string;
  note: string;
}): Promise<{ success: boolean; saved: boolean }> {
  const { elderId, note } = params;
  const trimmed = (note || "").trim().slice(0, 280);

  // Sync to Companion Server (LAN)
  fetch(`${BASE_URL}/carenote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ elderId, note: trimmed }),
  }).catch(() => {});

  try {
    const elderRef = doc(db, "elders", elderId);
    await setDoc(elderRef, { careNote: trimmed || null }, { merge: true });
  } catch (e) {
    console.warn("setCareNoteDirect Firestore notice:", e);
  }

  return {
    success: true,
    saved: !!trimmed,
  };
}

/**
 * Generates an empathetic proactive check-in speech prompt locally.
 */
export function getProactiveFallbackVoice(elderId: string, type: string = "daily_checkin"): CompanionResult {
  const now = new Date();
  const hour = now.getHours();
  let greeting = "നമസ്കാരം നിവിൻ സാർ! സുഖമായിരിക്കുന്നുവോ? ഇന്ന് എന്തെങ്കിലും സഹായം വേണമോ?";

  if (type === "medication") {
    greeting = "നിവിൻ സാർ, ഇപ്പോൾ ഡോക്ടർ മോഹൻ പറഞ്ഞ ഗുളിക കഴിക്കേണ്ട സമയമാണ് കേട്ടോ. മരുന്ന് കഴിച്ചോ?";
  } else if (hour >= 5 && hour < 12) {
    greeting = "നമസ്കാരം നിവിൻ സാർ! സുപ്രഭാതം. ഇന്ന് സുഖമായിരിക്കുന്നുവോ? പ്രഭാതഭക്ഷണം കഴിച്ചോ?";
  } else if (hour >= 12 && hour < 17) {
    greeting = "നമസ്കാരം നിവിൻ സാർ! ഉച്ചഭക്ഷണം കഴിച്ചോ? മരുന്നുകൾ കഴിക്കാൻ മറക്കരുത് കേട്ടോ.";
  } else {
    greeting = "നമസ്കാരം നിവിൻ സാർ! വൈകുന്നേരമായി. ചൂടുള്ള ചായ കുടിച്ചോ? ഇന്ന് എങ്ങനെയുണ്ട് ആരോഗ്യം?";
  }

  return {
    success: true,
    response: greeting,
    audioUri: getMalayalamAudioUri(greeting),
  };
}
