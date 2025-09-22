const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// Production configuration
const _PRODUCTION_CONFIG = {
  sessionTimeoutHours: 12,
  cleanupIntervalHours: 1,
  maxBatchSize: 500,
  performanceThresholds: {
    queryTimeMs: 1000,
    batchTimeMs: 5000,
  },
};

const twelveHoursInMs = 12 * 60 * 60 * 1000;

// Callable function to start a session with atomic checks
exports.startSession = onCall(async (request) => {
  try {
    const { data, auth } = request;

    // Authentication check
    if (!auth) {
      throw new Error("Authentication required");
    }

    // Validate input data
    if (!data || !data.locationId || !data.startTime || !data.checkInMethod || !data.distanceFromCenterAtCheckIn || !data.dayKey) {
      throw new Error("Missing required session data: locationId, startTime, checkInMethod, distanceFromCenterAtCheckIn, dayKey");
    }

    const db = admin.firestore();
    const userId = auth.uid;

    // Use a transaction to atomically check for existing active sessions and create new one
    const result = await db.runTransaction(async (transaction) => {
      // Check if user exists and is active
      const userRef = db.collection("users").doc(userId);
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists) {
        throw new Error("User not found");
      }

      const userData = userDoc.data();
      if (userData.role !== 'provider') {
        throw new Error("Only providers can start sessions");
      }

      if (userData.isActive === false || userData.disabled === true) {
        throw new Error("User account is not active");
      }

      // Check for existing active or paused sessions for this provider
      const existingSessionsQuery = db.collection("sessions")
        .where("userId", "==", userId)
        .where("status", "in", ["active", "paused"]);
      
      const existingSessionsSnapshot = await transaction.get(existingSessionsQuery);

      if (!existingSessionsSnapshot.empty) {
        const existingSession = existingSessionsSnapshot.docs[0];
        throw new Error(`Provider already has an ${existingSession.data().status} session: ${existingSession.id}`);
      }

      // Verify the location exists and provider has access
      const locationRef = db.collection("locations").doc(data.locationId);
      const locationDoc = await transaction.get(locationRef);
      
      if (!locationDoc.exists) {
        throw new Error("Location not found");
      }

      const locationData = locationDoc.data();
      if (locationData.active === false) {
        throw new Error("Location is not active");
      }

      // Check if provider is assigned to this location
      if (!locationData.assignedProviders || !locationData.assignedProviders.includes(userId)) {
        throw new Error("Provider is not assigned to this location");
      }

      // Create the new session document
      const sessionData = {
        id: null, // Will be set after creation
        userId: userId,
        locationId: data.locationId,
        startTime: admin.firestore.Timestamp.fromDate(new Date(data.startTime)),
        endTime: null,
        status: 'active',
        checkInMethod: data.checkInMethod,
        distanceFromCenterAtCheckIn: data.distanceFromCenterAtCheckIn,
        dayKey: data.dayKey,
        notes: data.notes || '',
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      };

      // Add optional fields if provided
      if (data.durationMinutes !== undefined) {
        sessionData.durationMinutes = data.durationMinutes;
      }

      const sessionRef = db.collection("sessions").doc();
      sessionData.id = sessionRef.id;
      
      transaction.set(sessionRef, sessionData);

      // Update user's last activity
      transaction.update(userRef, {
        lastActiveAt: admin.firestore.Timestamp.now()
      });

      return {
        sessionId: sessionRef.id,
        sessionData: sessionData
      };
    });

    logger.info(`Session started successfully for user ${userId}: ${result.sessionId}`);
    
    return {
      success: true,
      sessionId: result.sessionId,
      session: result.sessionData
    };

  } catch (error) {
    logger.error("Error starting session:", error);
    
    // Return user-friendly error messages
    if (error.message.includes("already has an")) {
      throw new Error("You already have an active session. Please end your current session before starting a new one.");
    } else if (error.message.includes("not assigned")) {
      throw new Error("You are not authorized to check in at this location.");
    } else if (error.message.includes("not active")) {
      throw new Error("This location is currently unavailable for check-in.");
    } else if (error.message.includes("User not found")) {
      throw new Error("User account not found. Please contact support.");
    } else if (error.message.includes("Only providers")) {
      throw new Error("Only provider accounts can start sessions.");
    } else if (error.message.includes("Missing required")) {
      throw new Error("Invalid session data provided.");
    }
    
    throw new Error("Failed to start session. Please try again.");
  }
});

exports.cleanupStaleSessions = onSchedule("every 1 hours", async (_event) => {
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
      type: "session_cleanup",
    };

    await db
      .collection("system")
      .doc("cleanup_metrics")
      .set(metrics, { merge: true });
  } catch (error) {
    logger.error("Error cleaning up stale sessions:", error);
    logger.error("Error occurred:", error);
    throw error; // Re-throw for proper error tracking
  }
});

// Daily statistics aggregation
exports.generateDailyStats = onSchedule("every day 02:00", async (_event) => {
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
    const sessionsQuery = db
      .collection("sessions")
      .where("startTime", ">=", startOfDay)
      .where("startTime", "<=", endOfDay);

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

    sessionsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.status === "completed") {
        sessionStats.completedSessions++;
        if (data.startTime && data.endTime) {
          const duration = data.endTime.toMillis() - data.startTime.toMillis();
          totalDuration += duration;
        }
      }

      // Track by location
      if (data.locationId) {
        sessionStats.byLocation[data.locationId] =
          (sessionStats.byLocation[data.locationId] || 0) + 1;
      }

      // Track by provider
      if (data.userId) {
        sessionStats.byProvider[data.userId] =
          (sessionStats.byProvider[data.userId] || 0) + 1;
      }
    });

    if (sessionStats.completedSessions > 0) {
      sessionStats.averageDuration =
        totalDuration / sessionStats.completedSessions;
    }

    // Store daily statistics
    await db
      .collection("system")
      .doc(`daily_stats_${yesterday.toISOString().split("T")[0]}`)
      .set(sessionStats);

    logger.info("Daily statistics generated:", sessionStats);
  } catch (error) {
    logger.error("Error generating daily statistics:", error);
    logger.error("Error occurred:", error);
    throw error;
  }
});

// Cache performance monitoring
exports.trackCachePerformance = onCall(async (request) => {
  try {
    const { data } = request;
    const db = admin.firestore();

    // Validate request data
    if (!data || typeof data !== "object") {
      throw new Error("Invalid cache performance data");
    }

    const cacheMetrics = {
      ...data,
      timestamp: admin.firestore.Timestamp.now(),
      source: "client",
    };

    // Store cache performance metrics
    await db.collection("cache_stats").add(cacheMetrics);

    return { success: true, timestamp: cacheMetrics.timestamp };
  } catch (error) {
    logger.error("Error tracking cache performance:", error);
    logger.error("Error occurred:", error);
    throw error;
  }
});

// Health check endpoint
exports.healthCheck = onCall(async (_request) => {
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
      await db.collection("system").doc("health_check").set({
        test: true,
        timestamp: admin.firestore.Timestamp.now(),
      });
      checks.firestore = true;
    } catch (error) {
      logger.warn("Firestore health check failed:", error);
    }

    // Test Auth connectivity
    try {
      await admin.auth().listUsers(1);
      checks.auth = true;
    } catch (error) {
      logger.warn("Auth health check failed:", error);
    }

    // Test Storage connectivity
    try {
      const bucket = admin.storage().bucket();
      await bucket.exists();
      checks.storage = true;
    } catch (error) {
      logger.warn("Storage health check failed:", error);
    }

    const allHealthy = Object.values(checks)
      .filter((v) => typeof v === "boolean")
      .every(Boolean);

    return {
      status: allHealthy ? "healthy" : "degraded",
      checks,
      version: "1.0.0",
    };
  } catch (error) {
    logger.error("Health check failed:", error);
    logger.error("Error occurred:", error);
    return {
      status: "error",
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
      throw new Error("Authentication required");
    }

    const db = admin.firestore();

    // Update user's last activity
    await db
      .collection("users")
      .doc(auth.uid)
      .update({
        lastActiveAt: admin.firestore.Timestamp.now(),
        lastActivityType: data.activityType || "unknown",
      });

    // Track activity in system collection for analytics
    await db
      .collection("system")
      .collection("user_activity")
      .add({
        userId: auth.uid,
        activityType: data.activityType,
        metadata: data.metadata || {},
        timestamp: admin.firestore.Timestamp.now(),
      });

    return { success: true };
  } catch (error) {
    logger.error("Error tracking user activity:", error);
    logger.error("Error occurred:", error);
    throw error;
  }
});
