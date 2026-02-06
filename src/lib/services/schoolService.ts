/**
 * School Service
 *
 * This module previously contained a static SCHOOLS_DATA array and a
 * SchoolService class that served hardcoded school locations. All
 * consumers have been migrated to CachedSchoolService, which reads
 * from Firestore.
 *
 * Re-exports CachedSchoolService for backward-compatibility.
 */

export { CachedSchoolService as SchoolService } from "./cachedSchoolService";
