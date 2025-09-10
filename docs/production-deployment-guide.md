# Production Deployment Guide

This guide covers the complete production deployment process for the Schools-In Firebase application.

## Overview

The production environment includes:

- **Enhanced security rules** with role-based access control
- **Performance monitoring** with Firebase Analytics and custom metrics
- **Optimized Firestore indexes** for efficient queries
- **CDN hosting** with intelligent caching strategies
- **Automated monitoring** via Cloud Functions
- **Error tracking** with Sentry integration

## Pre-Deployment Checklist

### 1. Environment Configuration

- [ ] Create `.env.production` with all required variables
- [ ] Verify Firebase project configuration
- [ ] Test security rules locally
- [ ] Validate Firestore indexes
- [ ] Configure domain settings (if custom domain)

### 2. Security Review

- [ ] Review Firestore security rules
- [ ] Review Storage security rules
- [ ] Verify authentication flow
- [ ] Test role-based permissions
- [ ] Review API endpoint security

### 3. Performance Optimization

- [ ] Run bundle analyzer to check sizes
- [ ] Verify image optimization settings
- [ ] Test caching strategies
- [ ] Check Core Web Vitals scores
- [ ] Validate offline functionality

### 4. Quality Assurance

- [ ] Run full test suite
- [ ] Perform end-to-end testing
- [ ] Test on multiple devices/browsers
- [ ] Verify accessibility compliance
- [ ] Load test critical user flows

## Deployment Process

### Method 1: Automated Script (Recommended)

```bash
# Run the complete deployment script
./scripts/deploy-production.sh

# Or with options
./scripts/deploy-production.sh --skip-tests  # Skip tests
./scripts/deploy-production.sh --dry-run     # Validate only
```

### Method 2: Manual Deployment

```bash
# 1. Validate environment
npm run lint
npm run test

# 2. Validate Firebase rules
firebase firestore:rules:validate firestore.rules
firebase storage:rules:validate storage.rules

# 3. Build production app
NODE_ENV=production npm run build

# 4. Deploy to Firebase
firebase deploy --only firestore,storage,hosting,functions
```

## Production Configuration Details

### Firebase Hosting Configuration

```json
{
  "hosting": {
    "public": "out",
    "cleanUrls": true,
    "trailingSlash": false,
    "headers": [
      {
        "source": "**/*.@(js|css|woff|woff2)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public,max-age=31536000,immutable"
          }
        ]
      },
      {
        "source": "**/*.@(png|jpg|jpeg|gif|svg|webp|avif|ico)",
        "headers": [
          {
            "key": "Cache-Control", 
            "value": "public,max-age=2592000"
          }
        ]
      }
    ]
  }
}
```

### Security Headers

- **X-Frame-Options**: DENY (prevents clickjacking)
- **X-Content-Type-Options**: nosniff (prevents MIME sniffing)
- **Referrer-Policy**: strict-origin-when-cross-origin
- **Permissions-Policy**: Restricts camera, microphone, allows geolocation

### Cache Control

- **Static assets** (JS, CSS, fonts): 1 year with immutable
- **Images**: 30 days with no-sniff
- **Manifest**: 1 day
- **Service Worker**: No cache (always fresh)

## Firestore Security Rules

### Key Security Features

1. **Role-based access control** (admin vs provider)
2. **User ownership validation** for personal data
3. **Data validation** (timestamps, email format, required fields)
4. **State transition validation** for sessions
5. **File size and type restrictions** for uploads

### Critical Rules

```javascript
// Users can only modify their own data (specific fields)
allow update: if isOwner(userId) && 
                 request.resource.data.diff(resource.data).affectedKeys()
                   .hasOnly(['displayName', 'photoURL', 'phoneNumber', 'preferences']);

// Session state transitions must be valid
allow update: if ((resource.data.status == 'active' && request.resource.data.status in ['paused', 'completed']) ||
                  (resource.data.status == 'paused' && request.resource.data.status in ['active', 'completed']));
```

## Firestore Indexes

### Performance-Optimized Indexes

```json
// User queries with role and status filtering
{
  "fields": [
    { "fieldPath": "role", "order": "ASCENDING" },
    { "fieldPath": "isActive", "order": "ASCENDING" },
    { "fieldPath": "displayName", "order": "ASCENDING" }
  ]
}

// Session queries with user, status, and time filtering
{
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "startTime", "order": "DESCENDING" }
  ]
}

// Location queries with provider assignments
{
  "fields": [
    { "fieldPath": "assignedProviders", "arrayConfig": "CONTAINS" },
    { "fieldPath": "name", "order": "ASCENDING" }
  ]
}
```

## Cloud Functions

### Production Functions

1. **cleanupStaleSessions** (every hour)
   - Closes sessions active > 12 hours
   - Tracks cleanup metrics
   - Error reporting to Sentry

2. **generateDailyStats** (daily at 2 AM)
   - Aggregates session statistics
   - Calculates performance metrics
   - Stores in system collection

3. **healthCheck** (callable)
   - Tests Firestore/Auth/Storage connectivity
   - Returns system health status
   - Used for uptime monitoring

4. **trackCachePerformance** (callable)
   - Receives client cache metrics
   - Stores performance data
   - Enables cache optimization

## Monitoring and Analytics

### Firebase Analytics Events

```typescript
// Authentication tracking
trackEvent('login', { method: 'google', user_role: 'provider' });
trackEvent('logout', { session_duration: 3600000 });

// Session tracking
trackEvent('session_start', { location_id: 'school123', gps_accuracy: 5 });
trackEvent('session_end', { duration: 7200000, location_id: 'school123' });

// Performance tracking
trackEvent('performance_metric', { 
  metric_name: 'check_in_duration', 
  metric_value: 2500 
});
```

### Performance Metrics

- **Check-in duration**: Time from button click to successful check-in
- **Location load time**: Time to load school list
- **Session list load**: Time to load session history
- **Cache response time**: Cache hit vs miss performance
- **Core Web Vitals**: LCP, FID, CLS tracking

### Error Monitoring

- **Global error handler** for uncaught JavaScript errors
- **Promise rejection handler** for unhandled async errors
- **Firebase operation errors** with context
- **Network connectivity errors** with retry information

## Performance Optimization

### Caching Strategy

```javascript
// Multi-layer cache configuration
const cacheConfig = {
  // Memory cache (fastest, 5-30 min TTL)
  user: { type: 'memory', ttl: 30 * 60 * 1000 },
  
  // Session storage (session duration TTL)  
  auth: { type: 'session', ttl: 2 * 60 * 60 * 1000 },
  
  // Local storage (long-term, 1-24 hour TTL)
  locations: { type: 'local', ttl: 24 * 60 * 60 * 1000 },
  
  // IndexedDB (offline support, days/weeks TTL)
  offline: { type: 'indexeddb', ttl: 7 * 24 * 60 * 60 * 1000 },
};
```

### Query Optimization

- **Indexed queries only** (no full collection scans)
- **Client-side filtering** for complex search (consider Algolia for scale)
- **Pagination** for large result sets
- **Real-time subscriptions** only for critical data
- **Batch operations** for bulk updates

### Bundle Optimization

- **Code splitting** by route and feature
- **Dynamic imports** for non-critical modules
- **Tree shaking** to remove unused code
- **Image optimization** with WebP/AVIF formats
- **Service worker caching** for offline support

## Security Considerations

### Data Protection

1. **Personally Identifiable Information (PII)**
   - Email addresses protected by user ownership
   - Phone numbers encrypted in transit
   - Profile photos size-limited and validated

2. **Role-based Security**
   - Providers can only access assigned schools
   - Admins have full access with audit logging
   - Session data protected by user ownership

3. **Input Validation**
   - All timestamps required on documents
   - Email format validation
   - File type and size restrictions
   - GPS coordinate validation

### Authentication Security

- **Firebase Auth** with Google OAuth and email/password
- **Session persistence** with secure tokens
- **Role verification** on every protected operation
- **Activity tracking** for audit purposes

## Monitoring and Alerts

### Key Metrics to Monitor

1. **Application Performance**
   - Page load times < 3 seconds
   - Time to Interactive < 5 seconds
   - Core Web Vitals in "Good" range

2. **Firebase Usage**
   - Firestore read/write operations
   - Authentication success rates
   - Storage bandwidth usage
   - Function execution times

3. **Error Rates**
   - JavaScript errors < 1%
   - Firebase operation failures < 0.1%
   - Authentication failures < 2%

### Alert Thresholds

```javascript
const alertThresholds = {
  errorRate: 0.01,          // 1% error rate
  responseTime: 3000,       // 3 second response time
  cacheHitRate: 0.7,        // 70% cache hit rate
  sessionTimeout: 0.05,     // 5% session timeout rate
  functionErrors: 0.001,    // 0.1% function error rate
};
```

## Post-Deployment Verification

### 1. Functional Testing

```bash
# Test critical user flows
curl -f https://schools-in-check.web.app/          # Homepage loads
curl -f https://schools-in-check.web.app/dashboard # Dashboard accessible
```

### 2. Performance Testing

- Run Lighthouse audit (score > 90)
- Test Core Web Vitals
- Verify caching headers
- Check service worker installation
- Test offline functionality

### 3. Security Testing

- Verify authentication flows
- Test role-based permissions
- Check security headers
- Validate HTTPS enforcement
- Test rate limiting

### 4. Monitoring Setup

- Configure Firebase Performance alerts
- Set up Sentry error notifications
- Monitor Cloud Functions logs
- Track analytics dashboards
- Set up uptime monitoring

## Rollback Procedure

### Immediate Rollback

```bash
# Rollback hosting to previous version
firebase hosting:releases:list
firebase hosting:releases:rollback <release-id>

# Rollback security rules (if needed)
git checkout HEAD~1 firestore.rules
firebase deploy --only firestore:rules
```

### Recovery Steps

1. **Identify the issue** (logs, error reports, metrics)
2. **Assess impact** (affected users, data integrity)
3. **Execute rollback** (hosting, rules, functions)
4. **Verify functionality** (critical path testing)
5. **Communicate status** (status page, user notifications)
6. **Plan forward fix** (hotfix or next release)

## Maintenance

### Daily Tasks

- [ ] Review error reports
- [ ] Check performance metrics
- [ ] Monitor resource usage
- [ ] Verify backup integrity

### Weekly Tasks

- [ ] Analyze user activity trends
- [ ] Review security logs
- [ ] Update dependencies
- [ ] Performance optimization review

### Monthly Tasks

- [ ] Security audit
- [ ] Cost optimization review
- [ ] Capacity planning
- [ ] Disaster recovery testing

## Support and Troubleshooting

### Common Issues

1. **Build failures**: Check environment variables and dependencies
2. **Rule deployment failures**: Validate syntax and test locally
3. **Performance degradation**: Check cache hit rates and query efficiency
4. **Authentication issues**: Verify domain configuration and user roles

### Emergency Contacts

- **Firebase Support**: [Firebase Support](https://firebase.google.com/support)
- **Sentry**: [Sentry Support](https://sentry.io/support/)
- **Development Team**: [Internal team contacts]

### Useful Commands

```bash
# View deployment history
firebase hosting:releases:list

# View function logs
firebase functions:log

# Test security rules
firebase firestore:rules:test

# Monitor performance
firebase performance:monitoring

# Export data
firebase firestore:export gs://backup-bucket
```

## Resources

- [Firebase Hosting Documentation](https://firebase.google.com/docs/hosting)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Performance Monitoring](https://firebase.google.com/docs/perf-mon)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
