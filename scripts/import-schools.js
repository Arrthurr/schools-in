#!/usr/bin/env node

/**
 * Import Schools to Firestore
 * 
 * This script imports the hardcoded school data from schoolService.ts
 * into Firestore as proper Location documents.
 * 
 * Usage:
 *   node scripts/import-schools.js
 * 
 * Prerequisites:
 *   - serviceAccountKey.json must exist in the project root
 *   - Firebase Admin SDK must be installed
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// School data from schoolService.ts
const SCHOOLS_DATA = [
  { name: "Walter Payton HS", latitude: 41.90191443941818, longitude: -87.63472443763325 },
  { name: "Estrella Foothills HS", latitude: 33.32774730573383, longitude: -112.42321335568697 },
  { name: "Augustus Tolton", latitude: 41.758053594905924, longitude: -87.61082755311055 },
  { name: "Bethesda International Academy", latitude: 42.009123647694, longitude: -87.63274729304545 },
  { name: "Cambridge School", latitude: 41.81239483239481, longitude: -87.59650712631131 },
  { name: "Chicago SDA Academy", latitude: 41.7720688903756, longitude: -87.66943795996532 },
  { name: "Chicago West Side Christian School", latitude: 41.88298993613497, longitude: -87.72200785016952 },
  { name: "Children of Peace Catholic School", latitude: 41.86620678370595, longitude: -87.68791329791728 },
  { name: "Daystar Academy", latitude: 41.86988548410223, longitude: -87.57461735669517 },
  { name: "DePaul College Prep", latitude: 41.94556292997298, longitude: -87.66897039985464 },
  { name: "Good Shepherd Catholic School", latitude: 41.79038457319608, longitude: -87.61852882493487 },
  { name: "Heritage Leadership Academy", latitude: 41.69418980316117, longitude: -87.64041011233861 },
  { name: "Holy Angels Catholic School", latitude: 41.82452120447666, longitude: -87.62574790138426 },
  { name: "HOPE Excel Academy", latitude: 41.89489643826383, longitude: -87.74549042314361 },
  { name: "ICCI Academy", latitude: 41.946599346578196, longitude: -87.84449809034912 },
  { name: "ITA Village Leadership Academy", latitude: 41.81040593002731, longitude: -87.62672967311518 },
  { name: "LYDIA Home", latitude: 41.958698147522966, longitude: -87.71297429733272 },
  { name: "Makki Educational Academy", latitude: 41.989645326938415, longitude: -87.71231955385213 },
  { name: "Mercy School for Boys", latitude: 41.884398518323565, longitude: -87.64727650010171 },
  { name: "Mercy School for Girls", latitude: 41.884398518323565, longitude: -87.64727650010171 },
  { name: "Oakdale Christian Academy", latitude: 41.73076656266556, longitude: -87.64951378822167 },
  { name: "Ravenswood Baptist Christian", latitude: 41.96342476422094, longitude: -87.6792012118811 },
  { name: "St. Ailbe School", latitude: 41.733963943348805, longitude: -87.60463832507088 },
  { name: "St. Katharine - Drexel Catholic School", latitude: 41.73788198295598, longitude: -87.56671196475762 },
  { name: "St. John's Lutheran School", latitude: 41.96368428829383, longitude: -87.7800006332083 },
  { name: "St. Margaret of Scotland School", latitude: 41.71704149043431, longitude: -87.67381145357817 },
  { name: "St. Paul Lutheran School", latitude: 41.75478591099567, longitude: -87.58372602978359 },
  { name: "St. Philip Neri School", latitude: 41.79231990661875, longitude: -87.58304443755415 },
  { name: "St. Sabina Academy", latitude: 41.76041917658477, longitude: -87.69943544658119 },
  { name: "St. Viator Elementary School", latitude: 41.946667823924905, longitude: -87.73031274614014 },
  { name: "Visitation Catholic School", latitude: 41.79280915614653, longitude: -87.64731241877288 }
];

// Generate a URL-safe ID from school name
function generateSchoolId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Geocode address from coordinates (simplified - you may want to use Google Maps API)
function generateAddress(latitude, longitude) {
  // For now, just return Chicago, IL with coordinates
  // In production, you'd use reverse geocoding
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}, Chicago, IL`;
}

async function importSchools() {
  console.log('🚀 Starting school import to Firestore...\n');
  
  const batch = db.batch();
  const now = admin.firestore.Timestamp.now();
  let count = 0;

  for (const school of SCHOOLS_DATA) {
    const schoolId = generateSchoolId(school.name);
    const schoolRef = db.collection('locations').doc(schoolId);

    // Check if school already exists
    const existing = await schoolRef.get();
    if (existing.exists) {
      console.log(`⏭️  Skipping "${school.name}" (already exists)`);
      continue;
    }

    const locationData = {
      id: schoolId,
      name: school.name,
      address: generateAddress(school.latitude, school.longitude),
      geo: new admin.firestore.GeoPoint(school.latitude, school.longitude),
      radiusMeters: 100, // Default 100m radius
      timezone: 'America/Chicago',
      active: true,
      assignedProviders: [], // Empty initially - will be populated by admin
      createdAt: now,
      updatedAt: now
    };

    batch.set(schoolRef, locationData);
    count++;
    console.log(`✅ Queued: "${school.name}" (${schoolId})`);
  }

  if (count > 0) {
    console.log(`\n📝 Committing ${count} schools to Firestore...`);
    await batch.commit();
    console.log(`✅ Successfully imported ${count} schools!\n`);
  } else {
    console.log('\n✨ All schools already exist in Firestore.\n');
  }

  console.log('📊 Import Summary:');
  console.log(`   Total schools in source: ${SCHOOLS_DATA.length}`);
  console.log(`   Newly imported: ${count}`);
  console.log(`   Already existed: ${SCHOOLS_DATA.length - count}\n`);

  // Verify
  const snapshot = await db.collection('locations').count().get();
  console.log(`🔍 Total locations in Firestore: ${snapshot.data().count}\n`);

  console.log('🎉 Import complete!');
  process.exit(0);
}

// Run import
importSchools().catch((error) => {
  console.error('❌ Error importing schools:', error);
  process.exit(1);
});
