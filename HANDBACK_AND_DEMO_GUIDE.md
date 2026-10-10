# SAHAYAM — Final Handback & Capstone Demo Guide
**KTU B.Tech Final Year Capstone (CSD415) — Group 9**  
**Architecture:** v2 Managed-Cloud (Expo React Native + Firebase Cloud Functions + Google Gemini AI + Cloud Firestore)

---

## 1. System Overview

**SAHAYAM** is an empathetic, voice-first companion app designed specifically for elderly individuals in Kerala. It combines cutting-edge cloud multimodal AI with geriatric safety, family monitoring, and cultural context in native Malayalam.

### Key Highlights
- **Role-Based Architecture:**
  - **Elder UI:** Single-screen, ultra-simplified interface with large voice button, live Malayalam audio responses, emergency SOS button, and fallback text input for noisy environments.
  - **Family Dashboard:** 4-tab dashboard (Overview, Medications, Check-ins & Escalations, Settings) with real-time Firestore sync.
- **Privacy by Design:** Elder conversation memories are stored in an elder-private Firestore subcollection. Family members only access structured health indicators, medication adherence, and alerts.
- **Serverless & Robust:** Runs on Firebase Cloud Functions and Firestore—no local tunnels or fragile desktop dependencies required.

---

## 2. Verification Against Definition of Done

| # | Requirement | Status | Evidence / Implementation |
|---|---|---|---|
| 1 | Mobile app boots into role selector (Elder / Family) | ✅ Complete | `mobile/screens/LoginScreen.tsx` provides instant, clean role switching |
| 2 | Functional Malayalam voice companion loop | ✅ Complete | `mobile/screens/elder/ElderHomeScreen.tsx` + `respondCompanionVoice` Cloud Function with Gemini & Malayalam TTS |
| 3 | Persistent semantic memory recall across sessions | ✅ Complete | `elders/{elderId}/memories` Firestore collection injected into Gemini prompt context |
| 4 | Medication schedules & check-in synchronization | ✅ Complete | `MedicationsTab.tsx`, `medicationReminderScheduler`, and `recordCheckInOutcome` |
| 5 | Missed check-in auto-escalation (30-min window) | ✅ Complete | `checkInEscalationMonitor` scheduled Cloud Function + family resolution in `CheckinsTab.tsx` |
| 6 | Firestore Security Rules enforce role privacy | ✅ Complete | `firestore.rules` blocks family role from elder semantic memory documents |
| 7 | Zero TypeScript compilation errors | ✅ Complete | `functions/` (`npm run build`) & `mobile/` (`npx tsc --noEmit`) pass with 0 errors |

---

## 3. Deployment & Operational Runbook

### Step 1: Firebase CLI & Backend Deployment
1. Log in to your Firebase account:
   ```powershell
   npx firebase-tools login
   ```
2. Store your Gemini API key in Firebase Secret Manager:
   ```powershell
   npx firebase-tools functions:secrets:set GEMINI_API_KEY
   ```
   *(Paste your Google AI Studio API key when prompted)*

3. Deploy Firestore rules and Cloud Functions:
   ```powershell
   npx firebase-tools deploy --only functions,firestore:rules
   ```

### Step 2: Running Locally for Development / Testing
To run the Expo app on an Android emulator or physical device with Expo Go:
```powershell
cd mobile
npx expo start
```
- Press `a` to open in Android Emulator, or scan the QR code using the Expo Go app.

### Step 3: Building Standalone Android APK (EAS Build)
The project is fully pre-configured for standalone APK creation:
```powershell
cd mobile
npx eas-cli build --platform android --profile preview
```
- EAS will build the `.apk` on the cloud and provide a direct download link for installation on any physical Android phone.

---

## 4. KTU Capstone Evaluation & Live Demo Script

Follow this step-by-step walkthrough during your viva / project demonstration:

### Scene 1: Role Selection & Elder Voice Interface (2 mins)
1. **Launch the App:** Show `LoginScreen`. Explain the two distinct user personas.
2. **Select "മുത്തശ്ശൻ / മുത്തശ്ശി (Elder)":**
   - Highlight the elder-friendly dark theme with high-contrast, large touch targets.
   - Point out the greeting generated with local Kerala awareness (e.g., *സുപ്രഭാതം* / *ശുഭസന്ധ്യ* based on IST time).
3. **Voice Conversation Demonstration:**
   - Tap the microphone button and speak in Malayalam:
     > *"നമസ്കാരം, സുഖമാണോ?"* (Hello, how are you?)
   - SAHAYAM answers back in spoken Malayalam via TTS:
     > *"നമസ്കാരം! സുഖമായിരിക്കുന്നു. ഇന്ന് എന്ത് സഹായമാണ് വേണ്ടത്?"*
4. **Fallback Text Input:**
   - Show the bottom text input for elders in noisy environments or with soft voices.

### Scene 2: Cross-Session Semantic Memory (2 mins)
1. **Teach SAHAYAM a Fact:**
   - Say: *"എനിക്ക് രവി എന്നൊരു മകനുണ്ട്. അവൻ എറണാകുളത്താണ് ജോലി ചെയ്യുന്നത്."*
   - SAHAYAM acknowledges and records this into elder-private memory.
2. **Restart / Clear Conversation Turn:**
   - Ask: *"എന്റെ മകൻ എവിടെയാണ് ജോലി ചെയ്യുന്നത്?"*
   - SAHAYAM recalls the memory from Firestore:
     > *"നിങ്ങൾ മുൻപ് പറഞ്ഞിരുന്നു, മകൻ രവി എറണാകുളത്താണ് ജോലി ചെയ്യുന്നത് എന്ന്."*
   - **Academic Point to Emphasize:** Highlight that raw voice/chat is never stored; only structured semantic facts are extracted to preserve privacy.

### Scene 3: Family Care Note & Social Bridging (1.5 mins)
1. **Switch to Family Mode:** Log out and choose "കുടുംബാംഗം (Family Member)".
2. **Navigate to Settings Tab:**
   - Locate the **"💛 മാത്സര്യ സന്ദേശം — Care Note"** card.
   - Type a short message: *"അച്ഛാ, ഇന്ന് വൈകുന്നേരം 7 മണിക്ക് ഞാൻ വിളിക്കാം. ഗുളിക കൃത്യമായി കഴിക്കണേ."*
   - Tap **"സന്ദേശം അയക്കുക (Send Care Note)"**.
3. **Switch Back to Elder Mode:**
   - The companion seamlessly mentions the message during the next conversational turn.

### Scene 4: Medication Reminders & Emergency Escalation (2.5 mins)
1. **Medication Management:**
   - Go to `Medications` tab in Family mode.
   - View active prescriptions (e.g., Metformin, Amlodipine) and scheduled times.
   - Show how the Cloud Function cron (`medicationReminderScheduler`) dispatches notifications at dosage times.
2. **Proactive Check-Ins & Safety Escalation:**
   - Open `Check-ins & Escalations` tab.
   - Explain the 30-minute safety threshold: If a scheduled check-in is pending for 30 minutes without elder response, the automated monitor escalates to `CRITICAL` and alerts the family.
   - Demonstrate the Elder **"അടിയന്തര സഹായം (Emergency SOS)"** button triggering an instant escalation alert.
   - Tap **"പ്രശ്നം പരിഹരിച്ചു (Resolve Alert)"** on the family dashboard to resolve the alert.

### Scene 5: Security & Privacy Defense (1 min)
- Show `firestore.rules`:
  - Demonstrate that family accounts are explicitly barred from querying `/memories/`.
  - Explain that only health metrics and escalation states are shared, respecting the elder's personal dignity and privacy.

---

## 5. Summary of Automated Verification Tests

All test scripts are located in `functions/` and can be executed via Node:

```powershell
cd functions
node test_voice_loop.js                    # Tests Gemini prompt & Malayalam TTS
node test_memory_recall.js                 # Tests cross-session semantic extraction
node test_scheduling_reminders.js          # Tests medication schedules & check-in flow
node test_integration_phases4_to_7.js      # Tests escalation ladder, rules, & local awareness
```

All test suites execute with **0 errors**.
