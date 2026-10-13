import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
} from "react-native";

interface Props {
  onSelectElder: () => void;
  onSelectFamily: () => void;
}

/**
 * LoginScreen / Role Portal Screen
 * Welcome gateway allowing users to choose between:
 *   1. Dedicated Elder Login Page
 *   2. Dedicated Family Member Login Page
 */
export default function LoginScreen({ onSelectElder, onSelectFamily }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D1A" />

      {/* Brand Header */}
      <View style={styles.logoArea}>
        <Text style={styles.logoEmoji}>🤝</Text>
        <Text style={styles.appName}>സഹായം</Text>
        <Text style={styles.appNameEn}>SAHAYAM</Text>
        <Text style={styles.tagline}>
          മുതിർന്നവർക്കായുള്ള മലയാളം വോയിസ് സഹായി{"\n"}
          (Malayalam Voice Companion for Elderly Care)
        </Text>
      </View>

      {/* Role Selection Prompt */}
      <View style={styles.roleArea}>
        <Text style={styles.prompt}>പ്രവേശന മാർഗ്ഗം തിരഞ്ഞെടുക്കുക (Select Role):</Text>

        {/* Elder Entry Card */}
        <TouchableOpacity
          style={[styles.roleBtn, styles.elderBtn]}
          onPress={onSelectElder}
          activeOpacity={0.85}
          accessibilityLabel="Elder portal"
          accessibilityRole="button"
        >
          <View style={styles.roleBtnHeader}>
            <Text style={styles.roleBtnIcon}>👴</Text>
            <View style={styles.roleBtnTextContainer}>
              <Text style={styles.roleBtnTitle}>മുതിർന്ന വ്യക്തി (Elder)</Text>
              <Text style={styles.roleBtnSub}>
                വോയിസ് സഹായി ഉപയോഗിച്ച് സംസാരിക്കാം
              </Text>
              <Text style={styles.roleBtnAction}>തുടങ്ങാൻ ഇവിടെ തൊടുക →</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Family Entry Card */}
        <TouchableOpacity
          style={[styles.roleBtn, styles.familyBtn]}
          onPress={onSelectFamily}
          activeOpacity={0.85}
          accessibilityLabel="Family caregiver portal"
          accessibilityRole="button"
        >
          <View style={styles.roleBtnHeader}>
            <Text style={styles.roleBtnIcon}>👨‍👩‍👦</Text>
            <View style={styles.roleBtnTextContainer}>
              <Text style={styles.roleBtnTitle}>കുടുംബാംഗം (Family Member)</Text>
              <Text style={styles.roleBtnSub}>
                ആരോഗ്യവും മരുന്നുകളും നിരീക്ഷിക്കാം
              </Text>
              <Text style={[styles.roleBtnAction, styles.familyActionText]}>
                ഡാഷ്‌ബോർഡിലേക്ക് പോകുക →
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* Privacy Notice */}
      <View style={styles.privacyNote}>
        <Text style={styles.privacyIcon}>🔒</Text>
        <Text style={styles.privacyText}>
          മുതിർന്നവരുടെ സംഭാഷണങ്ങൾ തികച്ചും സ്വകാര്യമാണ്. കുടുംബാംഗങ്ങൾക്ക് ഇത് കേൾക്കാൻ സാധിക്കില്ല.
        </Text>
      </View>

      {/* Academic Footer */}
      <Text style={styles.footer}>KTU B.Tech Capstone CSD415 · Group 9</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#0D0D1A",
    paddingHorizontal: 22,
    paddingTop: 48,
    paddingBottom: 28,
    justifyContent: "space-between",
  },
  logoArea: {
    alignItems: "center",
    paddingTop: 12,
  },
  logoEmoji: {
    fontSize: 56,
    marginBottom: 8,
  },
  appName: {
    fontSize: 38,
    fontWeight: "800",
    color: "#A78BFA",
    textAlign: "center",
    marginBottom: 2,
  },
  appNameEn: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6B7280",
    textAlign: "center",
    letterSpacing: 2, // Low letterSpacing avoids Android right-edge clipping of 'M'
    marginBottom: 10,
  },
  tagline: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  roleArea: {
    gap: 16,
    marginVertical: 20,
  },
  prompt: {
    fontSize: 15,
    fontWeight: "700",
    color: "#D1D5DB",
    textAlign: "center",
    marginBottom: 6,
  },
  roleBtn: {
    borderRadius: 22,
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderWidth: 2,
  },
  elderBtn: {
    backgroundColor: "#16162C",
    borderColor: "#6C63FF",
  },
  familyBtn: {
    backgroundColor: "#11221A",
    borderColor: "#10B981",
  },
  roleBtnHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  roleBtnIcon: {
    fontSize: 44,
    marginRight: 16,
  },
  roleBtnTextContainer: {
    flex: 1,
  },
  roleBtnTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#F9FAFB",
    marginBottom: 4,
  },
  roleBtnSub: {
    fontSize: 13,
    color: "#9CA3AF",
    marginBottom: 6,
    lineHeight: 18,
  },
  roleBtnAction: {
    fontSize: 13,
    fontWeight: "700",
    color: "#A78BFA",
  },
  familyActionText: {
    color: "#34D399",
  },
  privacyNote: {
    flexDirection: "row",
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1F2937",
    alignItems: "flex-start",
    marginTop: 10,
  },
  privacyIcon: {
    fontSize: 16,
    marginRight: 10,
    marginTop: 2,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 18,
  },
  footer: {
    textAlign: "center",
    color: "#4B5563",
    fontSize: 11,
    marginTop: 14,
  },
});
