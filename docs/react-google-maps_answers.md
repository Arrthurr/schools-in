1. SETUP
- Yes, I already have a GCP account and Maps API key. 
- For handling the API key, my plan is to add it to `.env.local`, but I need to know how I need to format the entry.
- One domain restriction for now: the Firebase Hosting address (@https://schools-in-check.web.app/ ). This address is entered into Google Maps Platform.

2. BUDGET & USAGE
- Assume 30 schools will be managed
- Assume 100 providers will use the app
- Assume 30 daily active users
- I am comfortable with the costs.

3. IMPLEMENTATION
- High Priority
-- Real geocoding to replace mock services
- Medium Priority
-- Navigation integration
-- Mobile-optimized map experience
- Low Priority
-- Offline map capabilities

4. TECH CONSTRAINTS
- No deployment restrictions
- No firewall or security policies
- I would like the option to use React Native later

5. UX
- ADMIN
-- I don't want a map-centric admin dashboard.
-- School list doesn't need a map view
- PROVIDER
-- Check-in does not need a map view
-- I would lke navigation integration

6. TIMELINE & RESOURCES
- Timeline
-- 1 week for implementation
-- 2 weeks for completion
-- Deadline: 10/03/2025
- Development
-- I am implementing this myself.
-- I do not have a designer.
-- Frontend: Next.js, Tailwind, shadcn/ui
-- Backend: Firebase
-- Database: Firestore
-- Hosting: Firebase Hosting
-- Authentication: Firebase Auth

7. INTEGRATION
- Migration
-- Please replace existing location features if needed.
-- Let's implement all at once.
-- One school should keep the 800 meter radius for testing. This value is set in the database: `locations` collection, document id: `/locations/pkMzBFLwB11pQDlxhvIp`
- Testing
-- I don't want to keep the currect mock geocoding.
-- I will take your recommendations on testing scenarios.
