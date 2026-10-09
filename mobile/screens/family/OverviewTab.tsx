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
import { API, roleHeaders } from "../../constants/api";

/**
 * OverviewTab — Family Dashboard, Tab 1
 * Phase 5: Live data from GET /dashboard/{family_id}?elder_id=...
 *
 * Shows:
 *   - Last check-in status & time
 *   - Active (unresolved) escalation count with alert badge
 *   - Medication count
 *   - Quick refresh button
 *
 * Privacy: No conversation content shown — elder-private per confirmed policy.
 */

// TODO: Replace with real IDs from auth context when auth is implemented (Phase 6).
const FAMILY_ID = "family_demo_001";
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
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchOverview = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const url = `${API.dashboard(FAMILY_ID)}?elder_id=${ELDER_ID}`;
      const res = await fetch(url, { headers: roleHeaders("family") });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setOverview(data.overview);
      setLastUpdated(new Date().toLocaleTimeString("en-IN"));
    } catch (e: any) {
      setError(e.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

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
          onRefresh={() => fetchOverview(true)}
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
          onPress={() => fetchOverview(true)}
          accessibilityLabel="Refresh dashboard"
        >
          <Text style={styles.refreshBtnText}>↻</Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠ {error}</Text>
          <TouchableOpacity onPress={() => fetchOverview()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

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
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2A2A4A",
  },
  refreshBtnText: {
    color: "#6C63FF",
    fontSize: 20,
    fontWeight: "700",
  },
  errorBanner: {
    backgroundColor: "#2D1515",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#7F1D1D",
  },
  errorText: {
    color: "#FCA5A5",
    fontSize: 13,
    flex: 1,
  },
  retryText: {
    color: "#6C63FF",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 8,
  },
  card: {
    backgroundColor: "#1A1A2E",
    borderRadius: 20,
    padding: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2A2A4A",
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  checkinRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  statusText: {
    fontSize: 20,
    fontWeight: "700",
  },
  timeText: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 4,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#1A1A2E",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2A4A",
  },
  statCardAlert: {
    borderColor: "#7F1D1D",
    backgroundColor: "#1F1015",
  },
  statNumber: {
    fontSize: 36,
    fontWeight: "800",
    color: "#F9FAFB",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: "#9CA3AF",
    fontWeight: "600",
    textAlign: "center",
  },
  alertBadge: {
    marginTop: 8,
    backgroundColor: "#7F1D1D",
    color: "#FCA5A5",
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: "hidden",
  },
  statSub: {
    marginTop: 6,
    color: "#4B5563",
    fontSize: 11,
  },
  infoBox: {
    flexDirection: "row",
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1F2937",
    alignItems: "flex-start",
    marginTop: 4,
  },
  infoIcon: {
    color: "#6C63FF",
    fontSize: 14,
    marginRight: 8,
    marginTop: 1,
  },
  infoText: {
    color: "#6B7280",
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },
});
