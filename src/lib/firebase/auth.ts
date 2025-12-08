// Firebase Authentication service and utilities

import { 
  signInWithPopup,
  OAuthProvider,
  signOut,
  User,
  UserCredential
} from 'firebase/auth';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../../../firebase.config';
import { COLLECTIONS } from './firestore';

// Types for M365 sync result
export interface M365SyncResult {
  role: 'admin' | 'provider';
  assignedLocations: Array<{ id: string; name: string }>;
  removedLocations: Array<{ id: string; name: string }>;
  groupsFound: string[];
}

// Microsoft Auth Provider
const microsoftProvider = new OAuthProvider('microsoft.com');
microsoftProvider.setCustomParameters({
  tenant: '31b9c0cb-a928-4266-b427-2820623d7f82'
});

// Sign in with Microsoft
export const signInWithMicrosoft = async (): Promise<UserCredential> => {
  const userCredential = await signInWithPopup(auth, microsoftProvider);
  
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
 * Called automatically on Microsoft sign-in
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

/**
 * Sync user role and school assignments from Microsoft 365 groups
 * 
 * This function calls the syncUserFromM365 Cloud Function which:
 * 1. Fetches the user's M365 group memberships
 * 2. Determines if user is admin (member of DMDL Office) or provider
 * 3. Matches school groups to Firestore locations by exact name match
 * 4. Updates the user's role and location assignments in Firestore
 * 
 * @returns Promise<M365SyncResult> The sync result with role and assigned locations
 * @throws Error if sync fails
 */
export async function syncUserFromM365(): Promise<M365SyncResult> {
  const currentUser = auth.currentUser;
  
  if (!currentUser) {
    throw new Error('No authenticated user. Please sign in first.');
  }

  console.log(`🔄 Starting M365 sync for user: ${currentUser.email}`);

  try {
    const syncFunction = httpsCallable<void, M365SyncResult>(functions, 'syncUserFromM365');
    const result = await syncFunction();
    
    console.log(`✅ M365 sync completed:`, result.data);
    console.log(`   Role: ${result.data.role}`);
    console.log(`   Assigned locations: ${result.data.assignedLocations.map(l => l.name).join(', ') || 'None'}`);
    
    if (result.data.removedLocations.length > 0) {
      console.log(`   Removed from: ${result.data.removedLocations.map(l => l.name).join(', ')}`);
    }
    
    return result.data;
  } catch (error) {
    console.error('❌ M365 sync failed:', error);
    throw error;
  }
}
