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
 * FamilyLoginScreen — Dedicated Dashboard Login for Family Members & Caregivers
 * Allows adult children / caregivers to sign in, verify elder connection,
 * and view medication schedules, check-in history, and emergency alerts.
 */
export default function FamilyLoginScreen({ onLogin, onBack }: Props) {
  const [caregiverName, setCaregiverName] = useState("രവി");
  const [phoneNumber, setPhoneNumber] = useState("9847012345");
  const [elderId, setElderId] = useState("elder_demo_001");
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();

  const handleSignIn = async () => {
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
          <Text style={[styles.backBtnText, { color: theme.success }]}>← പിന്നോട്ട് (Back)</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.headerArea}>
          <Text style={styles.iconEmoji}>👨‍👩‍👦</Text>
          <Text style={[styles.titleMalayalam, { color: theme.success }]}>കുടുംബാംഗ ലോഗിൻ</Text>
          <Text style={[styles.titleSub, { color: theme.text }]}>Family Caregiver Dashboard Sign In</Text>
          <Text style={[styles.tagline, { color: theme.textMuted }]}>
            മുതിർന്നവരുടെ ആരോഗ്യവും മരുന്നുകളും സുരക്ഷിതമായി നിരീക്ഷിക്കുക.
          </Text>
        </View>

        {/* Form Card */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.inputLabel, { color: theme.text }]}>നിങ്ങളുടെ പേര് (Your Name):</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBg,
                borderColor: theme.inputBorder,
                color: theme.inputText,
              },
            ]}
            value={caregiverName}
            onChangeText={setCaregiverName}
            placeholder="e.g. രവി (മകൻ)"
            placeholderTextColor={theme.inputPlaceholder}
          />

          <Text style={[styles.inputLabel, { color: theme.text }]}>ഫോൺ നമ്പർ (Phone Number):</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBg,
                borderColor: theme.inputBorder,
                color: theme.inputText,
              },
            ]}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="10 digit mobile number"
            placeholderTextColor={theme.inputPlaceholder}
            keyboardType="phone-pad"
          />

          <Text style={[styles.inputLabel, { color: theme.text }]}>ലിങ്ക് ചെയ്ത ഐഡി (Elder ID):</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBg,
                borderColor: theme.inputBorder,
                color: theme.inputText,
              },
            ]}
            value={elderId}
            onChangeText={setElderId}
            placeholder="e.g. elder_demo_001"
            placeholderTextColor={theme.inputPlaceholder}
            autoCapitalize="none"
          />
          <Text style={[styles.hintText, { color: theme.textMuted }]}>
            ഈ ഐഡി വഴി നിങ്ങളുടെ കുടുംബത്തിലെ മുതിർന്നയാളുടെ വിവരങ്ങൾ നിരീക്ഷിക്കാം.
          </Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: theme.success }, loading && styles.btnDisabled]}
          onPress={handleSignIn}
          disabled={loading}
          activeOpacity={0.85}
          accessibilityLabel="Enter family dashboard"
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator size="large" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.submitBtnText}>ഡാഷ്‌ബോർഡിലേക്ക് പ്രവേശിക്കുക</Text>
              <Text style={styles.submitBtnSub}>(Enter Family Dashboard)</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Privacy Card */}
        <View style={[styles.privacyCard, { backgroundColor: theme.cardSecondary, borderColor: theme.border }]}>
          <Text style={styles.privacyIcon}>🔒</Text>
          <Text style={[styles.privacyText, { color: theme.textSecondary }]}>
            മുതിർന്നവരുടെ സ്വകാര്യ വോയിസ് സംഭാഷണങ്ങൾ സുരക്ഷിതമാണ്. കുടുംബാംഗങ്ങൾക്ക് മരുന്നുകൾ, ചെക്ക്-ഇൻ വിവരങ്ങൾ, അടിയന്തര അലേർട്ടുകൾ എന്നിവ മാത്രമേ കാണാൻ സാധിക്കൂ.
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
    fontSize: 60,
    marginBottom: 10,
  },
  titleMalayalam: {
    fontSize: 30,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 6,
  },
  titleSub: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
  },
  tagline: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    marginBottom: 24,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    marginBottom: 14,
  },
  hintText: {
    fontSize: 12,
    lineHeight: 16,
  },
  submitBtn: {
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 20,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  submitBtnSub: {
    fontSize: 13,
    fontWeight: "600",
    color: "#D1FAE5",
  },
  privacyCard: {
    flexDirection: "row",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  privacyIcon: {
    fontSize: 18,
    marginRight: 10,
    marginTop: 2,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});
