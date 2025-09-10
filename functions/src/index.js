const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const Sentry = require("@sentry/node");

admin.initializeApp();

// Initialize Sentry for production error tracking
if (process.env.SENTRY_DSN) {
  Sentry.init({ 
    dsn: process.env.SENTRY_DSN,
    environment: process.env.ENVIRONMENT || 'production',
    tracesSampleRate: 0.1, // 10% performance monitoring
  });
}

// Production configuration
const PRODUCTION_CONFIG = {
  sessionTimeoutHours: 12,
  cleanupIntervalHours: 1,
  maxBatchSize: 500,
  performanceThresholds: {
    queryTimeMs: 1000,
    batchTimeMs: 5000,
  },
};

const twelveHoursInMs = 12 * 60 * 60 * 1000;

exports.cleanupStaleSessions = onSchedule("every 1 hours", async (event) => {
  try {
    const db = admin.firestore();
    const sessionsRef = db.collection("sessions");

    const now = admin.firestore.Timestamp.now();
    const cutoff = admin.firestore.Timestamp.fromMillis(
      now.toMillis() - twelveHoursInMs
    );

    const staleSessionsQuery = sessionsRef
      .where("status", "==", "active")
      .where("checkInTime", "<", cutoff);

    const staleSessionsSnapshot = await staleSessionsQuery.get();

    if (staleSessionsSnapshot.empty) {
      logger.info("No stale sessions found.");
      return;
    }

    const batch = db.batch();
    staleSessionsSnapshot.forEach((doc) => {
      logger.info(`Found stale session: ${doc.id}`);
      const sessionRef = sessionsRef.doc(doc.id);
      batch.update(sessionRef, {
        status: "error",
        notes: "Session automatically closed due to timeout.",
        checkOutTime: doc.data().checkInTime, // Or use a fixed time
      });
    });

    await batch.commit();
    logger.info(`Cleaned up ${staleSessionsSnapshot.size} stale sessions.`);
    
    // Track cleanup metrics
    const metrics = {
      cleanedSessions: staleSessionsSnapshot.size,
      timestamp: admin.firestore.Timestamp.now(),
      type: 'session_cleanup',
    };
    
    await db.collection('system').doc('cleanup_metrics').set(metrics, { merge: true });
    
  } catch (error) {
    logger.error("Error cleaning up stale sessions:", error);
    Sentry.captureException(error);
    throw error; // Re-throw for proper error tracking
  }
});

// Daily statistics aggregation
exports.generateDailyStats = onSchedule("every day 02:00", async (event) => {
  try {
    const db = admin.firestore();
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const startOfDay = admin.firestore.Timestamp.fromDate(
      new Date(yesterday.setHours(0, 0, 0, 0))
    );
    const endOfDay = admin.firestore.Timestamp.fromDate(
      new Date(yesterday.setHours(23, 59, 59, 999))
    );

    // Aggregate session statistics
    const sessionsQuery = db.collection('sessions')
      .where('startTime', '>=', startOfDay)
      .where('startTime', '<=', endOfDay);
    
    const sessionsSnapshot = await sessionsQuery.get();
    
    const sessionStats = {
      date: admin.firestore.Timestamp.fromDate(yesterday),
      totalSessions: sessionsSnapshot.size,
      completedSessions: 0,
      averageDuration: 0,
      byLocation: {},
      byProvider: {},
    };

    let totalDuration = 0;
    
    sessionsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.status === 'completed') {
        sessionStats.completedSessions++;
        if (data.startTime && data.endTime) {
          const duration = data.endTime.toMillis() - data.startTime.toMillis();
          totalDuration += duration;
        }
      }

      // Track by location
      if (data.locationId) {
        sessionStats.byLocation[data.locationId] = (sessionStats.byLocation[data.locationId] || 0) + 1;
      }

      // Track by provider
      if (data.userId) {
        sessionStats.byProvider[data.userId] = (sessionStats.byProvider[data.userId] || 0) + 1;
      }
    });

    if (sessionStats.completedSessions > 0) {
      sessionStats.averageDuration = totalDuration / sessionStats.completedSessions;
    }

    // Store daily statistics
    await db.collection('system').doc(`daily_stats_${yesterday.toISOString().split('T')[0]}`).set(sessionStats);
    
    logger.info('Daily statistics generated:', sessionStats);
    
  } catch (error) {
    logger.error('Error generating daily statistics:', error);
    Sentry.captureException(error);
    throw error;
  }
});

// Cache performance monitoring
exports.trackCachePerformance = onCall(async (request) => {
  try {
    const { data } = request;
    const db = admin.firestore();
    
    // Validate request data
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid cache performance data');
    }

    const cacheMetrics = {
      ...data,
      timestamp: admin.firestore.Timestamp.now(),
      source: 'client',
    };

    // Store cache performance metrics
    await db.collection('cache_stats').add(cacheMetrics);
    
    return { success: true, timestamp: cacheMetrics.timestamp };
  } catch (error) {
    logger.error('Error tracking cache performance:', error);
    Sentry.captureException(error);
    throw error;
  }
});

// Health check endpoint
exports.healthCheck = onCall(async (request) => {
  try {
    const db = admin.firestore();
    
    // Perform basic connectivity tests
    const checks = {
      firestore: false,
      auth: false,
      storage: false,
      timestamp: admin.firestore.Timestamp.now(),
    };

    // Test Firestore connectivity
    try {
      await db.collection('system').doc('health_check').set({
        test: true,
        timestamp: admin.firestore.Timestamp.now(),
      });
      checks.firestore = true;
    } catch (error) {
      logger.warn('Firestore health check failed:', error);
    }

    // Test Auth connectivity  
    try {
      await admin.auth().listUsers(1);
      checks.auth = true;
    } catch (error) {
      logger.warn('Auth health check failed:', error);
    }

    // Test Storage connectivity
    try {
      const bucket = admin.storage().bucket();
      await bucket.exists();
      checks.storage = true;
    } catch (error) {
      logger.warn('Storage health check failed:', error);
    }

    const allHealthy = Object.values(checks).filter(v => typeof v === 'boolean').every(Boolean);
    
    return {
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
      version: '1.0.0',
    };
  } catch (error) {
    logger.error('Health check failed:', error);
    Sentry.captureException(error);
    return {
      status: 'error',
      error: error.message,
      timestamp: admin.firestore.Timestamp.now(),
    };
  }
});

// User activity tracking
exports.trackUserActivity = onCall(async (request) => {
  try {
    const { data, auth } = request;
    
    if (!auth) {
      throw new Error('Authentication required');
    }

    const db = admin.firestore();
    
    // Update user's last activity
    await db.collection('users').doc(auth.uid).update({
      lastActiveAt: admin.firestore.Timestamp.now(),
      lastActivityType: data.activityType || 'unknown',
    });

    // Track activity in system collection for analytics
    await db.collection('system').collection('user_activity').add({
      userId: auth.uid,
      activityType: data.activityType,
      metadata: data.metadata || {},
      timestamp: admin.firestore.Timestamp.now(),
    });

    return { success: true };
  } catch (error) {
    logger.error('Error tracking user activity:', error);
    Sentry.captureException(error);
    throw error;
  }
});
