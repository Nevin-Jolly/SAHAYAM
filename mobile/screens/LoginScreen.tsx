import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
} from "react-native";
import { useTheme } from "../context/ThemeContext";

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
  const { theme, isDark, toggleTheme } = useTheme();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { backgroundColor: theme.background },
      ]}
    >
      <StatusBar
        barStyle={theme.statusBarStyle}
        backgroundColor={theme.statusBarBg}
      />

      {/* Top Bar with Theme Toggle */}
      <View style={styles.topRow}>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={[
            styles.themeToggleBtn,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}
          onPress={toggleTheme}
          activeOpacity={0.75}
          accessibilityLabel="Toggle Light/Dark Theme"
          accessibilityRole="button"
        >
          <Text style={[styles.themeToggleText, { color: theme.textSecondary }]}>
            {isDark ? "☀️ Light" : "🌙 Dark"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Brand Header */}
      <View style={styles.logoArea}>
        <Text style={styles.logoEmoji}>🤝</Text>
        <Text style={[styles.appName, { color: theme.brandMalayalam }]}>
          സഹായം
        </Text>
        <Text style={[styles.appNameEn, { color: theme.brandEnglish }]}>
          SAHAYAM
        </Text>
        <Text style={[styles.tagline, { color: theme.textMuted }]}>
          മുതിർന്നവർക്കായുള്ള മലയാളം വോയിസ് സഹായി{"\n"}
          (Malayalam Voice Companion for Elderly Care)
        </Text>
      </View>

      {/* Role Selection Prompt */}
      <View style={styles.roleArea}>
        <Text style={[styles.prompt, { color: theme.textSecondary }]}>
          പ്രവേശന മാർഗ്ഗം തിരഞ്ഞെടുക്കുക (Select Role):
        </Text>

        {/* Elder Entry Card */}
        <TouchableOpacity
          style={[
            styles.roleBtn,
            {
              backgroundColor: theme.elderCardBg,
              borderColor: theme.elderCardBorder,
            },
          ]}
          onPress={onSelectElder}
          activeOpacity={0.85}
          accessibilityLabel="Elder portal"
          accessibilityRole="button"
        >
          <View style={styles.roleBtnHeader}>
            <Text style={styles.roleBtnIcon}>👴</Text>
            <View style={styles.roleBtnTextContainer}>
              <Text style={[styles.roleBtnTitle, { color: theme.elderCardTitle }]}>
                മുതിർന്ന വ്യക്തി (Elder)
              </Text>
              <Text style={[styles.roleBtnSub, { color: theme.textMuted }]}>
                വോയിസ് സഹായി ഉപയോഗിച്ച് സംസാരിക്കാം
              </Text>
              <Text
                style={[
                  styles.roleBtnAction,
                  { color: theme.elderCardAction },
                ]}
              >
                തുടങ്ങാൻ ഇവിടെ തൊടുക →
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Family Entry Card */}
        <TouchableOpacity
          style={[
            styles.roleBtn,
            {
              backgroundColor: theme.familyCardBg,
              borderColor: theme.familyCardBorder,
            },
          ]}
          onPress={onSelectFamily}
          activeOpacity={0.85}
          accessibilityLabel="Family caregiver portal"
          accessibilityRole="button"
        >
          <View style={styles.roleBtnHeader}>
            <Text style={styles.roleBtnIcon}>👨‍👩‍👦</Text>
            <View style={styles.roleBtnTextContainer}>
              <Text style={[styles.roleBtnTitle, { color: theme.familyCardTitle }]}>
                കുടുംബാംഗം (Family Member)
              </Text>
              <Text style={[styles.roleBtnSub, { color: theme.textMuted }]}>
                ആരോഗ്യവും മരുന്നുകളും നിരീക്ഷിക്കാം
              </Text>
              <Text
                style={[
                  styles.roleBtnAction,
                  { color: theme.familyCardAction },
                ]}
              >
                ഡാഷ്‌ബോർഡിലേക്ക് പോകുക →
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* Privacy Notice */}
      <View
        style={[
          styles.privacyNote,
          {
            backgroundColor: theme.cardSecondary,
            borderColor: theme.cardBorder,
          },
        ]}
      >
        <Text style={styles.privacyIcon}>🔒</Text>
        <Text style={[styles.privacyText, { color: theme.textMuted }]}>
          മുതിർന്നവരുടെ സംഭാഷണങ്ങൾ തികച്ചും സ്വകാര്യമാണ്. കുടുംബാംഗങ്ങൾക്ക് ഇത് കേൾക്കാൻ സാധിക്കില്ല.
        </Text>
      </View>

      {/* Academic Footer */}
      <Text style={[styles.footer, { color: theme.textSubtle }]}>
        KTU B.Tech Capstone CSD415 · Group 9
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 40,
    paddingBottom: 28,
    justifyContent: "space-between",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: 4,
  },
  themeToggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  themeToggleText: {
    fontSize: 12,
    fontWeight: "700",
  },
  logoArea: {
    alignItems: "center",
    paddingTop: 4,
  },
  logoEmoji: {
    fontSize: 54,
    marginBottom: 8,
  },
  appName: {
    fontSize: 38,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 2,
  },
  appNameEn: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 2, // Low letterSpacing avoids Android right-edge clipping of 'M'
    marginBottom: 10,
  },
  tagline: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  roleArea: {
    gap: 16,
    marginVertical: 18,
  },
  prompt: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  roleBtn: {
    borderRadius: 22,
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderWidth: 2,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
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
    marginBottom: 4,
  },
  roleBtnSub: {
    fontSize: 13,
    marginBottom: 6,
    lineHeight: 18,
  },
  roleBtnAction: {
    fontSize: 13,
    fontWeight: "700",
  },
  privacyNote: {
    flexDirection: "row",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
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
    lineHeight: 18,
  },
  footer: {
    textAlign: "center",
    fontSize: 11,
    marginTop: 14,
  },
});
