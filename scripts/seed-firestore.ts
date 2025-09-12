/* eslint-disabl// Initialize Firebase Admin SDK
// eslint-disable-next-line @typescript-eslint/no-var-requires
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),onsole */
import * as admin from "firebase-admin";
import { GeoPoint } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";

// Local type for schools.json data
interface School {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

import { ServiceAccount } from "firebase-admin/app";

// Initialize Firebase Admin SDK
// eslint-disable-next-line @typescript-eslint/no-var-requires
import serviceAccount from "../serviceAccountKey.json"; // You'll need to create this file

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as ServiceAccount),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});

// To seed to the emulator, uncomment the following line
// process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

const db = admin.firestore();

const seedSchools = async () => {
  const schoolsPath = path.join(__dirname, "../schools.json");
  const schools: School[] = JSON.parse(fs.readFileSync(schoolsPath, "utf8"));

  if (!schools || schools.length === 0) {
    console.error("No schools found in schools.json");
    return;
  }

  console.log(`Found ${schools.length} schools. Seeding to Firestore...`);

  const batch = db.batch();
  const locationsCollection = db.collection("locations");

  schools.forEach((school, index) => {
    const { name, address, latitude, longitude } = school;
    const docRef = locationsCollection.doc(); // Auto-generate document ID

    batch.set(docRef, {
      name,
      address,
      gpsCoordinates: new GeoPoint(latitude, longitude),
      radius: 100, // Default radius in meters
    });
    console.log(`  - Queued school ${index + 1}/${schools.length}: ${name}`);
  });

  try {
    await batch.commit();
    console.log("✅ Firestore seeding complete.");
  } catch (error) {
    console.error("❌ Error committing batch:", error);
  }
};

seedSchools().catch((error) => {
  console.error("An unexpected error occurred:", error);
});
