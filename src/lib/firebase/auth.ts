// Firebase Authentication service and utilities

import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  User,
  UserCredential
} from 'firebase/auth';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../../../firebase.config';
import { COLLECTIONS } from './firestore';

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();

// Sign in with email and password
export const signInWithEmail = async (email: string, password: string): Promise<UserCredential> => {
  return await signInWithEmailAndPassword(auth, email, password);
};

// Create account with email and password
export const createAccount = async (email: string, password: string): Promise<UserCredential> => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  
  // Create corresponding Firestore user document
  await createUserDocument(userCredential.user);
  
  return userCredential;
};

// Sign in with Google
export const signInWithGoogle = async (): Promise<UserCredential> => {
  const userCredential = await signInWithPopup(auth, googleProvider);
  
  // Create Firestore user document if it doesn't exist
  await createUserDocument(userCredential.user);
  
  return userCredential;
};

// Sign out
export const logOut = async (): Promise<void> => {
  return await signOut(auth);
};

// Get current user
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

/**
 * Create or update Firestore user document
 * Called automatically on registration and Google sign-in
 */
async function createUserDocument(user: User): Promise<void> {
  const userRef = doc(db, COLLECTIONS.USERS, user.uid);
  
  // Check if user document already exists
  const userDoc = await getDoc(userRef);
  
  if (userDoc.exists()) {
    // Update lastActiveAt for existing users
    await setDoc(userRef, {
      lastActiveAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    }, { merge: true });
    return;
  }
  
  // Create new user document with default provider role
  const userData = {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || user.email?.split('@')[0] || 'User',
    role: 'provider' as const, // Default role - admin must be set manually
    photoURL: user.photoURL || null,
    phoneNumber: user.phoneNumber || null,
    isActive: true,
    disabled: false,
    createdAt: Timestamp.now(),
    lastActiveAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };
  
  await setDoc(userRef, userData);
  
  console.log(`✅ Created Firestore user document for ${user.email}`);
}
