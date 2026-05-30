/**
 * READ-ONLY Verification Script: Session Location Attribution Diagnostics
 *
 * This script reads session, user, and location data from Firestore and computes
 * attribution diagnostics. It does NOT update, delete, or modify any data.
 * It is intended for verifying the correctness of the locationId/schoolId
 * attribution model before any backfill or migration.
 *
 * Usage:
 *   ts-node scripts/verify-session-location-attribution.ts
 *   ts-node scripts/verify-session-location-attribution.ts --start 2026-05-01 --end 2026-05-31
 *   ts-node scripts/verify-session-location-attribution.ts --emulator
 *   ts-node scripts/verify-session-location-attribution.ts --start 2026-05-01 --end 2026-05-31 --emulator
 *
 * Output:
 *   - Human-readable summary printed to stdout
 *   - JSON diagnostics written to .omo/evidence/task-5-attribution-verification.json
 *   - Human-readable summary written to .omo/evidence/task-5-attribution-verification.txt
 *
 * Dependencies:
 *   - firebase-admin (devDependency)
 *   - serviceAccountKey.json in project root (required for production; optional for --emulator)
 */

import * as admin from "firebase-admin";
import { ServiceAccount } from "firebase-admin/app";
import { Timestamp } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SessionDoc {
  id: string;
  userId: string;
  schoolId?: string;
  locationId?: string;
  startTime?: admin.firestore.Timestamp;
  checkInTime?: admin.firestore.Timestamp;
  status?: string;
  [key: string]: unknown;
}

interface UserDoc {
  uid: string;
  email?: string;
  displayName?: string;
  role?: string;
  [key: string]: unknown;
}

interface LocationDoc {
  id: string;
  name?: string;
  [key: string]: unknown;
}

interface AttributionBreakdown {
  locationIdOnly: number;
  schoolIdOnly: number;
  both: number;
  neither: number;
}

interface RoleGroupInfo {
  userCount: number;
  sessionCount: number;
  userIds: string[];
}

interface PerUserSchoolCount {
  userId: string;
  userEmail: string;
  userDisplayName: string;
  uniqueSchools: number;
  schoolIds: string[];
}

interface AttributionDiagnostics {
  dateRange: { start: string; end: string };
  emulator: boolean;
  summary: {
    totalSessions: number;
    totalUsers: number;
    totalLocations: number;
  };
  attributionBreakdown: AttributionBreakdown;
  sessionsWithNeither: string[];
  missingLocationRefs: {
    count: number;
    sessionIds: string[];
    resolvedLocationIds: string[];
  };
  roleBreakdown: {
    provider: RoleGroupInfo;
    admin: RoleGroupInfo;
    unknown: RoleGroupInfo;
  };
  perUserSchoolCounts: PerUserSchoolCount[];
  oldLogicCollapseCount: number;
  oldLogicCollapseSessionIds: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Replicate getSessionLocationId — locationId is canonical, schoolId is fallback. */
function getSessionLocationId(session: SessionDoc): string | undefined {
  return session.locationId ?? session.schoolId;
}

/** Parse CLI arguments */
function parseArgs(): { start?: string; end?: string; emulator: boolean } {
  const args = process.argv.slice(2);
  let start: string | undefined;
  let end: string | undefined;
  let emulator = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--start" && i + 1 < args.length) {
      start = args[++i];
    } else if (args[i] === "--end" && i + 1 < args.length) {
      end = args[++i];
    } else if (args[i] === "--emulator") {
      emulator = true;
    }
  }

  return { start, end, emulator };
}

/** Get default date range (current month: first day of this month to now). */
function getDefaultDateRange(): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return {
    start: `${year}-${month}-01`,
    end: `${year}-${month}-${day}`,
  };
}

/** Convert YYYY-MM-DD string to a Date at start of day (midnight). */
function parseDate(str: string): Date {
  const [year, month, day] = str.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/** Convert YYYY-MM-DD string to a Date at end of day (23:59:59.999). */
function parseDateEndOfDay(str: string): Date {
  const [year, month, day] = str.split("-").map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { start: startStr, end: endStr, emulator } = parseArgs();

  // Determine date range (default: current month)
  const defaultRange = getDefaultDateRange();
  const startDateStr = startStr ?? defaultRange.start;
  const endDateStr = endStr ?? defaultRange.end;

  // Compute Firestore timestamps for querying startTime
  const startDate = parseDate(startDateStr);
  const endDate = parseDateEndOfDay(endDateStr);

  // Initialize Firebase Admin
  if (emulator) {
    // Emulator: no service account needed; set host before init.
    process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
    admin.initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "schools-in",
    });
    console.log("[CONFIG] Connecting to Firestore emulator at localhost:8080");
  } else {
    // Production: require service account key.
    const serviceAccountPath = path.join(__dirname, "..", "serviceAccountKey.json");
    if (!fs.existsSync(serviceAccountPath)) {
      console.error(
        "ERROR: serviceAccountKey.json not found at " + serviceAccountPath
      );
      console.error("Run with --emulator to connect to local emulator instead.");
      process.exit(1);
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const serviceAccount = require(serviceAccountPath) as ServiceAccount;
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
    console.log("[CONFIG] Connected to production Firestore");
  }

  const db = admin.firestore();
  console.log(`[CONFIG] Date range: ${startDateStr} to ${endDateStr}`);
  console.log("");

  // -----------------------------------------------------------------------
  // Fetch data
  // -----------------------------------------------------------------------

  console.log("[FETCH] Fetching users...");
  const usersSnapshot = await db.collection("users").get();
  const users: UserDoc[] = usersSnapshot.docs.map(
    (doc) => ({ uid: doc.id, ...doc.data() } as UserDoc)
  );
  console.log(`[FETCH]   ${users.length} users found`);

  console.log("[FETCH] Fetching locations...");
  const locationsSnapshot = await db.collection("locations").get();
  const locations: LocationDoc[] = locationsSnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as LocationDoc)
  );
  const locationIdSet = new Set(locations.map((l) => l.id));
  console.log(`[FETCH]   ${locations.length} locations found`);

  console.log("[FETCH] Fetching sessions...");
  const sessionsRef = db.collection("sessions");
  const sessionsQuery = sessionsRef
    .where("startTime", ">=", Timestamp.fromDate(startDate))
    .where("startTime", "<=", Timestamp.fromDate(endDate))
    .orderBy("startTime", "desc");

  const sessionsSnapshot = await sessionsQuery.get();
  const sessions: SessionDoc[] = sessionsSnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as SessionDoc)
  );
  console.log(`[FETCH]   ${sessions.length} sessions found in date range`);
  console.log("");

  // -----------------------------------------------------------------------
  // Compute diagnostics
  // -----------------------------------------------------------------------

  // 1. Attribution breakdown
  let locationIdOnly = 0;
  let schoolIdOnly = 0;
  let both = 0;
  let neither = 0;
  const sessionsWithNeither: string[] = [];

  for (const session of sessions) {
    const hasLocationId = session.locationId !== undefined && session.locationId !== null && session.locationId !== "";
    const hasSchoolId = session.schoolId !== undefined && session.schoolId !== null && session.schoolId !== "";

    if (hasLocationId && hasSchoolId) {
      both++;
    } else if (hasLocationId && !hasSchoolId) {
      locationIdOnly++;
    } else if (!hasLocationId && hasSchoolId) {
      schoolIdOnly++;
    } else {
      neither++;
      sessionsWithNeither.push(session.id);
    }
  }

  // 2. Missing location references
  const missingLocationRefSessionIds: string[] = [];
  const missingLocationRefResolvedIds: string[] = [];

  for (const session of sessions) {
    const resolvedId = getSessionLocationId(session);
    if (resolvedId !== undefined && resolvedId !== null && resolvedId !== "" && !locationIdSet.has(resolvedId)) {
      missingLocationRefSessionIds.push(session.id);
      missingLocationRefResolvedIds.push(resolvedId);
    }
  }

  // 3. Role breakdown
  const userMap = new Map<string, UserDoc>();
  for (const u of users) {
    userMap.set(u.uid, u);
  }

  const providerSessions: SessionDoc[] = [];
  const adminSessions: SessionDoc[] = [];
  const unknownSessions: SessionDoc[] = [];
  const providerUserIds = new Set<string>();
  const adminUserIds = new Set<string>();
  const unknownUserIds = new Set<string>();

  for (const session of sessions) {
    const user = userMap.get(session.userId);
    const role = user?.role ?? "unknown";
    if (role === "provider") {
      providerSessions.push(session);
      providerUserIds.add(session.userId);
    } else if (role === "admin") {
      adminSessions.push(session);
      adminUserIds.add(session.userId);
    } else {
      unknownSessions.push(session);
      unknownUserIds.add(session.userId);
    }
  }

  // 4. Per-user unique resolved school count
  const userSchoolMap = new Map<string, Set<string>>();
  for (const session of sessions) {
    const resolvedId = getSessionLocationId(session);
    if (resolvedId === undefined || resolvedId === null) continue;
    if (!userSchoolMap.has(session.userId)) {
      userSchoolMap.set(session.userId, new Set());
    }
    userSchoolMap.get(session.userId)!.add(resolvedId);
  }

  // Sort by unique school count descending for readability
  const perUserSchoolCounts: PerUserSchoolCount[] = [];
  for (const [userId, schoolIds] of userSchoolMap.entries()) {
    const user = userMap.get(userId);
    perUserSchoolCounts.push({
      userId,
      userEmail: user?.email ?? "unknown",
      userDisplayName: user?.displayName ?? "unknown",
      uniqueSchools: schoolIds.size,
      schoolIds: [...schoolIds].sort(),
    });
  }
  perUserSchoolCounts.sort((a, b) => b.uniqueSchools - a.uniqueSchools);

  // 5. Old logic collapse count — sessions where locationId exists but schoolId does not.
  //    Under old session.schoolId-only logic, these would collapse to undefined Set key.
  const oldLogicCollapseSessionIds: string[] = [];
  for (const session of sessions) {
    const hasLocationId = session.locationId !== undefined && session.locationId !== null && session.locationId !== "";
    const hasSchoolId = session.schoolId !== undefined && session.schoolId !== null && session.schoolId !== "";
    if (hasLocationId && !hasSchoolId) {
      // These locationId-only sessions would have been grouped under undefined in old code.
      oldLogicCollapseSessionIds.push(session.id);
    }
  }

  // -----------------------------------------------------------------------
  // Assemble result
  // -----------------------------------------------------------------------

  const diagnostics: AttributionDiagnostics = {
    dateRange: { start: startDateStr, end: endDateStr },
    emulator,
    summary: {
      totalSessions: sessions.length,
      totalUsers: users.length,
      totalLocations: locations.length,
    },
    attributionBreakdown: {
      locationIdOnly,
      schoolIdOnly,
      both,
      neither,
    },
    sessionsWithNeither,
    missingLocationRefs: {
      count: missingLocationRefSessionIds.length,
      sessionIds: missingLocationRefSessionIds,
      resolvedLocationIds: missingLocationRefResolvedIds,
    },
    roleBreakdown: {
      provider: {
        userCount: providerUserIds.size,
        sessionCount: providerSessions.length,
        userIds: [...providerUserIds].sort(),
      },
      admin: {
        userCount: adminUserIds.size,
        sessionCount: adminSessions.length,
        userIds: [...adminUserIds].sort(),
      },
      unknown: {
        userCount: unknownUserIds.size,
        sessionCount: unknownSessions.length,
        userIds: [...unknownUserIds].sort(),
      },
    },
    perUserSchoolCounts,
    oldLogicCollapseCount: oldLogicCollapseSessionIds.length,
    oldLogicCollapseSessionIds,
  };

  // -----------------------------------------------------------------------
  // Print human-readable summary to stdout
  // -----------------------------------------------------------------------

  const heading = (title: string) => {
    console.log("");
    console.log("=".repeat(72));
    console.log(`  ${title}`);
    console.log("=".repeat(72));
  };

  const subheading = (title: string) => {
    console.log("");
    console.log(`--- ${title} ---`);
  };

  heading("SESSION LOCATION ATTRIBUTION DIAGNOSTICS");
  console.log(`  Date range:        ${startDateStr} to ${endDateStr}`);
  console.log(`  Emulator mode:     ${emulator ? "YES" : "no"}`);
  console.log("");
  console.log(`  Total sessions:    ${diagnostics.summary.totalSessions}`);
  console.log(`  Total users:       ${diagnostics.summary.totalUsers}`);
  console.log(`  Total locations:   ${diagnostics.summary.totalLocations}`);

  subheading("Attribution Breakdown");
  console.log(
    `  locationId only:   ${diagnostics.attributionBreakdown.locationIdOnly} ` +
    `(${totalPercent(diagnostics.attributionBreakdown.locationIdOnly, sessions.length)})`
  );
  console.log(
    `  schoolId only:     ${diagnostics.attributionBreakdown.schoolIdOnly} ` +
    `(${totalPercent(diagnostics.attributionBreakdown.schoolIdOnly, sessions.length)})`
  );
  console.log(
    `  both:              ${diagnostics.attributionBreakdown.both} ` +
    `(${totalPercent(diagnostics.attributionBreakdown.both, sessions.length)})`
  );
  console.log(
    `  neither:           ${diagnostics.attributionBreakdown.neither} ` +
    `(${totalPercent(diagnostics.attributionBreakdown.neither, sessions.length)})`
  );

  if (diagnostics.attributionBreakdown.neither > 0) {
    console.log("");
    console.log("  ⚠ Sessions with MISSING attribution (no locationId, no schoolId):");
    for (const sid of diagnostics.sessionsWithNeither) {
      console.log(`     - ${sid}`);
    }
  }

  subheading("Missing Location References");
  if (diagnostics.missingLocationRefs.count === 0) {
    console.log("  ✅ All resolved location IDs exist in the locations collection.");
  } else {
    console.log(`  ⚠ ${diagnostics.missingLocationRefs.count} session(s) reference location IDs not found in locations collection:`);
    for (let i = 0; i < diagnostics.missingLocationRefs.count; i++) {
      console.log(`     - Session: ${diagnostics.missingLocationRefs.sessionIds[i]} → resolved ID: ${diagnostics.missingLocationRefs.resolvedLocationIds[i]}`);
    }
  }

  subheading("Role Breakdown");
  console.log(`  Provider users:    ${diagnostics.roleBreakdown.provider.userCount} users, ${diagnostics.roleBreakdown.provider.sessionCount} sessions`);
  console.log(`  Admin users:       ${diagnostics.roleBreakdown.admin.userCount} users, ${diagnostics.roleBreakdown.admin.sessionCount} sessions`);
  console.log(`  Unknown role:      ${diagnostics.roleBreakdown.unknown.userCount} users, ${diagnostics.roleBreakdown.unknown.sessionCount} sessions`);

  subheading("Per-User Unique Resolved School Count");
  console.log("  (Top 20 by unique school count)");
  console.log("  ┌──────────────┬──────────────────────────────────┬────────────┬──────────────────────────┐");
  console.log("  │ User ID      │ Name / Email                    │ # Schools  │ School IDs               │");
  console.log("  ├──────────────┼──────────────────────────────────┼────────────┼──────────────────────────┤");
  const top20 = diagnostics.perUserSchoolCounts.slice(0, 20);
  for (const entry of top20) {
    const displayName = entry.userDisplayName.length > 30
      ? entry.userDisplayName.substring(0, 27) + "..."
      : entry.userDisplayName;
    const schoolIdsStr = entry.schoolIds.join(", ");
    const truncatedSchools = schoolIdsStr.length > 25
      ? schoolIdsStr.substring(0, 22) + "..."
      : schoolIdsStr;
    console.log(
      `  │ ${entry.userId.substring(0, 12).padEnd(12)} │ ${displayName.padEnd(32)} │ ${String(entry.uniqueSchools).padStart(3)}         │ ${truncatedSchools.padEnd(24)} │`
    );
  }
  console.log("  └──────────────┴──────────────────────────────────┴────────────┴──────────────────────────┘");
  if (diagnostics.perUserSchoolCounts.length > 20) {
    console.log(`  (${diagnostics.perUserSchoolCounts.length - 20} more users not shown)`);
  }

  subheading("Old Logic Collapse");
  if (diagnostics.oldLogicCollapseCount === 0) {
    console.log("  ✅ No sessions would collapse to undefined under old schoolId-only logic.");
  } else {
    console.log(
      `  ⚠ ${diagnostics.oldLogicCollapseCount} session(s) have locationId but no schoolId — ` +
      `would have been grouped under undefined in old code.`
    );
    const sampleSize = Math.min(diagnostics.oldLogicCollapseSessionIds.length, 10);
    console.log(`  Showing first ${sampleSize} of ${diagnostics.oldLogicCollapseSessionIds.length}:`);
    for (let i = 0; i < sampleSize; i++) {
      console.log(`     - ${diagnostics.oldLogicCollapseSessionIds[i]}`);
    }
    if (diagnostics.oldLogicCollapseSessionIds.length > sampleSize) {
      console.log(`     ... and ${diagnostics.oldLogicCollapseSessionIds.length - sampleSize} more`);
    }
  }

  console.log("");
  console.log("✅ Diagnostics complete.");

  // -----------------------------------------------------------------------
  // Write evidence files
  // -----------------------------------------------------------------------

  const evidenceDir = path.join(__dirname, "..", ".omo", "evidence");
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  // JSON output
  const jsonPath = path.join(evidenceDir, "task-5-attribution-verification.json");
  fs.writeFileSync(jsonPath, JSON.stringify(diagnostics, null, 2), "utf-8");
  console.log(`\n[OUTPUT] JSON written to ${jsonPath}`);

  // Text output — capture the same stdout content
  const txtPath = path.join(evidenceDir, "task-5-attribution-verification.txt");
  // Build text summary (mimics stdout but with all data, not truncated)
  const textLines: string[] = [];
  const t = (...args: string[]) => textLines.push(args.join(" "));

  t("=".repeat(72));
  t("  SESSION LOCATION ATTRIBUTION DIAGNOSTICS");
  t("=".repeat(72));
  t(`  Date range:        ${startDateStr} to ${endDateStr}`);
  t(`  Emulator mode:     ${emulator ? "YES" : "no"}`);
  t("");
  t(`  Total sessions:    ${diagnostics.summary.totalSessions}`);
  t(`  Total users:       ${diagnostics.summary.totalUsers}`);
  t(`  Total locations:   ${diagnostics.summary.totalLocations}`);
  t("");
  t("--- Attribution Breakdown ---");
  t(`  locationId only:   ${diagnostics.attributionBreakdown.locationIdOnly} (${totalPercent(diagnostics.attributionBreakdown.locationIdOnly, sessions.length)})`);
  t(`  schoolId only:     ${diagnostics.attributionBreakdown.schoolIdOnly} (${totalPercent(diagnostics.attributionBreakdown.schoolIdOnly, sessions.length)})`);
  t(`  both:              ${diagnostics.attributionBreakdown.both} (${totalPercent(diagnostics.attributionBreakdown.both, sessions.length)})`);
  t(`  neither:           ${diagnostics.attributionBreakdown.neither} (${totalPercent(diagnostics.attributionBreakdown.neither, sessions.length)})`);

  if (diagnostics.sessionsWithNeither.length > 0) {
    t("");
    t("  ⚠ Sessions with MISSING attribution (no locationId, no schoolId):");
    for (const sid of diagnostics.sessionsWithNeither) {
      t(`     - ${sid}`);
    }
  }

  t("");
  t("--- Missing Location References ---");
  if (diagnostics.missingLocationRefs.count === 0) {
    t("  ✅ All resolved location IDs exist in the locations collection.");
  } else {
    t(`  ⚠ ${diagnostics.missingLocationRefs.count} session(s) reference missing location IDs:`);
    for (let i = 0; i < diagnostics.missingLocationRefs.count; i++) {
      t(`     - Session: ${diagnostics.missingLocationRefs.sessionIds[i]} → resolved ID: ${diagnostics.missingLocationRefs.resolvedLocationIds[i]}`);
    }
  }

  t("");
  t("--- Role Breakdown ---");
  t(`  Provider users:    ${diagnostics.roleBreakdown.provider.userCount} users, ${diagnostics.roleBreakdown.provider.sessionCount} sessions`);
  t(`  Admin users:       ${diagnostics.roleBreakdown.admin.userCount} users, ${diagnostics.roleBreakdown.admin.sessionCount} sessions`);
  t(`  Unknown role:      ${diagnostics.roleBreakdown.unknown.userCount} users, ${diagnostics.roleBreakdown.unknown.sessionCount} sessions`);

  t("");
  t(`--- Per-User Unique Resolved School Count ---`);
  t(`  (${diagnostics.perUserSchoolCounts.length} users total)`);
  for (const entry of diagnostics.perUserSchoolCounts) {
    t(`  ${entry.userId} | ${entry.userDisplayName} (${entry.userEmail}) | ${entry.uniqueSchools} schools | IDs: ${entry.schoolIds.join(", ")}`);
  }

  t("");
  t("--- Old Logic Collapse ---");
  if (diagnostics.oldLogicCollapseCount === 0) {
    t("  ✅ No sessions would collapse to undefined under old schoolId-only logic.");
  } else {
    t(`  ⚠ ${diagnostics.oldLogicCollapseCount} session(s) have locationId but no schoolId — would have been grouped under undefined.`);
    t("  Sessions:");
    for (const sid of diagnostics.oldLogicCollapseSessionIds) {
      t(`     - ${sid}`);
    }
  }

  t("");
  t("✅ Diagnostics complete.");

  fs.writeFileSync(txtPath, textLines.join("\n"), "utf-8");
  console.log(`[OUTPUT] Summary written to ${txtPath}`);
}

/**
 * Format a count as a percentage of total.
 * Returns e.g. "42 (63.6%)" or "0 (0.0%)".
 */
function totalPercent(count: number, total: number): string {
  if (total === 0) return "0 (0.0%)";
  const pct = ((count / total) * 100).toFixed(1);
  return `${count} (${pct}%)`;
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
