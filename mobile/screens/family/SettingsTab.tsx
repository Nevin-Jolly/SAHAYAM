import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
} from "react-native";
import { BASE_URL, API, roleHeaders } from "../../constants/api";

/**
 * SettingsTab — Family Dashboard, Tab 4
 * Phase 5: Configuration UI for elder ID, check-in schedule, and app info.
 *
 * Phase 6 will add role-based access control. For now this tab exposes:
 *   - Current elder_id in use (editable for demo purposes)
 *   - Check-in schedule setup: POST /checkins/schedule
 *   - Current backend URL info (reminder to update ngrok URL)
 *   - Privacy reminder (conversation history is elder-private)
 *
 * Note: Elder/family relationship and auth will be properly scoped in Phase 6.
 */

const CRON_OPTIONS = [
  { label: "Once daily — 10 AM", value: "0 10 * * *" },
  { label: "Once daily — 3 PM", value: "0 15 * * *" },
  { label: "Twice daily — 10 AM & 6 PM", value: "0 10,18 * * *" },
  { label: "Every 4 hours (9a-9p)", value: "0 9,13,17,21 * * *" },
];

export default function SettingsTab() {
  const [elderId, setElderId] = useState("elder_demo_001");
  const [elderFcmToken, setElderFcmToken] = useState("");
  const [familyFcmToken, setFamilyFcmToken] = useState("");
  const [selectedCron, setSelectedCron] = useState("0 10 * * *");
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleResult, setScheduleResult] = useState<string | null>(null);

  const handleScheduleCheckin = async () => {
    if (!elderId.trim()) {
      Alert.alert("Required", "Elder ID is required.");
      return;
    }
    if (!elderFcmToken.trim()) {
      Alert.alert("Required", "Elder FCM token is required to send check-in notifications.");
      return;
    }
    setScheduleSaving(true);
    setScheduleResult(null);
    try {
      const res = await fetch(`${API.checkins}/schedule`, {
        method: "POST",
        headers: roleHeaders("family"),
        body: JSON.stringify({
          elder_id: elderId.trim(),
          cron_expr: selectedCron,
          fcm_token: elderFcmToken.trim(),
          family_fcm_token: familyFcmToken.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Server error ${res.status}`);
      setScheduleResult(
        `✓ Check-in scheduled (${CRON_OPTIONS.find((o) => o.value === selectedCron)?.label}).`
      );
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to schedule check-in.");
    } finally {
      setScheduleSaving(false);
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
          This identifies whose data is shown in the dashboard. Proper auth will be
          linked in Phase 6.
        </Text>
      </View>

      {/* ── Check-in Schedule ─────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Proactive Check-in Schedule</Text>
        <Text style={styles.inputLabel}>Elder Device FCM Token *</Text>
        <TextInput
          style={styles.input}
          value={elderFcmToken}
          onChangeText={setElderFcmToken}
          placeholder="Paste elder device token"
          placeholderTextColor="#4B5563"
          autoCapitalize="none"
          multiline
          accessibilityLabel="Elder FCM token input"
        />
        <Text style={styles.inputLabel}>Family Device FCM Token (optional)</Text>
        <TextInput
          style={styles.input}
          value={familyFcmToken}
          onChangeText={setFamilyFcmToken}
          placeholder="Paste family device token"
          placeholderTextColor="#4B5563"
          autoCapitalize="none"
          multiline
          accessibilityLabel="Family FCM token input"
        />
        <Text style={styles.inputLabel}>Check-in Frequency</Text>
        <View style={styles.cronOptions}>
          {CRON_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.cronOption,
                selectedCron === opt.value && styles.cronOptionSelected,
              ]}
              onPress={() => setSelectedCron(opt.value)}
              accessibilityLabel={`Select schedule: ${opt.label}`}
            >
              <Text
                style={[
                  styles.cronOptionText,
                  selectedCron === opt.value && styles.cronOptionTextSelected,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.infoSmall}>
          Escalation fires 30 minutes after a check-in goes unanswered.
        </Text>

        <TouchableOpacity
          style={[styles.primaryBtn, scheduleSaving && styles.primaryBtnDisabled]}
          onPress={handleScheduleCheckin}
          disabled={scheduleSaving}
          accessibilityLabel="Save check-in schedule"
        >
          <Text style={styles.primaryBtnText}>
            {scheduleSaving ? "Saving…" : "Save Check-in Schedule"}
          </Text>
        </TouchableOpacity>

        {scheduleResult && (
          <Text style={styles.successText}>{scheduleResult}</Text>
        )}
      </View>

      {/* ── Backend Connection ────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Backend Connection</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Current API URL</Text>
          <Text style={styles.infoValue} selectable>
            {BASE_URL}
          </Text>
          <Text style={styles.infoHint}>
            Update BASE_URL in constants/api.ts each time ngrok restarts.
          </Text>
        </View>
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
          <Text style={styles.aboutVersion}>Backend v0.5.0 · Phase 5</Text>
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
