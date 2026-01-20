# Feedback System

Complete documentation for the provider feedback system.

## Status: ✅ Deployed and Operational

---

## Overview

The feedback system allows providers to submit bug reports, feature requests, and general feedback. Admins can view, manage, and update feedback status.

## Data Model

**Firestore Collection**: `feedback`

```typescript
interface Feedback {
  id: string;
  providerId: string;
  providerEmail?: string;
  providerName?: string;
  category: "bug" | "feature_request" | "general" | "other";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  url?: string;
  userAgent?: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Location**: `src/lib/firebase/types.ts`

---

## Architecture

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| FeedbackForm | `src/components/feedback/FeedbackForm.tsx` | Provider submission form |
| Provider Route | `src/app/provider/feedback/page.tsx` | Provider feedback page |
| Admin Dashboard | `src/app/admin/feedback/page.tsx` | Admin management UI |
| Service Layer | `src/lib/services/feedbackService.ts` | CRUD operations |

### Service Methods

- `submitFeedback(input)` - Create feedback (auto-sets status, timestamps)
- `getAllFeedback()` - Get all feedback (admin only, limit 100)
- `getFeedbackById(id)` - Get single feedback
- `updateStatus(id, status)` - Update status (admin only)

---

## Security Rules

**Location**: `firestore.rules`

### Provider Permissions
- **Create**: Only with their own `providerId`
- **Validation**: Valid category, severity, timestamps required

### Admin Permissions
- **Read**: All feedback
- **Update**: Status changes only
- **Delete**: Any feedback

### Database Index
Composite index on `status` (ASC) + `createdAt` (DESC) for filtered queries.

---

## User Flows

### Provider Submitting Feedback
1. Navigate to Dashboard → "Feedback" in sidebar
2. Fill form (category, severity, description)
3. Submit → Success toast → Auto-redirect to dashboard

### Admin Reviewing Feedback
1. Navigate to Admin Panel → Feedback
2. View list sorted by newest first
3. Click "View" to see details
4. Update status via dropdown

---

## Email Notifications (Optional)

Cloud Function triggers on feedback creation.

**Configuration** (Firebase Console → Functions → Configuration):

```bash
# SendGrid (Recommended)
SENDGRID_API_KEY=your_key
ADMIN_EMAIL=admin@yourdomain.com
SMTP_FROM=noreply@yourdomain.com

# Or Custom SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

---

## Testing

```bash
# Run all feedback tests
npm test -- --testPathPatterns="feedback"

# Individual tests
npm test -- src/lib/services/feedbackService.test.ts
npm test -- src/components/feedback/FeedbackForm.test.tsx
```

---

## Deployment

```bash
# Deploy everything
npm run firebase:deploy:production

# Deploy Firestore only
firebase deploy --only firestore

# Deploy functions (for email notifications)
firebase deploy --only functions
```

---

## Troubleshooting

### Form submission fails
1. Check user is authenticated
2. Verify Firestore rules allow create
3. Check browser console for errors

### Admin dashboard empty
1. Verify user has `admin` role
2. Check Firestore console for documents
3. Click "Refresh" button

### Status update fails
1. Verify user is admin
2. Check status is valid: open, in_progress, resolved, closed
