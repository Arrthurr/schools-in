/**
 * Seed script to initialize the services collection in Firestore.
 * 
 * Usage:
 *   npx ts-node scripts/seed-services.ts
 * 
 * Or with Firebase emulator:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 npx ts-node scripts/seed-services.ts
 */

import * as admin from "firebase-admin";
import { ServiceAccount } from "firebase-admin/app";

// Initialize Firebase Admin SDK
import serviceAccount from "../serviceAccountKey.json";

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as ServiceAccount),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "schools-in-check",
});

const db = admin.firestore();

interface ServiceData {
  name: string;
  code: string;
  description: string;
  isActive: boolean;
}

// Default services for Title I providers
const defaultServices: ServiceData[] = [
  {
    name: "Title I Reading",
    code: "T1-READ",
    description: "Title I reading intervention and literacy support services",
    isActive: true,
  },
  {
    name: "Title I Math",
    code: "T1-MATH",
    description: "Title I mathematics intervention and support services",
    isActive: true,
  },
  {
    name: "Title I General",
    code: "T1-GEN",
    description: "General Title I educational support services",
    isActive: true,
  },
  {
    name: "ESL/ELL Support",
    code: "ESL",
    description: "English as a Second Language / English Language Learner support",
    isActive: true,
  },
  {
    name: "Special Education",
    code: "SPED",
    description: "Special education support services",
    isActive: true,
  },
  {
    name: "Tutoring",
    code: "TUTOR",
    description: "One-on-one or small group tutoring services",
    isActive: true,
  },
];

const seedServices = async () => {
  console.log("🚀 Starting services collection seed...\n");

  const servicesCollection = db.collection("services");

  // Check if services already exist
  const existingServices = await servicesCollection.limit(1).get();
  if (!existingServices.empty) {
    console.log("⚠️  Services collection already has data. Skipping seed.");
    console.log("   To re-seed, manually delete existing services first.\n");
    
    // List existing services
    const allServices = await servicesCollection.orderBy("name").get();
    console.log("Existing services:");
    allServices.forEach((doc) => {
      const data = doc.data();
      console.log(`  - ${data.name} (${data.code}) - ${data.isActive ? "Active" : "Inactive"}`);
    });
    return;
  }

  const now = admin.firestore.Timestamp.now();
  const batch = db.batch();

  defaultServices.forEach((service, index) => {
    const docRef = servicesCollection.doc();
    batch.set(docRef, {
      ...service,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`  ${index + 1}. Queued: ${service.name} (${service.code})`);
  });

  try {
    await batch.commit();
    console.log(`\n✅ Successfully seeded ${defaultServices.length} services to Firestore.`);
    console.log("\nServices created:");
    defaultServices.forEach((s) => console.log(`  - ${s.name} (${s.code})`));
  } catch (error) {
    console.error("\n❌ Error seeding services:", error);
    process.exit(1);
  }
};

seedServices()
  .then(() => {
    console.log("\n🎉 Seed complete. You can now create schedules in the admin UI.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
