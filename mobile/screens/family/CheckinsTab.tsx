import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { API, roleHeaders } from "../../constants/api";

/**
 * CheckinsTab — Family Dashboard, Tab 3
 * Phase 5: Live data from GET /checkins and GET /escalations.
 *          Resolve action via PUT /escalations/{id}/resolve.
 *
 * Shows check-ins and escalations in a combined, scrollable view with
 * two sections — Escalations (top, most urgent) and Check-in History.
 * Escalation threshold: 30 minutes no response → auto-escalate (Phase 4 scheduler).
 */

// TODO: Replace with real IDs from auth context when auth is implemented (Phase 6).
const ELDER_ID = "elder_demo_001";

interface Checkin {
  id: string;
  elder_id: string;
  timestamp: string;
  responded_at: string | null;
  status: "answered" | "unanswered" | "pending";
  escalation_triggered: boolean;
  notes: string;
}

interface Escalation {
  id: string;
  elder_id: string;
  reason: string;
  triggered_at: string;
  family_notified: boolean;
  resolved: boolean;
  resolved_at: string | null;
}

function formatTime(iso: string | null | undefined): string {
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

function checkinStatusColor(status: Checkin["status"]): string {
  switch (status) {
    case "answered":  return "#10B981";
    case "unanswered": return "#EF4444";
    case "pending":   return "#F59E0B";
    default:          return "#6B7280";
  }
}

function checkinStatusIcon(status: Checkin["status"]): string {
  switch (status) {
    case "answered":  return "✓";
    case "unanswered": return "✗";
    case "pending":   return "⏳";
    default:          return "?";
  }
}

export default function CheckinsTab() {
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [checkinsRes, escalationsRes] = await Promise.all([
        fetch(`${API.checkins}?elder_id=${ELDER_ID}&limit=20`, {
          headers: roleHeaders("family"),
        }),
        fetch(`${API.escalations}?elder_id=${ELDER_ID}&limit=20`, {
          headers: roleHeaders("family"),
        }),
      ]);

      if (!checkinsRes.ok) throw new Error(`Check-ins error ${checkinsRes.status}`);
      if (!escalationsRes.ok) throw new Error(`Escalations error ${escalationsRes.status}`);

      const checkinsData = await checkinsRes.json();
      const escalationsData = await escalationsRes.json();

      setCheckins(checkinsData.checkins || []);
      setEscalations(escalationsData.escalations || []);
    } catch (e: any) {
      setError(e.message || "Failed to load data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleResolve = async (escalation: Escalation) => {
    Alert.alert(
      "Mark as Resolved",
      `Mark this escalation as resolved?\nReason: ${escalation.reason}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Resolve",
          onPress: async () => {
            setResolvingId(escalation.id);
            try {
              const res = await fetch(
                `${API.escalations}/${escalation.id}/resolve`,
                { method: "PUT", headers: roleHeaders("family") }
              );
              if (!res.ok) throw new Error(`Server error ${res.status}`);
              await fetchData();
            } catch (e: any) {
              Alert.alert("Error", e.message || "Failed to resolve escalation.");
            } finally {
              setResolvingId(null);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Loading check-ins…</Text>
      </View>
    );
  }

  const openEscalations = escalations.filter((e) => !e.resolved);
  const resolvedEscalations = escalations.filter((e) => e.resolved);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => fetchData(true)}
          tintColor="#6C63FF"
        />
      }
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Check-ins & Alerts</Text>
          <Text style={styles.subtitle}>Pull down to refresh</Text>
        </View>
        {openEscalations.length > 0 && (
          <View style={styles.alertBadge}>
            <Text style={styles.alertBadgeText}>{openEscalations.length} open</Text>
          </View>
        )}
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠ {error}</Text>
          <TouchableOpacity onPress={() => fetchData()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Open Escalations ─────────────────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>
        🚨 Open Escalations ({openEscalations.length})
      </Text>

      {openEscalations.length === 0 && (
        <View style={styles.emptyRow}>
          <Text style={styles.emptyText}>✓ No open escalations</Text>
        </View>
      )}

      {openEscalations.map((esc) => (
        <View key={esc.id} style={styles.escalationCard}>
          <View style={styles.escalationTop}>
            <View style={styles.escalationLeft}>
              <Text style={styles.escalationReason}>
                {esc.reason === "unanswered_checkin"
                  ? "Missed Check-in"
                  : esc.reason === "manual"
                  ? "Manual Alert"
                  : esc.reason}
              </Text>
              <Text style={styles.escalationTime}>
                Triggered: {formatTime(esc.triggered_at)}
              </Text>
              <Text style={styles.escalationNotified}>
                Family notified: {esc.family_notified ? "Yes ✓" : "No"}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.resolveBtn,
                resolvingId === esc.id && styles.resolveBtnDisabled,
              ]}
              onPress={() => handleResolve(esc)}
              disabled={resolvingId === esc.id}
              accessibilityLabel={`Resolve escalation from ${esc.triggered_at}`}
            >
              {resolvingId === esc.id ? (
                <ActivityIndicator size="small" color="#6C63FF" />
              ) : (
                <Text style={styles.resolveBtnText}>Resolve</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {/* ── Resolved Escalations ─────────────────────────────────────────────── */}
      {resolvedEscalations.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
            ✓ Resolved Escalations ({resolvedEscalations.length})
          </Text>
          {resolvedEscalations.map((esc) => (
            <View key={esc.id} style={[styles.escalationCard, styles.resolvedCard]}>
              <Text style={styles.resolvedReason}>
                {esc.reason === "unanswered_checkin" ? "Missed Check-in" : esc.reason}
              </Text>
              <Text style={styles.resolvedTime}>
                {formatTime(esc.triggered_at)} → Resolved {formatTime(esc.resolved_at)}
              </Text>
            </View>
          ))}
        </>
      )}

      {/* ── Check-in History ─────────────────────────────────────────────────── */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
        📋 Check-in History ({checkins.length})
      </Text>

      {checkins.length === 0 && !error && (
        <View style={styles.emptyRow}>
          <Text style={styles.emptyText}>No check-ins recorded yet</Text>
        </View>
      )}

      {checkins.map((c) => (
        <View key={c.id} style={styles.checkinRow}>
          <View
            style={[
              styles.checkinDot,
              { backgroundColor: checkinStatusColor(c.status) },
            ]}
          >
            <Text style={styles.checkinDotIcon}>{checkinStatusIcon(c.status)}</Text>
          </View>
          <View style={styles.checkinInfo}>
            <Text style={[styles.checkinStatus, { color: checkinStatusColor(c.status) }]}>
              {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
              {c.escalation_triggered ? " ⚠" : ""}
            </Text>
            <Text style={styles.checkinTime}>{formatTime(c.timestamp)}</Text>
            {c.responded_at && (
              <Text style={styles.checkinResponded}>
                Responded: {formatTime(c.responded_at)}
              </Text>
            )}
            {c.notes ? <Text style={styles.checkinNotes}>{c.notes}</Text> : null}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: "#0D0D1A", padding: 20 },
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
    alignItems: "flex-start",
    marginBottom: 20,
  },
  title: { fontSize: 28, fontWeight: "800", color: "#F9FAFB" },
  subtitle: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  alertBadge: {
    backgroundColor: "#7F1D1D",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  alertBadgeText: { color: "#FCA5A5", fontSize: 12, fontWeight: "700" },
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
  errorText: { color: "#FCA5A5", fontSize: 13, flex: 1 },
  retryText: { color: "#6C63FF", fontSize: 13, fontWeight: "700", marginLeft: 8 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#9CA3AF",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  emptyRow: {
    backgroundColor: "#1A1A2E",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2A4A",
    marginBottom: 8,
  },
  emptyText: { color: "#6B7280", fontSize: 14 },
  // Escalation cards
  escalationCard: {
    backgroundColor: "#1F1015",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#7F1D1D",
  },
  resolvedCard: {
    backgroundColor: "#111827",
    borderColor: "#1F2937",
  },
  escalationTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  escalationLeft: { flex: 1 },
  escalationReason: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FCA5A5",
    marginBottom: 4,
  },
  escalationTime: { fontSize: 12, color: "#9CA3AF", marginBottom: 2 },
  escalationNotified: { fontSize: 12, color: "#6B7280" },
  resolveBtn: {
    backgroundColor: "#1A1A2E",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#6C63FF",
    marginLeft: 12,
    minWidth: 70,
    alignItems: "center",
  },
  resolveBtnDisabled: { opacity: 0.5 },
  resolveBtnText: { color: "#6C63FF", fontSize: 13, fontWeight: "700" },
  resolvedReason: { fontSize: 13, fontWeight: "600", color: "#6B7280", marginBottom: 2 },
  resolvedTime: { fontSize: 11, color: "#4B5563" },
  // Check-in rows
  checkinRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    backgroundColor: "#1A1A2E",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#2A2A4A",
  },
  checkinDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  checkinDotIcon: { color: "#fff", fontSize: 14, fontWeight: "700" },
  checkinInfo: { flex: 1 },
  checkinStatus: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  checkinTime: { fontSize: 12, color: "#9CA3AF" },
  checkinResponded: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  checkinNotes: {
    fontSize: 11,
    color: "#4B5563",
    marginTop: 4,
    fontStyle: "italic",
  },
});
