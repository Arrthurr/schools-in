# Data Model Migration Guide

## Overview

This migration fixes the over-engineered assignment system by consolidating to a single source of truth: **Location.assignedProviders**.

## What Changed

### Before (Broken)
- ❌ Three conflicting assignment systems
- ❌ `User.assignedSchools` array (never matched types)
- ❌ `Location.assignedProviders` array (never updated)
- ❌ `assignments/{userId_locationId}` collection (never created)
- ❌ Mock data in `schoolService.ts`

### After (Fixed)
- ✅ Single source of truth: `Location.assignedProviders`
- ✅ Real Firestore queries via `locationService.ts`
- ✅ Simplified security rules
- ✅ All assignment operations update only `Location.assignedProviders`

## Bug Fix: Provider Assignment Synchronization (October 2025)

### Issue
The User Management admin form contained legacy code that stored assignments in `User.assignedSchools` but never synchronized them to `Location.assignedProviders`. This caused:
- Assignments via User Management form to not appear in Provider Dashboard
- Provider Dashboard to only recognize assignments made through Assignment Management page
- Data inconsistency between collections

### Solution
1. **Removed legacy functionality** from `UserForm.tsx` - school assignment UI now directs admins to the dedicated Assignment Management page
2. **Cleaned up interfaces** - removed `assignedSchools` from `UserRecord` and `UserFormData` in `userService.ts`
3. **Removed function** - deleted `updateUserSchools()` which tried to update the wrong collection

### Migration
To fix existing broken assignments from the User Management form:

```bash
# 1. Run the migration script to sync User.assignedSchools to Location.assignedProviders
node scripts/migrate-assignments.js

# 2. Verify results - check that providers now see their assigned schools in the dashboard
```

### What the Migration Does
- Finds all users with `User.assignedSchools` field
- For each assignment, adds the provider to the corresponding `Location.assignedProviders` array
- Removes the deprecated `User.assignedSchools` field
- Provides a detailed log of all changes

### Going Forward
- **Use Assignment Management page only** at `/admin/assignments` to manage provider-to-school assignments
- User Management form (`/admin/users`) now only handles user profile and role management
- `Location.assignedProviders` remains the single source of truth

## Migration Steps

### 1. Schools Imported ✅
31 schools successfully imported to Firestore locations collection.

### 2. Deploy Updated Security Rules
```bash
firebase deploy --only firestore:rules
```

### 3. Test Provider Access

#### Create a test provider and assign to schools:

**Option A: Using Firebase Console**
1. Go to Firestore Console
2. Select a location document (e.g., `walter-payton-hs`)
3. Edit the `assignedProviders` array
4. Add a provider's UID (get from Authentication tab)
5. Save

**Option B: Using Node script**
```javascript
// scripts/assign-test-provider.js
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function assignProvider() {
  const providerId = 'YOUR_PROVIDER_UID'; // Get from Firebase Auth
  const locationIds = ['walter-payton-hs', 'depaul-college-prep'];
  
  const batch = db.batch();
  locationIds.forEach(locationId => {
    const ref = db.collection('locations').doc(locationId);
    batch.update(ref, {
      assignedProviders: admin.firestore.FieldValue.arrayUnion(providerId),
      updatedAt: admin.firestore.Timestamp.now()
    });
  });
  
  await batch.commit();
  console.log('✅ Provider assigned to schools');
}

assignProvider();
```

### 4. Update UI Components

The following components need to use the new `locationService.ts` instead of `schoolService.ts`:

#### High Priority - Provider-facing
- [ ] `src/components/provider/SchoolList.tsx`
- [ ] `src/components/provider/SchoolDetailView.tsx`
- [ ] `src/components/provider/CheckInButton.tsx`
- [ ] `src/app/dashboard/page.tsx` (provider dashboard)

#### Medium Priority - Admin-facing
- [ ] `src/components/admin/UserForm.tsx`
- [ ] `src/components/admin/AssignmentModal.tsx`
- [ ] `src/app/admin/assignments/page.tsx`

#### Replace Pattern
```typescript
// OLD (schoolService.ts)
import { SchoolService } from '@/lib/services/schoolService';
const schools = await SchoolService.getAssignedSchools(userId);

// NEW (locationService.ts)
import { getAssignedLocations } from '@/lib/services/locationService';
const locations = await getAssignedLocations(userId);
```

## New Service Functions

### For Providers
```typescript
import { 
  getAssignedLocations,
  getAssignedLocationsWithDistance,
  isWithinRadius,
  calculateDistance
} from '@/lib/services/locationService';

// Get provider's assigned locations
const locations = await getAssignedLocations(providerId);

// Get locations sorted by distance
const sorted = await getAssignedLocationsWithDistance(
  providerId,
  userLat,
  userLon
);

// Check if within GPS radius
const canCheckIn = isWithinRadius(userLat, userLon, location);
```

### For Admins
```typescript
import {
  assignProviderToLocation,
  removeProviderFromLocation,
  replaceLocationProviders
} from '@/lib/services/locationService';

import {
  getSchoolAssignments,
  getUnassignedProviders
} from '@/lib/services/assignmentService';

// Assign provider to location
await assignProviderToLocation(providerId, locationId);

// Get all assignments (for admin view)
const assignments = await getSchoolAssignments();

// Get providers without any assignments
const unassigned = await getUnassignedProviders();
```

## Testing Checklist

### Provider Flow
- [ ] Provider logs in and sees assigned locations
- [ ] Locations are sorted by distance
- [ ] Provider can see location details (address, GPS coords, radius)
- [ ] Provider can check in when within radius
- [ ] Provider cannot check in when outside radius
- [ ] Provider cannot see unassigned locations

### Admin Flow
- [ ] Admin can view all locations
- [ ] Admin can see which providers are assigned to each location
- [ ] Admin can assign a provider to a location
- [ ] Admin can remove a provider from a location
- [ ] Admin can bulk assign/remove providers
- [ ] Changes are immediately reflected for providers

### Session Flow
- [ ] Check-in creates session with correct locationId
- [ ] Check-out completes session
- [ ] Sessions appear in provider history
- [ ] Admin can export sessions to CSV

## Rollback Plan

If issues arise, you can rollback by:

1. Revert Firestore rules:
```bash
git checkout HEAD~1 -- firestore.rules
firebase deploy --only firestore:rules
```

2. Keep using assignmentService (it now uses Location.assignedProviders)

3. The old schoolService.ts can be temporarily restored but it ONLY has mock data

## Known Issues Fixed

1. ✅ **Providers couldn't load data** - Now using real Firestore queries
2. ✅ **Security rules blocked access** - Rules now match query patterns
3. ✅ **Three conflicting models** - Consolidated to one
4. ✅ **Mock data in production** - Using real Firestore data
5. ✅ **assignedSchools didn't exist in types** - Removed entirely

## Performance Notes

- Location queries with `array-contains` are indexed by default
- Each provider query is single round-trip to Firestore
- Distance calculations happen client-side (fast)
- Consider caching locations in IndexedDB for offline support

## Next Steps

1. Update UI components to use `locationService.ts`
2. Test with real provider accounts
3. Deploy security rules
4. Monitor Firebase console for errors
5. Update documentation

## Support

If you encounter issues:
1. Check Firebase Console > Firestore for data
2. Check browser console for error messages
3. Verify security rules are deployed
4. Ensure user has correct role (`provider` or `admin`)
