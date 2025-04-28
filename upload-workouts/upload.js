// upload.js
import fs from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, WriteBatch } from 'firebase-admin/firestore';

/* ---------- 1. bootstrap admin ---------- */
initializeApp({ credential: cert('./serviceAccount.json') });
const db = getFirestore();

/* ---------- 2. read local JSON ---------- */
const workouts = JSON.parse(fs.readFileSync('./workouts.json', 'utf8'));   // array of objects

if (!Array.isArray(workouts) || workouts.length === 0) {
  console.error('⚠️  workouts.json is empty or not an array'); process.exit(1);
}

/* ---------- 3. push in batches of 500 ---------- */
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_,i) => arr.slice(i*n, (i+1)*n));

(async () => {
  for (const group of chunk(workouts, 500)) {
    const batch = db.batch();

    group.forEach(w => {
      // set the doc id to workout name slug or auto-id; choose one:
      const docRef = db.collection('workouts').doc();          // auto-id
      // const docRef = db.collection('workouts').doc(w.name.toLowerCase().replace(/\s+/g,'-'));
      batch.set(docRef, w, { merge: true });
    });

    await batch.commit();
    console.log(`✅  uploaded ${group.length} workouts`);
  }
  console.log('🎉  All done!');
  process.exit(0);
})();
