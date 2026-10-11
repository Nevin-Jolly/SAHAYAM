import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
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
const db = getFirestore(app);
const functions = getFunctions(app);

export { app, db, functions };
