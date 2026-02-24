/**
 * Cleanup duplicate sessions caused by offline-sync race condition.
 *
 * Finds sessions where the same userId + dayKey has multiple documents
 * with startTime within 60 seconds of each other. The offline-sync
 * duplicate is deleted and the original geo session is kept.
 *
 * Usage:
 *   DRY_RUN=true node scripts/cleanup-duplicate-sessions.mjs   # preview only
 *   node scripts/cleanup-duplicate-sessions.mjs                 # delete duplicates
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const DRY_RUN = process.env.DRY_RUN === "true";

initializeApp({
  credential: applicationDefault(),
  projectId: "schools-in-check",
});

const db = getFirestore();

async function findDuplicates() {
  // Fetch all sessions and group in memory to avoid needing extra composite indexes
  const sessionsSnap = await db.collection("sessions").get();

  console.log(`Total sessions: ${sessionsSnap.size}`);

  // Group by userId + dayKey
  const groups = new Map();
  sessionsSnap.forEach((doc) => {
    const d = doc.data();
    const key = `${d.userId}|${d.dayKey}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ id: doc.id, ...d });
  });

  const duplicates = [];

  for (const [key, sessions] of groups) {
    if (sessions.length < 2) continue;

    // Sort by startTime
    sessions.sort(
      (a, b) =>
        (a.startTime?.toMillis?.() || 0) - (b.startTime?.toMillis?.() || 0)
    );

    // Find pairs within 60 seconds of each other
    for (let i = 0; i < sessions.length - 1; i++) {
      const a = sessions[i];
      const b = sessions[i + 1];
      const diffMs = Math.abs(
        (a.startTime?.toMillis?.() || 0) - (b.startTime?.toMillis?.() || 0)
      );

      if (diffMs <= 60_000) {
        // Prefer keeping the geo session; delete the offline-sync one
        const toDelete =
          b.checkInMethod === "offline-sync"
            ? b
            : a.checkInMethod === "offline-sync"
              ? a
              : b; // fallback: delete the later one
        const toKeep = toDelete === b ? a : b;

        duplicates.push({ key, toDelete, toKeep, diffMs });
      }
    }
  }

  return duplicates;
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no changes)" : "LIVE DELETE"}\n`);

  const duplicates = await findDuplicates();

  if (duplicates.length === 0) {
    console.log("No duplicate sessions found.");
    return;
  }

  console.log(`Found ${duplicates.length} duplicate(s):\n`);

  for (const { key, toDelete, toKeep, diffMs } of duplicates) {
    const [userId, dayKey] = key.split("|");
    console.log(`User: ${userId}  Day: ${dayKey}  Δ ${diffMs}ms`);
    console.log(
      `  KEEP   ${toKeep.id}  method=${toKeep.checkInMethod}  start=${toKeep.startTime?.toDate?.()}`
    );
    console.log(
      `  DELETE ${toDelete.id}  method=${toDelete.checkInMethod}  start=${toDelete.startTime?.toDate?.()}`
    );

    if (!DRY_RUN) {
      await db.collection("sessions").doc(toDelete.id).delete();
      console.log(`  ✓ Deleted ${toDelete.id}`);
    }
    console.log();
  }

  console.log(
    DRY_RUN
      ? "Re-run without DRY_RUN=true to apply changes."
      : `Done. Deleted ${duplicates.length} duplicate session(s).`
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
