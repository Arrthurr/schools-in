import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize with application default credentials (from Firebase CLI login)
try {
  initializeApp({
    credential: applicationDefault(),
    projectId: 'schools-in-check'
  });
} catch (e) {
  console.error('Failed to initialize:', e.message);
  process.exit(1);
}

const db = getFirestore();

const sessionIds = [
  '5qFTZvWsfpOiPbRiPvg1',
  'AqeghM3MWkhtAPUE0lL3', 
  'HD9jQ6laGJGUvqS9uEmj',
  'THS8sdA3Cjd5lpxJH0XB',
  'VqaHyO3F9s5Pm9SWQIYA',
  'XBqFJbbuwisjXKMVWpsX',
  'YCfcurdyKYd2pqdqc5J4',
  '38WPoLmBwIY50OehEWoG'
];

async function fetchSessions() {
  console.log('Fetching sessions...\n');
  
  for (const id of sessionIds) {
    try {
      const doc = await db.collection('sessions').doc(id).get();
      if (doc.exists) {
        const data = doc.data();
        console.log(`=== Session: ${id} ===`);
        console.log(`status: ${data.status}`);
        console.log(`active: ${data.active}`);
        console.log(`checkInTime: ${data.checkInTime?.toDate?.() || data.checkInTime || 'MISSING'}`);
        console.log(`startTime: ${data.startTime?.toDate?.() || data.startTime || 'MISSING'}`);
        console.log(`endTime: ${data.endTime?.toDate?.() || data.endTime || 'null'}`);
        console.log(`checkOutTime: ${data.checkOutTime?.toDate?.() || data.checkOutTime || 'null'}`);
        console.log(`durationMinutes: ${data.durationMinutes || 'null'}`);
        console.log(`locationId: ${data.locationId}`);
        console.log(`checkInMethod: ${data.checkInMethod || 'null'}`);
        console.log(`errorCode: ${data.errorCode || 'null'}`);
        console.log('');
      } else {
        console.log(`=== Session: ${id} === NOT FOUND\n`);
      }
    } catch (e) {
      console.error(`Error fetching ${id}:`, e.message);
    }
  }
}

fetchSessions().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
