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
import { db } from "../../constants/firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

/**
 * CheckinsTab — Family Dashboard, Tab 3
 * Phase 4 & 5: Live Cloud Firestore check-in history & escalation management.
 *
 * Realtime sync:
 *   - Proactive check-in log from elders/{elderId}/checkins
 *   - Escalation alerts from elders/{elderId}/escalations
 *   - Direct resolution action updates Firestore document
 */

const ELDER_ID = "elder_demo_001";

interface Checkin {
  id: string;
  elder_id: string;
  status: "answered" | "unanswered" | "pending";
  timestamp: string;
  responded_at?: string | null;
  notes?: string | null;
  escalation_triggered: boolean;
}

interface Escalation {
  id: string;
  elder_id: string;
  reason: string;
  triggered_at: string;
  resolved: boolean;
  resolved_at?: string | null;
  family_notified: boolean;
  notes?: string | null;
}

function checkinStatusColor(status: Checkin["status"]): string {
  switch (status) {
    case "answered":
      return "#10B981";
    case "unanswered":
      return "#EF4444";
    case "pending":
      return "#F59E0B";
    default:
      return "#6B7280";
  }
}

function checkinStatusIcon(status: Checkin["status"]): string {
  switch (status) {
    case "answered":
      return "✓";
    case "unanswered":
      return "✗";
    case "pending":
      return "⏳";
    default:
      return "•";
  }
}

function formatTime(iso?: string | null): string {
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

export default function CheckinsTab() {
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);

    // 1. Subscribe to Check-ins
    const checkinsRef = collection(db, "elders", ELDER_ID, "checkins");
    const checkinsQuery = query(checkinsRef, orderBy("scheduledTime", "desc"), limit(20));
    const unsubCheckins = onSnapshot(
      checkinsQuery,
      (snap) => {
        const list: Checkin[] = [];
        snap.forEach((d) => {
          const data = d.data();
          const scheduledIso =
            data.scheduledTime?.toDate?.()?.toISOString?.() ||
            (typeof data.scheduledTime === "string" ? data.scheduledTime : new Date().toISOString());
          const answeredIso =
            data.answeredAt?.toDate?.()?.toISOString?.() ||
            (typeof data.answeredAt === "string" ? data.answeredAt : null);

          list.push({
            id: d.id,
            elder_id: ELDER_ID,
            status: data.status || "answered",
            timestamp: scheduledIso,
            responded_at: answeredIso,
            notes: data.moodNote || data.promptNote || null,
            escalation_triggered: !!data.escalationTriggered,
          });
        });
        setCheckins(list);
        setLoading(false);
        setRefreshing(false);
      },
      (err) => {
        console.warn("Checkins listener notice:", err);
        setLoading(false);
        setRefreshing(false);
      }
    );

    // 2. Subscribe to Escalations
    const escRef = collection(db, "elders", ELDER_ID, "escalations");
    const escQuery = query(escRef, orderBy("triggeredAt", "desc"), limit(20));
    const unsubEsc = onSnapshot(
      escQuery,
      (snap) => {
        const list: Escalation[] = [];
        snap.forEach((d) => {
          const data = d.data();
          const triggeredIso =
            data.triggeredAt?.toDate?.()?.toISOString?.() ||
            (typeof data.triggeredAt === "string" ? data.triggeredAt : new Date().toISOString());
          const resolvedIso =
            data.resolvedAt?.toDate?.()?.toISOString?.() ||
            (typeof data.resolvedAt === "string" ? data.resolvedAt : null);

          list.push({
            id: d.id,
            elder_id: ELDER_ID,
            reason: data.reason || "unanswered_checkin",
            triggered_at: triggeredIso,
            resolved: !!data.resolved,
            resolved_at: resolvedIso,
            family_notified: !!data.familyNotified,
            notes: data.notes || null,
          });
        });
        setEscalations(list);
      },
      (err) => console.warn("Escalations listener notice:", err)
    );

    return () => {
      unsubCheckins();
      unsubEsc();
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

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
              const docRef = doc(db, "elders", ELDER_ID, "escalations", escalation.id);
              await updateDoc(docRef, {
                resolved: true,
                resolvedAt: serverTimestamp(),
                resolvedBy: "family_user",
              });
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

  const openEscalations = escalations.filter((e) => !e.resolved);
  const resolvedEscalations = escalations.filter((e) => e.resolved);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Loading check-ins…</Text>
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
          <Text style={styles.title}>Check-ins & Alerts</Text>
          <Text style={styles.subtitle}>Pull down to refresh</Text>
        </View>
        {openEscalations.length > 0 && (
          <View style={styles.alertBadge}>
            <Text style={styles.alertBadgeText}>{openEscalations.length} open</Text>
          </View>
        )}
      </View>

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
                  : esc.reason === "elder_sos"
                  ? "Elder SOS Emergency"
                  : esc.reason === "manual"
                  ? "Manual Alert"
                  : esc.reason}
              </Text>
              <Text style={styles.escalationTime}>
                Triggered: {formatTime(esc.triggered_at)}
              </Text>
              <Text style={styles.escalationNotified}>
                Family notified: {esc.family_notified ? "Yes ✓" : "Pending"}
              </Text>
              {esc.notes ? <Text style={styles.notesText}>{esc.notes}</Text> : null}
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
                {esc.reason === "unanswered_checkin"
                  ? "Missed Check-in"
                  : esc.reason === "elder_sos"
                  ? "Elder SOS Emergency"
                  : esc.reason}
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

      {checkins.length === 0 && (
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
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#F9FAFB",
  },
  subtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  alertBadge: {
    backgroundColor: "#EF444422",
    borderColor: "#EF4444",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  alertBadgeText: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#9CA3AF",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  emptyRow: {
    backgroundColor: "#1A1A2E",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
  },
  emptyText: {
    color: "#6B7280",
    fontSize: 14,
  },
  escalationCard: {
    backgroundColor: "#1F1218",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EF444444",
    padding: 16,
    marginBottom: 10,
  },
  resolvedCard: {
    backgroundColor: "#131E17",
    borderColor: "#10B98133",
  },
  escalationTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  escalationLeft: {
    flex: 1,
    marginRight: 12,
  },
  escalationReason: {
    color: "#EF4444",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  resolvedReason: {
    color: "#10B981",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  escalationTime: {
    color: "#9CA3AF",
    fontSize: 12,
    marginBottom: 2,
  },
  resolvedTime: {
    color: "#6B7280",
    fontSize: 11,
  },
  escalationNotified: {
    color: "#6B7280",
    fontSize: 11,
  },
  notesText: {
    color: "#D1D5DB",
    fontSize: 12,
    marginTop: 4,
    fontStyle: "italic",
  },
  resolveBtn: {
    backgroundColor: "#1A1A2E",
    borderWidth: 1,
    borderColor: "#6C63FF",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
  },
  resolveBtnDisabled: {
    opacity: 0.5,
  },
  resolveBtnText: {
    color: "#6C63FF",
    fontSize: 13,
    fontWeight: "700",
  },
  checkinRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#1A1A2E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A4A",
    padding: 14,
    marginBottom: 8,
  },
  checkinDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 2,
  },
  checkinDotIcon: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  checkinInfo: {
    flex: 1,
  },
  checkinStatus: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  checkinTime: {
    color: "#9CA3AF",
    fontSize: 12,
  },
  checkinResponded: {
    color: "#10B981",
    fontSize: 11,
    marginTop: 2,
  },
  checkinNotes: {
    color: "#D1D5DB",
    fontSize: 12,
    marginTop: 4,
  },
});
