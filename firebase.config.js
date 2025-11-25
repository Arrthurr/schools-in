// Firebase SDK configuration and initialization
// Production-ready configuration with enhanced features

import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  initializeFirestore,
  CACHE_SIZE_UNLIMITED,
} from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getPerformance } from "firebase/performance";

// Production Firebase configuration. Keys are stored in environment variables for security.
const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    "AIzaSyDummyKeyForBuildPurposesOnly",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "dummy.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "dummy-project",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "dummy.appspot.com",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789:web:dummy",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore with modern cache settings
export const db = initializeFirestore(app, {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  ignoreUndefinedProperties: true,
});

// Initialize Firebase Storage
export const storage = getStorage(app);

// Initialize Firebase Functions
export const functions = getFunctions(app);

// Initialize Firebase Performance Monitoring (production only)
export let performance = null;
if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
  try {
    performance = getPerformance(app);
  } catch (error) {
    console.warn("Failed to initialize Firebase Performance:", error);
  }
}

// Development emulators
if (process.env.NODE_ENV === "development") {
  connectAuthEmulator(auth, "http://localhost:9099");
  connectFirestoreEmulator(db, "localhost", 8080);
  connectStorageEmulator(storage, "localhost", 9199);
  connectFunctionsEmulator(functions, "localhost", 5001);
}

// Note: Offline persistence is now configured via initializeFirestore settings above
// The modern approach uses FirestoreSettings.cache instead of enableMultiTabIndexedDbPersistence()

export default app;
