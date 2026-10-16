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
import { BASE_URL } from "../../constants/api";
import { resolveEmergencyEscalationDirect } from "../../services/companionService";
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
import { useTheme } from "../../context/ThemeContext";

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

const INITIAL_CHECKINS: Checkin[] = [
  {
    id: "chk_today_01",
    elder_id: ELDER_ID,
    status: "answered",
    timestamp: new Date().toISOString(),
    responded_at: new Date().toISOString(),
    notes: "സുഖമായിരിക്കുന്നു (Feeling well, morning check-in)",
    escalation_triggered: false,
  },
  {
    id: "chk_yesterday_01",
    elder_id: ELDER_ID,
    status: "answered",
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    responded_at: new Date(Date.now() - 86400000).toISOString(),
    notes: "മരുന്ന് കൃത്യമായി കഴിച്ചു (Medication taken on time)",
    escalation_triggered: false,
  },
];

export default function CheckinsTab() {
  const [checkins, setCheckins] = useState<Checkin[]>(INITIAL_CHECKINS);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [syncing, setSyncing] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // 1. LAN Server Fetching for instant multi-device reflection
  const fetchServerData = useCallback(async () => {
    try {
      const [chkRes, escRes] = await Promise.all([
        fetch(`${BASE_URL}/checkins?elderId=${encodeURIComponent(ELDER_ID)}`),
        fetch(`${BASE_URL}/escalations?elderId=${encodeURIComponent(ELDER_ID)}`),
      ]);
      if (chkRes.ok) {
        const data = await chkRes.json();
        if (data.checkins && Array.isArray(data.checkins)) {
          const list: Checkin[] = data.checkins.map((d: any) => ({
            id: d.id,
            elder_id: ELDER_ID,
            status: d.status || "answered",
            timestamp: d.scheduledTime || d.createdAt || new Date().toISOString(),
            responded_at: d.answeredAt || null,
            notes: d.moodNote || d.promptNote || null,
            escalation_triggered: !!d.escalationTriggered,
          }));
          list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setCheckins(list);
        }
      }
      if (escRes.ok) {
        const data = await escRes.json();
        if (data.escalations && Array.isArray(data.escalations)) {
          const list: Escalation[] = data.escalations.map((d: any) => ({
            id: d.id,
            elder_id: ELDER_ID,
            reason: d.reason || "elder_sos",
            triggered_at: d.triggered_at || d.triggeredAt || d.createdAt || new Date().toISOString(),
            resolved: !!d.resolved,
            resolved_at: d.resolved_at || d.resolvedAt || null,
            family_notified: !!d.family_notified || !!d.familyNotified,
            notes: d.notes || null,
          }));
          list.sort((a, b) => new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime());
          setEscalations(list);
        }
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    let isMounted = true;
    const syncTimer = setTimeout(() => setSyncing(false), 2000);

    fetchServerData();
    const pollInterval = setInterval(fetchServerData, 2000);

    // 2. Subscribe to Check-ins from Cloud Firestore
    const checkinsRef = collection(db, "elders", ELDER_ID, "checkins");
    const checkinsQuery = query(checkinsRef, limit(50));
    const unsubCheckins = onSnapshot(
      checkinsQuery,
      (snap) => {
        if (!snap.empty && isMounted) {
          const list: Checkin[] = [];
          snap.forEach((d) => {
            const data = d.data();
            const scheduledIso =
              data.scheduledTime?.toDate?.()?.toISOString?.() ||
              (typeof data.scheduledTime === "string" ? data.scheduledTime : null) ||
              data.createdAt?.toDate?.()?.toISOString?.() ||
              new Date().toISOString();
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
          list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setCheckins(list);
        }
        setSyncing(false);
        setRefreshing(false);
      },
      (err) => {
        setSyncing(false);
        setRefreshing(false);
      }
    );

    // 3. Subscribe to Escalations from Cloud Firestore
    const escRef = collection(db, "elders", ELDER_ID, "escalations");
    const escQuery = query(escRef, limit(50));
    const unsubEsc = onSnapshot(
      escQuery,
      (snap) => {
        if (isMounted) {
          const list: Escalation[] = [];
          snap.forEach((d) => {
            const data = d.data();
            const triggeredIso =
              data.triggeredAt?.toDate?.()?.toISOString?.() ||
              (typeof data.triggeredAt === "string" ? data.triggeredAt : null) ||
              data.createdAt?.toDate?.()?.toISOString?.() ||
              new Date().toISOString();
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
          list.sort((a, b) => new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime());
          setEscalations(list);
        }
      },
      (err) => {}
    );

    return () => {
      isMounted = false;
      clearTimeout(syncTimer);
      clearInterval(pollInterval);
      unsubCheckins();
      unsubEsc();
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setSyncing(true);
    fetchServerData();
    setTimeout(() => {
      setRefreshing(false);
      setSyncing(false);
    }, 600);
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
              await resolveEmergencyEscalationDirect(ELDER_ID, escalation.id);
              setEscalations((prev) =>
                prev.map((e) =>
                  e.id === escalation.id
                    ? { ...e, resolved: true, resolved_at: new Date().toISOString() }
                    : e
                )
              );
              setCheckins((prev) =>
                prev.map((c) =>
                  c.status === "unanswered" && c.escalation_triggered
                    ? {
                        ...c,
                        status: "answered",
                        responded_at: new Date().toISOString(),
                        notes: "പരിഹരിച്ചു — കുടുംബം സ്ഥിരീകരിച്ചു (Resolved by Family)",
                      }
                    : c
                )
              );
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
            <Text style={[styles.title, { color: theme.text }]}>Check-ins & Alerts</Text>
            {syncing && (
              <ActivityIndicator
                size="small"
                color={theme.primary}
                style={{ marginLeft: 8 }}
              />
            )}
          </View>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            {syncing ? "⚡ Syncing live history…" : "Daily welfare check-ins & escalation logs"}
          </Text>
        </View>
        {openEscalations.length > 0 && (
          <View style={[styles.alertBadge, { backgroundColor: theme.dangerBg, borderColor: theme.dangerBorder }]}>
            <Text style={[styles.alertBadgeText, { color: theme.danger }]}>{openEscalations.length} open</Text>
          </View>
        )}
      </View>

      {/* ── Open Escalations ─────────────────────────────────────────────────── */}
      <Text style={[styles.sectionTitle, { color: theme.primary }]}>
        🚨 Open Escalations ({openEscalations.length})
      </Text>

      {openEscalations.length === 0 && (
        <View style={[styles.emptyRow, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}>
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>✓ No open escalations</Text>
        </View>
      )}

      {openEscalations.map((esc) => (
        <View
          key={esc.id}
          style={[
            styles.escalationCard,
            {
              backgroundColor: theme.dangerBg,
              borderColor: theme.dangerBorder,
            },
          ]}
        >
          <View style={styles.escalationTop}>
            <View style={styles.escalationLeft}>
              <Text style={[styles.escalationReason, { color: theme.danger }]}>
                {esc.reason === "missed_medication"
                  ? "💊 Missed Medication Check-in"
                  : esc.reason === "unanswered_checkin"
                  ? "Missed Check-in"
                  : esc.reason === "elder_sos"
                  ? "Elder SOS Emergency"
                  : esc.reason === "manual"
                  ? "Manual Alert"
                  : esc.reason}
              </Text>
              <Text style={[styles.escalationTime, { color: theme.textSecondary }]}>
                Triggered: {formatTime(esc.triggered_at)}
              </Text>
              <Text style={[styles.escalationNotified, { color: theme.textMuted }]}>
                Family notified: {esc.family_notified ? "Yes ✓" : "Pending"}
              </Text>
              {esc.notes ? <Text style={[styles.notesText, { color: theme.textSecondary }]}>{esc.notes}</Text> : null}
            </View>
            <TouchableOpacity
              style={[
                styles.resolveBtn,
                { backgroundColor: theme.card, borderColor: theme.primary },
                resolvingId === esc.id && styles.resolveBtnDisabled,
              ]}
              onPress={() => handleResolve(esc)}
              disabled={resolvingId === esc.id}
              accessibilityLabel={`Resolve escalation from ${esc.triggered_at}`}
            >
              {resolvingId === esc.id ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Text style={[styles.resolveBtnText, { color: theme.primary }]}>Resolve</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {/* ── Resolved Escalations ─────────────────────────────────────────────── */}
      {resolvedEscalations.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: theme.primary, marginTop: 20 }]}>
            ✓ Resolved Escalations ({resolvedEscalations.length})
          </Text>
          {resolvedEscalations.map((esc) => (
            <View
              key={esc.id}
              style={[
                styles.escalationCard,
                styles.resolvedCard,
                {
                  backgroundColor: theme.successBg,
                  borderColor: theme.successBorder,
                },
              ]}
            >
              <Text style={[styles.resolvedReason, { color: theme.success }]}>
                {esc.reason === "missed_medication"
                  ? "💊 Missed Medication (Resolved)"
                  : esc.reason === "unanswered_checkin"
                  ? "Missed Check-in"
                  : esc.reason === "elder_sos"
                  ? "Elder SOS Emergency"
                  : esc.reason}
              </Text>
              <Text style={[styles.resolvedTime, { color: theme.textMuted }]}>
                {formatTime(esc.triggered_at)} → Resolved {formatTime(esc.resolved_at)}
              </Text>
            </View>
          ))}
        </>
      )}

      {/* ── Check-in History ─────────────────────────────────────────────────── */}
      <Text style={[styles.sectionTitle, { color: theme.primary, marginTop: 24 }]}>
        📋 Check-in History ({checkins.length})
      </Text>

      {checkins.length === 0 && (
        <View style={[styles.emptyRow, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}>
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>No check-ins recorded yet</Text>
        </View>
      )}

      {checkins.map((c) => (
        <View
          key={c.id}
          style={[
            styles.checkinRow,
            {
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            },
          ]}
        >
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
            <Text style={[styles.checkinTime, { color: theme.textSecondary }]}>{formatTime(c.timestamp)}</Text>
            {c.responded_at && (
              <Text style={[styles.checkinResponded, { color: theme.success }]}>
                Responded: {formatTime(c.responded_at)}
              </Text>
            )}
            {c.notes ? <Text style={[styles.checkinNotes, { color: theme.textSecondary }]}>{c.notes}</Text> : null}
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
    paddingRight: 8,
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
