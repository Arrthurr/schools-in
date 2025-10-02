#!/usr/bin/env node

/**
 * Assign Test Provider to Locations
 * 
 * Quick script to assign a provider to some schools for testing.
 * 
 * Usage:
 *   node scripts/assign-test-provider.js <provider-uid>
 * 
 * Example:
 *   node scripts/assign-test-provider.js abc123xyz456
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Default locations to assign for testing
const TEST_LOCATIONS = [
  'walter-payton-hs',
  'depaul-college-prep',
  'cambridge-school',
  'daystar-academy',
  'good-shepherd-catholic-school'
];

async function assignProvider(providerId, locationIds = TEST_LOCATIONS) {
  console.log(`🔄 Assigning provider ${providerId} to ${locationIds.length} locations...\n`);

  try {
    // Verify provider exists
    const userDoc = await db.collection('users').doc(providerId).get();
    if (!userDoc.exists) {
      console.error(`❌ Error: Provider ${providerId} not found in users collection`);
      console.log('\n💡 Get provider UID from:');
      console.log('   1. Firebase Console → Authentication');
      console.log('   2. Or create a test user first\n');
      process.exit(1);
    }

    const userData = userDoc.data();
    console.log(`✅ Found provider: ${userData.displayName || userData.email || providerId}`);
    console.log(`   Role: ${userData.role}`);
    console.log(`   Active: ${userData.isActive !== false}\n`);

    if (userData.role !== 'provider') {
      console.error(`❌ Error: User has role "${userData.role}", expected "provider"`);
      process.exit(1);
    }

    // Use batch for atomic updates
    const batch = db.batch();
    const timestamp = admin.firestore.Timestamp.now();
    let assignedCount = 0;

    for (const locationId of locationIds) {
      const locationRef = db.collection('locations').doc(locationId);
      const locationDoc = await locationRef.get();

      if (!locationDoc.exists) {
        console.log(`⏭️  Skipping ${locationId} (not found)`);
        continue;
      }

      const locationData = locationDoc.data();
      const currentProviders = locationData.assignedProviders || [];

      if (currentProviders.includes(providerId)) {
        console.log(`⏭️  Already assigned to "${locationData.name}"`);
        continue;
      }

      // Add provider to location
      batch.update(locationRef, {
        assignedProviders: admin.firestore.FieldValue.arrayUnion(providerId),
        updatedAt: timestamp
      });

      console.log(`✅ Assigning to "${locationData.name}"`);
      assignedCount++;
    }

    if (assignedCount > 0) {
      console.log(`\n📝 Committing ${assignedCount} assignments...`);
      await batch.commit();
      console.log(`✅ Successfully assigned provider to ${assignedCount} locations!\n`);
    } else {
      console.log('\n✨ No new assignments needed (already assigned to all locations)\n');
    }

    // Verify assignments
    console.log('🔍 Verifying assignments...');
    const assignedLocations = await db.collection('locations')
      .where('assignedProviders', 'array-contains', providerId)
      .get();

    console.log(`\n📊 Provider is now assigned to ${assignedLocations.size} location(s):`);
    assignedLocations.docs.forEach(doc => {
      const data = doc.data();
      console.log(`   - ${data.name} (${doc.id})`);
    });

    console.log('\n🎉 Assignment complete!');
    console.log('\n🧪 Test Steps:');
    console.log(`   1. Login as provider: ${userData.email}`);
    console.log('   2. Dashboard should show assigned schools');
    console.log('   3. Can check in if within GPS radius\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error assigning provider:', error);
    process.exit(1);
  }
}

// Get provider UID from command line
const providerId = process.argv[2];

if (!providerId) {
  console.log('❌ Error: Provider UID required\n');
  console.log('Usage:');
  console.log('  node scripts/assign-test-provider.js <provider-uid>\n');
  console.log('Example:');
  console.log('  node scripts/assign-test-provider.js abc123xyz456\n');
  console.log('Get provider UID from Firebase Console → Authentication\n');
  process.exit(1);
}

// Run assignment
assignProvider(providerId);
