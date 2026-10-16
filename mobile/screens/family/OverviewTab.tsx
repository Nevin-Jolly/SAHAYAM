import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { db } from "../../constants/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import {
  getCachedMedications,
  subscribeMedications,
  Medication,
  isMedicationDueOrOverdue,
} from "../../services/medicationService";
import { BASE_URL } from "../../constants/api";
import { useTheme } from "../../context/ThemeContext";

/**
 * OverviewTab — Family Dashboard, Tab 1
 * Phase 5: Live real-time Cloud Firestore synchronization.
 *
 * Subscribes to:
 *   - Latest check-in record in elders/{elderId}/checkins
 *   - Active (unresolved) escalations count in elders/{elderId}/escalations
 *   - Active medications count in elders/{elderId}/medications
 *
 * Privacy: No conversation content shown — elder-private per confirmed policy.
 */

const ELDER_ID = "elder_demo_001";

interface Overview {
  last_checkin_status: "answered" | "unanswered" | "pending" | null;
  last_checkin_time: string | null;
  active_escalations: number;
  medication_count: number;
}

function statusColor(
  status: Overview["last_checkin_status"],
  hasUntakenMed?: boolean
): string {
  if (hasUntakenMed || status === "unanswered") {
    return "#EF4444"; // red
  }
  switch (status) {
    case "answered":
      return "#10B981"; // green
    case "pending":
      return "#F59E0B"; // amber
    default:
      return "#6B7280"; // grey (no data)
  }
}

function statusLabel(
  status: Overview["last_checkin_status"],
  hasUntakenMed?: boolean
): string {
  if (hasUntakenMed || status === "unanswered") {
    return "✗ No Response";
  }
  switch (status) {
    case "answered":
      return "✓ Responded";
    case "pending":
      return "⏳ Pending";
    default:
      return "No check-ins yet";
  }
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

export default function OverviewTab() {
  const [overview, setOverview] = useState<Overview>({
    last_checkin_status: "answered",
    last_checkin_time: new Date().toISOString(),
    active_escalations: 0,
    medication_count: getCachedMedications().filter((m) => m.active).length || 2,
  });
  const [dueUntakenMed, setDueUntakenMed] = useState<Medication | null>(null);
  const dueUntakenMedRef = React.useRef<Medication | null>(null);
  dueUntakenMedRef.current = dueUntakenMed;

  const [syncing, setSyncing] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>("Just now");

  useEffect(() => {
    let isMounted = true;
    const syncTimer = setTimeout(() => {
      setSyncing(false);
    }, 2000);

    // 1. LAN Server Polling for instant multi-device reflection
    const fetchServerDashboard = async () => {
      try {
        const res = await fetch(`${BASE_URL}/dashboard/family_demo_001`);
        if (res.ok) {
          const d = await res.json();
          if (isMounted) {
            setOverview((prev) => {
              const activeCount =
                typeof d.active_escalations === "number"
                  ? d.active_escalations
                  : prev.active_escalations;
              let checkinStatus = d.last_checkin_status || prev.last_checkin_status;
              // If there's an active due medication, check-in MUST indicate unanswered
              if (d.due_untaken_med || dueUntakenMedRef.current) {
                checkinStatus = "unanswered";
              }
              return {
                ...prev,
                last_checkin_status: checkinStatus,
                last_checkin_time: d.last_checkin_time || prev.last_checkin_time,
                active_escalations: activeCount,
                medication_count:
                  typeof d.medication_count === "number"
                    ? d.medication_count
                    : prev.medication_count,
              };
            });
            if (d.due_untaken_med_details) {
              setDueUntakenMed(d.due_untaken_med_details);
            } else if (!d.due_untaken_med && !dueUntakenMedRef.current) {
              setDueUntakenMed(null);
            }
            setLastUpdated(new Date().toLocaleTimeString("en-IN"));
            setSyncing(false);
            setRefreshing(false);
          }
        }
      } catch (_) {}
    };

    fetchServerDashboard();
    const pollInterval = setInterval(fetchServerDashboard, 2000);

    // 2. Subscribe to check-ins without strict orderBy to avoid type/index drops
    const checkinsRef = collection(db, "elders", ELDER_ID, "checkins");
    const checkinQuery = query(checkinsRef, limit(30));
    const unsubCheckins = onSnapshot(
      checkinQuery,
      (snap) => {
        if (!snap.empty && isMounted) {
          const docs: any[] = [];
          snap.forEach((d) => docs.push({ id: d.id, ...d.data() }));

          docs.sort((a, b) => {
            const timeA =
              a.scheduledTime?.toMillis?.() ||
              (a.scheduledTime?.toDate ? a.scheduledTime.toDate().getTime() : 0) ||
              (typeof a.scheduledTime === "string" ? new Date(a.scheduledTime).getTime() : 0) ||
              (a.createdAt?.toMillis?.() || (a.createdAt ? new Date(a.createdAt).getTime() : 0));
            const timeB =
              b.scheduledTime?.toMillis?.() ||
              (b.scheduledTime?.toDate ? b.scheduledTime.toDate().getTime() : 0) ||
              (typeof b.scheduledTime === "string" ? new Date(b.scheduledTime).getTime() : 0) ||
              (b.createdAt?.toMillis?.() || (b.createdAt ? new Date(b.createdAt).getTime() : 0));
            return timeB - timeA;
          });

          const doc = docs[0];
          const scheduledIso =
            doc.scheduledTime?.toDate?.()?.toISOString?.() ||
            (typeof doc.scheduledTime === "string" ? doc.scheduledTime : null) ||
            doc.createdAt?.toDate?.()?.toISOString?.() ||
            new Date().toISOString();

          setOverview((prev) => {
            let effectiveStatus = doc.status || "answered";
            if (dueUntakenMedRef.current) {
              effectiveStatus = "unanswered";
            } else if (
              (prev.active_escalations === 0 || doc.resolved) &&
              (doc.type === "emergency_sos" || doc.escalationTriggered)
            ) {
              effectiveStatus = "answered";
            }
            return {
              ...prev,
              last_checkin_status: effectiveStatus,
              last_checkin_time: scheduledIso,
            };
          });
        }
        setLastUpdated(new Date().toLocaleTimeString("en-IN"));
        setSyncing(false);
        setRefreshing(false);
      },
      (err) => {
        setSyncing(false);
        setRefreshing(false);
      }
    );

    // 3. Subscribe to active (unresolved) escalations
    const escRef = collection(db, "elders", ELDER_ID, "escalations");
    const escQuery = query(escRef, where("resolved", "==", false));
    const unsubEsc = onSnapshot(
      escQuery,
      (snap) => {
        if (isMounted) {
          const openCount = snap.size;
          setOverview((prev) => ({
            ...prev,
            active_escalations: openCount,
            last_checkin_status:
              dueUntakenMedRef.current
                ? "unanswered"
                : openCount === 0 && prev.last_checkin_status === "unanswered"
                ? "answered"
                : prev.last_checkin_status,
          }));
          setLastUpdated(new Date().toLocaleTimeString("en-IN"));
          setSyncing(false);
        }
      },
      (err) => {
        setSyncing(false);
      }
    );

    // 4. Subscribe to medications count and untaken due reminder
    const unsubMeds = subscribeMedications(
      ELDER_ID,
      (meds) => {
        if (isMounted) {
          const activeCount = meds.filter((m) => m.active).length;
          const dueMed = meds.find((m) => isMedicationDueOrOverdue(m)) || null;
          setDueUntakenMed(dueMed);
          dueUntakenMedRef.current = dueMed;

          setOverview((prev) => ({
            ...prev,
            medication_count: activeCount,
            last_checkin_status: dueMed ? "unanswered" : prev.last_checkin_status,
          }));
          setLastUpdated(new Date().toLocaleTimeString("en-IN"));
          setSyncing(false);
        }
      },
      (err) => {
        setSyncing(false);
      }
    );

    return () => {
      isMounted = false;
      clearTimeout(syncTimer);
      clearInterval(pollInterval);
      unsubCheckins();
      unsubEsc();
      unsubMeds();
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setSyncing(true);
    fetch(`${BASE_URL}/dashboard/family_demo_001`)
      .then((r) => r.json())
      .then((d) => {
        setOverview((prev) => ({
          ...prev,
          last_checkin_status: d.last_checkin_status || prev.last_checkin_status,
          last_checkin_time: d.last_checkin_time || prev.last_checkin_time,
          active_escalations: typeof d.active_escalations === "number" ? d.active_escalations : prev.active_escalations,
          medication_count: typeof d.medication_count === "number" ? d.medication_count : prev.medication_count,
        }));
      })
      .catch(() => {})
      .finally(() => {
        setLastUpdated(new Date().toLocaleTimeString("en-IN"));
        setTimeout(() => {
          setRefreshing(false);
          setSyncing(false);
        }, 500);
      });
  }, []);

  const { theme, isDark } = useTheme();

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.primary}
        />
      }
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={[styles.title, { color: theme.text }]}>Overview</Text>
            {syncing && (
              <ActivityIndicator
                size="small"
                color={theme.primary}
                style={{ marginLeft: 8 }}
              />
            )}
          </View>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            {syncing
              ? "⚡ Syncing live data…"
              : lastUpdated
              ? `Updated ${lastUpdated}`
              : "Live Realtime Sync"}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.refreshBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={onRefresh}
          accessibilityLabel="Refresh dashboard"
        >
          <Text style={[styles.refreshBtnText, { color: theme.primary }]}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Last Check-in Card */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Text style={[styles.cardLabel, { color: theme.textMuted }]}>LAST CHECK-IN</Text>
          {dueUntakenMed && (
            <View style={[styles.dueBadge, { backgroundColor: theme.dangerBg, borderColor: theme.dangerBorder }]}>
              <Text style={[styles.dueBadgeText, { color: theme.danger }]}>💊 Reminder Active</Text>
            </View>
          )}
        </View>
        <View style={styles.checkinRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: statusColor(overview?.last_checkin_status ?? null, !!dueUntakenMed) },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              { color: statusColor(overview?.last_checkin_status ?? null, !!dueUntakenMed) },
            ]}
          >
            {statusLabel(overview?.last_checkin_status ?? null, !!dueUntakenMed)}
          </Text>
        </View>
        <Text style={[styles.timeText, { color: theme.textSecondary }]}>
          {dueUntakenMed
            ? `Waiting for elder: ${dueUntakenMed.name} (${dueUntakenMed.dosage})`
            : formatTime(overview?.last_checkin_time ?? null)}
        </Text>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        {/* Escalations card */}
        <View
          style={[
            styles.statCard,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
            (overview?.active_escalations ?? 0) > 0 && [
              styles.statCardAlert,
              { backgroundColor: theme.dangerBg, borderColor: theme.dangerBorder },
            ],
          ]}
        >
          <Text style={[styles.statNumber, { color: (overview?.active_escalations ?? 0) > 0 ? theme.danger : theme.text }]}>
            {overview?.active_escalations ?? 0}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>
            {(overview?.active_escalations ?? 0) === 1
              ? "Open Alert"
              : "Open Alerts"}
          </Text>
          {(overview?.active_escalations ?? 0) > 0 && (
            <Text style={[styles.alertBadge, { color: theme.danger, backgroundColor: isDark ? "#EF444422" : "#FEE2E2" }]}>⚠ Needs Attention</Text>
          )}
        </View>

        {/* Medications card */}
        <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.statNumber, { color: theme.text }]}>
            {overview?.medication_count ?? 0}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>
            {(overview?.medication_count ?? 0) === 1
              ? "Medication"
              : "Medications"}
          </Text>
          <Text style={[styles.statSub, { color: theme.textSubtle }]}>Active reminders</Text>
        </View>
      </View>

      {/* Info note */}
      <View style={[styles.infoBox, { backgroundColor: theme.cardSecondary, borderColor: theme.border }]}>
        <Text style={styles.infoIcon}>ℹ</Text>
        <Text style={[styles.infoText, { color: theme.textMuted }]}>
          Conversation history is private to the elder. Only structured events
          are shown here.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#0D0D1A",
    padding: 20,
  },
  centered: {
    flex: 1,
    backgroundColor: "#0D0D1A",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#9CA3AF",
    marginTop: 12,
    fontSize: 14,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#F9FAFB",
    paddingRight: 16,
  },
  subtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  refreshBtn: {
    backgroundColor: "#1A1A2E",
    borderWidth: 1,
    borderColor: "#2A2A4A",
    borderRadius: 12,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshBtnText: {
    color: "#9CA3AF",
    fontSize: 18,
    lineHeight: 22,
  },
  card: {
    backgroundColor: "#1A1A2E",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A4A",
    padding: 20,
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 1,
    marginBottom: 12,
  },
  checkinRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    flexWrap: "wrap",
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 18,
    fontWeight: "700",
    flexShrink: 1,
  },
  timeText: {
    fontSize: 13,
    color: "#9CA3AF",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#1A1A2E",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A4A",
    paddingVertical: 18,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  statCardAlert: {
    borderColor: "#EF444466",
    backgroundColor: "#1F1218",
  },
  statNumber: {
    fontSize: 32,
    fontWeight: "800",
    color: "#F9FAFB",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
    textAlign: "center",
  },
  statSub: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  alertBadge: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "700",
    color: "#EF4444",
    backgroundColor: "#EF444422",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dueBadge: {
    backgroundColor: "#EF444422",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#EF444455",
  },
  dueBadgeText: {
    color: "#EF4444",
    fontSize: 11,
    fontWeight: "700",
  },
  infoBox: {
    flexDirection: "row",
    backgroundColor: "#111827",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1F2937",
    padding: 14,
    alignItems: "flex-start",
    marginTop: 8,
  },
  infoIcon: {
    fontSize: 14,
    color: "#6B7280",
    marginRight: 8,
    marginTop: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 18,
  },
});
