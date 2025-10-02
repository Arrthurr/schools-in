#!/usr/bin/env node

/**
 * Create Missing Firestore User Documents
 * 
 * Creates user documents in Firestore for accounts that exist in Firebase Auth
 * but are missing from the users collection.
 */

const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function createUser(uid, email, role, displayName = null, assignToLocations = []) {
  console.log(`\n📝 Creating user document for ${email}...`);
  
  try {
    // Get user from Firebase Auth
    const authUser = await admin.auth().getUser(uid);
    console.log(`   ✅ Found in Firebase Auth: ${authUser.email}`);
    
    // Check if user already exists in Firestore
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists) {
      console.log(`   ⚠️  User already exists in Firestore`);
      const existingData = userDoc.data();
      console.log(`   Current role: ${existingData.role}`);
      
      // Update role if different
      if (existingData.role !== role) {
        await db.collection('users').doc(uid).update({
          role: role,
          updatedAt: admin.firestore.Timestamp.now()
        });
        console.log(`   ✅ Updated role from ${existingData.role} to ${role}`);
      }
    } else {
      // Create new user document
      const userData = {
        uid: uid,
        email: authUser.email,
        displayName: displayName || authUser.displayName || authUser.email?.split('@')[0] || 'User',
        role: role,
        photoURL: authUser.photoURL || null,
        phoneNumber: authUser.phoneNumber || null,
        isActive: true,
        disabled: false,
        createdAt: admin.firestore.Timestamp.now(),
        lastActiveAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      };
      
      await db.collection('users').doc(uid).set(userData);
      console.log(`   ✅ Created Firestore user document`);
      console.log(`   Role: ${role}`);
      console.log(`   Display Name: ${userData.displayName}`);
    }
    
    // Assign to locations if provider
    if (role === 'provider' && assignToLocations.length > 0) {
      console.log(`\n📍 Assigning to ${assignToLocations.length} locations...`);
      
      const batch = db.batch();
      for (const locationId of assignToLocations) {
        const locationRef = db.collection('locations').doc(locationId);
        const locationDoc = await locationRef.get();
        
        if (!locationDoc.exists) {
          console.log(`   ⏭️  Skipping ${locationId} (not found)`);
          continue;
        }
        
        const locationData = locationDoc.data();
        const currentProviders = locationData.assignedProviders || [];
        
        if (currentProviders.includes(uid)) {
          console.log(`   ⏭️  Already assigned to "${locationData.name}"`);
          continue;
        }
        
        batch.update(locationRef, {
          assignedProviders: admin.firestore.FieldValue.arrayUnion(uid),
          updatedAt: admin.firestore.Timestamp.now()
        });
        
        console.log(`   ✅ Assigning to "${locationData.name}"`);
      }
      
      await batch.commit();
      console.log(`   ✅ Location assignments complete`);
    }
    
    return true;
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Creating missing Firestore user documents...\n');
  console.log('═══════════════════════════════════════════════════\n');
  
  // Create the two users
  const users = [
    {
      uid: 'SIuoyE6STFPoyd4xF1gXtaUglMP2',
      email: 'jobs@dmdlinc.com',
      role: 'provider',
      displayName: 'Steve Jobs',
      locations: ['walter-payton-hs', 'estrella-foothills-hs']
    },
    {
      uid: 'uun1JUrZnZQN7fMoOVEMFegoPwr1',
      email: 'arthur.turnbull@gmail.com',
      role: 'admin',
      displayName: 'Arthur Turnbull',
      locations: []
    }
  ];
  
  for (const user of users) {
    await createUser(user.uid, user.email, user.role, user.displayName, user.locations);
  }
  
  console.log('\n═══════════════════════════════════════════════════');
  console.log('\n✅ User creation complete!\n');
  console.log('🧪 Test Instructions:');
  console.log('\n1. Provider Account:');
  console.log('   Email: jobs@dmdlinc.com');
  console.log('   Should see 2 assigned schools');
  console.log('   Can check in/out at assigned locations\n');
  console.log('2. Admin Account:');
  console.log('   Email: arthur.turnbull@gmail.com');
  console.log('   Full access to admin dashboard');
  console.log('   Can manage users and assignments\n');
  
  process.exit(0);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
