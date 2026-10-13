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
 * FamilyLoginScreen — Dedicated Dashboard Login for Family Members & Caregivers
 * Allows adult children / caregivers to sign in, verify elder connection,
 * and view medication schedules, check-in history, and emergency alerts.
 */
export default function FamilyLoginScreen({ onLogin, onBack }: Props) {
  const [caregiverName, setCaregiverName] = useState("രവി");
  const [phoneNumber, setPhoneNumber] = useState("9847012345");
  const [elderId, setElderId] = useState("elder_demo_001");
  const [loading, setLoading] = useState(false);

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

        {/* Header */}
        <View style={styles.headerArea}>
          <Text style={styles.iconEmoji}>👨‍👩‍👦</Text>
          <Text style={styles.titleMalayalam}>കുടുംബാംഗ ലോഗിൻ</Text>
          <Text style={styles.titleSub}>Family Caregiver Dashboard Sign In</Text>
          <Text style={styles.tagline}>
            മുതിർന്നവരുടെ ആരോഗ്യവും മരുന്നുകളും സുരക്ഷിതമായി നിരീക്ഷിക്കുക.
          </Text>
        </View>

        {/* Form Card */}
        <View style={styles.card}>
          <Text style={styles.inputLabel}>നിങ്ങളുടെ പേര് (Your Name):</Text>
          <TextInput
            style={styles.input}
            value={caregiverName}
            onChangeText={setCaregiverName}
            placeholder="e.g. രവി (മകൻ)"
            placeholderTextColor="#6B7280"
          />

          <Text style={styles.inputLabel}>ഫോൺ നമ്പർ (Phone Number):</Text>
          <TextInput
            style={styles.input}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="10 digit mobile number"
            placeholderTextColor="#6B7280"
            keyboardType="phone-pad"
          />

          <Text style={styles.inputLabel}>ലിങ്ക് ചെയ്ത ഐഡി (Elder ID):</Text>
          <TextInput
            style={styles.input}
            value={elderId}
            onChangeText={setElderId}
            placeholder="e.g. elder_demo_001"
            placeholderTextColor="#6B7280"
            autoCapitalize="none"
          />
          <Text style={styles.hintText}>
            ഈ ഐഡി വഴി നിങ്ങളുടെ കുടുംബത്തിലെ മുതിർന്നയാളുടെ വിവരങ്ങൾ നിരീക്ഷിക്കാം.
          </Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.btnDisabled]}
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
        <View style={styles.privacyCard}>
          <Text style={styles.privacyIcon}>🔒</Text>
          <Text style={styles.privacyText}>
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
    backgroundColor: "#0D0D1A",
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 36,
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
    color: "#10B981",
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
    color: "#10B981",
    textAlign: "center",
    marginBottom: 6,
  },
  titleSub: {
    fontSize: 15,
    fontWeight: "700",
    color: "#E5E7EB",
    textAlign: "center",
    marginBottom: 6,
  },
  tagline: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  card: {
    backgroundColor: "#1A1A2E",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#10B98144",
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#D1D5DB",
    marginBottom: 8,
    marginTop: 6,
  },
  input: {
    backgroundColor: "#0D0D1A",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#374151",
    marginBottom: 12,
  },
  hintText: {
    fontSize: 12,
    color: "#9CA3AF",
    lineHeight: 16,
    marginTop: 2,
  },
  submitBtn: {
    backgroundColor: "#059669",
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 20,
  },
  btnDisabled: {
    opacity: 0.7,
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
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1F2937",
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
    color: "#6B7280",
    lineHeight: 18,
  },
});
