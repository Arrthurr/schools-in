/* eslint-disable no-console */
import * as admin from 'firebase-admin';
import { GeoPoint, Timestamp } from 'firebase/firestore';
import { COLLECTIONS } from '../src/lib/firebase/firestore';

// Initialize Firebase Admin SDK
const serviceAccount = require('../serviceAccountKey.json'); // You'll need to create this file

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});

// Set FIRESTORE_EMULATOR_HOST environment variable
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

const db = admin.firestore();

const seedData = {
  users: [
    {
      _id: 'admin-user-id',
      uid: 'admin-user-id',
      email: 'admin@example.com',
      displayName: 'Admin User',
      role: 'admin',
    },
    {
      _id: 'provider-user-id',
      uid: 'provider-user-id',
      email: 'provider@example.com',
      displayName: 'Provider User',
      role: 'provider',
      assignedLocations: ['location-1-id', 'location-2-id'],
    },
  ],
  locations: [
    {
      _id: 'location-1-id',
      name: 'Main Street Elementary',
      address: '123 Main St, Anytown, USA',
      gpsCoordinates: new GeoPoint(40.7128, -74.0060),
      radius: 100,
    },
    {
      _id: 'location-2-id',
      name: 'Oakwood Middle School',
      address: '456 Oak Ave, Anytown, USA',
      gpsCoordinates: new GeoPoint(40.7138, -74.0070),
      radius: 150,
    },
  ],
  sessions: [
    {
      _id: 'session-1-id',
      userId: 'provider-user-id',
      locationId: 'location-1-id',
      checkInTime: Timestamp.now(),
      checkOutTime: null,
      status: 'active',
    },
  ],
};

const seedFirestore = async () => {
  console.log('Seeding Firestore data...');

  for (const collectionName in seedData) {
    const collectionData = seedData[collectionName as keyof typeof seedData];
    console.log(`Seeding collection: ${collectionName}`);
    for (const docData of collectionData) {
      const { _id, ...data } = docData;
      await db.collection(collectionName).doc(_id).set(data);
      console.log(`  - Added document with ID: ${_id}`);
    }
  }

  console.log('Firestore seeding complete.');
};

seedFirestore().catch(console.error);
