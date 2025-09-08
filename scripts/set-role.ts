
import * as admin from 'firebase-admin';

// TODO: Replace with your service account key
// You can generate this file in the Firebase console:
// Project settings > Service accounts > Generate new private key
const serviceAccount = require("../../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const [email, role] = process.argv.slice(2);

if (!email || !role) {
  console.error('Usage: ts-node scripts/set-role.ts <email> <role>');
  process.exit(1);
}

admin
  .auth()
  .getUserByEmail(email)
  .then((user) => {
    return admin.auth().setCustomUserClaims(user.uid, { role });
  })
  .then(() => {
    console.log(`Successfully set role '${role}' for user ${email}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error setting custom claims:', error);
    process.exit(1);
  });
