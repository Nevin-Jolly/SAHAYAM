import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeFirestore, getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

// Firebase web/mobile client configuration (public identifiers for project sahayam-33cd4)
const firebaseConfig = {
  apiKey: "AIzaSyAkeHb3hBAQ2AdfUWnw9b05tXdK_Pyul70",
  authDomain: "sahayam-33cd4.firebaseapp.com",
  projectId: "sahayam-33cd4",
  storageBucket: "sahayam-33cd4.firebasestorage.app",
  messagingSenderId: "687305559829",
  appId: "1:687305559829:android:fb4349224ed482e953231c",
};

// Initialize Firebase singleton
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// In React Native / Expo, the default WebChannel streaming transport cannot establish
// a connection and causes "client is offline" errors. Enabling experimentalForceLongPolling resolves this.
let db: ReturnType<typeof getFirestore>;
try {
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });
} catch {
  db = getFirestore(app);
}

const functions = getFunctions(app);

export { app, db, functions };

