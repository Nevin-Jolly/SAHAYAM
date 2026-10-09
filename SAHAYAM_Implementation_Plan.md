# SAHAYAM — Complete Implementation Plan (v2 Managed-Cloud)
### Architectural Specification & Handoff Document for AI Agents
**Project:** SAHAYAM — Malayalam-Native Voice Companion for Elderly Care  
**Academic Context:** KTU B.Tech Final Year Capstone (CSD415), Group 9  
**Version:** v2.0 (Managed-Cloud Build: Expo + Firebase + Gemini Multimodal + Cloud Functions)  

---

## 0. READ THIS FIRST — Rules of Engagement for the Agent

You are building **SAHAYAM**, a Malayalam-native voice companion app for elderly care. This document, alongside `AGENTS.md`, forms the single source of truth for the v2 cloud-managed architecture. Follow these rules strictly:

1. **No Unapproved Scope or Assumptions:** If any requirement, credential, config value, or design choice is ambiguous, pause and consult the project owner (Nevin).
2. **Work Phase by Phase:** Implement strictly in order (Section 6, Phases 0 to 9). Complete and verify each phase before advancing.
3. **Never Store Secrets on Client:** AI API keys and service credentials must never exist in the mobile bundle or source control. All AI inference and TTS generation occur strictly within Firebase Cloud Functions using environment secrets.
4. **Privacy Enforced at Database Level:** Semantic memory and raw voice interactions are elder-private, enforced by Firestore Security Rules and server-side callable functions. The family dashboard accesses only structured care logs (medication status, check-in history, escalation alerts).
5. **Simplicity and Reliability First:** Follow the owner's directive: *"do everything that is best and simple for the system, implement in the least complex way"*. Minimize external moving parts by utilizing Firebase native capabilities (Firestore, Cloud Functions v2, Cloud Messaging, Auth) and Google Gemini multimodal AI.

---

## 1. Project Overview & Core Value Proposition

- **Domain:** Geriatric assistive technology / voice-first companion.
- **Two Distinct Roles, One Application:**
  - **Elder Role:** Single-screen, large-button voice-first interface designed for non-tech-savvy rural elderly. Features voice activity detection/touch recording, Malayalam conversational speech, and emergency alert capability, with text-input fallback if ambient noise hampers audio capture.
  - **Family Role:** Clean, 4-tab dashboard (Overview, Medications, Check-ins & Escalations, Settings) allowing adult children or caregivers to monitor well-being, schedule reminders, and receive urgent push alerts.
- **Key Academic Differentiators:**
  - Native Malayalam voice conversation (not literal English translation).
  - Cross-session persistent semantic memory stored securely in Firestore.
  - Proactive check-ins scheduled server-side, with an automatic escalation ladder if unanswered.
  - Managed-cloud serverless backend that eliminates fragile local tunnels and PC dependencies.

---

## 2. Fixed Technology Stack (v2 Managed Cloud)

| Layer | Technology | Rationale / Function |
|---|---|---|
| **Mobile Frontend** | **Expo React Native (TypeScript)** | Single cross-platform codebase, Android 10+ target, EAS Build APK. |
| **Authentication** | **Firebase Auth** | Role-based identity management (Elder vs Family). |
| **Database** | **Cloud Firestore** | Real-time synchronization of care data, schedules, escalations, and memories. |
| **Backend & Scheduling** | **Firebase Cloud Functions (Node.js/TS)** | Secure callable endpoints + Cloud Scheduler cron jobs for automated tasks. |
| **Cloud Multimodal AI** | **Google Gemini (2.0 Flash / 1.5 Flash)** | Native Malayalam speech/text comprehension, empathetic conversational companion. |
| **Malayalam Voice Synthesis** | **Google Cloud TTS / Gemini Audio** | High-fidelity Malayalam voice synthesis (`ml-IN` voices). |
| **Push Notifications** | **Firebase Cloud Messaging (FCM)** | Remote push delivery for medication alerts and escalation warnings. |
| **Packaging** | **Expo EAS Build** | Standalone Android APK for physical device evaluation. |

---

## 3. System Architecture & 10 Functional Modules

### 3.1 Module Breakdown
1. **Voice Interaction:** Audio recorded in Expo app → uploaded or base64 streamed to callable Cloud Function → processed by Gemini multimodal pipeline → synthesized into Malayalam audio stream → returned and played on device.
2. **Companion Chat:** Empathetic, culturally aware Malayalam persona ("സഹായം") keeping conversational turns concise and supportive.
3. **Proactive Check-Ins:** Cloud Scheduler triggers scheduled daily check-ins; app notifies elder or prompts automatically on opening.
4. **Medication Reminders:** Firestore-backed medication schedules; triggers push notifications and voice reminders at scheduled dosing times.
5. **Persistent Semantic Memory:** Facts, family names, and preferences extracted from elder conversations and stored with vector embeddings in Firestore. Injected into conversation prompts for seamless long-term recall.
6. **Safety & Emergency Escalation:** If a proactive check-in remains unanswered after 30 minutes (or elder presses emergency), system flags high-priority escalation and broadcasts push notification to registered family members.
7. **Social Bridging (Simple v2 Spec):** Daily voice greeting conveying caring messages or status notes from family members, bridging emotional distance.
8. **Local Awareness (Simple v2 Spec):** Injects current Kerala date, time, Malayalam day of week, and daily context (festivals, weather caution) into daily morning greeting.
9. **Family Dashboard:** Four intuitive tabs:
   - *Overview:* Quick status cards, last check-in timestamp, active escalation banner.
   - *Medications:* List active medicines, add/edit schedules, mark taken.
   - *Check-ins & Escalations:* History log of check-in outcomes and alert resolution.
   - *Settings:* Notification preferences, elder link codes, care circle configuration.
10. **Privacy Layer:** Strict Firestore Security Rules ensuring elder conversation memories cannot be queried directly by the family client; family only receives aggregated health/care data.

---

## 4. Firestore Data Models

### `users/{userId}`
```typescript
interface UserProfile {
  uid: string;
  role: 'elder' | 'family';
  name: string;
  elderId?: string; // For family users, links to the elder they monitor
  fcmToken?: string;
  createdAt: FirebaseFirestore.Timestamp;
}
```

### `elders/{elderId}/memories/{memoryId}` (Elder-Private)
```typescript
interface SemanticMemory {
  id: string;
  text: string;
  category: 'preference' | 'family_fact' | 'health_note' | 'routine';
  embedding?: number[];
  createdAt: FirebaseFirestore.Timestamp;
}
```

### `elders/{elderId}/medications/{medId}` (Shared with Family)
```typescript
interface Medication {
  id: string;
  name: string;
  dosage: string;
  scheduleTimes: string[]; // e.g. ["08:00", "20:00"]
  instructions: string;    // e.g. "ഭക്ഷണത്തിന് ശേഷം" (After food)
  active: boolean;
  createdAt: FirebaseFirestore.Timestamp;
}
```

### `elders/{elderId}/checkins/{checkinId}` (Shared with Family)
```typescript
interface CheckInRecord {
  id: string;
  scheduledTime: FirebaseFirestore.Timestamp;
  status: 'pending' | 'answered' | 'unanswered';
  answeredAt?: FirebaseFirestore.Timestamp;
  moodNote?: string;
  escalationTriggered: boolean;
}
```

### `elders/{elderId}/escalations/{escalationId}` (Shared with Family)
```typescript
interface EscalationAlert {
  id: string;
  triggeredAt: FirebaseFirestore.Timestamp;
  reason: 'unanswered_checkin' | 'elder_sos' | 'health_distress';
  resolved: boolean;
  resolvedAt?: FirebaseFirestore.Timestamp;
  resolvedBy?: string;
  notes?: string;
}
```

---

## 5. Phased Implementation Plan

### Phase 0: Environment & Scaffolding
- Initialize project repository structure (`mobile/` and `functions/`).
- Configure Firebase project config, `firebase.json`, and `firestore.rules`.
- Port and verify core mobile screens (Elder UI and Family Dashboard) into `mobile/`.
- Verify TypeScript compilation and mobile dependencies.

### Phase 1: Core Voice & Chat Pipeline (Modules 1 & 2)
- Build callable Cloud Function `respondCompanionVoice` connecting to Gemini with Malayalam prompting.
- Connect mobile `ElderHomeScreen` to record audio, invoke Cloud Function, and play Malayalam synthesized speech.
- Validate text fallback input path for noisy or low-confidence transcription.

### Phase 2: Persistent Semantic Memory (Module 5)
- Implement memory extraction prompt in Cloud Function turns.
- Store semantic memory chunks in Firestore subcollection.
- Inject retrieved memories into LLM context turns for demonstrable cross-session recall.

### Phase 3: Scheduling & Reminders (Modules 3 & 4)
- Implement Firestore CRUD for medications in `MedicationsTab`.
- Create scheduled Cloud Functions or Firestore triggers for medication reminder notifications.
- Send FCM push notifications to elder device at dosage times.

### Phase 4: Proactive Check-Ins & Safety Escalation (Module 6)
- Implement scheduled check-in trigger and pending check-in records.
- Implement auto-escalation job: if status is still `pending` after 30 minutes, create escalation and dispatch urgent FCM notification to family.
- Provide resolution button in family `CheckinsTab`.

### Phase 5: Family Dashboard Live Synchronization (Module 9)
- Wire real-time Firestore snapshot listeners to `OverviewTab`, `MedicationsTab`, `CheckinsTab`, and `SettingsTab`.
- Demonstrate live status updates when elder responds or check-in expires.

### Phase 6: Privacy Layer & Security Rules (Module 10)
- Write and validate `firestore.rules` enforcing role-based read/write access.
- Verify family accounts receive permission denied when attempting to access elder memory documents directly.

### Phase 7: Social Bridging & Local Awareness (Modules 7 & 8)
- Implement simple daily context injection (Malayalam day, date, morning greeting).
- Add quick care note entry in family settings that elder companion speaks during morning conversation.

### Phase 8: Packaging & Demo Readiness
- Configure `eas.json` for Android APK build.
- Produce release build or verify APK execution on test device.

### Phase 9: Testing & Handback
- Run full end-to-end integration checklist across both roles.
- Document system operations, demo script, and final report.

---

## 6. Definition of Done
1. Mobile app boots cleanly into role selector (Elder / Family).
2. Elder screen provides functional Malayalam voice companion loop (speak → Gemini AI → Malayalam speech playback).
3. Persistent memory demonstrably recalls previously stated user facts.
4. Medication schedules and check-ins sync dynamically via Firestore.
5. Missed check-in escalates cleanly to family dashboard after 30 minutes.
6. Firestore Security Rules enforce strict role privacy.
7. Project compiles with zero TypeScript errors.
