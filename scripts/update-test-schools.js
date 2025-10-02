const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const TEST_SCHOOLS = [
  { id: 'walter-payton-hs', name: 'Walter Payton HS' },
  { id: 'estrella-foothills-hs', name: 'Estrella Foothills HS' }
];

const TEST_PROVIDER_UID = 'SIuoyE6STFPoyd4xF1gXtaUglMP2';
const RADIUS_METERS = 800;

async function updateTestSchools() {
  console.log('Updating test schools...\n');

  for (const school of TEST_SCHOOLS) {
    try {
      const docRef = db.collection('locations').doc(school.id);
      const doc = await docRef.get();

      if (!doc.exists) {
        console.log(`❌ School not found: ${school.name} (${school.id})`);
        continue;
      }

      await docRef.update({
        radiusMeters: RADIUS_METERS,
        assignedProviders: [TEST_PROVIDER_UID]
      });

      console.log(`✅ Updated ${school.name}:`);
      console.log(`   - radiusMeters: ${RADIUS_METERS}`);
      console.log(`   - assignedProviders: [${TEST_PROVIDER_UID}]`);
      console.log();
    } catch (error) {
      console.error(`❌ Error updating ${school.name}:`, error.message);
    }
  }

  console.log('Done!');
  process.exit(0);
}

updateTestSchools();
