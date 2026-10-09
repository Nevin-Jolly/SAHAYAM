# AGENTS.md — SAHAYAM

You are building **SAHAYAM**, a Malayalam-native voice companion app for elderly care (KTU B.Tech final-year capstone, CSD415).

**Full plan:** `SAHAYAM_Implementation_Plan.md` in this repo (v2, managed-cloud build). Read it fully before writing any code. This file holds only the standing rules.

## Ground rules
1. Do not assume anything not stated in the plan. If something is unspecified or unclear, **stop and ask the project owner (Nevin)**. "Proposed default" in the plan means it still needs confirmation.
2. Do not add scope, modules, libraries, or paid services without proposing it and getting approval.
3. Verify model names, free-tier limits, pricing, SDK versions, and Expo/Firebase setup in current official docs. Never rely on memory for these.
4. Work phase by phase (plan Section 7). After each phase, report what was built, how it was tested, what is left, and open questions, then wait for confirmation.
5. Never put API keys or secrets in the mobile app or the repo. AI calls happen only in Cloud Functions using stored secrets.
6. Privacy is enforced by Firestore Security Rules and server-side access, not UI hiding. No raw conversation logs are stored. Semantic memory is elder-private.
7. Flag risks (plan Section 9) instead of silently working around them.
8. Open items in plan Section 8 must be answered by the owner, never guessed.

## Stack (v2)
Expo React Native (Android 10+, EAS Build APK) · Firebase Auth · Cloud Firestore · Cloud Functions (callable + scheduled) · FCM · cloud multimodal LLM for Malayalam speech/chat (provider confirmed with owner) · Malayalam cloud TTS · embeddings stored in Firestore for semantic memory.

## First actions
Confirm you have read plan Sections 0, 3, 8, 9. Then send the owner your list of open questions before starting Phase 0.

---
*Using Claude Code instead? It loads `CLAUDE.md`, not `AGENTS.md`. Add a `CLAUDE.md` containing one line: `@AGENTS.md`*
