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
import { useTheme } from "../../context/ThemeContext";

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
  const { theme } = useTheme();

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
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}>
        <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.statusBarBg} />

        {/* Back Button */}
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={onBack}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={[styles.backBtnText, { color: theme.primary }]}>← പിന്നോട്ട് (Back)</Text>
        </TouchableOpacity>

        {/* Header Area */}
        <View style={styles.headerArea}>
          <Text style={styles.iconEmoji}>👴</Text>
          <Text style={[styles.titleMalayalam, { color: theme.brandMalayalam }]}>നമസ്കാരം!</Text>
          <Text style={[styles.titleSub, { color: theme.text }]}>സഹായം വോയിസ് സഹായിയിലേക്ക് സ്വാഗതം</Text>
          <Text style={[styles.titleSubEn, { color: theme.textMuted }]}>Welcome to Sahayam Voice Companion</Text>
        </View>

        {/* Name / Profile Card */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.cardLabel, { color: theme.text }]}>നിങ്ങളുടെ പേര് (Your Name):</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBg,
                borderColor: theme.inputBorder,
                color: theme.inputText,
              },
            ]}
            value={elderName}
            onChangeText={setElderName}
            placeholder="നിങ്ങളുടെ പേര് ടൈപ്പ് ചെയ്യുക"
            placeholderTextColor={theme.inputPlaceholder}
          />
          <Text style={[styles.hintText, { color: theme.textMuted }]}>
            സ്നേഹത്തോടെ സംസാരിക്കാൻ നിങ്ങളുടെ പേര് ഓർത്തു വെക്കും.
          </Text>
        </View>

        {/* Big Start Button */}
        <TouchableOpacity
          style={[styles.startBtn, { backgroundColor: theme.primary }, loading && styles.btnDisabled]}
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
        <View style={[styles.assistanceNote, { backgroundColor: theme.cardSecondary, borderColor: theme.border }]}>
          <Text style={styles.assistanceIcon}>💡</Text>
          <Text style={[styles.assistanceText, { color: theme.textSecondary }]}>
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
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 36,
    justifyContent: "space-between",
  },
  backBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  backBtnText: {
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
    textAlign: "center",
    marginBottom: 8,
  },
  titleSub: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 4,
  },
  titleSubEn: {
    fontSize: 13,
    textAlign: "center",
  },
  card: {
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    marginBottom: 24,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  input: {
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: "600",
    borderWidth: 1,
    marginBottom: 10,
  },
  hintText: {
    fontSize: 13,
    lineHeight: 18,
  },
  startBtn: {
    borderRadius: 22,
    paddingVertical: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6C63FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 20,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  startBtnIcon: {
    fontSize: 40,
    marginBottom: 6,
  },
  startBtnText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  startBtnSub: {
    fontSize: 14,
    fontWeight: "600",
    color: "#E0E7FF",
  },
  assistanceNote: {
    flexDirection: "row",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    alignItems: "center",
  },
  assistanceIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  assistanceText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
});
