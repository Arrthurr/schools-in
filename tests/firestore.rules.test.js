const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'schools-in-test';
const RULES_PATH = path.join(__dirname, '../firestore.rules');

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe('Firestore Security Rules', () => {
  describe('Users Collection', () => {
    test('should allow users to read their own profile', async () => {
      const alice = testEnv.authenticatedContext('alice', {
        uid: 'alice',
        email: 'alice@test.com',
      });
      
      await assertSucceeds(alice.firestore().doc('users/alice').get());
    });

    test('should deny users from reading other users profiles', async () => {
      const alice = testEnv.authenticatedContext('alice', {
        uid: 'alice',
        email: 'alice@test.com',
      });
      
      await assertFails(alice.firestore().doc('users/bob').get());
    });

    test('should allow users to create their own profile', async () => {
      const alice = testEnv.authenticatedContext('alice', {
        uid: 'alice',
        email: 'alice@test.com',
      });
      
      await assertSucceeds(
        alice.firestore().doc('users/alice').set({
          name: 'Alice Smith',
          email: 'alice@test.com',
          role: 'provider',
          createdAt: new Date(),
        })
      );
    });

    test('should deny users from creating profiles for others', async () => {
      const alice = testEnv.authenticatedContext('alice', {
        uid: 'alice',
        email: 'alice@test.com',
      });
      
      await assertFails(
        alice.firestore().doc('users/bob').set({
          name: 'Bob Johnson',
          email: 'bob@test.com',
          role: 'provider',
          createdAt: new Date(),
        })
      );
    });

    test('should allow admins to read all user profiles', async () => {
      const admin = testEnv.authenticatedContext('admin', {
        uid: 'admin',
        email: 'admin@test.com',
        role: 'admin',
      });
      
      // First create a user document
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc('users/alice').set({
          name: 'Alice Smith',
          email: 'alice@test.com',
          role: 'provider',
        });
      });
      
      await assertSucceeds(admin.firestore().doc('users/alice').get());
    });
  });

  describe('Sessions Collection', () => {
    test('should allow providers to create sessions', async () => {
      const provider = testEnv.authenticatedContext('provider', {
        uid: 'provider123',
        email: 'provider@test.com',
        role: 'provider',
      });
      
      await assertSucceeds(
        provider.firestore().collection('sessions').add({
          providerId: 'provider123',
          schoolId: 'school123',
          status: 'active',
          checkInTime: new Date(),
          location: { lat: 40.7128, lng: -74.0060 },
        })
      );
    });

    test('should deny providers from creating sessions for others', async () => {
      const provider = testEnv.authenticatedContext('provider', {
        uid: 'provider123',
        email: 'provider@test.com',
        role: 'provider',
      });
      
      await assertFails(
        provider.firestore().collection('sessions').add({
          providerId: 'other-provider',
          schoolId: 'school123',
          status: 'active',
          checkInTime: new Date(),
          location: { lat: 40.7128, lng: -74.0060 },
        })
      );
    });

    test('should allow providers to read their own sessions', async () => {
      const provider = testEnv.authenticatedContext('provider', {
        uid: 'provider123',
        email: 'provider@test.com',
        role: 'provider',
      });
      
      // Create a session first
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc('sessions/session123').set({
          providerId: 'provider123',
          schoolId: 'school123',
          status: 'active',
          checkInTime: new Date(),
        });
      });
      
      await assertSucceeds(
        provider.firestore().collection('sessions')
          .where('providerId', '==', 'provider123')
          .get()
      );
    });

    test('should allow admins to read all sessions', async () => {
      const admin = testEnv.authenticatedContext('admin', {
        uid: 'admin',
        email: 'admin@test.com',
        role: 'admin',
      });
      
      await assertSucceeds(admin.firestore().collection('sessions').get());
    });
  });

  describe('Locations Collection', () => {
    test('should allow all authenticated users to read locations', async () => {
      const provider = testEnv.authenticatedContext('provider', {
        uid: 'provider123',
        email: 'provider@test.com',
        role: 'provider',
      });
      
      await assertSucceeds(provider.firestore().collection('locations').get());
    });

    test('should deny unauthenticated users from reading locations', async () => {
      const unauth = testEnv.unauthenticatedContext();
      
      await assertFails(unauth.firestore().collection('locations').get());
    });

    test('should only allow admins to create/update locations', async () => {
      const admin = testEnv.authenticatedContext('admin', {
        uid: 'admin',
        email: 'admin@test.com',
        role: 'admin',
      });
      
      await assertSucceeds(
        admin.firestore().collection('locations').add({
          name: 'Test School',
          address: '123 Main St',
          coordinates: { lat: 40.7128, lng: -74.0060 },
          radius: 500,
        })
      );
    });

    test('should deny non-admins from creating locations', async () => {
      const provider = testEnv.authenticatedContext('provider', {
        uid: 'provider123',
        email: 'provider@test.com',
        role: 'provider',
      });
      
      await assertFails(
        provider.firestore().collection('locations').add({
          name: 'Test School',
          address: '123 Main St',
          coordinates: { lat: 40.7128, lng: -74.0060 },
          radius: 500,
        })
      );
    });
  });

  describe('Unauthenticated Access', () => {
    test('should deny all access to unauthenticated users', async () => {
      const unauth = testEnv.unauthenticatedContext();
      
      await assertFails(unauth.firestore().doc('users/alice').get());
      await assertFails(unauth.firestore().collection('sessions').get());
      await assertFails(unauth.firestore().collection('locations').get());
    });
  });
});
