// Firebase SDK configuration and initialization
// Production-ready configuration with enhanced features

import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  enableMultiTabIndexedDbPersistence,
} from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getPerformance } from "firebase/performance";
import { getAnalytics, isSupported } from "firebase/analytics";

// Production Firebase configuration. Keys are stored in environment variables for security.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Firebase Storage
export const storage = getStorage(app);

// Initialize Firebase Performance Monitoring (production only)
export let performance = null;
if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
  try {
    performance = getPerformance(app);
  } catch (error) {
    console.warn("Failed to initialize Firebase Performance:", error);
  }
}

// Initialize Firebase Analytics (production only)
export let analytics = null;
if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
  isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch((error) => {
      console.warn("Failed to initialize Firebase Analytics:", error);
    });
}

// Development emulators
if (process.env.NODE_ENV === "development") {
  connectAuthEmulator(auth, "http://localhost:9099");
  connectFirestoreEmulator(db, "localhost", 8080);
  connectStorageEmulator(storage, "localhost", 9199);
}

// Enable offline persistence in production
if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
  try {
    enableMultiTabIndexedDbPersistence(db).catch((err) => {
      if (err.code === "failed-precondition") {
        console.warn("Firebase persistence failed: Multiple tabs open");
      } else if (err.code === "unimplemented") {
        console.warn("Firebase persistence not supported by browser");
      }
    });
  } catch (error) {
    console.warn("Failed to enable Firebase persistence:", error);
  }
}

export default app;
