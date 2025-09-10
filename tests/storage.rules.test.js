const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'schools-in-test';
const RULES_PATH = path.join(__dirname, '../storage.rules');

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    storage: {
      rules: fs.readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearStorage();
});

describe('Storage Security Rules', () => {
  describe('Profile Images', () => {
    test('should allow users to upload their own profile images', async () => {
      const alice = testEnv.authenticatedContext('alice', {
        uid: 'alice',
        email: 'alice@test.com',
      });
      
      const ref = alice.storage().ref('profile-images/alice/avatar.jpg');
      await assertSucceeds(ref.put(Buffer.from('fake image data')));
    });

    test('should deny users from uploading to other users profile folders', async () => {
      const alice = testEnv.authenticatedContext('alice', {
        uid: 'alice',
        email: 'alice@test.com',
      });
      
      const ref = alice.storage().ref('profile-images/bob/avatar.jpg');
      await assertFails(ref.put(Buffer.from('fake image data')));
    });

    test('should allow users to read their own profile images', async () => {
      const alice = testEnv.authenticatedContext('alice', {
        uid: 'alice',
        email: 'alice@test.com',
      });
      
      // First upload an image
      const uploadRef = alice.storage().ref('profile-images/alice/avatar.jpg');
      await assertSucceeds(uploadRef.put(Buffer.from('fake image data')));
      
      // Then read it
      const readRef = alice.storage().ref('profile-images/alice/avatar.jpg');
      await assertSucceeds(readRef.getDownloadURL());
    });

    test('should only allow specific image formats', async () => {
      const alice = testEnv.authenticatedContext('alice', {
        uid: 'alice',
        email: 'alice@test.com',
      });
      
      // Should allow JPG
      const jpgRef = alice.storage().ref('profile-images/alice/avatar.jpg');
      await assertSucceeds(jpgRef.put(Buffer.from('fake image data')));
      
      // Should allow PNG
      const pngRef = alice.storage().ref('profile-images/alice/avatar.png');
      await assertSucceeds(pngRef.put(Buffer.from('fake image data')));
      
      // Should deny non-image files
      const txtRef = alice.storage().ref('profile-images/alice/file.txt');
      await assertFails(txtRef.put(Buffer.from('text content')));
    });
  });

  describe('School Documents', () => {
    test('should allow admins to upload school documents', async () => {
      const admin = testEnv.authenticatedContext('admin', {
        uid: 'admin',
        email: 'admin@test.com',
        role: 'admin',
      });
      
      const ref = admin.storage().ref('school-documents/school123/policy.pdf');
      await assertSucceeds(ref.put(Buffer.from('fake pdf data')));
    });

    test('should deny non-admins from uploading school documents', async () => {
      const provider = testEnv.authenticatedContext('provider', {
        uid: 'provider123',
        email: 'provider@test.com',
        role: 'provider',
      });
      
      const ref = provider.storage().ref('school-documents/school123/policy.pdf');
      await assertFails(ref.put(Buffer.from('fake pdf data')));
    });

    test('should allow all authenticated users to read school documents', async () => {
      const admin = testEnv.authenticatedContext('admin', {
        uid: 'admin',
        email: 'admin@test.com',
        role: 'admin',
      });
      
      const provider = testEnv.authenticatedContext('provider', {
        uid: 'provider123',
        email: 'provider@test.com',
        role: 'provider',
      });
      
      // Admin uploads document
      const uploadRef = admin.storage().ref('school-documents/school123/policy.pdf');
      await assertSucceeds(uploadRef.put(Buffer.from('fake pdf data')));
      
      // Provider can read it
      const readRef = provider.storage().ref('school-documents/school123/policy.pdf');
      await assertSucceeds(readRef.getDownloadURL());
    });
  });

  describe('Session Attachments', () => {
    test('should allow providers to upload attachments to their own sessions', async () => {
      const provider = testEnv.authenticatedContext('provider123', {
        uid: 'provider123',
        email: 'provider@test.com',
        role: 'provider',
      });
      
      const ref = provider.storage().ref('session-attachments/provider123/session456/photo.jpg');
      await assertSucceeds(ref.put(Buffer.from('fake image data')));
    });

    test('should deny providers from uploading to other providers sessions', async () => {
      const provider = testEnv.authenticatedContext('provider123', {
        uid: 'provider123',
        email: 'provider@test.com',
        role: 'provider',
      });
      
      const ref = provider.storage().ref('session-attachments/other-provider/session456/photo.jpg');
      await assertFails(ref.put(Buffer.from('fake image data')));
    });

    test('should enforce file size limits', async () => {
      const provider = testEnv.authenticatedContext('provider123', {
        uid: 'provider123',
        email: 'provider@test.com',
        role: 'provider',
      });
      
      // Should allow files under 10MB
      const smallFile = Buffer.alloc(1024 * 1024); // 1MB
      const smallRef = provider.storage().ref('session-attachments/provider123/session456/small.jpg');
      await assertSucceeds(smallRef.put(smallFile));
      
      // Should deny files over 10MB (simulated by metadata)
      const largeRef = provider.storage().ref('session-attachments/provider123/session456/large.jpg');
      await assertFails(largeRef.put(Buffer.alloc(11 * 1024 * 1024))); // 11MB
    });
  });

  describe('Unauthenticated Access', () => {
    test('should deny all access to unauthenticated users', async () => {
      const unauth = testEnv.unauthenticatedContext();
      
      await assertFails(unauth.storage().ref('profile-images/alice/avatar.jpg').getDownloadURL());
      await assertFails(unauth.storage().ref('school-documents/school123/policy.pdf').getDownloadURL());
      await assertFails(unauth.storage().ref('session-attachments/provider123/session456/photo.jpg').put(Buffer.from('data')));
    });
  });

  describe('Public Assets', () => {
    test('should allow read access to public assets for everyone', async () => {
      const unauth = testEnv.unauthenticatedContext();
      const auth = testEnv.authenticatedContext('user', {
        uid: 'user123',
        email: 'user@test.com',
      });
      
      // Upload public asset as admin first
      const admin = testEnv.authenticatedContext('admin', {
        uid: 'admin',
        email: 'admin@test.com',
        role: 'admin',
      });
      
      const uploadRef = admin.storage().ref('public/logo.png');
      await assertSucceeds(uploadRef.put(Buffer.from('fake image data')));
      
      // Both authenticated and unauthenticated should be able to read
      const unauthRef = unauth.storage().ref('public/logo.png');
      await assertSucceeds(unauthRef.getDownloadURL());
      
      const authRef = auth.storage().ref('public/logo.png');
      await assertSucceeds(authRef.getDownloadURL());
    });
  });
});
