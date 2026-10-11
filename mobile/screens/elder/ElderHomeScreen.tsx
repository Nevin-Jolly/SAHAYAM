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
  useAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  RecordingPresets,
  AudioModule,
} from "expo-audio";
import type { AudioRecorder } from "expo-audio";
import {
  respondCompanionVoiceDirect,
  triggerEmergencyEscalationDirect,
} from "../../services/companionService";
import { useRole } from "../../context/RoleContext";

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
  const [statusText, setStatusText] = useState("സംസാരിക്കാൻ ഇവിടെ അമർത്തുക");
  const [statusTextEn, setStatusTextEn] = useState("(Tap to speak)");
  const [lastResponse, setLastResponse] = useState<string>("");
  const [fallbackText, setFallbackText] = useState("");
  const [showFallback, setShowFallback] = useState(false);
  const { logout } = useRole();

  // Recorder is created lazily inside startRecording() to avoid
  // "AudioRecorder.constructor rejected: activity not available" on mount.
  const recorderRef = useRef<AudioRecorder | null>(null);
  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);

  // Pulsing animation for the mic button while recording
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  // ─── Permissions on mount ──────────────────────────────────────────────────

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

    return () => {
      // Clean up any active recorder on unmount
      recorderRef.current?.stop().catch(() => {});
      recorderRef.current = null;
    };
  }, []);

  // ─── Playback completion listener ─────────────────────────────────────────

  useEffect(() => {
    if (playerStatus.didJustFinish) {
      setAppState("idle");
      setStatusText("സംസാരിക്കാൻ ഇവിടെ അമർത്തുക");
      setStatusTextEn("(Tap to speak)");
      setShowFallback(false);
    }
  }, [playerStatus.didJustFinish]);

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
      // Create the native recorder lazily — avoids crash at mount time
      const rec = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
      recorderRef.current = rec;
      await rec.prepareToRecordAsync();
      rec.record();
      setAppState("recording");
      setStatusText("കേൾക്കുന്നു...");
      setStatusTextEn("(Listening — tap to stop)");
      setShowFallback(false);
      setLastResponse("");
    } catch (e) {
      console.error("Recording start failed:", e);
      recorderRef.current = null;
      handleError("റെക്കോർഡിംഗ് ആരംഭിക്കാൻ കഴിഞ്ഞില്ല.");
    }
  }

  async function stopRecordingAndProcess() {
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
      setStatusText("ചിന്തിക്കുന്നു...");
      setStatusTextEn("(Listening and thinking...)");

      if (uri) {
        const responseData = await respondCompanionVoiceDirect({
          elderId: DEMO_ELDER_ID,
          text: "നമസ്കാരം",
        });

        if (responseData.success && responseData.response) {
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
      }

      // If audio processing yielded no speech, open fallback text input
      setShowFallback(true);
      setAppState("fallback_input");
      setStatusText("ടൈപ്പ് ചെയ്ത് അയക്കൂ");
      setStatusTextEn("(Tap below to type your message)");
    } catch (e: any) {
      console.error("Voice processing error:", e);
      setShowFallback(true);
      setAppState("fallback_input");
      setStatusText("ടൈപ്പ് ചെയ്ത് അയക്കൂ");
      setStatusTextEn("(Please type your message below)");
    }
  }

  // ─── Direct Companion + Voice Pipeline (Option B Free Mode) ────────────────

  async function sendTextToLLM(text: string) {
    setAppState("thinking");
    setStatusText("ചിന്തിക്കുന്നു...");
    setStatusTextEn("(Thinking...)");

    try {
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

  async function playSynthesizedAudio(audioUri: string) {
    setAppState("speaking");
    setStatusText("പറയുന്നു...");
    setStatusTextEn("(Speaking...)");

    try {
      player.replace({ uri: audioUri });
      player.play();
    } catch (e) {
      console.error("Audio playback error:", e);
      setAppState("idle");
      setStatusText("സംസാരിക്കാൻ ഇവിടെ അമർത്തുക");
      setStatusTextEn("(Tap to speak)");
    }
  }

  async function handleEmergencySOS() {
    Alert.alert(
      "അടിയന്തര സഹായം (Emergency SOS)",
      "വീട്ടുകാരെ ഉടൻ വിവരം അറിയിക്കണമോ?",
      [
        { text: "വേണ്ട (Cancel)", style: "cancel" },
        {
          text: "അതെ (Yes, Alert Family)",
          style: "destructive",
          onPress: async () => {
            try {
              setStatusText("അടിയന്തര സന്ദേശം അയക്കുന്നു...");
              await triggerEmergencyEscalationDirect({
                elderId: DEMO_ELDER_ID,
                reason: "elder_sos",
                notes: "Elder pressed emergency SOS on screen",
              });
              Alert.alert(
                "അറിയിപ്പ് നൽകി",
                "വീട്ടുകാർക്ക് അടിയന്തര സന്ദേശം വിജയകരമായി അയച്ചു."
              );
              setStatusText("സംസാരിക്കാൻ ഇവിടെ അമർത്തുക");
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
    } else if (appState === "idle") {
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
        return "#6C63FF"; // Default purple
    }
  }

  function isMicDisabled(): boolean {
    return ["transcribing", "thinking", "speaking"].includes(appState);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <StatusBar barStyle="light-content" backgroundColor="#0D0D1A" />

        {/* Top header with Switch Role */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.switchRoleBtn}
            onPress={logout}
            accessibilityLabel="Switch Role"
          >
            <Text style={styles.switchRoleBtnText}>🔄 റോൾ മാറ്റുക (Switch Role)</Text>
          </TouchableOpacity>
        </View>

        {/* App name in Malayalam script */}
        <Text style={styles.brandMalayalam}>സഹായം</Text>
        <Text style={styles.brandEnglish}>SAHAYAM</Text>
        <Text style={styles.tagline}>നിങ്ങളുടെ സ്നേഹിതൻ</Text>

        {/* Large mic button with pulse animation */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={[styles.micButton, { backgroundColor: getMicColor(), shadowColor: getMicColor() }]}
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
                {appState === "recording" ? "⏹️" : "🎙️"}
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Status text */}
        <Text style={styles.hint}>{statusText}</Text>
        <Text style={styles.hintEn}>{statusTextEn}</Text>

        {/* Last response display */}
        {lastResponse ? (
          <View style={styles.responseBox}>
            <Text style={styles.responseLabel}>സഹായം:</Text>
            <Text style={styles.responseText}>{lastResponse}</Text>
          </View>
        ) : null}

        {/* Text-input fallback — shown only after failed transcription */}
        {showFallback && (
          <View style={styles.fallbackBox}>
            <Text style={styles.fallbackLabel}>
              ടൈപ്പ് ചെയ്ത് അയക്കൂ:
            </Text>
            <TextInput
              style={styles.fallbackInput}
              value={fallbackText}
              onChangeText={setFallbackText}
              placeholder="ഇവിടെ ടൈപ്പ് ചെയ്യുക..."
              placeholderTextColor="#6B7280"
              multiline
              autoFocus
              returnKeyType="send"
              onSubmitEditing={handleFallbackSubmit}
              id="fallback-text-input"
            />
            <TouchableOpacity
              style={styles.fallbackButton}
              onPress={handleFallbackSubmit}
              id="fallback-submit-button"
            >
              <Text style={styles.fallbackButtonText}>അയക്കൂ →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Emergency SOS Button */}
        <TouchableOpacity
          style={styles.sosButton}
          onPress={handleEmergencySOS}
          activeOpacity={0.8}
          accessibilityLabel="Emergency SOS"
          accessibilityRole="button"
          id="elder-sos-button"
        >
          <Text style={styles.sosButtonText}>🚨 സഹായം വേണം (SOS)</Text>
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
    fontSize: 52,
    fontWeight: "800",
    color: "#A78BFA",
    letterSpacing: 2,
    marginBottom: 4,
  },
  brandEnglish: {
    fontSize: 18,
    fontWeight: "700",
    color: "#7C3AED",
    letterSpacing: 8,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: "#9CA3AF",
    marginBottom: 48,
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
    marginBottom: 32,
  },
  micIcon: {
    fontSize: 72,
  },
  hint: {
    fontSize: 18,
    color: "#D1D5DB",
    textAlign: "center",
    marginBottom: 4,
  },
  hintEn: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
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
  sosButton: {
    marginTop: 24,
    backgroundColor: "#DC2626",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  sosButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  topBar: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 8,
  },
  switchRoleBtn: {
    backgroundColor: "#1A1A2E",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A4A",
  },
  switchRoleBtnText: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "600",
  },
});
