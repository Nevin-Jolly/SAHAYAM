import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { setCareNoteDirect } from "../../services/companionService";
import { useRole } from "../../context/RoleContext";
import { BASE_URL } from "../../constants/api";
import { useTheme } from "../../context/ThemeContext";

/**
 * SettingsTab — Family Dashboard, Tab 4
 * Phase 7: Social Bridging — family sends a care note to the elder via SAHAYAM.
 *
 * Provides:
 *   - Elder ID configuration (identifies whose data the dashboard shows)
 *   - Live phone-to-phone synchronization & server health check
 *   - Morning Care Note (social bridging): family writes a short message that
 *     SAHAYAM speaks naturally during the elder's next conversation.
 *   - Privacy reminder (conversation history is elder-private)
 */

export default function SettingsTab() {
  const [elderId, setElderId] = useState("elder_demo_001");
  const [careNote, setCareNote] = useState("");
  const [careNoteSaving, setCareNoteSaving] = useState(false);
  const [careNoteResult, setCareNoteResult] = useState<string | null>(null);
  const [connStatus, setConnStatus] = useState<"checking" | "connected" | "disconnected">("checking");
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [testingConn, setTestingConn] = useState(false);
  const { logout } = useRole();
  const { theme, isDark, themeMode, setThemeMode } = useTheme();

  const checkConnection = async (isManual = false) => {
    if (isManual) setTestingConn(true);
    const start = Date.now();
    try {
      const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const ms = Date.now() - start;
        setConnStatus("connected");
        setPingMs(ms);
        if (isManual) {
          Alert.alert(
            "✅ കണക്ഷൻ വിജയകരം (Synced)",
            `രണ്ട് ഫോണുകളും സർവറുമായി വിജയകരമായി ബന്ധിപ്പിച്ചിരിക്കുന്നു!\n\n• Server: ${BASE_URL}\n• Elder ID: ${elderId}\n• Latency: ${ms}ms\n• Sync Status: Active`
          );
        }
      } else {
        setConnStatus("disconnected");
        setPingMs(null);
        if (isManual) {
          Alert.alert("പിശക്", `സർവർ മറുപടി നൽകുന്നില്ല (${res.status}).`);
        }
      }
    } catch (_) {
      setConnStatus("disconnected");
      setPingMs(null);
      if (isManual) {
        Alert.alert(
          "❌ സിൻക് നഷ്ടപ്പെട്ടു (Sync Lost)",
          `സർവറുമായി ബന്ധപ്പെടാൻ സാധിക്കുന്നില്ല.\n\nദയവായി കമ്പ്യൂട്ടറിൽ companion server റൺ ചെയ്യുന്നുണ്ടെന്ന് ഉറപ്പുവരുത്തുക:\n${BASE_URL}`
        );
      }
    } finally {
      if (isManual) setTestingConn(false);
    }
  };

  useEffect(() => {
    checkConnection();
    const timer = setInterval(() => checkConnection(), 5000);
    return () => clearInterval(timer);
  }, []);

  const handleSaveCareNote = async () => {
    if (!elderId.trim()) {
      Alert.alert("Required", "Elder ID must be set first.");
      return;
    }
    setCareNoteSaving(true);
    setCareNoteResult(null);
    try {
      const result = await setCareNoteDirect({
        elderId: elderId.trim(),
        note: careNote.trim(),
      });
      if (result.saved) {
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
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
      <Text style={[styles.subtitle, { color: theme.textMuted }]}>App configuration & preferences</Text>

      {/* ── Theme / Appearance ─────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.primary, borderBottomColor: theme.border }]}>
          🎨 ദൃശ്യരൂപം — Theme / Appearance
        </Text>
        <Text style={[styles.careNoteDesc, { color: theme.textMuted }]}>
          ഇഷ്ടമുള്ള തീം തിരഞ്ഞെടുക്കുക (Select preferred display theme):
        </Text>
        <View style={styles.themeSelectorRow}>
          <TouchableOpacity
            style={[
              styles.themeOptionBtn,
              { backgroundColor: theme.cardSecondary, borderColor: theme.border },
              themeMode === "dark" && [styles.themeOptionBtnActive, { backgroundColor: theme.primary, borderColor: theme.primaryLight }],
            ]}
            onPress={() => setThemeMode("dark")}
            activeOpacity={0.8}
            accessibilityLabel="Select Dark Theme"
          >
            <Text
              style={[
                styles.themeOptionText,
                { color: theme.textSecondary },
                themeMode === "dark" && { color: "#FFFFFF", fontWeight: "700" },
              ]}
            >
              🌙 ഇരുണ്ടത് (Dark)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.themeOptionBtn,
              { backgroundColor: theme.cardSecondary, borderColor: theme.border },
              themeMode === "light" && [styles.themeOptionBtnActive, { backgroundColor: theme.primary, borderColor: theme.primaryLight }],
            ]}
            onPress={() => setThemeMode("light")}
            activeOpacity={0.8}
            accessibilityLabel="Select Light Theme"
          >
            <Text
              style={[
                styles.themeOptionText,
                { color: theme.textSecondary },
                themeMode === "light" && { color: "#FFFFFF", fontWeight: "700" },
              ]}
            >
              ☀️ വെളിച്ചം (Light)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.themeOptionBtn,
              { backgroundColor: theme.cardSecondary, borderColor: theme.border },
              themeMode === "system" && [styles.themeOptionBtnActive, { backgroundColor: theme.primary, borderColor: theme.primaryLight }],
            ]}
            onPress={() => setThemeMode("system")}
            activeOpacity={0.8}
            accessibilityLabel="Select System Auto Theme"
          >
            <Text
              style={[
                styles.themeOptionText,
                { color: theme.textSecondary },
                themeMode === "system" && { color: "#FFFFFF", fontWeight: "700" },
              ]}
            >
              ⚙️ സിസ്റ്റം (Auto)
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Elder Connection & Multi-Phone Sync ───────────────────────────────── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.primary, borderBottomColor: theme.border }]}>
          Elder Connection &amp; Phone Sync
        </Text>
        
        {/* Sync Status Badge */}
        <View
          style={[
            styles.syncStatusCard,
            connStatus === "connected"
              ? (isDark ? styles.syncCardConnected : { backgroundColor: "#ECFDF5", borderColor: "#10B981" })
              : connStatus === "disconnected"
              ? (isDark ? styles.syncCardDisconnected : { backgroundColor: "#FEF2F2", borderColor: "#EF4444" })
              : (isDark ? styles.syncCardChecking : { backgroundColor: "#EEF2FF", borderColor: "#6366F1" }),
          ]}
        >
          <View style={styles.syncStatusRow}>
            <View
              style={[
                styles.statusDot,
                connStatus === "connected"
                  ? styles.dotConnected
                  : connStatus === "disconnected"
                  ? styles.dotDisconnected
                  : styles.dotChecking,
              ]}
            />
            <Text style={[styles.syncStatusTitle, { color: isDark ? "#F9FAFB" : "#0F172A" }]}>
              {connStatus === "connected"
                ? "കണക്റ്റഡ് & സിൻക്രൊണൈസ്ഡ് (Synchronized)"
                : connStatus === "disconnected"
                ? "കണക്ഷൻ നഷ്ടപ്പെട്ടു (Sync Lost / Offline)"
                : "പരിശോധിക്കുന്നു (Checking Sync…)"}
            </Text>
          </View>
          <Text style={[styles.syncStatusSub, { color: isDark ? "#D1D5DB" : "#334155" }]}>
            {connStatus === "connected"
              ? `Mobile 1 (Elder) & Mobile 2 (Family) പരസ്പരം സിൻക് ചെയ്തിരിക്കുന്നു (${pingMs ?? "<10"}ms)`
              : `Companion Server (${BASE_URL}) റൺ ചെയ്യുന്നുണ്ടെന്ന് ഉറപ്പാക്കുക.`}
          </Text>
          <TouchableOpacity
            style={[styles.testConnBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => checkConnection(true)}
            disabled={testingConn}
          >
            {testingConn ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Text style={[styles.testConnBtnText, { color: theme.primary }]}>⚡ സിൻക് കണക്ഷൻ പരിശോധിക്കുക (Test Ping)</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Elder ID</Text>
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
          accessibilityLabel="Elder ID input"
        />
        <Text style={[styles.inputHint, { color: theme.textSubtle }]}>
          ഇത് ഏത് മുതിർന്ന വ്യക്തിയുടെ വിവരങ്ങളാണ് കാണിക്കുന്നത് എന്ന് നിർണ്ണയിക്കുന്നു.
        </Text>
      </View>

      {/* ── Phase 7: Morning Care Note (Social Bridging) ──────────────── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.primary, borderBottomColor: theme.border }]}>
          💛 സ്നേഹസന്ദേശം — Family Care Note
        </Text>
        <Text style={[styles.careNoteDesc, { color: theme.textMuted }]}>
          മുതിർന്നവർക്കായി ഒരു ചെറിയ സ്നേഹസന്ദേശം എഴുതുക. അടുത്ത സംഭാഷണത്തിൽ സഹായം ഇത് സ്നേഹത്തോടെ അറിയിക്കും.
        </Text>
        <TextInput
          style={[
            styles.input,
            styles.careNoteInput,
            {
              backgroundColor: theme.inputBg,
              borderColor: theme.inputBorder,
              color: theme.inputText,
            },
          ]}
          value={careNote}
          onChangeText={(t) => {
            setCareNote(t);
            setCareNoteResult(null);
          }}
          placeholder="ഉദാഹരണത്തിന്: മരുന്ന് കൃത്യസമയത്ത് കഴിക്കണം, വൈകുന്നേരം വിളിക്കാം..."
          placeholderTextColor={theme.inputPlaceholder}
          multiline
          maxLength={280}
          accessibilityLabel="Morning care note input"
        />
        <Text style={[styles.charCount, { color: theme.textSubtle }]}>{careNote.length}/280</Text>
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
          <Text style={[styles.successText, { color: theme.success }]}>{careNoteResult}</Text>
        )}
      </View>

      {/* ── Privacy ───────────────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.primary, borderBottomColor: theme.border }]}>
          Privacy
        </Text>
        <View style={[styles.privacyCard, { backgroundColor: theme.cardSecondary, borderColor: theme.border }]}>
          <Text style={styles.privacyIcon}>🔒</Text>
          <View style={styles.privacyText}>
            <Text style={[styles.privacyTitle, { color: theme.text }]}>Conversation History</Text>
            <Text style={[styles.privacyDesc, { color: theme.textMuted }]}>
              The elder's voice conversations with SAHAYAM are private and are
              not accessible from the family dashboard.
            </Text>
            <Text style={[styles.privacyDesc, { color: theme.textMuted }]}>
              Family can see: check-in status, medication schedules, and
              escalation alerts only.
            </Text>
          </View>
        </View>
      </View>

      {/* ── Session & Role Switch ─────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.primary, borderBottomColor: theme.border }]}>
          Session &amp; Role
        </Text>
        <TouchableOpacity
          style={[styles.switchRoleCard, { backgroundColor: theme.cardHighlight, borderColor: theme.primaryLight }]}
          onPress={logout}
          accessibilityLabel="Switch Role or Log Out"
        >
          <Text style={[styles.switchRoleCardText, { color: theme.primary }]}>🔄 റോൾ മാറ്റുക / Switch Role</Text>
          <Text style={[styles.switchRoleCardSub, { color: theme.textMuted }]}>Return to role selector (Elder / Family)</Text>
        </TouchableOpacity>
      </View>

      {/* ── App Info ──────────────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.primary, borderBottomColor: theme.border }]}>
          About
        </Text>
        <View style={[styles.aboutCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.aboutName, { color: theme.primary }]}>SAHAYAM</Text>
          <Text style={[styles.aboutDesc, { color: theme.textMuted }]}>
            An AI companion for elderly care
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: "#0D0D1A", padding: 20 },
  title: { fontSize: 28, fontWeight: "800", color: "#F9FAFB", marginBottom: 4, paddingRight: 8 },
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
  switchRoleCard: {
    backgroundColor: "#1F1D36",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#6C63FF66",
    alignItems: "center",
  },
  switchRoleCardText: {
    color: "#A78BFA",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  switchRoleCardSub: {
    color: "#6B7280",
    fontSize: 12,
  },
  syncStatusCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  syncCardConnected: {
    backgroundColor: "#06281E",
    borderColor: "#10B981",
  },
  syncCardDisconnected: {
    backgroundColor: "#2B0B0B",
    borderColor: "#EF4444",
  },
  syncCardChecking: {
    backgroundColor: "#1F1D36",
    borderColor: "#6C63FF",
  },
  syncStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  dotConnected: {
    backgroundColor: "#10B981",
  },
  dotDisconnected: {
    backgroundColor: "#EF4444",
  },
  dotChecking: {
    backgroundColor: "#F59E0B",
  },
  syncStatusTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#F9FAFB",
  },
  syncStatusSub: {
    fontSize: 12,
    color: "#D1D5DB",
    lineHeight: 18,
    marginBottom: 12,
  },
  testConnBtn: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  testConnBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#A78BFA",
  },
  themeSelectorRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  themeOptionBtn: {
    flex: 1,
    minWidth: 95,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  themeOptionBtnActive: {
    borderWidth: 1.5,
    elevation: 2,
  },
  themeOptionText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
