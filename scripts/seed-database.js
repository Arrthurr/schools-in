const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountKey = require('../serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountKey),
  projectId: 'schools-in-check'
});

const db = admin.firestore();

// Sample users data
const users = [
  {
    id: 'admin-user-1',
    data: {
      uid: 'admin-user-1',
      role: 'admin',
      displayName: 'Sarah Johnson',
      email: 'admin@schools-in.com',
      photoURL: 'https://images.unsplash.com/photo-1494790108755-2616b5ff07d5?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
      disabled: false,
      isActive: true,
      createdAt: admin.firestore.Timestamp.fromDate(new Date('2023-11-26')),
      lastActiveAt: admin.firestore.Timestamp.now()
    }
  },
  {
    id: 'provider-user-1',
    data: {
      uid: 'provider-user-1',
      role: 'provider',
      displayName: 'Michael Rodriguez',
      email: 'michael.rodriguez@providers.com',
      photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
      disabled: false,
      isActive: true,
      createdAt: admin.firestore.Timestamp.fromDate(new Date('2023-11-27')),
      lastActiveAt: admin.firestore.Timestamp.now()
    }
  },
  {
    id: 'provider-user-2',
    data: {
      uid: 'provider-user-2',
      role: 'provider',
      displayName: 'Jennifer Chen',
      email: 'jennifer.chen@providers.com',
      photoURL: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
      disabled: false,
      isActive: true,
      createdAt: admin.firestore.Timestamp.fromDate(new Date('2023-11-28')),
      lastActiveAt: admin.firestore.Timestamp.now()
    }
  },
  {
    id: 'provider-user-3',
    data: {
      uid: 'provider-user-3',
      role: 'provider',
      displayName: 'David Thompson',
      email: 'david.thompson@providers.com',
      photoURL: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
      disabled: false,
      isActive: true,
      createdAt: admin.firestore.Timestamp.fromDate(new Date('2023-11-29')),
      lastActiveAt: admin.firestore.Timestamp.now()
    }
  },
  {
    id: 'provider-user-4',
    data: {
      uid: 'provider-user-4',
      role: 'provider',
      displayName: 'Lisa Anderson',
      email: 'lisa.anderson@providers.com',
      photoURL: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
      disabled: false,
      isActive: true,
      createdAt: admin.firestore.Timestamp.fromDate(new Date('2023-11-30')),
      lastActiveAt: admin.firestore.Timestamp.fromDate(new Date('2025-01-21'))
    }
  }
];

// Get existing location IDs to use for sessions and assignments
const existingLocationIds = [
  'hF69wM9EzJzqb4cdOZXc', // Augustus Tolton
  '5AwxLPbARsSudQmkYu9T', // Bethesda International Academy
  '2JRtNQVsUN7XHa3S1Pcf', // Cambridge School
  'EU0GMSFfPuSLRqn1Bq5D', // Chicago SDA Academy
  'K9Vc47HSBSloYDK3VGIx', // Chicago West Side Christian School
  'MLDXvaSAGRapcFErxEgo', // Children of Peace Catholic School
  '0Uc4DlR36e9gFqSPrVaQ', // Daystar Academy
  'vOf0J3naumrSP21pEvkq', // DePaul College Prep
];

// Helper function to get dayKey in America/Chicago timezone
function getDayKey(date) {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

// Helper function to get random past date within last N days
function getRandomPastDate(daysAgo) {
  const now = new Date();
  const pastDate = new Date(now.getTime() - (Math.random() * daysAgo * 24 * 60 * 60 * 1000));
  return pastDate;
}

// Sample sessions data - variety of statuses and timeframes
const sessions = [
  // Active session for provider-user-1
  {
    id: 'session-active-1',
    data: {
      id: 'session-active-1',
      userId: 'provider-user-1',
      locationId: existingLocationIds[0],
      startTime: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 2 * 60 * 60 * 1000)), // 2 hours ago
      endTime: null,
      status: 'active',
      checkInMethod: 'geo',
      distanceFromCenterAtCheckIn: 45,
      dayKey: getDayKey(new Date()),
      notes: 'Regular check-in',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    }
  },
  // Completed sessions from this week
  {
    id: 'session-completed-1',
    data: {
      id: 'session-completed-1',
      userId: 'provider-user-2',
      locationId: existingLocationIds[1],
      startTime: admin.firestore.Timestamp.fromDate(getRandomPastDate(3)),
      endTime: admin.firestore.Timestamp.fromDate(new Date(getRandomPastDate(3).getTime() + 4 * 60 * 60 * 1000)),
      status: 'completed',
      durationMinutes: 240,
      checkInMethod: 'geo',
      distanceFromCenterAtCheckIn: 32,
      dayKey: getDayKey(getRandomPastDate(3)),
      notes: 'Morning session',
      createdAt: admin.firestore.Timestamp.fromDate(getRandomPastDate(3)),
      updatedAt: admin.firestore.Timestamp.fromDate(getRandomPastDate(3))
    }
  },
  {
    id: 'session-completed-2',
    data: {
      id: 'session-completed-2',
      userId: 'provider-user-3',
      locationId: existingLocationIds[2],
      startTime: admin.firestore.Timestamp.fromDate(getRandomPastDate(2)),
      endTime: admin.firestore.Timestamp.fromDate(new Date(getRandomPastDate(2).getTime() + 6 * 60 * 60 * 1000)),
      status: 'completed',
      durationMinutes: 360,
      checkInMethod: 'geo',
      distanceFromCenterAtCheckIn: 28,
      dayKey: getDayKey(getRandomPastDate(2)),
      notes: 'Full day session',
      createdAt: admin.firestore.Timestamp.fromDate(getRandomPastDate(2)),
      updatedAt: admin.firestore.Timestamp.fromDate(getRandomPastDate(2))
    }
  },
  // Today's sessions for dashboard metrics
  {
    id: 'session-today-1',
    data: {
      id: 'session-today-1',
      userId: 'provider-user-4',
      locationId: existingLocationIds[3],
      startTime: admin.firestore.Timestamp.fromDate(new Date(new Date().setHours(8, 0, 0, 0))),
      endTime: admin.firestore.Timestamp.fromDate(new Date(new Date().setHours(16, 0, 0, 0))),
      status: 'completed',
      durationMinutes: 480,
      checkInMethod: 'geo',
      distanceFromCenterAtCheckIn: 50,
      dayKey: getDayKey(new Date()),
      notes: 'Today morning start',
      createdAt: admin.firestore.Timestamp.fromDate(new Date(new Date().setHours(8, 0, 0, 0))),
      updatedAt: admin.firestore.Timestamp.fromDate(new Date(new Date().setHours(16, 0, 0, 0)))
    }
  },
  // Yesterday's sessions for comparison
  {
    id: 'session-yesterday-1',
    data: {
      id: 'session-yesterday-1',
      userId: 'provider-user-2',
      locationId: existingLocationIds[4],
      startTime: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000)),
      endTime: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 20 * 60 * 60 * 1000)),
      status: 'completed',
      durationMinutes: 240,
      checkInMethod: 'geo',
      distanceFromCenterAtCheckIn: 38,
      dayKey: getDayKey(new Date(Date.now() - 24 * 60 * 60 * 1000)),
      notes: 'Yesterday session',
      createdAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000)),
      updatedAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 20 * 60 * 60 * 1000))
    }
  }
];

async function seedDatabase() {
  console.log('Starting database seeding...');

  try {
    // Create users collection
    console.log('Creating users...');
    for (const user of users) {
      await db.collection('users').doc(user.id).set(user.data);
      console.log(`Created user: ${user.data.displayName}`);
    }

    // Update existing locations with new schema fields
    console.log('Updating locations schema...');
    const locationsSnapshot = await db.collection('locations').get();
    
    const batch = db.batch();
    let updateCount = 0;
    
    locationsSnapshot.forEach((doc) => {
      const data = doc.data();
      const locationRef = db.collection('locations').doc(doc.id);
      
      // Update to match new schema
      const updates = {
        // Convert gpsCoordinates to geo (if not already GeoPoint)
        geo: data.gpsCoordinates || data.geo,
        // Add new required fields
        radiusMeters: data.radius || 100,
        timezone: 'America/Chicago',
        active: true,
        assignedProviders: [], // Start with empty, will assign later
        // Add timestamp fields
        createdAt: admin.firestore.Timestamp.fromDate(new Date('2023-11-01')),
        updatedAt: admin.firestore.Timestamp.now()
      };
      
      batch.update(locationRef, updates);
      updateCount++;
    });
    
    if (updateCount > 0) {
      await batch.commit();
      console.log(`Updated ${updateCount} locations with new schema`);
    }

    // Assign providers to locations
    console.log('Assigning providers to locations...');
    const providerAssignments = [
      { locationId: existingLocationIds[0], providerIds: ['provider-user-1', 'provider-user-2'] },
      { locationId: existingLocationIds[1], providerIds: ['provider-user-2', 'provider-user-3'] },
      { locationId: existingLocationIds[2], providerIds: ['provider-user-3', 'provider-user-4'] },
      { locationId: existingLocationIds[3], providerIds: ['provider-user-4', 'provider-user-1'] },
      { locationId: existingLocationIds[4], providerIds: ['provider-user-1', 'provider-user-3'] },
      { locationId: existingLocationIds[5], providerIds: ['provider-user-2', 'provider-user-4'] },
    ];

    const assignmentBatch = db.batch();
    for (const assignment of providerAssignments) {
      const locationRef = db.collection('locations').doc(assignment.locationId);
      assignmentBatch.update(locationRef, {
        assignedProviders: assignment.providerIds,
        updatedAt: admin.firestore.Timestamp.now()
      });
    }
    await assignmentBatch.commit();
    console.log('Provider assignments completed');

    // Create sessions
    console.log('Creating sessions...');
    for (const session of sessions) {
      await db.collection('sessions').doc(session.id).set(session.data);
      console.log(`Created session: ${session.id} (${session.data.status})`);
    }

    // Create additional completed sessions for better metrics
    console.log('Creating additional historical sessions...');
    const additionalSessions = [];
    const providerIds = ['provider-user-1', 'provider-user-2', 'provider-user-3', 'provider-user-4'];
    
    for (let i = 0; i < 15; i++) {
      const sessionDate = getRandomPastDate(30);
      const startTime = new Date(sessionDate.getTime());
      startTime.setHours(8 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 60));
      
      const endTime = new Date(startTime.getTime() + (3 + Math.random() * 5) * 60 * 60 * 1000);
      const duration = Math.floor((endTime - startTime) / (60 * 1000));
      
      additionalSessions.push({
        id: `session-hist-${i}`,
        data: {
          id: `session-hist-${i}`,
          userId: providerIds[Math.floor(Math.random() * providerIds.length)],
          locationId: existingLocationIds[Math.floor(Math.random() * existingLocationIds.length)],
          startTime: admin.firestore.Timestamp.fromDate(startTime),
          endTime: admin.firestore.Timestamp.fromDate(endTime),
          status: 'completed',
          durationMinutes: duration,
          checkInMethod: Math.random() > 0.8 ? 'offline-sync' : 'geo',
          distanceFromCenterAtCheckIn: Math.floor(Math.random() * 80) + 20,
          dayKey: getDayKey(sessionDate),
          notes: `Historical session ${i + 1}`,
          createdAt: admin.firestore.Timestamp.fromDate(startTime),
          updatedAt: admin.firestore.Timestamp.fromDate(endTime)
        }
      });
    }

    for (const session of additionalSessions) {
      await db.collection('sessions').doc(session.id).set(session.data);
    }
    console.log(`Created ${additionalSessions.length} additional historical sessions`);

    console.log('Database seeding completed successfully!');
    console.log(`
Summary:
- Users: ${users.length} created
- Locations: ${updateCount} updated with new schema
- Sessions: ${sessions.length + additionalSessions.length} created
- Provider assignments: ${providerAssignments.length} location assignments made
    `);

  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
}

// Run the seeding
seedDatabase()
  .then(() => {
    console.log('Seeding completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });
