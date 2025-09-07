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
import { auth } from '../../../firebase.config';

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();

// Sign in with email and password
export const signInWithEmail = async (email: string, password: string): Promise<UserCredential> => {
  return await signInWithEmailAndPassword(auth, email, password);
};

// Create account with email and password
export const createAccount = async (email: string, password: string): Promise<UserCredential> => {
  return await createUserWithEmailAndPassword(auth, email, password);
};

// Sign in with Google
export const signInWithGoogle = async (): Promise<UserCredential> => {
  return await signInWithPopup(auth, googleProvider);
};

// Sign out
export const logOut = async (): Promise<void> => {
  return await signOut(auth);
};

// Get current user
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};
