Help me build a location-based Progressive Web Application (PWA) that lets educational service providers track their presence at specific school locations. I want them to be able to "check-in" and "check-out" of these different school locations.

Requirements:

- Google OAuth or email/password to log in - ensure database schema handles this
- Add unit tests for business logic, e2e tests for core user journeys
- Use git and npm, use descriptive comments
- Role-Based Access that allow service providers to check-in/check-out at school locations
- Admin role, full access to manage users, schools, and check-in/check-out events (sessions)
- Protected routes for authenticated users

Design:

- Minimal, functional, practical
- Intentional use of color, different shades of blue (#154690 is brand color)
- Cooler tones
- Inspired by social apps

Frontend: 

- Next.js and React
- Tailwind CSS v4
- shadcn/ui
- ESLint 9

Backend:

- Google Firestore DB
- Google Firebase Authentication
