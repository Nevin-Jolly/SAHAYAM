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

function statusColor(status: Overview["last_checkin_status"]): string {
  switch (status) {
    case "answered":
      return "#10B981"; // green
    case "unanswered":
      return "#EF4444"; // red
    case "pending":
      return "#F59E0B"; // amber
    default:
      return "#6B7280"; // grey (no data)
  }
}

function statusLabel(status: Overview["last_checkin_status"]): string {
  switch (status) {
    case "answered":
      return "✓ Responded";
    case "unanswered":
      return "✗ No Response";
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
    medication_count: 2,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);

    // 1. Subscribe to latest check-in
    const checkinsRef = collection(db, "elders", ELDER_ID, "checkins");
    const checkinQuery = query(checkinsRef, orderBy("scheduledTime", "desc"), limit(1));
    const unsubCheckins = onSnapshot(
      checkinQuery,
      (snap) => {
        if (!snap.empty) {
          const doc = snap.docs[0].data();
          const scheduledIso =
            doc.scheduledTime?.toDate?.()?.toISOString?.() ||
            (typeof doc.scheduledTime === "string" ? doc.scheduledTime : null);
          setOverview((prev) => ({
            ...prev,
            last_checkin_status: doc.status || "answered",
            last_checkin_time: scheduledIso || prev.last_checkin_time,
          }));
        }
        setLastUpdated(new Date().toLocaleTimeString("en-IN"));
        setLoading(false);
        setRefreshing(false);
      },
      (err) => {
        console.warn("Checkins snapshot listener notice:", err);
        setLoading(false);
        setRefreshing(false);
      }
    );

    // 2. Subscribe to active (unresolved) escalations
    const escRef = collection(db, "elders", ELDER_ID, "escalations");
    const escQuery = query(escRef, where("resolved", "==", false));
    const unsubEsc = onSnapshot(
      escQuery,
      (snap) => {
        setOverview((prev) => ({
          ...prev,
          active_escalations: snap.size,
        }));
        setLastUpdated(new Date().toLocaleTimeString("en-IN"));
      },
      (err) => console.warn("Escalations listener notice:", err)
    );

    // 3. Subscribe to active medications count
    const medsRef = collection(db, "elders", ELDER_ID, "medications");
    const medsQuery = query(medsRef, where("active", "==", true));
    const unsubMeds = onSnapshot(
      medsQuery,
      (snap) => {
        setOverview((prev) => ({
          ...prev,
          medication_count: snap.size,
        }));
        setLastUpdated(new Date().toLocaleTimeString("en-IN"));
      },
      (err) => console.warn("Medications listener notice:", err)
    );

    return () => {
      unsubCheckins();
      unsubEsc();
      unsubMeds();
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setLastUpdated(new Date().toLocaleTimeString("en-IN"));
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Loading dashboard…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#6C63FF"
        />
      }
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Overview</Text>
          <Text style={styles.subtitle}>
            {lastUpdated ? `Updated ${lastUpdated}` : "Pull down to refresh"}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={onRefresh}
          accessibilityLabel="Refresh dashboard"
        >
          <Text style={styles.refreshBtnText}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Last Check-in Card */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>LAST CHECK-IN</Text>
        <View style={styles.checkinRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: statusColor(overview?.last_checkin_status ?? null) },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              { color: statusColor(overview?.last_checkin_status ?? null) },
            ]}
          >
            {statusLabel(overview?.last_checkin_status ?? null)}
          </Text>
        </View>
        <Text style={styles.timeText}>
          {formatTime(overview?.last_checkin_time ?? null)}
        </Text>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        {/* Escalations card */}
        <View
          style={[
            styles.statCard,
            (overview?.active_escalations ?? 0) > 0 && styles.statCardAlert,
          ]}
        >
          <Text style={styles.statNumber}>
            {overview?.active_escalations ?? 0}
          </Text>
          <Text style={styles.statLabel}>
            {(overview?.active_escalations ?? 0) === 1
              ? "Open Alert"
              : "Open Alerts"}
          </Text>
          {(overview?.active_escalations ?? 0) > 0 && (
            <Text style={styles.alertBadge}>⚠ Needs Attention</Text>
          )}
        </View>

        {/* Medications card */}
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {overview?.medication_count ?? 0}
          </Text>
          <Text style={styles.statLabel}>
            {(overview?.medication_count ?? 0) === 1
              ? "Medication"
              : "Medications"}
          </Text>
          <Text style={styles.statSub}>Active reminders</Text>
        </View>
      </View>

      {/* Info note */}
      <View style={styles.infoBox}>
        <Text style={styles.infoIcon}>ℹ</Text>
        <Text style={styles.infoText}>
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
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 20,
    fontWeight: "700",
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
    padding: 20,
    alignItems: "center",
  },
  statCardAlert: {
    borderColor: "#EF444466",
    backgroundColor: "#1F1218",
  },
  statNumber: {
    fontSize: 36,
    fontWeight: "800",
    color: "#F9FAFB",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9CA3AF",
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
