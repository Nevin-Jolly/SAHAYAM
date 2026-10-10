import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { callSetCareNote } from "../../constants/api";

/**
 * SettingsTab — Family Dashboard, Tab 4
 * Phase 7: Social Bridging — family sends a care note to the elder via SAHAYAM.
 *
 * Provides:
 *   - Elder ID configuration (identifies whose data the dashboard shows)
 *   - Morning Care Note (social bridging): family writes a short message that
 *     SAHAYAM speaks naturally during the elder's next conversation.
 *   - Privacy reminder (conversation history is elder-private)
 */


export default function SettingsTab() {
  const [elderId, setElderId] = useState("elder_demo_001");
  const [careNote, setCareNote] = useState("");
  const [careNoteSaving, setCareNoteSaving] = useState(false);
  const [careNoteResult, setCareNoteResult] = useState<string | null>(null);

  const handleSaveCareNote = async () => {
    if (!elderId.trim()) {
      Alert.alert("Required", "Elder ID must be set first.");
      return;
    }
    setCareNoteSaving(true);
    setCareNoteResult(null);
    try {
      const result = await callSetCareNote({
        elderId: elderId.trim(),
        note: careNote.trim(),
      });
      if (result.data.saved) {
        setCareNoteResult("✓ Care note saved. SAHAYAM will share it with the elder in the next conversation.");
      } else {
        setCareNoteResult("✓ Care note cleared.");
        setCareNote("");
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save care note.");
    } finally {
      setCareNoteSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>App configuration & preferences</Text>

      {/* ── Elder Connection ──────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Elder Connection</Text>
        <Text style={styles.inputLabel}>Elder ID</Text>
        <TextInput
          style={styles.input}
          value={elderId}
          onChangeText={setElderId}
          placeholder="e.g. elder_demo_001"
          placeholderTextColor="#4B5563"
          autoCapitalize="none"
          accessibilityLabel="Elder ID input"
        />
        <Text style={styles.inputHint}>
          This identifies whose data is shown in the dashboard.
        </Text>
      </View>

      {/* ── Phase 7: Morning Care Note (Social Bridging) ──────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💛 മാത്സര്യ സന്ദേശം — Care Note</Text>
        <Text style={styles.careNoteDesc}>
          Write a short message for your elder. SAHAYAM will deliver it naturally
          during the next conversation — like a warm voice from the family.
        </Text>
        <TextInput
          style={[styles.input, styles.careNoteInput]}
          value={careNote}
          onChangeText={(t) => {
            setCareNote(t);
            setCareNoteResult(null);
          }}
          placeholder="e.g. കുടുംബം സ്നേഹമുൾളള വാക്കുകൾ അരുളുന്നു..."
          placeholderTextColor="#4B5563"
          multiline
          maxLength={280}
          accessibilityLabel="Morning care note input"
        />
        <Text style={styles.charCount}>{careNote.length}/280</Text>
        <TouchableOpacity
          style={[styles.primaryBtn, styles.careNoteBtn, careNoteSaving && styles.primaryBtnDisabled]}
          onPress={handleSaveCareNote}
          disabled={careNoteSaving}
          accessibilityLabel="Send care note to elder"
        >
          <Text style={styles.primaryBtnText}>
            {careNoteSaving ? "അയക്കുന്നു…" : "💚 Send to Elder via SAHAYAM"}
          </Text>
        </TouchableOpacity>
        {careNoteResult && (
          <Text style={styles.successText}>{careNoteResult}</Text>
        )}
      </View>



      {/* ── Privacy ───────────────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy</Text>
        <View style={styles.privacyCard}>
          <Text style={styles.privacyIcon}>🔒</Text>
          <View style={styles.privacyText}>
            <Text style={styles.privacyTitle}>Conversation History</Text>
            <Text style={styles.privacyDesc}>
              The elder's voice conversations with SAHAYAM are private and are
              not accessible from the family dashboard.
            </Text>
            <Text style={styles.privacyDesc}>
              Family can see: check-in status, medication schedules, and
              escalation alerts only.
            </Text>
          </View>
        </View>
      </View>

      {/* ── App Info ──────────────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.aboutCard}>
          <Text style={styles.aboutName}>SAHAYAM</Text>
          <Text style={styles.aboutDesc}>
            Malayalam-native voice companion for elderly care.{"\n"}
            KTU B.Tech CSD415 Capstone · Group 9
          </Text>
          <Text style={styles.aboutVersion}>Phase 7 · Social Bridging &amp; Local Awareness</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: "#0D0D1A", padding: 20 },
  title: { fontSize: 28, fontWeight: "800", color: "#F9FAFB", marginBottom: 4 },
  subtitle: { fontSize: 13, color: "#6B7280", marginBottom: 24 },
  section: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6C63FF",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
    paddingBottom: 8,
  },
  careNoteDesc: {
    fontSize: 12,
    color: "#9CA3AF",
    lineHeight: 18,
    marginBottom: 12,
  },
  careNoteInput: {
    minHeight: 90,
    textAlignVertical: "top",
    marginBottom: 2,
  },
  careNoteBtn: {
    backgroundColor: "#059669",
  },
  charCount: {
    fontSize: 11,
    color: "#4B5563",
    textAlign: "right",
    marginBottom: 12,
  },
  inputLabel: { fontSize: 12, fontWeight: "600", color: "#9CA3AF", marginBottom: 6 },
  input: {
    backgroundColor: "#1A1A2E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A4A",
    color: "#F9FAFB",
    padding: 14,
    fontSize: 14,
    marginBottom: 6,
  },
  inputHint: { fontSize: 11, color: "#4B5563", marginBottom: 12, lineHeight: 16 },
  cronOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  cronOption: {
    backgroundColor: "#1A1A2E",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#2A2A4A",
  },
  cronOptionSelected: { backgroundColor: "#4F46E5", borderColor: "#6C63FF" },
  cronOptionText: { color: "#9CA3AF", fontSize: 12 },
  cronOptionTextSelected: { color: "#fff", fontWeight: "700" },
  infoSmall: {
    fontSize: 11,
    color: "#4B5563",
    marginBottom: 14,
    fontStyle: "italic",
  },
  primaryBtn: {
    backgroundColor: "#6C63FF",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  successText: {
    color: "#10B981",
    fontSize: 13,
    marginTop: 10,
    textAlign: "center",
  },
  infoCard: {
    backgroundColor: "#1A1A2E",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2A2A4A",
  },
  infoLabel: { fontSize: 11, fontWeight: "700", color: "#6B7280", marginBottom: 4 },
  infoValue: {
    fontSize: 13,
    color: "#6C63FF",
    fontFamily: "monospace",
    marginBottom: 6,
  },
  infoHint: { fontSize: 11, color: "#4B5563", lineHeight: 16 },
  privacyCard: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  privacyIcon: { fontSize: 24, marginRight: 12, marginTop: 2 },
  privacyText: { flex: 1 },
  privacyTitle: { fontSize: 14, fontWeight: "700", color: "#D1D5DB", marginBottom: 6 },
  privacyDesc: { fontSize: 12, color: "#6B7280", lineHeight: 18, marginBottom: 4 },
  aboutCard: {
    backgroundColor: "#1A1A2E",
    borderRadius: 14,
    padding: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2A4A",
  },
  aboutName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#6C63FF",
    letterSpacing: 2,
    marginBottom: 8,
  },
  aboutDesc: { fontSize: 13, color: "#9CA3AF", textAlign: "center", lineHeight: 20 },
  aboutVersion: { fontSize: 11, color: "#4B5563", marginTop: 8 },
});
