import * as admin from "firebase-admin";

// Firebase Admin script to update a school's check-in radius
// Usage: npx ts-node scripts/update-school-radius-direct.ts <schoolId> <newRadius>

const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const [schoolId, newRadius] = process.argv.slice(2);

if (!schoolId || !newRadius) {
  console.error(
    "Usage: npx ts-node scripts/update-school-radius-direct.ts <schoolId> <newRadius>"
  );
  console.error(
    "Example: npx ts-node scripts/update-school-radius-direct.ts school-123 1000"
  );
  process.exit(1);
}

const updateSchoolRadius = async () => {
  try {
    const schoolRef = db.collection("locations").doc(schoolId);
    const schoolDoc = await schoolRef.get();

    if (!schoolDoc.exists) {
      console.error(`❌ School with ID ${schoolId} not found`);
      process.exit(1);
    }

    const schoolData = schoolDoc.data();
    console.log(`📍 Found school: ${schoolData?.name}`);
    console.log(
      `🔄 Updating radius from ${
        schoolData?.radius || "default"
      } to ${newRadius}m`
    );

    await schoolRef.update({
      radius: parseInt(newRadius),
      updatedAt: admin.firestore.Timestamp.now(),
    });

    console.log(
      `✅ Successfully updated school ${schoolId} radius to ${newRadius}m`
    );

    // Verify the update
    const updatedDoc = await schoolRef.get();
    const updatedData = updatedDoc.data();
    console.log(`✓ Verified: School radius is now ${updatedData?.radius}m`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error updating school radius:", error);
    process.exit(1);
  }
};

updateSchoolRadius();
