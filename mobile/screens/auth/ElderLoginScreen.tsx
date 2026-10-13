import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

interface Props {
  onLogin: () => void;
  onBack: () => void;
}

/**
 * ElderLoginScreen — Dedicated Accessible Login for Elderly Users
 * Designed with large fonts, high contrast, warm Malayalam phrasing,
 * and simple 1-tap access without complex passwords.
 */
export default function ElderLoginScreen({ onLogin, onBack }: Props) {
  const [elderName, setElderName] = useState("നിവിൻ");
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 350));
    setLoading(false);
    onLogin();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0D0D1A" />

        {/* Back Button */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={styles.backBtnText}>← പിന്നോട്ട് (Back)</Text>
        </TouchableOpacity>

        {/* Header Area */}
        <View style={styles.headerArea}>
          <Text style={styles.iconEmoji}>👴</Text>
          <Text style={styles.titleMalayalam}>നമസ്കാരം!</Text>
          <Text style={styles.titleSub}>സഹായം വോയിസ് സഹായിയിലേക്ക് സ്വാഗതം</Text>
          <Text style={styles.titleSubEn}>Welcome to Sahayam Voice Companion</Text>
        </View>

        {/* Name / Profile Card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>നിങ്ങളുടെ പേര് (Your Name):</Text>
          <TextInput
            style={styles.input}
            value={elderName}
            onChangeText={setElderName}
            placeholder="നിങ്ങളുടെ പേര് ടൈപ്പ് ചെയ്യുക"
            placeholderTextColor="#6B7280"
          />
          <Text style={styles.hintText}>
            സ്നേഹത്തോടെ സംസാരിക്കാൻ നിങ്ങളുടെ പേര് ഓർത്തു വെക്കും.
          </Text>
        </View>

        {/* Big Start Button */}
        <TouchableOpacity
          style={[styles.startBtn, loading && styles.btnDisabled]}
          onPress={handleStart}
          disabled={loading}
          activeOpacity={0.85}
          accessibilityLabel="Start voice companion"
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator size="large" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.startBtnIcon}>🎙️</Text>
              <Text style={styles.startBtnText}>സംഭാഷണം ആരംഭിക്കുക</Text>
              <Text style={styles.startBtnSub}>(Start Speaking)</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Assistance Note */}
        <View style={styles.assistanceNote}>
          <Text style={styles.assistanceIcon}>💡</Text>
          <Text style={styles.assistanceText}>
            മൈക്രോഫോണിൽ തൊട്ട് മലയാളത്തിൽ സംസാരിച്ചാൽ സഹായം ഉടനടി മറുപടി നൽകും.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#0D0D1A",
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 36,
    justifyContent: "space-between",
  },
  backBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#1A1A2E",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2A2A4A",
    marginBottom: 20,
  },
  backBtnText: {
    color: "#A78BFA",
    fontSize: 14,
    fontWeight: "700",
  },
  headerArea: {
    alignItems: "center",
    marginBottom: 24,
  },
  iconEmoji: {
    fontSize: 64,
    marginBottom: 12,
  },
  titleMalayalam: {
    fontSize: 34,
    fontWeight: "800",
    color: "#A78BFA",
    textAlign: "center",
    marginBottom: 8,
  },
  titleSub: {
    fontSize: 16,
    fontWeight: "600",
    color: "#E5E7EB",
    textAlign: "center",
    marginBottom: 4,
  },
  titleSubEn: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#1A1A2E",
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: "#6C63FF44",
    marginBottom: 24,
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#D1D5DB",
    marginBottom: 10,
  },
  input: {
    backgroundColor: "#0D0D1A",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: "600",
    color: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#4B5563",
    marginBottom: 10,
  },
  hintText: {
    fontSize: 13,
    color: "#9CA3AF",
    lineHeight: 18,
  },
  startBtn: {
    backgroundColor: "#6C63FF",
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6C63FF",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 24,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  startBtnIcon: {
    fontSize: 32,
    marginBottom: 6,
  },
  startBtnText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 2,
    textAlign: "center",
  },
  startBtnSub: {
    fontSize: 14,
    fontWeight: "600",
    color: "#E0E7FF",
    textAlign: "center",
  },
  assistanceNote: {
    flexDirection: "row",
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1F2937",
    alignItems: "center",
  },
  assistanceIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  assistanceText: {
    flex: 1,
    fontSize: 13,
    color: "#9CA3AF",
    lineHeight: 20,
  },
});
