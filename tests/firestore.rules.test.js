const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const fs = require("fs");
const path = require("path");

const PROJECT_ID = "schools-in-test";
const RULES_PATH = path.join(__dirname, "../firestore.rules");

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(RULES_PATH, "utf8"),
      host: "127.0.0.1",
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

function authed(uid, { email } = {}) {
  return testEnv.authenticatedContext(uid, {
    // Firebase Auth UID is carried in the JWT "sub" claim.
    // (The "uid" claim is no longer supported by mockUserToken.)
    sub: uid,
    email: email || `${uid}@test.com`,
  });
}

async function seedUser(userId, data) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(`users/${userId}`).set(data);
  });
}

async function seedLocation(locationId, data) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(`locations/${locationId}`).set(data);
  });
}

describe("Firestore Security Rules", () => {
  describe("Users Collection", () => {
    test("allows user to read their own profile", async () => {
      const alice = authed("alice", { email: "alice@test.com" });
      await assertSucceeds(alice.firestore().doc("users/alice").get());
    });

    test("denies user from reading other users profiles", async () => {
      const alice = authed("alice", { email: "alice@test.com" });
      await assertFails(alice.firestore().doc("users/bob").get());
    });

    test("allows user to create their own profile with required fields", async () => {
      const alice = authed("alice", { email: "alice@test.com" });
      const now = new Date();

      await assertSucceeds(
        alice.firestore().doc("users/alice").set({
          uid: "alice",
          email: "alice@test.com",
          displayName: "Alice Smith",
          role: "provider",
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
      );
    });

    test("denies user from creating profiles for others", async () => {
      const alice = authed("alice", { email: "alice@test.com" });
      const now = new Date();

      await assertFails(
        alice.firestore().doc("users/bob").set({
          uid: "bob",
          email: "bob@test.com",
          displayName: "Bob",
          role: "provider",
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
      );
    });

    test("allows admins to read all user profiles", async () => {
      const now = new Date();
      await seedUser("admin", {
        uid: "admin",
        email: "admin@test.com",
        displayName: "Admin",
        role: "admin",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      await seedUser("alice", {
        uid: "alice",
        email: "alice@test.com",
        displayName: "Alice",
        role: "provider",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      const admin = authed("admin", { email: "admin@test.com" });
      await assertSucceeds(admin.firestore().doc("users/alice").get());
    });
  });

  describe("Push Subscriptions Subcollection", () => {
    test("allows user to write their own push subscription", async () => {
      const now = new Date();
      await seedUser("alice", {
        uid: "alice",
        email: "alice@test.com",
        displayName: "Alice",
        role: "provider",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      const alice = authed("alice", { email: "alice@test.com" });
      await assertSucceeds(
        alice.firestore().doc("users/alice/pushSubscriptions/geofence").set({
          endpoint: "https://push.example.com/endpoint",
          expirationTime: null,
          keys: {
            p256dh: "p256dh",
            auth: "auth",
          },
          platform: "test",
          userAgent: "jest",
          createdAt: now,
          updatedAt: now,
        })
      );
    });

    test("denies user from writing another user's push subscription", async () => {
      const now = new Date();
      await seedUser("alice", {
        uid: "alice",
        email: "alice@test.com",
        displayName: "Alice",
        role: "provider",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      await seedUser("bob", {
        uid: "bob",
        email: "bob@test.com",
        displayName: "Bob",
        role: "provider",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      const alice = authed("alice", { email: "alice@test.com" });
      await assertFails(
        alice.firestore().doc("users/bob/pushSubscriptions/geofence").set({
          endpoint: "https://push.example.com/endpoint",
          expirationTime: null,
          keys: {
            p256dh: "p256dh",
            auth: "auth",
          },
          createdAt: now,
          updatedAt: now,
        })
      );
    });

    test("allows admin to read another user's push subscription", async () => {
      const now = new Date();
      await seedUser("admin", {
        uid: "admin",
        email: "admin@test.com",
        displayName: "Admin",
        role: "admin",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      await seedUser("alice", {
        uid: "alice",
        email: "alice@test.com",
        displayName: "Alice",
        role: "provider",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context
          .firestore()
          .doc("users/alice/pushSubscriptions/geofence")
          .set({
            endpoint: "https://push.example.com/endpoint",
            expirationTime: null,
            keys: { p256dh: "p256dh", auth: "auth" },
            createdAt: now,
            updatedAt: now,
          });
      });

      const admin = authed("admin", { email: "admin@test.com" });
      await assertSucceeds(
        admin.firestore().doc("users/alice/pushSubscriptions/geofence").get()
      );
    });
  });

  describe("Locations Collection", () => {
    test("allows provider to read an assigned location", async () => {
      const now = new Date();
      await seedUser("provider123", {
        uid: "provider123",
        email: "provider@test.com",
        displayName: "Provider",
        role: "provider",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      await seedLocation("loc1", {
        name: "Test Location",
        address: "123 Main St",
        geo: { latitude: 41.0, longitude: -87.0 },
        radiusMeters: 100,
        assignedProviders: ["provider123"],
        active: true,
        createdAt: now,
        updatedAt: now,
      });

      const provider = authed("provider123", { email: "provider@test.com" });
      await assertSucceeds(provider.firestore().doc("locations/loc1").get());
    });

    test("denies provider from reading an unassigned location", async () => {
      const now = new Date();
      await seedUser("provider123", {
        uid: "provider123",
        email: "provider@test.com",
        displayName: "Provider",
        role: "provider",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      await seedLocation("loc2", {
        name: "Other Location",
        address: "456 Main St",
        geo: { latitude: 41.0, longitude: -87.0 },
        radiusMeters: 100,
        assignedProviders: [],
        active: true,
        createdAt: now,
        updatedAt: now,
      });

      const provider = authed("provider123", { email: "provider@test.com" });
      await assertFails(provider.firestore().doc("locations/loc2").get());
    });
  });

  describe("Sessions Collection", () => {
    test("allows provider to create a session only for assigned active location", async () => {
      const now = new Date();
      await seedUser("provider123", {
        uid: "provider123",
        email: "provider@test.com",
        displayName: "Provider",
        role: "provider",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      await seedLocation("loc1", {
        name: "Test Location",
        address: "123 Main St",
        geo: { latitude: 41.0, longitude: -87.0 },
        radiusMeters: 100,
        assignedProviders: ["provider123"],
        active: true,
        createdAt: now,
        updatedAt: now,
      });

      const provider = authed("provider123", { email: "provider@test.com" });
      await assertSucceeds(
        provider.firestore().collection("sessions").add({
          userId: "provider123",
          locationId: "loc1",
          startTime: now,
          status: "active",
          checkInMethod: "geo",
          distanceFromCenterAtCheckIn: 10,
          dayKey: "2026-01-01",
          createdAt: now,
          updatedAt: now,
        })
      );
    });

    test("allows admin to create a manual session for an active location", async () => {
      const now = new Date();
      await seedUser("admin", {
        uid: "admin",
        email: "admin@test.com",
        displayName: "Admin",
        role: "admin",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      await seedLocation("loc1", {
        name: "Test Location",
        address: "123 Main St",
        geo: { latitude: 41.0, longitude: -87.0 },
        radiusMeters: 100,
        assignedProviders: [],
        active: true,
        createdAt: now,
        updatedAt: now,
      });

      const admin = authed("admin", { email: "admin@test.com" });
      await assertSucceeds(
        admin.firestore().collection("sessions").add({
          userId: "admin",
          locationId: "loc1",
          startTime: now,
          status: "active",
          checkInMethod: "manual",
          distanceFromCenterAtCheckIn: 10,
          dayKey: "2026-01-01",
          createdAt: now,
          updatedAt: now,
        })
      );
    });

    test("denies provider from creating a manual session (manual is admin-only)", async () => {
      const now = new Date();
      await seedUser("provider123", {
        uid: "provider123",
        email: "provider@test.com",
        displayName: "Provider",
        role: "provider",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      await seedLocation("loc1", {
        name: "Test Location",
        address: "123 Main St",
        geo: { latitude: 41.0, longitude: -87.0 },
        radiusMeters: 100,
        assignedProviders: ["provider123"],
        active: true,
        createdAt: now,
        updatedAt: now,
      });

      const provider = authed("provider123", { email: "provider@test.com" });
      await assertFails(
        provider.firestore().collection("sessions").add({
          userId: "provider123",
          locationId: "loc1",
          startTime: now,
          status: "active",
          checkInMethod: "manual",
          distanceFromCenterAtCheckIn: 10,
          dayKey: "2026-01-01",
          createdAt: now,
          updatedAt: now,
        })
      );
    });

    test("denies provider from creating a session for unassigned location", async () => {
      const now = new Date();
      await seedUser("provider123", {
        uid: "provider123",
        email: "provider@test.com",
        displayName: "Provider",
        role: "provider",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      await seedLocation("loc2", {
        name: "Other Location",
        address: "456 Main St",
        geo: { latitude: 41.0, longitude: -87.0 },
        radiusMeters: 100,
        assignedProviders: [],
        active: true,
        createdAt: now,
        updatedAt: now,
      });

      const provider = authed("provider123", { email: "provider@test.com" });
      await assertFails(
        provider.firestore().collection("sessions").add({
          userId: "provider123",
          locationId: "loc2",
          startTime: now,
          status: "active",
          checkInMethod: "geo",
          distanceFromCenterAtCheckIn: 10,
          dayKey: "2026-01-01",
          createdAt: now,
          updatedAt: now,
        })
      );
    });

    test("denies provider from creating a session for inactive location", async () => {
      const now = new Date();
      await seedUser("provider123", {
        uid: "provider123",
        email: "provider@test.com",
        displayName: "Provider",
        role: "provider",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      await seedLocation("loc3", {
        name: "Inactive Location",
        address: "789 Main St",
        geo: { latitude: 41.0, longitude: -87.0 },
        radiusMeters: 100,
        assignedProviders: ["provider123"],
        active: false,
        createdAt: now,
        updatedAt: now,
      });

      const provider = authed("provider123", { email: "provider@test.com" });
      await assertFails(
        provider.firestore().collection("sessions").add({
          userId: "provider123",
          locationId: "loc3",
          startTime: now,
          status: "active",
          checkInMethod: "geo",
          distanceFromCenterAtCheckIn: 10,
          dayKey: "2026-01-01",
          createdAt: now,
          updatedAt: now,
        })
      );
    });

    test("allows provider to read their own sessions", async () => {
      const now = new Date();
      await seedUser("provider123", {
        uid: "provider123",
        email: "provider@test.com",
        displayName: "Provider",
        role: "provider",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc("sessions/session123").set({
          userId: "provider123",
          locationId: "loc1",
          startTime: now,
          status: "active",
          checkInMethod: "geo",
          distanceFromCenterAtCheckIn: 10,
          dayKey: "2026-01-01",
          createdAt: now,
          updatedAt: now,
        });
      });

      const provider = authed("provider123", { email: "provider@test.com" });
      await assertSucceeds(
        provider
          .firestore()
          .collection("sessions")
          .where("userId", "==", "provider123")
          .get()
      );
    });

    test("allows admin to read all sessions", async () => {
      const now = new Date();
      await seedUser("admin", {
        uid: "admin",
        email: "admin@test.com",
        displayName: "Admin",
        role: "admin",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      const admin = authed("admin", { email: "admin@test.com" });
      await assertSucceeds(admin.firestore().collection("sessions").get());
    });
  });

  describe("Unauthenticated Access", () => {
    test("denies all access to unauthenticated users", async () => {
      const unauth = testEnv.unauthenticatedContext();

      await assertFails(unauth.firestore().doc("users/alice").get());
      await assertFails(unauth.firestore().collection("sessions").get());
      await assertFails(unauth.firestore().collection("locations").get());
    });
  });
});
