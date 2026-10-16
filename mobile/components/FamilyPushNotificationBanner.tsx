import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Vibration,
  Platform,
} from "react-native";
import { db } from "../constants/firebase";
import { BASE_URL } from "../constants/api";
import { resolveEmergencyEscalationDirect } from "../services/companionService";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../context/ThemeContext";

const ELDER_ID = "elder_demo_001";

interface ActiveAlert {
  id: string;
  reason: string;
  notes: string;
  timeStr: string;
}

export default function FamilyPushNotificationBanner() {
  const [activeAlert, setActiveAlert] = useState<ActiveAlert | null>(null);
  const slideAnim = useRef(new Animated.Value(-140)).current;
  const lastAlertIdRef = useRef<string | null>(null);
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();

  useEffect(() => {
    let isMounted = true;

    // Helper to process active alert
    const triggerPushAlert = (alertId: string, reason: string, notes: string, timeDate?: Date | null) => {
      if (alertId === lastAlertIdRef.current) return;
      lastAlertIdRef.current = alertId;

      let timeStr = "Just now";
      if (timeDate && !isNaN(timeDate.getTime())) {
        timeStr = timeDate.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
      }

      const alertObj: ActiveAlert = {
        id: alertId,
        reason: reason || "elder_alert",
        notes: notes || "മുതിർന്നയാളിൽ നിന്ന് അടിയന്തര മുന്നറിയിപ്പ് ലഭിച്ചു.",
        timeStr,
      };

      setActiveAlert(alertObj);

      // Vibrate device for push notification sensation
      try {
        if (Platform.OS === "android" || Platform.OS === "ios") {
          Vibration.vibrate([0, 500, 200, 500, 200, 500]);
        }
      } catch (_) {}

      // Slide banner down
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 8,
      }).start();
    };

    // 1. LAN Server Polling (every 1.5s for instant multi-device sync)
    const pollServerEscalations = async () => {
      try {
        const res = await fetch(`${BASE_URL}/escalations?elderId=${encodeURIComponent(ELDER_ID)}&activeOnly=true`);
        if (res.ok) {
          const data = await res.json();
          if (data.escalations && Array.isArray(data.escalations) && isMounted) {
            if (data.escalations.length > 0) {
              const top = data.escalations[0];
              const t = top.triggered_at ? new Date(top.triggered_at) : null;
              triggerPushAlert(top.id, top.reason, top.notes, t);
            } else if (lastAlertIdRef.current) {
              // Alerts cleared
              lastAlertIdRef.current = null;
              Animated.timing(slideAnim, {
                toValue: -140,
                duration: 250,
                useNativeDriver: true,
              }).start(() => setActiveAlert(null));
            }
          }
        }
      } catch (_) {}
    };

    pollServerEscalations();
    const pollTimer = setInterval(pollServerEscalations, 1500);

    // 2. Cloud Firestore listener
    const escRef = collection(db, "elders", ELDER_ID, "escalations");
    const q = query(escRef, where("resolved", "==", false));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        if (!snap.empty && isMounted) {
          const docs: any[] = [];
          snap.forEach((d) => {
            docs.push({ id: d.id, ...d.data() });
          });

          docs.sort((a, b) => {
            const timeA =
              a.triggeredAt?.toMillis?.() ||
              (a.triggeredAt?.toDate ? a.triggeredAt.toDate().getTime() : 0) ||
              (a.createdAt?.toMillis?.() || (a.createdAt ? new Date(a.createdAt).getTime() : 0));
            const timeB =
              b.triggeredAt?.toMillis?.() ||
              (b.triggeredAt?.toDate ? b.triggeredAt.toDate().getTime() : 0) ||
              (b.createdAt?.toMillis?.() || (b.createdAt ? new Date(b.createdAt).getTime() : 0));
            return timeB - timeA;
          });

          const topDoc = docs[0];
          const trig = topDoc.triggeredAt?.toDate?.() || (topDoc.triggeredAt ? new Date(topDoc.triggeredAt) : null);
          triggerPushAlert(topDoc.id, topDoc.reason, topDoc.notes, trig);
        } else if (lastAlertIdRef.current && isMounted) {
          lastAlertIdRef.current = null;
          Animated.timing(slideAnim, {
            toValue: -140,
            duration: 250,
            useNativeDriver: true,
          }).start(() => setActiveAlert(null));
        }
      },
      (err) => {
        // Fallback to LAN polling
      }
    );

    return () => {
      isMounted = false;
      clearInterval(pollTimer);
      unsubscribe();
    };
  }, []);

  const handleDismiss = () => {
    Animated.timing(slideAnim, {
      toValue: -140,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setActiveAlert(null);
      lastAlertIdRef.current = null;
    });
  };

  const handlePressAction = () => {
    handleDismiss();
    try {
      navigation.navigate("Check-ins");
    } catch (_) {}
  };

  const handleResolveDirect = async () => {
    if (!activeAlert) return;
    const alertId = activeAlert.id;

    // 1. Immediately slide banner out so user gets instant visual confirmation
    handleDismiss();

    // 2. Resolve on server & cloud in background
    try {
      await resolveEmergencyEscalationDirect(ELDER_ID, alertId);
    } catch (e: any) {
      console.warn("Direct resolve error:", e);
    }
  };

  if (!activeAlert) return null;

  const isSos =
    activeAlert.reason === "elder_sos" || activeAlert.reason === "emergency_sos";
  const isMissedMed = activeAlert.reason === "missed_medication";

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View
        style={[
          styles.banner,
          isSos
            ? [styles.bannerSos, !isDark && { backgroundColor: "#FEF2F2", borderColor: "#EF4444" }]
            : [styles.bannerMed, !isDark && { backgroundColor: "#FFFBEB", borderColor: "#F59E0B" }],
        ]}
      >
        <View style={styles.topRow}>
          <View style={styles.badgeRow}>
            <Text style={styles.badgeDot}>🔴</Text>
            <Text
              style={[
                styles.badgeText,
                !isDark && { color: isSos ? "#DC2626" : "#D97706" },
              ]}
            >
              {isSos
                ? "അടിയന്തര പുഷ് അറിയിപ്പ് (SOS ALERT)"
                : isMissedMed
                ? "മരുന്ന് മുന്നറിയിപ്പ് (MISSED MED)"
                : "അടിയന്തര പുഷ് അറിയിപ്പ് (ALERT)"}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleDismiss}
            accessibilityLabel="Dismiss notification"
          >
            <Text style={[styles.closeBtnText, !isDark && { color: "#64748B" }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bodyRow}>
          <Text style={styles.icon}>{isSos ? "🚨" : isMissedMed ? "💊" : "⚠️"}</Text>
          <View style={styles.textContainer}>
            <Text
              style={[
                styles.title,
                !isDark && { color: isSos ? "#991B1B" : "#92400E" },
              ]}
            >
              {isSos
                ? "മുതിർന്നയാൾ SOS സഹായം ആവശ്യപ്പെട്ടു!"
                : isMissedMed
                ? "മരുന്ന് ചെക്ക്-ഇൻ വിട്ടുപോയി!"
                : "അടിയന്തര മുന്നറിയിപ്പ് ലഭിച്ചു!"}
            </Text>
            <Text
              style={[
                styles.subtitle,
                !isDark && { color: isSos ? "#7F1D1D" : "#78350F" },
              ]}
              numberOfLines={2}
            >
              {activeAlert.notes}
            </Text>
            <Text
              style={[
                styles.timeText,
                !isDark && { color: isSos ? "#B91C1C" : "#B45309" },
              ]}
            >
              സമയം: {activeAlert.timeStr}
            </Text>
          </View>
        </View>

        <View style={styles.btnRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handlePressAction}
            activeOpacity={0.8}
            accessibilityLabel="Open check-in alert"
          >
            <Text style={styles.actionBtnText}>🔎 പരിശോധിക്കുക (View) →</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.resolveDirectBtn}
            onPress={handleResolveDirect}
            activeOpacity={0.8}
            accessibilityLabel="Resolve alert immediately"
          >
            <Text style={styles.resolveDirectBtnText}>✓ പരിഹരിച്ചു (Resolve)</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: Platform.OS === "ios" ? 44 : 12,
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 25,
  },
  banner: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
  bannerSos: {
    backgroundColor: "#2B0B0B",
    borderColor: "#EF4444",
  },
  bannerMed: {
    backgroundColor: "#2A1B0B",
    borderColor: "#F59E0B",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  badgeDot: {
    fontSize: 10,
    marginRight: 6,
  },
  badgeText: {
    color: "#FCA5A5",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  closeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  closeBtnText: {
    color: "#9CA3AF",
    fontSize: 16,
    fontWeight: "700",
  },
  bodyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  icon: {
    fontSize: 26,
    marginRight: 10,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 2,
  },
  subtitle: {
    color: "#D1D5DB",
    fontSize: 12,
    lineHeight: 17,
  },
  timeText: {
    color: "#9CA3AF",
    fontSize: 11,
    marginTop: 4,
    fontWeight: "600",
  },
  btnRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: "#DC2626",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  resolveDirectBtn: {
    flex: 1,
    backgroundColor: "#166534",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#22C55E",
  },
  resolveDirectBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
});
