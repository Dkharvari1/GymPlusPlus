// uploadFoods.js
// ---------------------------------------------------------------------------
// Bulk-upload the contents of foods_seed.json into the `foods` collection
// in the GymPlusPlus Firestore.
// ---------------------------------------------------------------------------

import fs from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/* ---------- 1. bootstrap the Admin SDK ---------- */
initializeApp({ credential: cert('./serviceAccount.json') });
const db = getFirestore();

/* ---------- 2. read local JSON ---------- */
const foods = JSON.parse(fs.readFileSync('./foods_seed.json', 'utf8')); // array of objects

if (!Array.isArray(foods) || foods.length === 0) {
  console.error('⚠️  foods_seed.json is empty or not an array');
  process.exit(1);
}

/* ---------- 3. utility to chunk >500 docs ---------- */
const chunk = (arr, n) =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) =>
    arr.slice(i * n, (i + 1) * n)
  );

/* ---------- 4. push in batches ---------- */
(async () => {
  for (const group of chunk(foods, 500)) {
    const batch = db.batch();

    group.forEach(food => {
      // --- choose ONE of the following doc-ID strategies ---

      // 1) Auto-generated ID (simplest – matches your workouts uploader)
      const docRef = db.collection('foods').doc();

      // 2) Name-based slug ID (uncomment if you want stable IDs)
      // const docRef = db
      //   .collection('foods')
      //   .doc(food.name.toLowerCase().replace(/\s+/g, '-'));

      batch.set(docRef, food, { merge: true });
    });

    await batch.commit();
    console.log(`✅  Uploaded ${group.length} foods`);
  }

  console.log('🎉  All foods uploaded!');
  process.exit(0);
})();
