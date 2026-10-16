import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Switch,
  Platform,
} from "react-native";
import {
  Medication,
  PRESET_TIMES,
  INSTRUCTION_PRESETS,
  subscribeMedications,
  addMedication,
  toggleMedicationActive,
  deleteMedication,
  formatMedicationVoiceReminder,
  getCachedMedications,
  PresetTime,
  buildTimeConfig,
} from "../../services/medicationService";
import { createAudioPlayer } from "expo-audio";
import { getMalayalamAudioUri } from "../../services/companionService";
import { useTheme } from "../../context/ThemeContext";

const ELDER_ID = "elder_demo_001";

export default function MedicationsTab() {
  const [medications, setMedications] = useState<Medication[]>(getCachedMedications());
  const [syncing, setSyncing] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const { theme, isDark } = useTheme();

  // Time adjuster states
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>("preset_morning");
  const [hour12, setHour12] = useState<number>(8);
  const [minute, setMinute] = useState<number>(0);
  const [period, setPeriod] = useState<"AM" | "PM">("AM");

  // Add form state
  const [form, setForm] = useState({
    name: "",
    dosage: "",
    instructions: "ഭക്ഷണത്തിന് ശേഷം (After food)",
    time_str: "08:00",
    time_label: "8:00 AM (രാവിലെ)",
    cron_expr: "0 8 * * *",
  });

  const handleSelectPreset = (opt: PresetTime) => {
    setSelectedPresetId(opt.id);
    setHour12(opt.hour);
    setMinute(opt.minute);
    setPeriod(opt.period);
    setForm((f) => ({
      ...f,
      time_str: opt.time_str,
      time_label: opt.label,
      cron_expr: opt.cron_expr,
    }));
  };

  const updateCustomTime = (newH: number, newM: number, newP: "AM" | "PM") => {
    let h = Math.max(1, Math.min(12, Math.round(newH)));
    let m = Math.max(0, Math.min(59, Math.round(newM)));
    setHour12(h);
    setMinute(m);
    setPeriod(newP);
    setSelectedPresetId(null); // Custom selection

    const cfg = buildTimeConfig(h, m, newP);
    setForm((f) => ({
      ...f,
      time_str: cfg.time_str,
      time_label: cfg.time_label,
      cron_expr: cfg.cron_expr,
    }));
  };

  const handleStepHour = (delta: number) => {
    let nextH = hour12 + delta;
    if (nextH < 1) nextH = 12;
    if (nextH > 12) nextH = 1;
    updateCustomTime(nextH, minute, period);
  };

  const handleStepMinute = (delta: number) => {
    let nextM = minute + delta;
    if (nextM < 0) nextM = 55;
    if (nextM > 59) nextM = 0;
    updateCustomTime(hour12, nextM, period);
  };

  const handleTogglePeriod = (newP: "AM" | "PM") => {
    updateCustomTime(hour12, minute, newP);
  };

  // Real-time synchronization
  useEffect(() => {
    const syncTimer = setTimeout(() => setSyncing(false), 2000);

    const unsubscribe = subscribeMedications(
      ELDER_ID,
      (list) => {
        setMedications(list);
        setSyncing(false);
        setRefreshing(false);
      },
      (err) => {
        console.warn("Medications subscription warning:", err);
        setSyncing(false);
        setRefreshing(false);
      }
    );

    return () => {
      clearTimeout(syncTimer);
      unsubscribe();
    };
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  const handleAdd = async () => {
    if (!form.name.trim()) {
      Alert.alert("Missing Name", "Please enter the medication name.");
      return;
    }
    if (!form.dosage.trim()) {
      Alert.alert("Missing Dosage", "Please enter the dosage (e.g. 500mg, 1 tablet).");
      return;
    }

    setSaving(true);
    try {
      const added = await addMedication(ELDER_ID, {
        name: form.name.trim(),
        dosage: form.dosage.trim(),
        instructions: form.instructions.trim(),
        time_str: form.time_str,
        time_label: form.time_label,
        cron_expr: form.cron_expr,
      });

      // Instantly update state and close modal without spinner lag
      setMedications(getCachedMedications());
      setSaving(false);
      setModalVisible(false);

      setForm({
        name: "",
        dosage: "",
        instructions: "ഭക്ഷണത്തിന് ശേഷം (After food)",
        time_str: "08:00",
        time_label: "8:00 AM (രാവിലെ)",
        cron_expr: "0 8 * * *",
      });
      setSelectedPresetId("preset_morning");
      setHour12(8);
      setMinute(0);
      setPeriod("AM");
      Alert.alert("Saved Successfully", `Medication "${added.name}" added to schedule.`);
    } catch (e: any) {
      setSaving(false);
      Alert.alert("Error", e.message || "Failed to add medication.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (med: Medication) => {
    try {
      await toggleMedicationActive(ELDER_ID, med.id, !med.active);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to update medication status.");
    }
  };

  const handleDelete = (med: Medication) => {
    Alert.alert(
      "Delete Medication",
      `Remove "${med.name}" from the schedule?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMedication(ELDER_ID, med.id);
            } catch (e: any) {
              Alert.alert("Error", e.message || "Failed to delete medication.");
            }
          },
        },
      ]
    );
  };

  // Test speaking the Malayalam reminder
  const handleTestVoice = async (med: Medication) => {
    try {
      const sentence = formatMedicationVoiceReminder(med);
      const audioUri = getMalayalamAudioUri(sentence);
      const player = createAudioPlayer({ uri: audioUri });
      player.play();
      Alert.alert("Voice Reminder Playing", `Sahayam says:\n"${sentence}"`);
    } catch (e: any) {
      Alert.alert("Voice Error", e.message || "Could not play audio.");
    }
  };

  return (
    <>
      <ScrollView
        contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
              Medications
            </Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              {medications.length} medication{medications.length !== 1 ? "s" : ""} scheduled
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: theme.primary }]}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
            accessibilityLabel="Add medication"
          >
            <Text style={styles.addBtnText}>+ Add Medication</Text>
          </TouchableOpacity>
        </View>

        {medications.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={styles.emptyIcon}>💊</Text>
            <Text style={[styles.emptyText, { color: theme.text }]}>No medications scheduled</Text>
            <Text style={[styles.emptySub, { color: theme.primary }]}>
              Tap "+ Add Medication" above to create a schedule
            </Text>
          </View>
        ) : null}

        {medications.map((med) => (
          <View
            key={med.id}
            style={[
              styles.medCard,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
              !med.active && styles.medCardInactive,
            ]}
          >
            <View style={styles.medCardTop}>
              <View style={styles.medInfo}>
                <View style={styles.medNameRow}>
                  <Text style={[styles.medName, { color: theme.text }, !med.active && styles.medNameInactive]}>
                    {med.name}
                  </Text>
                  <View style={[styles.dosageBadge, { backgroundColor: theme.cardSecondary, borderColor: theme.border }]}>
                    <Text style={[styles.dosageBadgeText, { color: theme.primary }]}>{med.dosage}</Text>
                  </View>
                </View>

                {med.instructions ? (
                  <Text style={[styles.medInstructions, { color: theme.textSecondary }]}>📋 {med.instructions}</Text>
                ) : null}
                <Text style={[styles.medCron, { color: theme.primary }]}>⏰ {med.time_label || med.time_str || "Scheduled"}</Text>
              </View>

              <View style={styles.medActions}>
                <Switch
                  value={med.active}
                  onValueChange={() => handleToggleActive(med)}
                  trackColor={{ false: isDark ? "#374151" : "#CBD5E1", true: theme.primaryLight }}
                  thumbColor={med.active ? theme.primary : (isDark ? "#9CA3AF" : "#64748B")}
                />
                <Text style={[styles.activeLabel, { color: theme.textMuted }]}>
                  {med.active ? "Active" : "Paused"}
                </Text>
              </View>
            </View>

            <View style={styles.cardBottomRow}>
              <TouchableOpacity
                style={[styles.testVoiceBtn, { backgroundColor: theme.cardSecondary, borderColor: theme.border }]}
                onPress={() => handleTestVoice(med)}
                activeOpacity={0.7}
              >
                <Text style={[styles.testVoiceBtnText, { color: theme.primary }]}>🔊 Test Voice Reminder</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.deleteBtn, { backgroundColor: theme.dangerBg, borderColor: theme.dangerBorder }]}
                onPress={() => handleDelete(med)}
                accessibilityLabel={`Delete ${med.name}`}
              >
                <Text style={[styles.deleteBtnText, { color: theme.danger }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Add Medication Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Add Medication Schedule</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={[styles.modalCloseText, { color: theme.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Medication Name *</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.inputBorder,
                    color: theme.inputText,
                  },
                ]}
                placeholder="e.g. Metformin, Paracetamol"
                placeholderTextColor={theme.inputPlaceholder}
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                accessibilityLabel="Medication name input"
              />

              <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Dosage *</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.inputBorder,
                    color: theme.inputText,
                  },
                ]}
                placeholder="e.g. 500mg, 1 tablet"
                placeholderTextColor={theme.inputPlaceholder}
                value={form.dosage}
                onChangeText={(v) => setForm((f) => ({ ...f, dosage: v }))}
                accessibilityLabel="Dosage input"
              />

              <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Quick Time Presets</Text>
              <View style={styles.cronOptions}>
                {PRESET_TIMES.map((opt) => {
                  const isSelected = selectedPresetId === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[
                        styles.cronOption,
                        { backgroundColor: theme.cardSecondary, borderColor: theme.border },
                        isSelected && [styles.cronOptionSelected, { backgroundColor: theme.primary, borderColor: theme.primaryLight }],
                      ]}
                      onPress={() => handleSelectPreset(opt)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.cronOptionText,
                          { color: theme.textSecondary },
                          isSelected && [styles.cronOptionTextSelected, { color: "#FFFFFF" }],
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Interactive Adjustable Time Picker */}
              <View style={[styles.timeAdjustCard, { backgroundColor: theme.cardSecondary, borderColor: theme.border }]}>
                <View style={styles.timeAdjustHeader}>
                  <Text style={[styles.timeAdjustTitle, { color: theme.text }]}>⏰ Adjust Schedule Time</Text>
                  <Text style={[styles.timeAdjustSubtitle, { color: theme.textMuted }]}>
                    Tap ▲ / ▼ to set exact hour & minute, or toggle AM / PM
                  </Text>
                </View>

                <View style={styles.timePickerRow}>
                  {/* Hour Stepper */}
                  <View style={styles.pickerColumn}>
                    <Text style={[styles.pickerColLabel, { color: theme.textMuted }]}>HOUR</Text>
                    <TouchableOpacity
                      style={[styles.stepBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
                      onPress={() => handleStepHour(1)}
                      activeOpacity={0.7}
                      accessibilityLabel="Increment Hour"
                    >
                      <Text style={[styles.stepBtnText, { color: theme.text }]}>▲</Text>
                    </TouchableOpacity>
                    <View style={[styles.timeDisplayBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      <Text style={[styles.timeDisplayText, { color: theme.text }]}>{String(hour12).padStart(2, "0")}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.stepBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
                      onPress={() => handleStepHour(-1)}
                      activeOpacity={0.7}
                      accessibilityLabel="Decrement Hour"
                    >
                      <Text style={[styles.stepBtnText, { color: theme.text }]}>▼</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.timeColon, { color: theme.text }]}>:</Text>

                  {/* Minute Stepper */}
                  <View style={styles.pickerColumn}>
                    <Text style={[styles.pickerColLabel, { color: theme.textMuted }]}>MINUTE</Text>
                    <TouchableOpacity
                      style={[styles.stepBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
                      onPress={() => handleStepMinute(5)}
                      activeOpacity={0.7}
                      accessibilityLabel="Increment Minute"
                    >
                      <Text style={[styles.stepBtnText, { color: theme.text }]}>▲</Text>
                    </TouchableOpacity>
                    <View style={[styles.timeDisplayBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      <Text style={[styles.timeDisplayText, { color: theme.text }]}>{String(minute).padStart(2, "0")}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.stepBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
                      onPress={() => handleStepMinute(-5)}
                      activeOpacity={0.7}
                      accessibilityLabel="Decrement Minute"
                    >
                      <Text style={[styles.stepBtnText, { color: theme.text }]}>▼</Text>
                    </TouchableOpacity>
                  </View>

                  {/* AM / PM Toggle */}
                  <View style={styles.periodCol}>
                    <Text style={[styles.pickerColLabel, { color: theme.textMuted }]}>PERIOD</Text>
                    <TouchableOpacity
                      style={[
                        styles.periodBtn,
                        { backgroundColor: theme.card, borderColor: theme.border },
                        period === "AM" && [styles.periodBtnActive, { backgroundColor: theme.primary, borderColor: theme.primaryLight }],
                      ]}
                      onPress={() => handleTogglePeriod("AM")}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.periodBtnText,
                          { color: theme.textSecondary },
                          period === "AM" && [styles.periodBtnTextActive, { color: "#FFFFFF" }],
                        ]}
                      >
                        AM
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.periodBtn,
                        { backgroundColor: theme.card, borderColor: theme.border },
                        period === "PM" && [styles.periodBtnActive, { backgroundColor: theme.primary, borderColor: theme.primaryLight }],
                      ]}
                      onPress={() => handleTogglePeriod("PM")}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.periodBtnText,
                          { color: theme.textSecondary },
                          period === "PM" && [styles.periodBtnTextActive, { color: "#FFFFFF" }],
                        ]}
                      >
                        PM
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Quick Minute Jumps */}
                <View style={styles.minuteJumpsRow}>
                  <Text style={[styles.minuteJumpsLabel, { color: theme.textMuted }]}>Quick Min:</Text>
                  {[0, 15, 30, 45].map((mVal) => {
                    const isMActive = minute === mVal;
                    return (
                      <TouchableOpacity
                        key={`min_${mVal}`}
                        style={[
                          styles.minuteJumpChip,
                          { backgroundColor: theme.card, borderColor: theme.border },
                          isMActive && [styles.minuteJumpChipActive, { backgroundColor: theme.primary, borderColor: theme.primaryLight }],
                        ]}
                        onPress={() => updateCustomTime(hour12, mVal, period)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.minuteJumpChipText,
                            { color: theme.textSecondary },
                            isMActive && [styles.minuteJumpChipTextActive, { color: "#FFFFFF" }],
                          ]}
                        >
                          :{String(mVal).padStart(2, "0")}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Active Schedule Preview Banner */}
                <View style={[styles.previewBox, { backgroundColor: isDark ? "#1E1B4B" : "#EEF2FF", borderColor: theme.border }]}>
                  <Text style={[styles.previewLabel, { color: theme.textMuted }]}>SCHEDULED AT</Text>
                  <Text style={[styles.previewTime, { color: theme.primary }]}>{form.time_label}</Text>
                </View>
              </View>

              <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Instructions (Optional)</Text>
              <View style={styles.instructionPresetsRow}>
                {INSTRUCTION_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    style={[
                      styles.presetChip,
                      { backgroundColor: theme.cardSecondary, borderColor: theme.border },
                      form.instructions === preset && [styles.presetChipSelected, { backgroundColor: theme.primary, borderColor: theme.primaryLight }],
                    ]}
                    onPress={() => setForm((f) => ({ ...f, instructions: preset }))}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        { color: theme.textSecondary },
                        form.instructions === preset && [styles.presetChipTextSelected, { color: "#FFFFFF" }],
                      ]}
                    >
                      {preset.split(" ")[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.inputBorder,
                    color: theme.inputText,
                  },
                ]}
                placeholder="Custom instructions (e.g. after dinner)"
                placeholderTextColor={theme.inputPlaceholder}
                value={form.instructions}
                onChangeText={(v) => setForm((f) => ({ ...f, instructions: v }))}
                accessibilityLabel="Instructions input"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { backgroundColor: theme.cardSecondary, borderColor: theme.border }]}
                  onPress={() => setModalVisible(false)}
                  disabled={saving}
                >
                  <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: theme.primary }, saving && styles.saveBtnDisabled]}
                  onPress={handleAdd}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Schedule</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#0D0D1A",
    padding: 20,
    paddingTop: Platform.OS === "android" ? 16 : 20,
  },
  centered: {
    flex: 1,
    backgroundColor: "#0D0D1A",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { color: "#9CA3AF", marginTop: 12, fontSize: 14 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitleContainer: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#F9FAFB",
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 4,
  },
  addBtn: {
    backgroundColor: "#6C63FF",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },
  addBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  emptyBox: {
    backgroundColor: "#1A1A2E",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2A4A",
    marginTop: 16,
  },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#D1D5DB",
    marginBottom: 6,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 14,
    color: "#A78BFA",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  medCard: {
    backgroundColor: "#1A1A2E",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2A2A4A",
  },
  medCardInactive: { opacity: 0.55 },
  medCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  medInfo: { flex: 1, paddingRight: 8 },
  medNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 4,
    gap: 8,
  },
  medName: { fontSize: 18, fontWeight: "700", color: "#F9FAFB" },
  medNameInactive: { color: "#6B7280" },
  dosageBadge: {
    backgroundColor: "#312E81",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  dosageBadgeText: {
    color: "#A78BFA",
    fontSize: 12,
    fontWeight: "700",
  },
  medInstructions: {
    fontSize: 13,
    color: "#9CA3AF",
    marginBottom: 4,
    lineHeight: 18,
  },
  medCron: { fontSize: 13, color: "#60A5FA", fontWeight: "600" },
  medActions: { alignItems: "center", justifyContent: "center" },
  activeLabel: { fontSize: 10, color: "#9CA3AF", marginTop: 4 },
  cardBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#2A2A4A88",
  },
  testVoiceBtn: {
    backgroundColor: "#1E1B4B",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#4338CA",
  },
  testVoiceBtnText: {
    color: "#C7D2FE",
    fontSize: 12,
    fontWeight: "600",
  },
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#7F1D1D",
  },
  deleteBtnText: { color: "#EF4444", fontSize: 12, fontWeight: "600" },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#12121F",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: "90%",
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#F9FAFB",
  },
  modalCloseText: {
    fontSize: 20,
    color: "#9CA3AF",
    padding: 4,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#D1D5DB",
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: "#1A1A2E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A4A",
    color: "#F9FAFB",
    padding: 12,
    fontSize: 15,
    marginBottom: 8,
  },
  cronOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  cronOption: {
    backgroundColor: "#1A1A2E",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#2A2A4A",
  },
  cronOptionSelected: {
    backgroundColor: "#4F46E5",
    borderColor: "#6C63FF",
  },
  cronOptionText: { color: "#9CA3AF", fontSize: 12 },
  cronOptionTextSelected: { color: "#FFFFFF", fontWeight: "700" },
  instructionPresetsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  presetChip: {
    backgroundColor: "#1A1A2E",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#2A2A4A",
  },
  presetChipSelected: {
    backgroundColor: "#312E81",
    borderColor: "#6C63FF",
  },
  presetChipText: { color: "#9CA3AF", fontSize: 11 },
  presetChipTextSelected: { color: "#C7D2FE", fontWeight: "600" },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    marginBottom: 10,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#1A1A2E",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2A4A",
  },
  cancelBtnText: { color: "#9CA3AF", fontWeight: "700", fontSize: 15 },
  saveBtn: {
    flex: 2,
    backgroundColor: "#6C63FF",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    elevation: 3,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // Time Adjuster Card & Stepper Styles
  timeAdjustCard: {
    backgroundColor: "#16162A",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2E2A54",
    padding: 14,
    marginBottom: 14,
  },
  timeAdjustHeader: {
    marginBottom: 12,
  },
  timeAdjustTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#E0E7FF",
  },
  timeAdjustSubtitle: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },
  timePickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginVertical: 10,
    paddingHorizontal: 4,
  },
  pickerColumn: {
    alignItems: "center",
    minWidth: 78,
  },
  pickerColLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#818CF8",
    marginBottom: 6,
    textAlign: "center",
    includeFontPadding: false,
  },
  stepBtn: {
    backgroundColor: "#1F1F38",
    width: 64,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#3730A3",
  },
  stepBtnText: {
    color: "#A5B4FC",
    fontSize: 14,
    fontWeight: "bold",
    includeFontPadding: false,
  },
  timeDisplayBox: {
    backgroundColor: "#0D0D1A",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#4F46E5",
    width: 76,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
    paddingHorizontal: 4,
  },
  timeDisplayText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    includeFontPadding: false,
  },
  timeColon: {
    color: "#A5B4FC",
    fontSize: 28,
    fontWeight: "800",
    marginTop: 18,
    marginHorizontal: 4,
    includeFontPadding: false,
  },
  periodCol: {
    alignItems: "center",
    minWidth: 70,
  },
  periodBtn: {
    backgroundColor: "#1A1A2E",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2A2A4A",
    marginVertical: 3,
    width: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  periodBtnActive: {
    backgroundColor: "#4F46E5",
    borderColor: "#6C63FF",
  },
  periodBtnText: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    includeFontPadding: false,
  },
  periodBtnTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  minuteJumpsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginVertical: 10,
    paddingTop: 2,
  },
  minuteJumpsLabel: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "600",
    marginRight: 4,
    includeFontPadding: false,
  },
  minuteJumpChip: {
    backgroundColor: "#1F1F38",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2E2A54",
    minWidth: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  minuteJumpChipActive: {
    backgroundColor: "#312E81",
    borderColor: "#6366F1",
  },
  minuteJumpChipText: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    includeFontPadding: false,
  },
  minuteJumpChipTextActive: {
    color: "#C7D2FE",
    fontWeight: "800",
  },
  previewBox: {
    backgroundColor: "#111122",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderLeftWidth: 3,
    borderLeftColor: "#6C63FF",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  previewLabel: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "700",
    includeFontPadding: false,
    marginRight: 8,
  },
  previewTime: {
    color: "#A5B4FC",
    fontSize: 14,
    fontWeight: "700",
    includeFontPadding: false,
    flexShrink: 1,
    textAlign: "right",
  },
});
