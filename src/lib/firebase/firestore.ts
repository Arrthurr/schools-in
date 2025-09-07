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

// Collection names
export const COLLECTIONS = {
  USERS: 'users',
  SCHOOLS: 'schools',
  SESSIONS: 'sessions',
  LOCATIONS: 'locations'
} as const;

// User interface
export interface User {
  id?: string;
  email: string;
  role: 'provider' | 'admin';
  name: string;
  assignedSchools?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// School interface
export interface School {
  id?: string;
  name: string;
  address: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  radius: number; // in meters
  assignedProviders: string[];
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Session interface
export interface Session {
  id?: string;
  userId: string;
  schoolId: string;
  checkInTime: Timestamp;
  checkOutTime?: Timestamp;
  checkInLocation: {
    latitude: number;
    longitude: number;
  };
  checkOutLocation?: {
    latitude: number;
    longitude: number;
  };
  status: 'active' | 'completed' | 'error';
  duration?: number; // in minutes
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Generic CRUD operations
export const createDocument = async (collectionName: string, data: any): Promise<string> => {
  const docRef = await addDoc(collection(db, collectionName), data);
  return docRef.id;
};

export const getDocument = async (collectionName: string, docId: string): Promise<DocumentSnapshot<DocumentData>> => {
  return await getDoc(doc(db, collectionName, docId));
};

export const updateDocument = async (collectionName: string, docId: string, data: any): Promise<void> => {
  await updateDoc(doc(db, collectionName, docId), data);
};

export const deleteDocument = async (collectionName: string, docId: string): Promise<void> => {
  await deleteDoc(doc(db, collectionName, docId));
};

export const getCollection = async (collectionName: string): Promise<QuerySnapshot<DocumentData>> => {
  return await getDocs(collection(db, collectionName));
};

// Specific queries
export const getUserByEmail = async (email: string): Promise<QuerySnapshot<DocumentData>> => {
  const q = query(collection(db, COLLECTIONS.USERS), where('email', '==', email));
  return await getDocs(q);
};

export const getSchoolsByProvider = async (providerId: string): Promise<QuerySnapshot<DocumentData>> => {
  const q = query(
    collection(db, COLLECTIONS.SCHOOLS), 
    where('assignedProviders', 'array-contains', providerId)
  );
  return await getDocs(q);
};

export const getSessionsByUser = async (userId: string, limitCount: number = 50): Promise<QuerySnapshot<DocumentData>> => {
  const q = query(
    collection(db, COLLECTIONS.SESSIONS),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  return await getDocs(q);
};

export const getActiveSessions = async (): Promise<QuerySnapshot<DocumentData>> => {
  const q = query(
    collection(db, COLLECTIONS.SESSIONS),
    where('status', '==', 'active')
  );
  return await getDocs(q);
};
