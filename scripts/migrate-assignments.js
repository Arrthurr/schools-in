#!/usr/bin/env node

/**
 * Migration Script: Sync User.assignedSchools to Location.assignedProviders
 * 
 * This script migrates legacy assignments from the users collection to the locations collection.
 * 
 * Background:
 * - Previously, assignments were stored in User.assignedSchools (deprecated)
 * - Now assignments are stored in Location.assignedProviders (single source of truth)
 * - This script ensures data consistency across collections
 * 
 * Usage:
 *   node scripts/migrate-assignments.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Load service account key
const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateAssignments() {
  console.log('🔄 Starting assignment migration...\n');

  try {
    // Get all users with assignedSchools field
    const usersSnapshot = await db.collection('users')
      .where('assignedSchools', '!=', null)
      .get();

    console.log(`📊 Found ${usersSnapshot.size} users with assignedSchools field\n`);

    let migratedCount = 0;
    let errorCount = 0;
    const migrationLog = [];

    // Process each user
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      const assignedSchools = userData.assignedSchools || [];

      if (assignedSchools.length === 0) {
        console.log(`⏭️  Skipping ${userId} - no schools assigned`);
        continue;
      }

      console.log(`👤 Processing ${userData.displayName || userData.email} (${userId})`);
      console.log(`   Schools to migrate: ${assignedSchools.length}`);

      try {
        // Use batch for atomic updates
        const batch = db.batch();
        const timestamp = admin.firestore.Timestamp.now();

        // Update each location to add this provider to assignedProviders
        for (const locationId of assignedSchools) {
          const locationRef = db.collection('locations').doc(locationId);
          const locationDoc = await locationRef.get();

          if (!locationDoc.exists) {
            console.log(`   ⚠️  Location not found: ${locationId}`);
            continue;
          }

          const locationData = locationDoc.data();
          const currentProviders = locationData.assignedProviders || [];

          // Only update if provider not already in the array
          if (!currentProviders.includes(userId)) {
            batch.update(locationRef, {
              assignedProviders: admin.firestore.FieldValue.arrayUnion(userId),
              updatedAt: timestamp
            });
            console.log(`   ✅ Added to: ${locationData.name}`);
          } else {
            console.log(`   ℹ️  Already in: ${locationData.name}`);
          }
        }

        // Remove assignedSchools field from user document
        batch.update(db.collection('users').doc(userId), {
          assignedSchools: admin.firestore.FieldValue.delete(),
          updatedAt: timestamp
        });

        await batch.commit();
        migrationLog.push(`✅ ${userData.displayName || userData.email}: Successfully migrated ${assignedSchools.length} assignments`);
        migratedCount++;
        console.log(`   ✅ User record updated - assignedSchools field removed\n`);

      } catch (error) {
        errorCount++;
        migrationLog.push(`❌ ${userData.displayName || userData.email}: ${error.message}`);
        console.log(`   ❌ Error: ${error.message}\n`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully processed: ${migratedCount}`);
    console.log(`❌ Errors encountered: ${errorCount}`);
    console.log(`📊 Total users with assignedSchools: ${usersSnapshot.size}\n`);

    console.log('Migration Details:');
    migrationLog.forEach(log => console.log(`  ${log}`));

    if (errorCount === 0) {
      console.log('\n✨ Migration completed successfully!\n');
    } else {
      console.log(`\n⚠️  Migration completed with ${errorCount} error(s). Please review.\n`);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateAssignments().then(() => {
  process.exit(0);
});
