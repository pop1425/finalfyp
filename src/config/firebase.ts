// src/config/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';

// TODO: Replace with your actual Firebase project config keys from the Firebase Console
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID", // Change this to your project ID to activate Firebase!
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// We check if the user replaced the placeholder PROJECT_ID to determine if Firebase is configured
const isFirebaseConfigured = !!(
  firebaseConfig.projectId && 
  firebaseConfig.projectId !== "YOUR_PROJECT_ID" && 
  firebaseConfig.projectId.trim() !== ""
);

let db: Firestore | null = null;

if (isFirebaseConfigured) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    console.log("Firebase Firestore initialized successfully!");
  } catch (error) {
    console.error("Firebase failed to initialize:", error);
  }
} else {
  console.log("Firebase not configured. Running app in Local Demo Mode.");
}

export { db, isFirebaseConfigured };
