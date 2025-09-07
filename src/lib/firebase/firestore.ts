// Firestore database service and CRUD operations

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  DocumentData,
  QuerySnapshot,
  DocumentSnapshot
} from 'firebase/firestore';
import { db } from '../../../firebase.config';
import { User, Location, Session } from './types';

// Collection names
export const COLLECTIONS = {
  USERS: 'users',
  SESSIONS: 'sessions',
  LOCATIONS: 'locations'
} as const;

// Generic CRUD operations
export const createDocument = async <T extends object>(collectionName: string, data: T): Promise<string> => {
  const docRef = await addDoc(collection(db, collectionName), data);
  return docRef.id;
};

export const getDocument = async <T>(collectionName: string, docId: string): Promise<T | null> => {
  const docSnap = await getDoc(doc(db, collectionName, docId));
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as T;
  }
  return null;
};

export const updateDocument = async <T extends object>(collectionName: string, docId: string, data: Partial<T>): Promise<void> => {
  await updateDoc(doc(db, collectionName, docId), data);
};

export const deleteDocument = async (collectionName: string, docId: string): Promise<void> => {
  await deleteDoc(doc(db, collectionName, docId));
};

export const getCollection = async <T>(collectionName: string): Promise<T[]> => {
  const querySnapshot = await getDocs(collection(db, collectionName));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
};


// Specific queries
export const getUserByEmail = async (email: string): Promise<User | null> => {
  const q = query(collection(db, COLLECTIONS.USERS), where('email', '==', email));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) {
    return null;
  }
  const doc = querySnapshot.docs[0];
  return { id: doc.id, ...doc.data() } as User;
};

export const getLocationsByProvider = async (providerId: string): Promise<Location[]> => {
  const q = query(
    collection(db, COLLECTIONS.LOCATIONS), 
    where('assignedProviders', 'array-contains', providerId)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Location));
};

export const getSessionsByUser = async (userId: string, limitCount: number = 50): Promise<Session[]> => {
  const q = query(
    collection(db, COLLECTIONS.SESSIONS),
    where('userId', '==', userId),
    orderBy('checkInTime', 'desc'),
    limit(limitCount)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
};

export const getActiveSessions = async (): Promise<Session[]> => {
  const q = query(
    collection(db, COLLECTIONS.SESSIONS),
    where('status', '==', 'active')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
};
