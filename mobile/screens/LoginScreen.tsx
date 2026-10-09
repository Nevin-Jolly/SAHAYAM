import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
} from "react-native";
import { API } from "../constants/api";

/**
 * LoginScreen — Phase 6: Role selection with backend health check.
 *
 * Replaces the hardcoded CURRENT_ROLE in RootNavigator.
 * Two large buttons: "I am the Elder" / "I am a Family Member".
 * Tapping either:
 *   1. Pings /health to confirm backend is reachable (early failure feedback).
 *   2. Stores the selected role.
 *   3. Calls onLogin(role) to advance to the role-appropriate screen.
 *
 * Phase 6 privacy note displayed inline:
 *   Conversation history is private to the elder; family sees structured data only.
 *
 * Note: Full auth (credentials, JWT) is out of scope for this academic project.
 * Role selection here provides the panel-demonstrable separation of access paths.
 */

interface Props {
  onLogin: (role: "elder" | "family") => void;
}

export default function LoginScreen({ onLogin }: Props) {
  const [checking, setChecking] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"elder" | "family" | null>(null);

  const handleRoleSelect = async (role: "elder" | "family") => {
    setSelectedRole(role);
    setChecking(true);

    try {
      const res = await fetch(API.health, {
        method: "GET",
        headers: { "X-Role": role },
      });

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Backend returned status 404. Your ngrok tunnel is offline or BASE_URL in constants/api.ts is outdated.");
        }
        throw new Error(`Backend returned status ${res.status}`);
      }

      // Backend is reachable — proceed to the role screen
      onLogin(role);
    } catch (e: any) {
      Alert.alert(
        "Cannot Reach Server",
        "The SAHAYAM backend is not reachable.\n\n" +
          "Please check that:\n" +
          "• The FastAPI server is running\n" +
          "• ngrok is active and BASE_URL in api.ts is updated\n\n" +
          `Error: ${e.message}`,
        [{ text: "OK" }]
      );
    } finally {
      setChecking(false);
      setSelectedRole(null);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D1A" />

      {/* Logo / Title */}
      <View style={styles.logoArea}>
        <Text style={styles.logoEmoji}>🤝</Text>
        <Text style={styles.appName}>സഹായം</Text>
        <Text style={styles.appNameEn}>SAHAYAM</Text>
        <Text style={styles.tagline}>Malayalam Voice Companion{"\n"}for Elderly Care</Text>
      </View>

      {/* Role Selection */}
      <View style={styles.roleArea}>
        <Text style={styles.prompt}>Who are you?</Text>

        {/* Elder button */}
        <TouchableOpacity
          style={[
            styles.roleBtn,
            styles.elderBtn,
            selectedRole === "elder" && styles.roleBtnLoading,
          ]}
          onPress={() => handleRoleSelect("elder")}
          disabled={checking}
          accessibilityLabel="I am the elder"
          accessibilityRole="button"
        >
          {checking && selectedRole === "elder" ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : (
            <>
              <Text style={styles.roleBtnIcon}>👴</Text>
              <Text style={styles.roleBtnTitle}>ഞാൻ മൂപ്പര്‍ ആണ്</Text>
              <Text style={styles.roleBtnSub}>I am the Elder</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Family button */}
        <TouchableOpacity
          style={[
            styles.roleBtn,
            styles.familyBtn,
            selectedRole === "family" && styles.roleBtnLoading,
          ]}
          onPress={() => handleRoleSelect("family")}
          disabled={checking}
          accessibilityLabel="I am a family member"
          accessibilityRole="button"
        >
          {checking && selectedRole === "family" ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : (
            <>
              <Text style={styles.roleBtnIcon}>👨‍👩‍👦</Text>
              <Text style={styles.roleBtnTitle}>ഞാൻ കുടുംബാംഗം ആണ്</Text>
              <Text style={styles.roleBtnSub}>I am a Family Member</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Privacy notice */}
      <View style={styles.privacyNote}>
        <Text style={styles.privacyIcon}>🔒</Text>
        <Text style={styles.privacyText}>
          The elder's conversations are private and not accessible to family members.
        </Text>
      </View>

      {/* Footer */}
      <Text style={styles.footer}>KTU CSD415 · Group 9</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D1A",
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 32,
    justifyContent: "space-between",
  },
  logoArea: {
    alignItems: "center",
    paddingTop: 20,
  },
  logoEmoji: {
    fontSize: 64,
    marginBottom: 12,
  },
  appName: {
    fontSize: 36,
    fontWeight: "800",
    color: "#6C63FF",
    letterSpacing: 3,
  },
  appNameEn: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4B5563",
    letterSpacing: 6,
    marginTop: 2,
  },
  tagline: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 22,
  },
  roleArea: {
    gap: 16,
  },
  prompt: {
    fontSize: 18,
    fontWeight: "700",
    color: "#9CA3AF",
    textAlign: "center",
    marginBottom: 8,
  },
  roleBtn: {
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 110,
    borderWidth: 2,
  },
  elderBtn: {
    backgroundColor: "#1A1A2E",
    borderColor: "#6C63FF",
  },
  familyBtn: {
    backgroundColor: "#1A2E1A",
    borderColor: "#10B981",
  },
  roleBtnLoading: {
    opacity: 0.7,
  },
  roleBtnIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  roleBtnTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#F9FAFB",
    marginBottom: 2,
  },
  roleBtnSub: {
    fontSize: 13,
    color: "#9CA3AF",
  },
  privacyNote: {
    flexDirection: "row",
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1F2937",
    alignItems: "flex-start",
  },
  privacyIcon: {
    fontSize: 14,
    marginRight: 8,
    marginTop: 1,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 18,
  },
  footer: {
    textAlign: "center",
    color: "#374151",
    fontSize: 11,
    letterSpacing: 1,
  },
});
