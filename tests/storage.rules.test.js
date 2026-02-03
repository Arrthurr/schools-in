const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const fs = require("fs");
const path = require("path");

const PROJECT_ID = "schools-in-check";
const FIRESTORE_RULES_PATH = path.join(__dirname, "../firestore.rules");
const RULES_PATH = path.join(__dirname, "../storage.rules");

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(FIRESTORE_RULES_PATH, "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
    storage: {
      rules: fs.readFileSync(RULES_PATH, "utf8"),
      host: "127.0.0.1",
      port: 9199,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await db.doc("users/admin").set({ role: "admin" });
    await db.doc("users/provider123").set({ role: "provider" });
    await db.doc("users/other-provider").set({ role: "provider" });

    await db.doc("sessions/session456").set({ userId: "provider123" });
    await db.doc("sessions/session789").set({ userId: "other-provider" });
  });
});

describe("Storage Security Rules", () => {
  describe("Profile Images", () => {
    test("should allow users to upload their own profile images", async () => {
      const alice = testEnv.authenticatedContext("alice", {
        sub: "alice",
        email: "alice@test.com",
      });

      const ref = alice.storage().ref("users/alice/profile/avatar.jpg");
      await assertSucceeds(
        ref.put(Buffer.from("fake image data"), { contentType: "image/jpeg" })
      );
    });

    test("should deny users from uploading to other users profile folders", async () => {
      const alice = testEnv.authenticatedContext("alice", {
        sub: "alice",
        email: "alice@test.com",
      });

      const ref = alice.storage().ref("users/bob/profile/avatar.jpg");
      await assertFails(
        ref.put(Buffer.from("fake image data"), { contentType: "image/jpeg" })
      );
    });

    test("should allow users to read their own profile images", async () => {
      const alice = testEnv.authenticatedContext("alice", {
        sub: "alice",
        email: "alice@test.com",
      });

      // First upload an image
      const uploadRef = alice.storage().ref("users/alice/profile/avatar.jpg");
      await assertSucceeds(
        uploadRef.put(Buffer.from("fake image data"), {
          contentType: "image/jpeg",
        })
      );

      // Then read it
      const readRef = alice.storage().ref("users/alice/profile/avatar.jpg");
      await assertSucceeds(readRef.getDownloadURL());
    });

    test("should only allow specific image formats", async () => {
      const alice = testEnv.authenticatedContext("alice", {
        sub: "alice",
        email: "alice@test.com",
      });

      // Should allow JPG
      const jpgRef = alice.storage().ref("users/alice/profile/avatar.jpg");
      await assertSucceeds(
        jpgRef.put(Buffer.from("fake image data"), {
          contentType: "image/jpeg",
        })
      );

      // Should allow PNG
      const pngRef = alice.storage().ref("users/alice/profile/avatar.png");
      await assertSucceeds(
        pngRef.put(Buffer.from("fake image data"), { contentType: "image/png" })
      );

      // Should deny non-image files
      const txtRef = alice.storage().ref("users/alice/profile/file.txt");
      await assertFails(
        txtRef.put(Buffer.from("text content"), { contentType: "text/plain" })
      );
    });
  });

  describe("Location Images", () => {
    test("should allow admins to upload location images", async () => {
      const admin = testEnv.authenticatedContext("admin", {
        sub: "admin",
        email: "admin@test.com",
        role: "admin",
      });

      const ref = admin.storage().ref("locations/school123/images/photo.jpg");
      await assertSucceeds(
        ref.put(Buffer.from("fake image data"), { contentType: "image/jpeg" })
      );
    });

    test("should deny non-admins from uploading location images", async () => {
      const provider = testEnv.authenticatedContext("provider123", {
        sub: "provider123",
        email: "provider@test.com",
        role: "provider",
      });

      const ref = provider
        .storage()
        .ref("locations/school123/images/photo.jpg");
      await assertFails(
        ref.put(Buffer.from("fake image data"), { contentType: "image/jpeg" })
      );
    });

    test("should allow all authenticated users to read location images", async () => {
      const admin = testEnv.authenticatedContext("admin", {
        sub: "admin",
        email: "admin@test.com",
        role: "admin",
      });

      const provider = testEnv.authenticatedContext("provider123", {
        sub: "provider123",
        email: "provider@test.com",
        role: "provider",
      });

      // Admin uploads image
      const uploadRef = admin
        .storage()
        .ref("locations/school123/images/photo.jpg");
      await assertSucceeds(
        uploadRef.put(Buffer.from("fake image data"), {
          contentType: "image/jpeg",
        })
      );

      // Provider can read it
      const readRef = provider
        .storage()
        .ref("locations/school123/images/photo.jpg");
      await assertSucceeds(readRef.getDownloadURL());
    });
  });

  describe("Session Attachments", () => {
    test("should allow providers to upload attachments to their own sessions", async () => {
      const provider = testEnv.authenticatedContext("provider123", {
        sub: "provider123",
        email: "provider@test.com",
        role: "provider",
      });

      const ref = provider
        .storage()
        .ref("sessions/session456/attachments/photo.jpg");
      await assertSucceeds(
        ref.put(Buffer.from("fake image data"), { contentType: "image/jpeg" })
      );
    });

    test("should deny providers from uploading to other providers sessions", async () => {
      const provider = testEnv.authenticatedContext("provider123", {
        sub: "provider123",
        email: "provider@test.com",
        role: "provider",
      });

      const ref = provider
        .storage()
        .ref("sessions/session789/attachments/photo.jpg");
      await assertFails(
        ref.put(Buffer.from("fake image data"), { contentType: "image/jpeg" })
      );
    });

    test("should enforce file size limits", async () => {
      const provider = testEnv.authenticatedContext("provider123", {
        sub: "provider123",
        email: "provider@test.com",
        role: "provider",
      });

      // Should allow images under 5MB
      const smallFile = Buffer.alloc(1024 * 1024); // 1MB
      const smallRef = provider
        .storage()
        .ref("sessions/session456/attachments/small.jpg");
      await assertSucceeds(
        smallRef.put(smallFile, { contentType: "image/jpeg" })
      );

      // Should deny images over 5MB
      const largeRef = provider
        .storage()
        .ref("sessions/session456/attachments/large.jpg");
      await assertFails(
        largeRef.put(Buffer.alloc(6 * 1024 * 1024), {
          contentType: "image/jpeg",
        })
      );
    });
  });

  describe("Unauthenticated Access", () => {
    test("should deny all access to unauthenticated users", async () => {
      const unauth = testEnv.unauthenticatedContext();

      await assertFails(
        unauth.storage().ref("users/alice/profile/avatar.jpg").getDownloadURL()
      );
      await assertFails(
        unauth
          .storage()
          .ref("locations/school123/images/photo.jpg")
          .getDownloadURL()
      );
      await assertFails(
        unauth
          .storage()
          .ref("sessions/session456/attachments/photo.jpg")
          .put(Buffer.from("data"), { contentType: "image/jpeg" })
      );
    });
  });

  describe("Public Assets", () => {
    test("should allow read access to public assets for everyone", async () => {
      const unauth = testEnv.unauthenticatedContext();
      const auth = testEnv.authenticatedContext("user123", {
        sub: "user123",
        email: "user@test.com",
      });

      // Upload public asset as admin first
      const admin = testEnv.authenticatedContext("admin", {
        sub: "admin",
        email: "admin@test.com",
        role: "admin",
      });

      const uploadRef = admin.storage().ref("public/logo.png");
      await assertSucceeds(
        uploadRef.put(Buffer.from("fake image data"), {
          contentType: "image/png",
        })
      );

      // Both authenticated and unauthenticated should be able to read
      const unauthRef = unauth.storage().ref("public/logo.png");
      await assertSucceeds(unauthRef.getDownloadURL());

      const authRef = auth.storage().ref("public/logo.png");
      await assertSucceeds(authRef.getDownloadURL());
    });
  });
});
