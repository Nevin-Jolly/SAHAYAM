import { db } from "../constants/firebase";
import { BASE_URL } from "../constants/api";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDocs,
  where,
  limit,
} from "firebase/firestore";

export interface Medication {
  id: string;
  elder_id: string;
  name: string;
  dosage: string;
  instructions: string;
  cron_expr: string;
  time_str: string; // e.g. "08:00", "13:00", "20:00"
  time_label: string; // e.g. "8:00 AM (രാവിലെ)"
  active: boolean;
  last_taken_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PresetTime {
  id: string;
  label: string;
  time_str: string;
  cron_expr: string;
  hour: number;
  minute: number;
  period: "AM" | "PM";
}

export const PRESET_TIMES: PresetTime[] = [
  { id: "preset_morning", label: "8:00 AM (രാവിലെ)", time_str: "08:00", cron_expr: "0 8 * * *", hour: 8, minute: 0, period: "AM" },
  { id: "preset_noon", label: "1:00 PM (ഉച്ചയ്ക്ക്)", time_str: "13:00", cron_expr: "0 13 * * *", hour: 1, minute: 0, period: "PM" },
  { id: "preset_evening", label: "6:00 PM (വൈകുന്നേരം)", time_str: "18:00", cron_expr: "0 18 * * *", hour: 6, minute: 0, period: "PM" },
  { id: "preset_night", label: "8:30 PM (രാത്രി)", time_str: "20:30", cron_expr: "30 20 * * *", hour: 8, minute: 30, period: "PM" },
  { id: "preset_twice", label: "8:00 AM & 8:00 PM (രാവിലെയും രാത്രിയും)", time_str: "08:00", cron_expr: "0 8,20 * * *", hour: 8, minute: 0, period: "AM" },
];

/**
 * Converts 12-hour, minute, and AM/PM into normalized 24-hr time_str, display label, and cron expression.
 */
export function buildTimeConfig(hour12: number, minute: number, period: "AM" | "PM") {
  const h12 = Math.max(1, Math.min(12, Math.round(Number(hour12) || 8)));
  const m = Math.max(0, Math.min(59, Math.round(Number(minute) || 0)));
  let h24 = h12;
  if (period === "AM" && h12 === 12) h24 = 0;
  if (period === "PM" && h12 < 12) h24 = h12 + 12;

  const time_str = `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const minutePad = String(m).padStart(2, "0");

  let periodMl = "രാവിലെ";
  if (h24 >= 12 && h24 < 16) periodMl = "ഉച്ചയ്ക്ക്";
  else if (h24 >= 16 && h24 < 19) periodMl = "വൈകുന്നേരം";
  else if (h24 >= 19 || h24 < 5) periodMl = "രാത്രി";

  const time_label = `${h12}:${minutePad} ${period} (${periodMl})`;
  const cron_expr = `${m} ${h24} * * *`;

  return { time_str, time_label, cron_expr, hour12: h12, minute: m, period };
}

export const INSTRUCTION_PRESETS = [
  "ഭക്ഷണത്തിന് ശേഷം (After food)",
  "ഭക്ഷണത്തിന് മുൻപ് (Before food)",
  "വെള്ളത്തോടൊപ്പം (With water)",
  "ഉറങ്ങുന്നതിന് മുൻപ് (Before sleep)",
];

// In-memory fallback cache so the app always functions even with network lag
let memoryMedicationsCache: Medication[] = [
  {
    id: "med_init_01",
    elder_id: "elder_demo_001",
    name: "Metformin",
    dosage: "500mg",
    instructions: "ഭക്ഷണത്തിന് ശേഷം (After food)",
    cron_expr: "0 8 * * *",
    time_str: "08:00",
    time_label: "8:00 AM (രാവിലെ)",
    active: true,
    last_taken_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "med_init_02",
    elder_id: "elder_demo_001",
    name: "BP Tablet (Amlodipine)",
    dosage: "5mg",
    instructions: "രാത്രി ഭക്ഷണത്തിന് ശേഷം (After night food)",
    cron_expr: "30 20 * * *",
    time_str: "20:30",
    time_label: "8:30 PM (രാത്രി)",
    active: true,
    last_taken_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export function getCachedMedications(): Medication[] {
  return [...memoryMedicationsCache];
}

// Flag to avoid duplicate seeding
let isSeedingStarterMeds = false;

async function seedStarterMedicationsIfEmpty(elderId: string) {
  if (isSeedingStarterMeds) return;
  isSeedingStarterMeds = true;
  try {
    const medsRef = collection(db, "elders", elderId, "medications");
    for (const med of memoryMedicationsCache) {
      await addDoc(medsRef, {
        elder_id: elderId,
        elderId,
        name: med.name,
        dosage: med.dosage,
        instructions: med.instructions,
        cron_expr: med.cron_expr,
        time_str: med.time_str,
        time_label: med.time_label,
        active: true,
        last_taken_date: null,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
    }
  } catch (seedErr) {
    console.warn("Could not seed starter medications to Firestore:", seedErr);
  }
}

/**
 * Subscribes to real-time medications from Companion Server & Cloud Firestore.
 * Ensures instant sync across mobile devices on the network.
 */
export function subscribeMedications(
  elderId: string,
  onUpdate: (meds: Medication[]) => void,
  onError?: (err: any) => void
): () => void {
  let isMounted = true;

  // Immediately emit cached list
  onUpdate([...memoryMedicationsCache]);

  // Function to fetch latest from Companion Server (LAN)
  const fetchFromServer = async () => {
    try {
      const res = await fetch(`${BASE_URL}/medications?elderId=${encodeURIComponent(elderId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.medications && Array.isArray(data.medications) && isMounted) {
          memoryMedicationsCache = data.medications;
          onUpdate(data.medications);
        }
      }
    } catch (_) {
      // Server temporarily unreachable; offline cache active
    }
  };

  // Immediate fetch
  fetchFromServer();

  // Poll server every 2 seconds for live multi-device sync
  const pollTimer = setInterval(fetchFromServer, 2000);

  // Also listen to Cloud Firestore
  let unsubFirestore = () => {};
  try {
    const medsRef = collection(db, "elders", elderId, "medications");
    const q = query(medsRef);

    unsubFirestore = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty && isMounted) {
          const list: Medication[] = [];
          snapshot.forEach((d) => {
            const data = d.data();
            list.push({
              id: d.id,
              elder_id: elderId,
              name: data.name || "",
              dosage: data.dosage || "",
              instructions: data.instructions || "",
              cron_expr: data.cron_expr || "0 8 * * *",
              time_str: data.time_str || "08:00",
              time_label: data.time_label || "8:00 AM",
              active: data.active ?? true,
              last_taken_date: data.last_taken_date || null,
              created_at:
                data.created_at?.toDate?.()?.toISOString?.() ||
                (typeof data.created_at === "string" ? data.created_at : new Date().toISOString()),
              updated_at:
                data.updated_at?.toDate?.()?.toISOString?.() ||
                (typeof data.updated_at === "string" ? data.updated_at : new Date().toISOString()),
            });
          });
          list.sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          memoryMedicationsCache = list;
          onUpdate(list);
        }
      },
      (err) => {
        // Fallback to local cache & server
        onError?.(err);
      }
    );
  } catch (err) {
    // Firestore not initialized
  }

  return () => {
    isMounted = false;
    clearInterval(pollTimer);
    unsubFirestore();
  };
}

/**
 * Adds a new medication.
 */
export async function addMedication(
  elderId: string,
  data: {
    name: string;
    dosage: string;
    instructions: string;
    time_str: string;
    time_label: string;
    cron_expr: string;
  }
): Promise<Medication> {
  const newMed: Medication = {
    id: `med_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    elder_id: elderId,
    name: data.name.trim(),
    dosage: data.dosage.trim(),
    instructions: data.instructions.trim(),
    time_str: data.time_str || "08:00",
    time_label: data.time_label || "8:00 AM",
    cron_expr: data.cron_expr || "0 8 * * *",
    active: true,
    last_taken_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Add to in-memory cache immediately
  memoryMedicationsCache = [newMed, ...memoryMedicationsCache];

  // Sync to Companion Server (LAN) for instant multi-device reflection
  fetch(`${BASE_URL}/medications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, elderId }),
  }).catch(() => {});

  // Persist to Cloud Firestore with a 600ms race timeout so UI never hangs
  try {
    const firestoreSave = addDoc(collection(db, "elders", elderId, "medications"), {
      elder_id: elderId,
      name: newMed.name,
      dosage: newMed.dosage,
      instructions: newMed.instructions,
      time_str: newMed.time_str,
      time_label: newMed.time_label,
      cron_expr: newMed.cron_expr,
      active: true,
      last_taken_date: null,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    })
      .then((docRef) => {
        newMed.id = docRef.id;
      })
      .catch((err) => {
        console.warn("Firestore addDoc medication warning (cached locally):", err);
      });

    await Promise.race([
      firestoreSave,
      new Promise((resolve) => setTimeout(resolve, 600)),
    ]);
  } catch (err) {
    console.warn("Firestore addDoc medication timeout (cached locally):", err);
  }

  return newMed;
}

/**
 * Toggles active status of a medication.
 */
export async function toggleMedicationActive(
  elderId: string,
  medId: string,
  newActive: boolean
): Promise<void> {
  // Update local cache
  memoryMedicationsCache = memoryMedicationsCache.map((m) =>
    m.id === medId ? { ...m, active: newActive, updated_at: new Date().toISOString() } : m
  );

  // Sync to Companion Server (LAN)
  fetch(`${BASE_URL}/medications/toggle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ elderId, medicationId: medId, active: newActive }),
  }).catch(() => {});

  // Update Firestore
  try {
    const ref = doc(db, "elders", elderId, "medications", medId);
    await updateDoc(ref, {
      active: newActive,
      updated_at: serverTimestamp(),
    });
  } catch (err) {
    console.warn("Firestore updateDoc medication active warning:", err);
  }
}

/**
 * Deletes a medication.
 */
export async function deleteMedication(elderId: string, medId: string): Promise<void> {
  memoryMedicationsCache = memoryMedicationsCache.filter((m) => m.id !== medId);

  // Sync to Companion Server (LAN)
  fetch(`${BASE_URL}/medications/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ elderId, medicationId: medId }),
  }).catch(() => {});

  try {
    const ref = doc(db, "elders", elderId, "medications", medId);
    await deleteDoc(ref);
  } catch (err) {
    console.warn("Firestore deleteDoc medication warning:", err);
  }
}

/**
 * Records a positive medication check-in in Firestore elders/{elderId}/checkins,
 * immediately synchronizing to the Family Dashboard on other devices.
 */
export async function recordMedicationTakenCheckin(
  elderId: string,
  med: Medication
): Promise<void> {
  const noteText = `മരുന്ന് കഴിച്ചു: ${med.name} (${med.dosage}) — ${med.time_label || med.time_str}`;
  const nowIso = new Date().toISOString();

  // Sync to Companion Server (LAN)
  fetch(`${BASE_URL}/checkins`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      elderId,
      status: "answered",
      note: noteText,
      escalationTriggered: false,
      type: "medication",
    }),
  }).catch(() => {});

  try {
    const checkinRef = collection(db, "elders", elderId, "checkins");
    await addDoc(checkinRef, {
      elderId,
      elder_id: elderId,
      status: "answered",
      scheduledTime: nowIso,
      answeredAt: nowIso,
      moodNote: noteText,
      escalationTriggered: false,
      createdAt: serverTimestamp(),
      medicationId: med.id,
      medicationName: med.name,
      type: "medication",
    });
  } catch (err) {
    console.warn("recordMedicationTakenCheckin warning:", err);
  }
}

/**
 * Records an active reminder check-in in Firestore elders/{elderId}/checkins with status "unanswered".
 * This immediately ensures Family Dashboard indicates "✗ No" while waiting for the elder to press "Taken".
 */
export async function recordMedicationReminderCheckin(
  elderId: string,
  med: Medication
): Promise<void> {
  const noteText = `മരുന്ന് സമയം: ${med.name} (${med.dosage}) — കഴിച്ചിട്ടില്ല (Medication Reminder Active)`;
  const nowIso = new Date().toISOString();

  // Sync to Companion Server (LAN)
  fetch(`${BASE_URL}/checkins`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      elderId,
      status: "unanswered",
      note: noteText,
      escalationTriggered: false,
      type: "medication_due",
      medicationId: med.id,
      medicationName: med.name,
      scheduledTime: nowIso,
    }),
  }).catch(() => {});

  try {
    const checkinRef = collection(db, "elders", elderId, "checkins");
    await addDoc(checkinRef, {
      elderId,
      elder_id: elderId,
      status: "unanswered",
      scheduledTime: nowIso,
      answeredAt: null,
      moodNote: noteText,
      escalationTriggered: false,
      createdAt: serverTimestamp(),
      medicationId: med.id,
      medicationName: med.name,
      type: "medication_due",
    });
  } catch (err) {
    console.warn("recordMedicationReminderCheckin warning:", err);
  }
}

/**
 * Checks if a medication has already been taken today, taking into account
 * date strings ("YYYY-MM-DD"), ISO timestamps, and local timezone offsets.
 */
export function isMedicationTakenToday(med: Medication): boolean {
  if (!med.last_taken_date) return false;
  const str = String(med.last_taken_date).trim();
  if (!str || str === "null" || str === "undefined") return false;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const localToday = `${year}-${month}-${day}`;
  const utcToday = now.toISOString().split("T")[0];

  // 1. Matches today's date prefix (e.g. "2026-10-12" or "2026-10-12T...")
  if (str.startsWith(localToday) || str.startsWith(utcToday)) {
    return true;
  }

  // 2. Check if taken timestamp is within the last 18 hours
  try {
    const t = new Date(str).getTime();
    if (!isNaN(t)) {
      const hoursDiff = (now.getTime() - t) / (1000 * 60 * 60);
      if (hoursDiff >= 0 && hoursDiff < 18) {
        return true;
      }
    }
  } catch (_) {}

  return false;
}

/**
 * Checks if a medication is currently due or overdue today and has not yet been taken.
 */
export function isMedicationDueOrOverdue(med: Medication): boolean {
  if (!med.active) return false;
  if (isMedicationTakenToday(med)) return false;
  if (!med.time_str) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [h, m] = med.time_str.split(":").map(Number);
  const scheduledMinutes = h * 60 + (m || 0);

  // Due if within 45 minutes before scheduled time or any time after scheduled time today
  return currentMinutes >= scheduledMinutes - 45;
}

/**
 * Marks a medication as taken today by the elder.
 * Updates the medication document and immediately logs an answered check-in in Firestore.
 */
export async function markMedicationTaken(elderId: string, medId: string): Promise<void> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;
  const nowIso = now.toISOString();

  const targetMed = memoryMedicationsCache.find((m) => m.id === medId);

  // Mark in local memory cache immediately
  memoryMedicationsCache = memoryMedicationsCache.map((m) =>
    m.id === medId ? { ...m, last_taken_date: todayStr, updated_at: nowIso } : m
  );

  // Sync to Companion Server (LAN)
  fetch(`${BASE_URL}/medications/markTaken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ elderId, medicationId: medId }),
  }).catch(() => {});

  try {
    const ref = doc(db, "elders", elderId, "medications", medId);
    await updateDoc(ref, {
      last_taken_date: todayStr,
      updated_at: serverTimestamp(),
    });
  } catch (err) {
    console.warn("Firestore markMedicationTaken warning:", err);
  }

  // Also log the completed check-in so Family Dashboard receives real-time confirmation
  if (targetMed) {
    await recordMedicationTakenCheckin(elderId, targetMed);
  }

  // Also resolve any pending unanswered medication checkins for this elder in Firestore
  try {
    const checkinRef = collection(db, "elders", elderId, "checkins");
    const unans = await getDocs(
      query(checkinRef, where("status", "==", "unanswered"), limit(10))
    );
    unans.forEach((d) => {
      const data = d.data();
      if (data.type === "medication_due" || data.medicationId === medId) {
        updateDoc(doc(db, "elders", elderId, "checkins", d.id), {
          status: "answered",
          answeredAt: serverTimestamp(),
          moodNote: `മരുന്ന് കഴിച്ചു: ${targetMed?.name || "മരുന്ന്"} (${targetMed?.dosage || ""})`,
        }).catch(() => {});
      }
    });
  } catch (_) {}
}

/**
 * Returns any medication that is currently due (within +/- 45 minutes of scheduled time)
 * and not yet taken today.
 */
export function getDueMedication(medications: Medication[]): Medication | null {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const med of medications) {
    if (!med.active) continue;
    if (isMedicationTakenToday(med)) continue; // Already taken today

    if (med.time_str) {
      const [h, m] = med.time_str.split(":").map(Number);
      const scheduledMinutes = h * 60 + (m || 0);

      // Within 45 minutes of scheduled time
      if (Math.abs(currentMinutes - scheduledMinutes) <= 45) {
        return med;
      }
    }
  }
  return null;
}

/**
 * Generates spoken Malayalam reminder sentence for an elder.
 */
export function formatMedicationVoiceReminder(med: Medication): string {
  const instructionPart = med.instructions ? ` ${med.instructions}.` : "";
  return `നിവിൻ ചേട്ടാ, ഇപ്പോൾ ${med.name} (${med.dosage}) കഴിക്കാനുള്ള സമയമാണ് കേട്ടോ.${instructionPart} മരുന്ന് കഴിക്കാൻ മറക്കരുത്!`;
}

/**
 * Generates repeat reminder sentence when elder hasn't checked in within the scheduled interval.
 */
export function formatRepeatMedicationVoiceReminder(med: Medication, attempt: number = 2): string {
  const instructionPart = med.instructions ? ` ${med.instructions}.` : "";
  if (attempt >= 3) {
    return `നിവിൻ ചേട്ടാ, ${med.name} (${med.dosage}) മരുന്ന് ഇതുവരെ കഴിച്ചില്ലേ?${instructionPart} ദയവായി ഇപ്പോൾ തന്നെ മരുന്ന് കഴിക്കൂ.`;
  }
  return `നിവിൻ ചേട്ടാ, ${med.name} (${med.dosage}) മരുന്ന് കഴിക്കാൻ മറന്നോ?${instructionPart} ഇതുവരെ കഴിച്ചില്ലെങ്കിൽ ഇപ്പോൾ തന്നെ കഴിക്കണേ!`;
}

/**
 * Generates voice alert when medication check-in is officially missed and family alerted.
 */
export function formatMissedMedicationVoiceAlert(med: Medication): string {
  return `നിവിൻ ചേട്ടാ, ${med.name} മരുന്ന് കൃത്യസമയത്ത് കഴിക്കാതിരുന്ന വിവരം കുടുംബത്തെ അറിയിച്ചിട്ടുണ്ട്. ദയവായി ഇപ്പോൾ തന്നെ മരുന്ന് കഴിച്ച് സ്ക്രീനിൽ തൊടൂ.`;
}

/**
 * Records a missed medication check-in and triggers an escalation alert in the Family Dashboard.
 */
export async function recordMissedMedicationCheckin(elderId: string, med: Medication): Promise<void> {
  const noteText = `മരുന്ന് കഴിച്ചില്ല: ${med.name} (${med.dosage}) — ഷെഡ്യൂൾ ചെയ്തത് ${med.time_label || med.time_str}`;
  const nowIso = new Date().toISOString();

  // Instant sync to Companion Server (LAN) for real-time family phone alert banner
  fetch(`${BASE_URL}/escalations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      elderId,
      reason: "missed_medication",
      notes: `മരുന്ന് കഴിച്ചില്ല: ${med.name} (${med.dosage}) — ഷെഡ്യൂൾ ചെയ്തത് ${med.time_label || med.time_str}. 3 തവണ ഓർമ്മപ്പെടുത്തിയിട്ടും പ്രതികരണമില്ല.`,
    }),
  }).catch(() => {});

  try {
    // 1. Log missed checkin in elders/{elderId}/checkins
    const checkinRef = collection(db, "elders", elderId, "checkins");
    const checkinPromise = addDoc(checkinRef, {
      elder_id: elderId,
      status: "unanswered",
      scheduledTime: nowIso,
      answeredAt: null,
      moodNote: noteText,
      escalationTriggered: true,
      createdAt: serverTimestamp(),
    });

    // 2. Log active escalation in elders/{elderId}/escalations
    const escRef = collection(db, "elders", elderId, "escalations");
    const escPromise = addDoc(escRef, {
      elder_id: elderId,
      reason: "missed_medication",
      notes: `Missed medication: ${med.name} (${med.dosage}) scheduled at ${med.time_label || med.time_str}. Elder did not respond after 3 reminders.`,
      resolved: false,
      familyNotified: true,
      medicationId: med.id,
      triggeredAt: serverTimestamp(),
    });

    await Promise.race([
      Promise.all([checkinPromise, escPromise]),
      new Promise((resolve) => setTimeout(resolve, 800)),
    ]);
  } catch (err) {
    console.warn("recordMissedMedicationCheckin warning:", err);
  }
}

/**
 * Resolves missed medication escalation when elder eventually marks it as taken.
 */
export async function resolveMissedMedicationEscalation(elderId: string, medId: string): Promise<void> {
  // Sync to Companion Server (LAN)
  fetch(`${BASE_URL}/escalations/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ elderId, medicationId: medId }),
  }).catch(() => {});

  try {
    const escRef = collection(db, "elders", elderId, "escalations");
    const q = query(escRef, where("resolved", "==", false), where("medicationId", "==", medId));
    const snap = await getDocs(q);
    const updates = snap.docs.map((d) =>
      updateDoc(doc(db, "elders", elderId, "escalations", d.id), {
        resolved: true,
        resolvedAt: serverTimestamp(),
        resolvedBy: "elder_acknowledged_late",
      })
    );
    await Promise.race([Promise.all(updates), new Promise((res) => setTimeout(res, 800))]);
  } catch (err) {
    console.warn("resolveMissedMedicationEscalation notice:", err);
  }
}
