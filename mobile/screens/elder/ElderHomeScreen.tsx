import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
  TextInput,
  ActivityIndicator,
  Animated,
  Easing,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import {
  createAudioPlayer,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  RecordingPresets,
  AudioModule,
} from "expo-audio";
import type { AudioPlayer, AudioRecorder, AudioStatus } from "expo-audio";
import {
  respondCompanionVoiceDirect,
  triggerEmergencyEscalationDirect,
  getProactiveFallbackVoice,
  getMalayalamAudioUri,
  subscribeCareNote,
} from "../../services/companionService";
import {
  Medication,
  subscribeMedications,
  getDueMedication,
  isMedicationTakenToday,
  markMedicationTaken,
  formatMedicationVoiceReminder,
  formatRepeatMedicationVoiceReminder,
  formatMissedMedicationVoiceAlert,
  recordMissedMedicationCheckin,
  resolveMissedMedicationEscalation,
  recordMedicationReminderCheckin,
} from "../../services/medicationService";
import {
  callRespondCompanionVoice,
  requestCompanionVoice,
  requestProactiveVoice,
} from "../../constants/api";
import { useRole } from "../../context/RoleContext";
import { useTheme } from "../../context/ThemeContext";
import * as FileSystem from "expo-file-system/legacy";

const { width } = Dimensions.get("window");
const MIC_SIZE = width * 0.52;

/**
 * ElderHomeScreen — Phase 1 implementation
 *
 * Full voice loop:
 *   1. User taps mic → recording starts
 *   2. User taps mic again → recording stops
 *   3. Audio sent to POST /voice/transcribe
 *   4. Transcribed text sent to POST /chat/respond
 *   5. LLM response text sent to POST /voice/synthesize
 *   6. MP3 audio played back on device
 *
 * Text-input fallback (confirmed by owner):
 *   - Shown only after a failed transcription (confidence < 0.3 OR success=false)
 *   - NOT always visible
 *   - User types text → sent directly to /chat/respond → /voice/synthesize → playback
 *
 * Audio stack: expo-audio (replaces deprecated expo-av, bundled in Expo Go SDK 52+)
 */

// Confidence threshold below which the text-input fallback is surfaced
const CONFIDENCE_THRESHOLD = 0.3;

// Elder ID — hardcoded for Phase 1; auth/login introduced in a later phase
const DEMO_ELDER_ID = "elder_demo_001";

type AppState =
  | "idle"
  | "recording"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "fallback_input"
  | "error";

export default function ElderHomeScreen() {
  const [appState, setAppState] = useState<AppState>("idle");
  const appStateRef = useRef<AppState>("idle");
  appStateRef.current = appState;

  const [statusText, setStatusText] = useState("സംസാരിക്കാൻ മൈക്രോഫോണിൽ തൊടുക");
  const [statusTextEn, setStatusTextEn] = useState("(Tap microphone to speak)");
  const [lastResponse, setLastResponse] = useState<string>("");
  const [lastTranscript, setLastTranscript] = useState<string>("");
  const [fallbackText, setFallbackText] = useState("");
  const [showFallback, setShowFallback] = useState(false);
  const { logout } = useRole();
  const { theme, isDark, toggleTheme } = useTheme();

  // Medication scheduling & reminder states
  const [medications, setMedications] = useState<Medication[]>([]);
  const [dueMedication, setDueMedication] = useState<Medication | null>(null);
  const [reminderStage, setReminderStage] = useState<"first" | "repeat" | "missed">("first");
  const medicationsRef = useRef<Medication[]>([]);

  // Detailed reminder tracking per medication key (medId_YYYY-MM-DD)
  interface MedTrackingInfo {
    firstSpokenAt: number;
    lastSpokenAt: number;
    repeatCount: number;
    stage: "first" | "repeat" | "missed" | "taken";
    taken?: boolean;
    familyEscalated?: boolean;
  }
  const medTrackingRef = useRef<Record<string, MedTrackingInfo>>({});

  // 1 minute (60 seconds) repeat interval as chosen by project owner
  const REPEAT_INTERVAL_MS = 60 * 1000;

  // Recorder is created lazily inside startRecording() to avoid
  // "AudioRecorder.constructor rejected: activity not available" on mount.
  const recorderRef = useRef<AudioRecorder | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);

  // Proactive speech tracking
  const isProactiveTurn = useRef<boolean>(false);

  // Pulsing animation for the mic button while recording
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  // Real-time synchronization of medications added by family
  useEffect(() => {
    const unsubscribe = subscribeMedications(DEMO_ELDER_ID, (list) => {
      medicationsRef.current = list;
      setMedications(list);
      const due = getDueMedication(list);
      const todayStr = new Date().toISOString().split("T")[0];
      const reminderKey = due ? `${due.id}_${todayStr}` : "";
      if (due && !medTrackingRef.current[reminderKey]?.taken) {
        setDueMedication(due);
      } else {
        setDueMedication(null);
      }
    });

    const medCheckTimer = setInterval(() => {
      if (appStateRef.current !== "idle") return;
      const due = getDueMedication(medicationsRef.current);
      if (!due) {
        setDueMedication(null);
        return;
      }

      const todayStr = new Date().toISOString().split("T")[0];
      const reminderKey = `${due.id}_${todayStr}`;
      const tracker = medTrackingRef.current[reminderKey];

      // If already taken, do not display prompt
      if (tracker?.taken) {
        setDueMedication(null);
        return;
      }

      setDueMedication(due);

      const nowMs = Date.now();

      // 1. Initial reminder trigger
      if (!tracker) {
        medTrackingRef.current[reminderKey] = {
          firstSpokenAt: nowMs,
          lastSpokenAt: nowMs,
          repeatCount: 1,
          stage: "first",
        };
        setReminderStage("first");
        recordMedicationReminderCheckin(DEMO_ELDER_ID, due);
        triggerMedicationVoiceReminder(due);
        return;
      }

      // 2. Repeat reminder every 1 minute (60s) if no response received
      const elapsedSinceLast = nowMs - tracker.lastSpokenAt;
      if (elapsedSinceLast >= REPEAT_INTERVAL_MS) {
        tracker.repeatCount = (tracker.repeatCount || 1) + 1;
        tracker.lastSpokenAt = nowMs;

        if (tracker.repeatCount === 2) {
          // 2nd reminder (1 minute past initial)
          tracker.stage = "repeat";
          setReminderStage("repeat");
          triggerRepeatMedicationVoiceReminder(due, 2);
          return;
        } else if (tracker.repeatCount === 3) {
          // 3rd reminder (2 minutes past initial)
          tracker.stage = "repeat";
          setReminderStage("repeat");
          triggerRepeatMedicationVoiceReminder(due, 3);
          return;
        } else if (tracker.repeatCount >= 4) {
          // 3 unanswered reminders (+3 minutes total) -> Alert Family Dashboard!
          tracker.stage = "missed";
          setReminderStage("missed");
          if (!tracker.familyEscalated) {
            tracker.familyEscalated = true;
            triggerMissedMedicationEscalation(due);
          } else {
            // Continues repeating every 1 minute so the elder is prompted until taken
            triggerRepeatMedicationVoiceReminder(due, tracker.repeatCount);
          }
          return;
        }
      }
    }, 4000);

    // Real-time care note subscription from family
    const careNoteUnsub = subscribeCareNote(DEMO_ELDER_ID);

    return () => {
      unsubscribe();
      careNoteUnsub();
      clearInterval(medCheckTimer);
    };
  }, []);

  async function triggerMedicationVoiceReminder(med: Medication) {
    try {
      const sentence = formatMedicationVoiceReminder(med);
      setLastResponse(sentence);
      setStatusText("മരുന്ന് കഴിക്കാനുള്ള സമയമായി!");
      setStatusTextEn("(Time to take your scheduled medicine!)");

      const audioUri = getMalayalamAudioUri(sentence);
      await playSynthesizedAudio(audioUri);
    } catch (err) {
      console.error("Medication reminder voice error:", err);
    }
  }

  async function triggerRepeatMedicationVoiceReminder(med: Medication, attempt: number = 2) {
    try {
      const sentence = formatRepeatMedicationVoiceReminder(med, attempt);
      setLastResponse(sentence);
      const titleMl = attempt >= 3
        ? "മരുന്ന് കഴിക്കാൻ മറന്നോ? (തുടർ ഓർമ്മപ്പെടുത്തൽ)"
        : "മരുന്ന് കഴിക്കാൻ മറന്നോ? (രണ്ടാമത്തെ ഓർമ്മപ്പെടുത്തൽ)";
      const titleEn = `(Reminder ${attempt}: 1 min past previous reminder)`;
      setStatusText(titleMl);
      setStatusTextEn(titleEn);

      const audioUri = getMalayalamAudioUri(sentence);
      await playSynthesizedAudio(audioUri);
    } catch (err) {
      console.error("Repeat medication voice error:", err);
    }
  }

  async function triggerMissedMedicationEscalation(med: Medication) {
    try {
      // 1. Mark as missed check-in and alert family in Firestore
      await recordMissedMedicationCheckin(DEMO_ELDER_ID, med);

      // 2. Spoken alert to elder
      const sentence = formatMissedMedicationVoiceAlert(med);
      setLastResponse(sentence);
      setStatusText("മരുന്ന് കഴിച്ചില്ല — വീട്ടുകാരെ അറിയിച്ചു!");
      setStatusTextEn("(Check-in Missed — Family Alerted)");

      const audioUri = getMalayalamAudioUri(sentence);
      await playSynthesizedAudio(audioUri);
    } catch (err) {
      console.error("Missed medication escalation error:", err);
    }
  }

  function isMedicationTakenIntent(text: string): boolean {
    const t = (text || "").toLowerCase().trim();
    if (!t) return false;
    return (
      (t.includes("മരുന്ന്") && (t.includes("കഴിച്ചു") || t.includes("എടുത്തു") || t.includes("കഴിക്കാം") || t.includes("കഴിക്കുകയാണ്") || t.includes("കഴിക്കാൻ പോവുക"))) ||
      (t.includes("ഗുളിക") && (t.includes("കഴിച്ചു") || t.includes("എടുത്തു"))) ||
      (t.includes("കഴിച്ചു") && !t.includes("ഭക്ഷണം കഴിച്ചു") && !t.includes("ചായ") && !t.includes("ബ്രേക്ക്ഫാസ്റ്റ്")) ||
      t.includes("dolo കഴിച്ചു") ||
      t.includes("dolo എടുത്തു") ||
      t.includes("മെറ്റ്ഫോർമിൻ കഴിച്ചു") ||
      t.includes("ഗുളിക എടുത്തു") ||
      t.includes("taken") ||
      t.includes("took medicine")
    );
  }

  async function handleAcknowledgeMedication(med: Medication) {
    try {
      // 1. Immediately dismiss from UI state so it disappears INSTANTLY
      setDueMedication(null);
      setReminderStage("first");

      // 2. Mark in local tracking that this medication has been taken today
      const todayStr = new Date().toISOString().split("T")[0];
      const reminderKey = `${med.id}_${todayStr}`;
      medTrackingRef.current[reminderKey] = {
        firstSpokenAt: Date.now(),
        lastSpokenAt: Date.now(),
        repeatCount: 1,
        stage: "taken",
        taken: true,
      };

      // 3. Update local medications state so getDueMedication sees it as taken
      const updatedList = medicationsRef.current.map((m) =>
        m.id === med.id ? { ...m, last_taken_date: todayStr } : m
      );
      medicationsRef.current = updatedList;
      setMedications(updatedList);

      // 4. Update status display with immediate visual confirmation
      setStatusText("✓ മരുന്ന് കഴിച്ചു — രേഖപ്പെടുത്തി!");
      setStatusTextEn("(Medication taken — logged!)");

      // 5. Sync to server & Cloud Firestore
      await markMedicationTaken(DEMO_ELDER_ID, med.id);
      await resolveMissedMedicationEscalation(DEMO_ELDER_ID, med.id);

      const ackVoice = "നല്ല കാര്യം നിവിൻ ചേട്ടാ! കൃത്യസമയത്ത് മരുന്ന് കഴിച്ചതിൽ സന്തോഷം.";
      setLastResponse(ackVoice);
      const audioUri = getMalayalamAudioUri(ackVoice);
      await playSynthesizedAudio(audioUri);
    } catch (err) {
      console.error("Mark medication taken error:", err);
    }
  }

  async function triggerManualMedicationCheck() {
    const list = medicationsRef.current.length > 0 ? medicationsRef.current : medications;
    if (list.length === 0) {
      const noMed = "നിവിൻ ചേട്ടാ, ഇപ്പോൾ പുതിയ മരുന്നുകൾ ഒന്നും ഷെഡ്യൂൾ ചെയ്തിട്ടില്ല.";
      setLastResponse(noMed);
      const audioUri = getMalayalamAudioUri(noMed);
      await playSynthesizedAudio(audioUri);
      return;
    }
    const summary = list
      .filter((m) => m.active)
      .map((m) => `${m.name} (${m.dosage}) ${m.time_label || m.time_str}`)
      .join(", ");
    const voiceText = `നിവിൻ ചേട്ടാ, ഇന്നത്തെ മരുന്നുകൾ: ${summary} ആണ്.`;
    setLastResponse(voiceText);
    const audioUri = getMalayalamAudioUri(voiceText);
    await playSynthesizedAudio(audioUri);
  }

  // ─── Proactive Speech Trigger ─────────────────────────────────────────────

  async function triggerProactiveSpeech(type: string = "daily_checkin") {
    // Only trigger proactive speech if app is currently idle
    if (appStateRef.current !== "idle") return;

    try {
      isProactiveTurn.current = true;
      setAppState("speaking");
      setStatusText("സഹായം സംസാരിക്കുന്നു...");
      setStatusTextEn("(Sahayam is speaking to you...)");

      let voiceData: { response: string; audioUri?: string } | null = null;
      try {
        const remote = await requestProactiveVoice({ elderId: DEMO_ELDER_ID, type });
        if (remote && remote.success && remote.response) {
          voiceData = remote;
        }
      } catch (err) {
        console.log("Remote proactive endpoint unavailable, using local fallback:", err);
      }

      if (!voiceData) {
        voiceData = getProactiveFallbackVoice(DEMO_ELDER_ID, type);
      }

      setLastResponse(voiceData.response);
      if (voiceData.audioUri) {
        await playSynthesizedAudio(voiceData.audioUri, true);
      } else {
        isProactiveTurn.current = false;
        setAppState("idle");
        setStatusText("സംസാരിക്കാൻ മൈക്രോഫോണിൽ തൊടുക");
        setStatusTextEn("(Tap microphone to speak)");
      }
    } catch (e) {
      console.error("Proactive speech error:", e);
      isProactiveTurn.current = false;
      setAppState("idle");
      setStatusText("സംസാരിക്കാൻ മൈക്രോഫോണിൽ തൊടുക");
      setStatusTextEn("(Tap microphone to speak)");
    }
  }

  // ─── Permissions & Scheduled Check-ins ────────────────────────────────────

  useEffect(() => {
    (async () => {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert(
          "അനുമതി ആവശ്യമാണ്",
          "മൈക്രോഫോൺ ഉപയോഗിക്കാൻ അനുമതി നൽകുക.",
          [{ text: "ശരി" }]
        );
      }
    })();

    // Scheduled daily check-ins (e.g. 8:00 AM, 1:00 PM, 7:00 PM)
    const scheduledInterval = setInterval(() => {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (["08:00", "13:00", "19:00", "20:00"].includes(timeStr) && appStateRef.current === "idle") {
        triggerProactiveSpeech("scheduled_checkin");
      }
    }, 45000);

    return () => {
      clearInterval(scheduledInterval);
      if (playerRef.current) {
        try {
          playerRef.current.pause();
          playerRef.current.remove();
        } catch (_) {}
        playerRef.current = null;
      }
      recorderRef.current?.stop().catch(() => {});
      recorderRef.current = null;
    };
  }, []);

  // ─── Pulse animation ───────────────────────────────────────────────────────

  useEffect(() => {
    if (appState === "recording") {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.12,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [appState]);

  // ─── Recording ─────────────────────────────────────────────────────────────

  async function startRecording() {
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      // Flattened options for Android MediaRecorder compatibility
      const recordingOptions = {
        extension: ".m4a",
        sampleRate: 44100,
        numberOfChannels: 1, // Mono for higher speech-to-text accuracy & low noise
        bitRate: 64000,
        isMeteringEnabled: false,
        ...(Platform.OS === "android"
          ? { outputFormat: "mpeg4", audioEncoder: "aac" }
          : { outputFormat: "aac" }),
      };

      // Create the native recorder lazily — avoids crash at mount time
      const rec = new AudioModule.AudioRecorder(recordingOptions as any);
      recorderRef.current = rec;
      await rec.prepareToRecordAsync();
      rec.record();
      setAppState("recording");
      setStatusText("കേൾക്കുന്നു... (സംസാരിക്കൂ)");
      setStatusTextEn("(Listening... speak now, tap mic when finished)");
      setShowFallback(false);
      setLastResponse("");

      // Auto-stop recording after 12 seconds if user doesn't tap to stop
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = setTimeout(() => {
        if (appStateRef.current === "recording") {
          stopRecordingAndProcess();
        }
      }, 12000);
    } catch (e) {
      console.error("Recording start failed:", e);
      recorderRef.current = null;
      handleError("റെക്കോർഡിംഗ് ആരംഭിക്കാൻ കഴിഞ്ഞില്ല.");
    }
  }

  async function stopRecordingAndProcess() {
    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    setAppState("transcribing");
    setStatusText("മനസ്സിലാക്കുന്നു...");
    setStatusTextEn("(Understanding your speech...)");

    const rec = recorderRef.current;
    if (!rec) {
      handleError("ശബ്ദം പ്രോസസ്സ് ചെയ്യാൻ കഴിഞ്ഞില്ല.");
      return;
    }

    try {
      await rec.stop();
      const uri = rec.uri;
      recorderRef.current = null;

      if (!uri) {
        throw new Error("No recording URI");
      }

      await processVoiceUri(uri);
    } catch (e) {
      console.error("Stop/process error:", e);
      recorderRef.current = null;
      handleError("ശബ്ദം പ്രോസസ്സ് ചെയ്യാൻ കഴിഞ്ഞില്ല.");
    }
  }

  async function processVoiceUri(uri: string) {
    try {
      setAppState("thinking");
      setStatusText("മനസ്സിലാക്കുന്നു...");
      setStatusTextEn("(Processing speech...)");

      // 1. Give Android MediaRecorder a brief moment to finish flushing to disk
      await new Promise((r) => setTimeout(r, 150));

      // 2. Read recorded audio file directly from device storage as Base64
      let audioBase64: string | undefined;
      try {
        audioBase64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        console.log(`[Audio Base64 Read]: ${audioBase64?.length || 0} characters`);
      } catch (readErr) {
        console.error("FileSystem.readAsStringAsync failed:", readErr);
      }

      // 3. Call local companion server with multimodal audio if base64 is available
      let answered = false;
      if (audioBase64 && audioBase64.length > 50) {
        try {
          const responseData = await requestCompanionVoice({
            elderId: DEMO_ELDER_ID,
            audioBase64,
            mimeType: "audio/mp4",
          });
          if (responseData && responseData.success && responseData.response) {
            answered = true;
            if (responseData.transcript) {
              setLastTranscript(responseData.transcript);
              const currentDue = dueMedication || getDueMedication(medicationsRef.current);
              if (currentDue && isMedicationTakenIntent(responseData.transcript)) {
                await handleAcknowledgeMedication(currentDue);
                return;
              }
            }
            setLastResponse(responseData.response);
            if (responseData.audioUri) {
              await playSynthesizedAudio(responseData.audioUri);
              return;
            } else {
              setAppState("idle");
              setStatusText("സംസാരിക്കാൻ ഇവിടെ അമർത്തുക");
              setStatusTextEn("(Tap to speak)");
              return;
            }
          }
        } catch (serverErr: any) {
          console.log("Companion server audio call error:", serverErr?.message || serverErr);
        }
      }

      // 3.5. Try Firebase Cloud Function (Managed-Cloud v2 pipeline)
      if (!answered && audioBase64 && audioBase64.length > 50) {
        try {
          const cfPromise = callRespondCompanionVoice({
            elderId: DEMO_ELDER_ID,
            audioBase64,
          });
          const cfRes = await Promise.race([
            cfPromise,
            new Promise<null>((_, reject) => setTimeout(() => reject(new Error("CF timeout")), 5000)),
          ]);
          if (cfRes && (cfRes as any).data?.success && (cfRes as any).data?.response) {
            answered = true;
            const cfData = (cfRes as any).data;
            setLastResponse(cfData.response);
            if (cfData.audioUri) {
              await playSynthesizedAudio(cfData.audioUri);
              return;
            } else {
              setAppState("idle");
              setStatusText("സംസാരിക്കാൻ ഇവിടെ അമർത്തുക");
              setStatusTextEn("(Tap to speak)");
              return;
            }
          }
        } catch (_) {
          // Cloud function unavailable, continue to in-app fallback
        }
      }

      // 4. In-App Companion Fallback: if server and cloud function unreachable, generate empathetic local response
      if (!answered) {
        try {
          const fallbackData = await respondCompanionVoiceDirect({
            elderId: DEMO_ELDER_ID,
            text: "ശബ്ദം കേൾക്കാമോ",
          });
          if (fallbackData && fallbackData.success && fallbackData.response) {
            setLastResponse(fallbackData.response);
            if (fallbackData.audioUri) {
              await playSynthesizedAudio(fallbackData.audioUri);
              return;
            }
          }
        } catch (localErr) {
          console.warn("Local fallback companion error:", localErr);
        }
      }

      // 5. Fallback: If both fail, surface text fallback
      setShowFallback(true);
      setAppState("fallback_input");
      setStatusText("ശബ്ദം തിരിച്ചറിയാൻ കഴിഞ്ഞില്ല — ദയവായി ടൈപ്പ് ചെയ്യുക");
      setStatusTextEn("(Voice processing offline — please type below)");
    } catch (e: any) {
      console.error("Voice processing error:", e);
      setShowFallback(true);
      setAppState("fallback_input");
      setStatusText("ടൈപ്പ് ചെയ്ത് അയക്കൂ");
      setStatusTextEn("(Please type your message below)");
    }
  }

  // ─── Direct Companion + Voice Pipeline ────────────────────────────────────

  async function sendTextToLLM(text: string) {
    setAppState("thinking");
    setStatusText("ചിന്തിക്കുന്നു...");
    setStatusTextEn("(Thinking...)");
    setLastTranscript(text);

    // Immediate check if elder typed/spoke they took their medication
    const currentDue = dueMedication || getDueMedication(medicationsRef.current);
    if (currentDue && isMedicationTakenIntent(text)) {
      await handleAcknowledgeMedication(currentDue);
      return;
    }

    try {
      // 1. Try companion server first
      try {
        const serverResult = await requestCompanionVoice({
          elderId: DEMO_ELDER_ID,
          text,
        });
        if (serverResult && serverResult.success && serverResult.response) {
          const responseText = serverResult.response;
          setLastResponse(responseText);
          if (serverResult.audioUri) {
            await playSynthesizedAudio(serverResult.audioUri);
            return;
          } else {
            setAppState("idle");
            setStatusText("സംസാരിക്കാൻ ഇവിടെ അമർത്തുക");
            setStatusTextEn("(Tap to speak)");
            return;
          }
        }
      } catch (serverErr) {
        console.log("Companion server text call unavailable, trying Cloud Function or local fallback:", serverErr);
      }

      // 1.5. Try Firebase Cloud Function (Managed-Cloud v2 pipeline)
      try {
        const cfPromise = callRespondCompanionVoice({
          elderId: DEMO_ELDER_ID,
          text,
        });
        const cfRes = await Promise.race([
          cfPromise,
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error("CF timeout")), 5000)),
        ]);
        if (cfRes && (cfRes as any).data?.success && (cfRes as any).data?.response) {
          const cfData = (cfRes as any).data;
          setLastResponse(cfData.response);
          if (cfData.audioUri) {
            await playSynthesizedAudio(cfData.audioUri);
            return;
          } else {
            setAppState("idle");
            setStatusText("സംസാരിക്കാൻ ഇവിടെ അമർത്തുക");
            setStatusTextEn("(Tap to speak)");
            return;
          }
        }
      } catch (_) {
        // Cloud Function unavailable, proceed to in-app companion fallback
      }

      // 2. Local in-app companion fallback
      const responseData = await respondCompanionVoiceDirect({
        elderId: DEMO_ELDER_ID,
        text,
      });

      if (!responseData.success || !responseData.response) {
        throw new Error("No response returned from companion");
      }

      const responseText = responseData.response;
      setLastResponse(responseText);

      // Play synthesized Malayalam voice if audioUri returned
      if (responseData.audioUri) {
        await playSynthesizedAudio(responseData.audioUri);
      } else {
        setAppState("idle");
        setStatusText("സംസാരിക്കാൻ ഇവിടെ അമർത്തുക");
        setStatusTextEn("(Tap to speak)");
      }
    } catch (e: any) {
      console.error("Companion voice error:", e);
      handleError("മറുപടി ലഭിക്കാൻ കഴിഞ്ഞില്ല.");
    }
  }

  async function playSynthesizedAudio(audioUri: string, isProactive: boolean = false) {
    setAppState("speaking");
    setStatusText("പറയുന്നു...");
    setStatusTextEn("(Speaking...)");

    try {
      // Safely cleanup previous audio player
      if (playerRef.current) {
        try {
          playerRef.current.pause();
          playerRef.current.remove();
        } catch (_) {}
        playerRef.current = null;
      }

      const player = createAudioPlayer({ uri: audioUri });
      playerRef.current = player;

      player.addListener("playbackStatusUpdate", (status: AudioStatus) => {
        if (status.didJustFinish) {
          if (isProactiveTurn.current || isProactive) {
            isProactiveTurn.current = false;
            // Sahayam finished proactive speech: open mic for reply
            setStatusText("നിങ്ങൾ പറയുന്നത് കേൾക്കുന്നു...");
            setStatusTextEn("(Listening to your reply — speak now)");
            setTimeout(() => {
              startRecording().catch(() => {
                setAppState("idle");
                setStatusText("മറുപടി പറയാൻ മൈക്രോഫോണിൽ തൊടുക");
                setStatusTextEn("(Tap microphone to reply)");
              });
            }, 350);
          } else {
            setAppState("idle");
            setStatusText("സംസാരിക്കാൻ മൈക്രോഫോണിൽ തൊടുക");
            setStatusTextEn("(Tap microphone to speak)");
            setShowFallback(false);
          }
        }
      });

      player.play();
    } catch (e) {
      console.error("Audio playback error:", e);
      isProactiveTurn.current = false;
      setAppState("idle");
      setStatusText("സംസാരിക്കാൻ ഇവിടെ അമർത്തുക");
      setStatusTextEn("(Tap to speak)");
    }
  }

  async function handleEmergencySOS() {
    Alert.alert(
      "അടിയന്തര സഹായം (Emergency SOS)",
      "കുടുംബാംഗങ്ങളെ ഉടൻ അറിയിക്കണമോ? (Alert family immediately?)",
      [
        { text: "വേണ്ട (Cancel)", style: "cancel" },
        {
          text: "അതെ (Yes, Alert Family)",
          style: "destructive",
          onPress: async () => {
            try {
              setStatusText("അടിയന്തര സന്ദേശം അയക്കുന്നു...");
              setStatusTextEn("(Sending emergency alert to family dashboard...)");
              await triggerEmergencyEscalationDirect({
                elderId: DEMO_ELDER_ID,
                reason: "elder_sos",
                notes: "മുതിർന്ന വ്യക്തി സ്ക്രീനിൽ നിന്ന് അടിയന്തര SOS സഹായം ആവശ്യപ്പെട്ടു (Elder pressed SOS on screen)",
              });
              Alert.alert(
                "അറിയിപ്പ് നൽകി (Alert Sent)",
                "വീട്ടുകാരുടെ ഡാഷ്‌ബോർഡിലേക്ക് അടിയന്തര മുന്നറിയിപ്പ് വിജയകരമായി അയച്ചു. സഹായം ഉടൻ എത്തും."
              );
              setStatusText("സംസാരിക്കാൻ മൈക്രോഫോണിൽ തൊടുക");
              setStatusTextEn("(Tap microphone to speak)");
            } catch (err) {
              console.error("SOS trigger error:", err);
              Alert.alert("പിശക്", "സന്ദേശം അയക്കാൻ കഴിഞ്ഞില്ല.");
            }
          },
        },
      ]
    );
  }

  // ─── Mic Button Handler ────────────────────────────────────────────────────

  async function handleMicPress() {
    if (appState === "recording") {
      await stopRecordingAndProcess();
    } else if (appState === "speaking") {
      // User tapped while Sahayam is speaking: stop audio immediately and start recording
      if (playerRef.current) {
        try {
          playerRef.current.pause();
          playerRef.current.remove();
        } catch (_) {}
        playerRef.current = null;
      }
      await startRecording();
    } else {
      await startRecording();
    }
  }

  // ─── Fallback text input submit ────────────────────────────────────────────

  async function handleFallbackSubmit() {
    if (!fallbackText.trim()) return;
    const text = fallbackText.trim();
    setFallbackText("");
    setShowFallback(false);
    await sendTextToLLM(text);
  }

  // ─── Error state ───────────────────────────────────────────────────────────

  function handleError(msg: string) {
    setAppState("idle");
    setStatusText("ഒരു പ്രശ്നം ഉണ്ടായി");
    setStatusTextEn(msg);
    setTimeout(() => {
      setStatusText("സംസാരിക്കാൻ ഇവിടെ അമർത്തുക");
      setStatusTextEn("(Tap to speak)");
    }, 3000);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function getMicColor(): string {
    switch (appState) {
      case "recording":
        return "#EF4444"; // Red while recording
      case "thinking":
      case "transcribing":
        return "#F59E0B"; // Amber while processing
      case "speaking":
        return "#10B981"; // Green while speaking
      default:
        return theme.primary;
    }
  }

  function isMicDisabled(): boolean {
    return ["transcribing", "thinking"].includes(appState);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
        keyboardShouldPersistTaps="handled"
      >
        <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.statusBarBg} />

        {/* Top header with Switch Role, Theme Toggle, and Proactive Demo Trigger */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={[styles.proactiveTriggerBtn, { backgroundColor: theme.cardSecondary, borderColor: theme.border }]}
            onPress={() => triggerProactiveSpeech("daily_checkin")}
            accessibilityLabel="Trigger Proactive Speech"
          >
            <Text style={[styles.proactiveTriggerBtnText, { color: theme.primary }]}>⚡ മുൻകൈയെടുക്കൽ (Proactive)</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <TouchableOpacity
              style={[styles.switchRoleBtn, { backgroundColor: theme.cardSecondary, borderColor: theme.border }]}
              onPress={toggleTheme}
              accessibilityLabel="Toggle Theme"
            >
              <Text style={[styles.switchRoleBtnText, { color: theme.textSecondary }]}>
                {isDark ? "☀️ Light" : "🌙 Dark"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.switchRoleBtn, { backgroundColor: theme.cardSecondary, borderColor: theme.border }]}
              onPress={logout}
              accessibilityLabel="Switch Role"
            >
              <Text style={[styles.switchRoleBtnText, { color: theme.primary }]}>🔄 റോൾ (Switch)</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* App name in Malayalam script */}
        <Text style={[styles.brandMalayalam, { color: theme.brandMalayalam }]}>സഹായം</Text>
        <Text style={[styles.brandEnglish, { color: theme.brandEnglish }]}>SAHAYAM</Text>
        <Text style={[styles.tagline, { color: theme.textMuted }]}>മുതിർന്നവർക്കായുള്ള മലയാളം വോയിസ് സഹായി</Text>

        {/* Large mic button with pulse animation */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={[
              styles.micButton,
              {
                backgroundColor: getMicColor(),
                shadowColor: isDark ? getMicColor() : theme.micShadow,
              },
            ]}
            activeOpacity={isMicDisabled() ? 1 : 0.8}
            onPress={handleMicPress}
            disabled={isMicDisabled()}
            accessibilityLabel={appState === "recording" ? "Stop recording" : "Speak to Sahayam"}
            accessibilityRole="button"
            id="mic-button"
          >
            {isMicDisabled() ? (
              <ActivityIndicator size="large" color="#FFFFFF" />
            ) : (
              <Text style={styles.micIcon}>
                {appState === "recording" ? "⏹️" : appState === "speaking" ? "🔊" : "🎙️"}
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Status text */}
        <Text style={[styles.hint, { color: theme.text }]}>{statusText}</Text>
        <Text style={[styles.hintEn, { color: theme.textMuted }]}>{statusTextEn}</Text>

        {/* Spoken Transcript display */}
        {lastTranscript ? (
          <View style={[styles.transcriptBox, { backgroundColor: theme.transcriptBoxBg, borderColor: theme.transcriptBoxBorder }]}>
            <Text style={[styles.transcriptLabel, { color: theme.primary }]}>🎙️ നിങ്ങൾ പറഞ്ഞത് (You said):</Text>
            <Text style={[styles.transcriptText, { color: theme.textSecondary }]}>"{lastTranscript}"</Text>
          </View>
        ) : null}

        {/* Last response display */}
        {lastResponse ? (
          <View style={[styles.responseBox, { backgroundColor: theme.responseBoxBg, borderColor: theme.responseBoxBorder }]}>
            <Text style={[styles.responseLabel, { color: theme.primary }]}>സഹായം:</Text>
            <Text style={[styles.responseText, { color: theme.text }]}>{lastResponse}</Text>
          </View>
        ) : null}

        {/* Text-input fallback — shown only after failed transcription */}
        {showFallback && (
          <View style={[styles.fallbackBox, { backgroundColor: theme.cardSecondary, borderColor: theme.warningBorder }]}>
            <Text style={[styles.fallbackLabel, { color: theme.warning }]}>
              ടൈപ്പ് ചെയ്ത് അയക്കൂ:
            </Text>
            <TextInput
              style={[
                styles.fallbackInput,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: theme.inputBorder,
                  color: theme.inputText,
                },
              ]}
              value={fallbackText}
              onChangeText={setFallbackText}
              placeholder="ഇവിടെ ടൈപ്പ് ചെയ്യുക..."
              placeholderTextColor={theme.inputPlaceholder}
              multiline
              autoFocus
              returnKeyType="send"
              onSubmitEditing={handleFallbackSubmit}
              id="fallback-text-input"
            />
            <TouchableOpacity
              style={[styles.fallbackButton, { backgroundColor: theme.primary }]}
              onPress={handleFallbackSubmit}
              id="fallback-submit-button"
            >
              <Text style={styles.fallbackButtonText}>അയക്കൂ →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Due Medication Alert Card with 3-Stage Escalation */}
        {dueMedication ? (
          <View
            style={[
              styles.dueMedCard,
              {
                backgroundColor:
                  reminderStage === "missed"
                    ? (isDark ? "#2B0B0B" : "#FEF2F2")
                    : reminderStage === "repeat"
                    ? (isDark ? "#2A1B0B" : "#FFFBEB")
                    : (isDark ? "#2E1A1A" : "#FFFBEB"),
                borderColor: reminderStage === "missed" ? "#EF4444" : "#F59E0B",
              },
            ]}
          >
            <View style={styles.dueMedHeaderRow}>
              <Text style={styles.dueMedIcon}>
                {reminderStage === "missed" ? "🚨" : reminderStage === "repeat" ? "⏰" : "🔔"}
              </Text>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text
                  style={[
                    styles.dueMedTitle,
                    {
                      color:
                        reminderStage === "missed"
                          ? (isDark ? "#FCA5A5" : "#991B1B")
                          : (isDark ? "#FDE68A" : "#92400E"),
                    },
                  ]}
                >
                  {reminderStage === "missed"
                    ? "മരുന്ന് കഴിച്ചില്ല — വീട്ടുകാരെ അറിയിച്ചു!"
                    : reminderStage === "repeat"
                    ? "മരുന്ന് കഴിക്കാൻ മറന്നോ? (2-ാം ഓർമ്മപ്പെടുത്തൽ)"
                    : "മരുന്ന് കഴിക്കാനുള്ള സമയമായി!"}
                </Text>
                <Text
                  style={[
                    styles.dueMedSubTitle,
                    {
                      color:
                        reminderStage === "missed"
                          ? "#EF4444"
                          : (isDark ? "#F59E0B" : "#D97706"),
                    },
                  ]}
                >
                  {reminderStage === "missed"
                    ? "(Check-in Missed — Alert Sent to Family Dashboard)"
                    : reminderStage === "repeat"
                    ? "(Repeat Reminder: 1 minute past schedule)"
                    : "(Time to take your scheduled medicine)"}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.dueMedBody,
                {
                  backgroundColor: isDark ? "#1C1414" : "#FFFFFF",
                  borderWidth: isDark ? 0 : 1,
                  borderColor: isDark ? "transparent" : "#E2E8F0",
                },
              ]}
            >
              <Text style={[styles.dueMedName, { color: isDark ? "#FFFFFF" : "#0F172A" }]}>
                💊 {dueMedication.name} ({dueMedication.dosage})
              </Text>
              {dueMedication.instructions ? (
                <Text style={[styles.dueMedInstructions, { color: isDark ? "#E5E7EB" : "#334155" }]}>
                  📋 {dueMedication.instructions}
                </Text>
              ) : null}
              <Text style={[styles.dueMedTime, { color: theme.primary }]}>
                ⏰ {dueMedication.time_label || dueMedication.time_str}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.dueMedAckBtn,
                reminderStage === "repeat" && { backgroundColor: "#D97706" },
                reminderStage === "missed" && { backgroundColor: "#DC2626" },
              ]}
              onPress={() => handleAcknowledgeMedication(dueMedication)}
              activeOpacity={0.8}
            >
              <Text style={styles.dueMedAckBtnText}>
                {reminderStage === "missed"
                  ? "✓ ഇപ്പോൾ കഴിച്ചു (Taken Now — Clear Alert)"
                  : reminderStage === "repeat"
                  ? "✓ ഇപ്പോൾ കഴിച്ചു (Taken Now)"
                  : "✓ മരുന്ന് കഴിച്ചു (Taken)"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Today's Scheduled Medications Bar */}
        {medications.length > 0 ? (
          <View style={[styles.medSummaryCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={[styles.medSummaryHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.medSummaryTitle, { color: theme.primary }]} numberOfLines={1}>
                💊 ഇന്നത്തെ മരുന്നുകൾ
              </Text>
              <TouchableOpacity
                onPress={triggerManualMedicationCheck}
                style={[styles.medSummaryVoiceBtn, { backgroundColor: theme.cardHighlight }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.medSummaryVoiceBtnText, { color: theme.primary }]}>🔊 വായിക്കുക (Read)</Text>
              </TouchableOpacity>
            </View>
            {medications.map((m) => (
              <View key={m.id} style={styles.medSummaryItem}>
                <Text style={[styles.medSummaryItemText, { color: theme.textSecondary }]}>
                  • <Text style={{ fontWeight: "700", color: theme.text }}>{m.name}</Text> ({m.dosage}) — {m.time_label || m.time_str}
                </Text>
                {m.instructions ? (
                  <Text style={[styles.medSummaryItemSub, { color: theme.textMuted }]}>  {m.instructions}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* Emergency SOS Button */}
        <TouchableOpacity
          style={styles.sosButton}
          onPress={handleEmergencySOS}
          activeOpacity={0.8}
          accessibilityLabel="Emergency SOS"
          accessibilityRole="button"
          id="elder-sos-button"
        >
          <Text style={styles.sosButtonIcon}>🚨</Text>
          <Text style={styles.sosButtonText}>സഹായം വേണം (SOS)</Text>
          <Text style={styles.sosButtonSub}>കുടുംബത്തെ ഉടൻ വിവരം അറിയിക്കാൻ തൊടുക</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Utility: ArrayBuffer → base64 ────────────────────────────────────────────

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#0D0D1A",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  brandMalayalam: {
    fontSize: 48,
    fontWeight: "800",
    color: "#A78BFA",
    letterSpacing: 1,
    marginBottom: 4,
    textAlign: "center",
  },
  brandEnglish: {
    fontSize: 16,
    fontWeight: "700",
    color: "#7C3AED",
    letterSpacing: 1.2,
    paddingHorizontal: 8,
    marginBottom: 6,
    textAlign: "center",
  },
  tagline: {
    fontSize: 14,
    fontWeight: "500",
    color: "#9CA3AF",
    marginBottom: 36,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  micButton: {
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: MIC_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 32,
    elevation: 20,
    marginBottom: 28,
  },
  micIcon: {
    fontSize: 72,
  },
  hint: {
    fontSize: 18,
    fontWeight: "600",
    color: "#D1D5DB",
    textAlign: "center",
    marginBottom: 4,
    lineHeight: 26,
    paddingHorizontal: 12,
    includeFontPadding: false,
  },
  hintEn: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 18,
    paddingHorizontal: 10,
    includeFontPadding: false,
  },
  transcriptBox: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    width: "100%",
    borderWidth: 1,
    borderColor: "#374151",
  },
  transcriptLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 6,
  },
  transcriptText: {
    fontSize: 16,
    color: "#E5E7EB",
    fontStyle: "italic",
    lineHeight: 24,
  },
  responseBox: {
    backgroundColor: "#1A1A2E",
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
    width: "100%",
    borderWidth: 1,
    borderColor: "#6C63FF44",
  },
  responseLabel: {
    fontSize: 12,
    color: "#6C63FF",
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 8,
  },
  responseText: {
    fontSize: 18,
    color: "#F3F4F6",
    lineHeight: 28,
  },
  fallbackBox: {
    width: "100%",
    marginTop: 16,
    backgroundColor: "#1A1A2E",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F59E0B44",
  },
  fallbackLabel: {
    fontSize: 14,
    color: "#F59E0B",
    fontWeight: "600",
    marginBottom: 8,
  },
  fallbackInput: {
    backgroundColor: "#0D0D1A",
    borderRadius: 10,
    padding: 12,
    color: "#F3F4F6",
    fontSize: 16,
    minHeight: 60,
    borderWidth: 1,
    borderColor: "#374151",
    marginBottom: 12,
  },
  fallbackButton: {
    backgroundColor: "#6C63FF",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  fallbackButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  topBar: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  proactiveTriggerBtn: {
    backgroundColor: "#161D2E",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#3B82F6",
  },
  proactiveTriggerBtnText: {
    color: "#60A5FA",
    fontSize: 12,
    fontWeight: "700",
  },
  switchRoleBtn: {
    backgroundColor: "#1A1A2E",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#374151",
  },
  switchRoleBtnText: {
    color: "#A78BFA",
    fontSize: 12,
    fontWeight: "700",
  },
  dueMedCard: {
    backgroundColor: "#2E1A1A",
    borderRadius: 16,
    padding: 18,
    marginTop: 14,
    width: "100%",
    borderWidth: 2,
    borderColor: "#F59E0B",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  dueMedCardRepeat: {
    backgroundColor: "#2A1B0B",
    borderColor: "#F59E0B",
    shadowColor: "#F59E0B",
  },
  dueMedCardMissed: {
    backgroundColor: "#2B0B0B",
    borderColor: "#EF4444",
    shadowColor: "#EF4444",
  },
  dueMedHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  dueMedIcon: {
    fontSize: 24,
  },
  dueMedTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FDE68A",
  },
  dueMedSubTitle: {
    fontSize: 12,
    color: "#D97706",
  },
  dueMedBody: {
    backgroundColor: "#1C1414",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  dueMedName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  dueMedInstructions: {
    fontSize: 13,
    color: "#E5E7EB",
    marginBottom: 4,
  },
  dueMedTime: {
    fontSize: 13,
    color: "#60A5FA",
    fontWeight: "600",
  },
  dueMedAckBtn: {
    backgroundColor: "#10B981",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dueMedAckBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  medSummaryCard: {
    backgroundColor: "#16162A",
    borderRadius: 16,
    padding: 16,
    marginTop: 14,
    width: "100%",
    borderWidth: 1,
    borderColor: "#3730A3",
  },
  medSummaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A4A",
    paddingBottom: 8,
  },
  medSummaryTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#C7D2FE",
    marginRight: 8,
  },
  medSummaryVoiceBtn: {
    backgroundColor: "#312E81",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  medSummaryVoiceBtnText: {
    color: "#A5B4FC",
    fontSize: 12,
    fontWeight: "700",
  },
  medSummaryItem: {
    marginBottom: 8,
  },
  medSummaryItemText: {
    fontSize: 14,
    color: "#D1D5DB",
    lineHeight: 20,
  },
  medSummaryItemSub: {
    fontSize: 12,
    color: "#9CA3AF",
    marginLeft: 12,
  },
  sosButton: {
    backgroundColor: "#DC2626",
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginTop: 22,
    marginBottom: 20,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#EF4444",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  sosButtonIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  sosButtonText: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "center",
  },
  sosButtonSub: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FEE2E2",
    marginTop: 4,
    textAlign: "center",
  },
});
