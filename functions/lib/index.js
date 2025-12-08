"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const firebase_functions_1 = require("firebase-functions");
const admin = __importStar(require("firebase-admin"));
const nodemailer = __importStar(require("nodemailer"));
admin.initializeApp();
/**
 * Acquire an app-only access token from Microsoft Identity Platform
 * using client credentials flow
 */
async function getM365AccessToken() {
    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    if (!tenantId || !clientId || !clientSecret) {
        throw new Error("Microsoft 365 configuration missing. Ensure MS_TENANT_ID, MS_CLIENT_ID, and MS_CLIENT_SECRET are set.");
    }
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
    });
    const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
    });
    if (!response.ok) {
        const errorText = await response.text();
        firebase_functions_1.logger.error("Failed to acquire M365 access token:", errorText);
        throw new Error(`Failed to acquire M365 access token: ${response.status}`);
    }
    const data = await response.json();
    return data.access_token;
}
/**
 * Fetch all groups a user is a member of from Microsoft Graph
 */
async function getUserM365Groups(accessToken, userEmail) {
    const groups = [];
    // Use the user's email (UPN) to query their group membership
    let url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userEmail)}/memberOf?$select=id,displayName&$top=100`;
    while (url) {
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
        });
        if (!response.ok) {
            const errorText = await response.text();
            firebase_functions_1.logger.error(`Failed to fetch user groups for ${userEmail}:`, errorText);
            throw new Error(`Failed to fetch user groups: ${response.status}`);
        }
        const data = await response.json();
        // Filter to only include groups (not other directory objects like roles)
        for (const item of data.value || []) {
            if (item["@odata.type"] === "#microsoft.graph.group" &&
                item.displayName) {
                groups.push({
                    id: item.id,
                    displayName: item.displayName,
                });
            }
        }
        // Handle pagination
        url = data["@odata.nextLink"] || null;
    }
    return groups;
}
/**
 * Sync user role and school assignments from Microsoft 365 groups
 *
 * This callable function:
 * 1. Fetches the user's M365 group memberships
 * 2. Determines if user is admin (member of DMDL Office) or provider
 * 3. Matches school groups to Firestore locations by exact name match
 * 4. Updates the user's role in Firestore
 * 5. Updates locations.assignedProviders for matched schools
 * 6. Removes user from locations they're no longer assigned to
 */
exports.syncUserFromM365 = (0, https_1.onCall)({
    secrets: ["MS_TENANT_ID", "MS_CLIENT_ID", "MS_CLIENT_SECRET"],
}, async (request) => {
    const { auth } = request;
    // Require authentication
    if (!auth) {
        throw new Error("Authentication required");
    }
    const userId = auth.uid;
    const userEmail = auth.token.email;
    if (!userEmail) {
        throw new Error("User email not available in authentication token");
    }
    firebase_functions_1.logger.info(`Starting M365 sync for user: ${userEmail} (${userId})`);
    try {
        // Step 1: Get M365 access token
        const accessToken = await getM365AccessToken();
        // Step 2: Fetch user's group memberships
        const userGroups = await getUserM365Groups(accessToken, userEmail);
        const groupNames = userGroups.map((g) => g.displayName);
        firebase_functions_1.logger.info(`User ${userEmail} is member of ${userGroups.length} groups:`, groupNames);
        // Step 3: Determine role based on DMDL Office membership
        const adminGroupName = process.env.DMDL_OFFICE_GROUP_NAME || "DMDL Office";
        const isAdmin = userGroups.some((g) => g.displayName.toLowerCase() === adminGroupName.toLowerCase());
        const role = isAdmin ? "admin" : "provider";
        firebase_functions_1.logger.info(`User ${userEmail} role determined: ${role}`);
        // Step 4: Update user document with role
        const db = admin.firestore();
        const userRef = db.collection("users").doc(userId);
        await userRef.update({
            role: role,
            updatedAt: admin.firestore.Timestamp.now(),
        });
        // Step 5: Match groups to Firestore locations (for providers only)
        // Admins don't need school assignments as they have access to all
        const assignedLocations = [];
        const removedLocations = [];
        if (role === "provider") {
            // Get all active locations from Firestore
            const locationsSnapshot = await db
                .collection("locations")
                .where("active", "==", true)
                .get();
            const allLocations = locationsSnapshot.docs.map((doc) => ({
                id: doc.id,
                name: doc.data().name,
                assignedProviders: (doc.data().assignedProviders || []),
            }));
            // Filter out admin group from matching
            const schoolGroupNames = groupNames.filter((name) => name.toLowerCase() !== adminGroupName.toLowerCase());
            // Find locations that match user's school groups (exact name match)
            const matchedLocations = allLocations.filter((loc) => schoolGroupNames.some((groupName) => groupName.toLowerCase() === loc.name.toLowerCase()));
            const matchedLocationIds = new Set(matchedLocations.map((l) => l.id));
            // Find locations user is currently assigned to
            const currentlyAssignedLocations = allLocations.filter((loc) => loc.assignedProviders.includes(userId));
            // Add user to newly matched locations
            for (const location of matchedLocations) {
                if (!location.assignedProviders.includes(userId)) {
                    await db
                        .collection("locations")
                        .doc(location.id)
                        .update({
                        assignedProviders: admin.firestore.FieldValue.arrayUnion(userId),
                        updatedAt: admin.firestore.Timestamp.now(),
                    });
                    firebase_functions_1.logger.info(`Added user ${userId} to location: ${location.name}`);
                }
                assignedLocations.push({ id: location.id, name: location.name });
            }
            // Remove user from locations they're no longer in groups for
            for (const location of currentlyAssignedLocations) {
                if (!matchedLocationIds.has(location.id)) {
                    await db
                        .collection("locations")
                        .doc(location.id)
                        .update({
                        assignedProviders: admin.firestore.FieldValue.arrayRemove(userId),
                        updatedAt: admin.firestore.Timestamp.now(),
                    });
                    firebase_functions_1.logger.info(`Removed user ${userId} from location: ${location.name}`);
                    removedLocations.push({ id: location.id, name: location.name });
                }
            }
        }
        const result = {
            role,
            assignedLocations,
            removedLocations,
            groupsFound: groupNames,
        };
        firebase_functions_1.logger.info(`M365 sync completed for user ${userEmail}:`, result);
        return result;
    }
    catch (error) {
        firebase_functions_1.logger.error(`M365 sync failed for user ${userEmail}:`, error);
        throw new Error(`Failed to sync user from Microsoft 365: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
});
// Production configuration
const _PRODUCTION_CONFIG = {
    sessionTimeoutHours: 2,
    cleanupIntervalHours: 1,
    maxBatchSize: 500,
    performanceThresholds: {
        queryTimeMs: 1000,
        batchTimeMs: 5000,
    },
};
const sessionLimitInMs = _PRODUCTION_CONFIG.sessionTimeoutHours * 60 * 60 * 1000;
// Callable function to start a session with atomic checks
exports.startSession = (0, https_1.onCall)(async (request) => {
    try {
        const { data, auth } = request;
        // Authentication check
        if (!auth) {
            throw new Error("Authentication required");
        }
        // Validate input data
        if (!data ||
            !data.locationId ||
            !data.startTime ||
            !data.checkInMethod ||
            !data.distanceFromCenterAtCheckIn ||
            !data.dayKey) {
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
            if (userData.role !== "provider") {
                throw new Error("Only providers can start sessions");
            }
            if (userData.isActive === false || userData.disabled === true) {
                throw new Error("User account is not active");
            }
            // Check for existing active or paused sessions for this provider
            const existingSessionsQuery = db
                .collection("sessions")
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
            if (!locationData.assignedProviders ||
                !locationData.assignedProviders.includes(userId)) {
                throw new Error("Provider is not assigned to this location");
            }
            // Create the new session document
            const sessionData = {
                id: null, // Will be set after creation
                userId: userId,
                locationId: data.locationId,
                startTime: admin.firestore.Timestamp.fromDate(new Date(data.startTime)),
                checkInTime: admin.firestore.Timestamp.fromDate(new Date(data.startTime)),
                endTime: null,
                status: "active",
                active: true,
                checkInMethod: data.checkInMethod,
                distanceFromCenterAtCheckIn: data.distanceFromCenterAtCheckIn,
                dayKey: data.dayKey,
                notes: data.notes || "",
                createdAt: admin.firestore.Timestamp.now(),
                updatedAt: admin.firestore.Timestamp.now(),
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
                lastActiveAt: admin.firestore.Timestamp.now(),
            });
            return {
                sessionId: sessionRef.id,
                sessionData: sessionData,
            };
        });
        firebase_functions_1.logger.info(`Session started successfully for user ${userId}: ${result.sessionId}`);
        return {
            success: true,
            sessionId: result.sessionId,
            session: result.sessionData,
        };
    }
    catch (error) {
        firebase_functions_1.logger.error("Error starting session:", error);
        // Return user-friendly error messages
        if (error instanceof Error) {
            if (error.message.includes("already has an")) {
                throw new Error("You already have an active session. Please end your current session before starting a new one.");
            }
            else if (error.message.includes("not assigned")) {
                throw new Error("You are not authorized to check in at this location.");
            }
            else if (error.message.includes("not active")) {
                throw new Error("This location is currently unavailable for check-in.");
            }
            else if (error.message.includes("User not found")) {
                throw new Error("User account not found. Please contact support.");
            }
            else if (error.message.includes("Only providers")) {
                throw new Error("Only provider accounts can start sessions.");
            }
            else if (error.message.includes("Missing required")) {
                throw new Error("Invalid session data provided.");
            }
        }
        throw new Error("Failed to start session. Please try again.");
    }
});
exports.cleanupStaleSessions = (0, scheduler_1.onSchedule)("every 15 minutes", async (_event) => {
    try {
        const db = admin.firestore();
        const sessionsRef = db.collection("sessions");
        const now = admin.firestore.Timestamp.now();
        const cutoff = admin.firestore.Timestamp.fromMillis(now.toMillis() - sessionLimitInMs);
        const staleSessionsQuery = sessionsRef
            .where("status", "in", ["active", "paused"])
            .where("checkInTime", "<", cutoff)
            .limit(_PRODUCTION_CONFIG.maxBatchSize);
        const staleSessionsSnapshot = await staleSessionsQuery.get();
        if (staleSessionsSnapshot.empty) {
            firebase_functions_1.logger.info("No stale sessions found.");
            return;
        }
        const batch = db.batch();
        const durationMinutes = Math.floor(sessionLimitInMs / 60000);
        const updateTime = admin.firestore.Timestamp.now();
        staleSessionsSnapshot.forEach((doc) => {
            firebase_functions_1.logger.info(`Found stale session: ${doc.id}`);
            const sessionRef = sessionsRef.doc(doc.id);
            batch.update(sessionRef, {
                status: "error",
                active: false, // Ensures legacy listener drops the session
                endTime: cutoff, // Primary end time field
                checkOutTime: cutoff, // Legacy compatibility
                durationMinutes: durationMinutes, // Max duration in minutes
                notes: "Session automatically closed due to timeout.",
                updatedAt: updateTime, // Track update time
            });
        });
        await batch.commit();
        firebase_functions_1.logger.info(`Cleaned up ${staleSessionsSnapshot.size} stale sessions.`);
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
    }
    catch (error) {
        firebase_functions_1.logger.error("Error cleaning up stale sessions:", error);
        firebase_functions_1.logger.error("Error occurred:", error);
        throw error; // Re-throw for proper error tracking
    }
});
// Daily statistics aggregation
exports.generateDailyStats = (0, scheduler_1.onSchedule)("every day 02:00", async (_event) => {
    try {
        const db = admin.firestore();
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const startOfDay = admin.firestore.Timestamp.fromDate(new Date(yesterday.setHours(0, 0, 0, 0)));
        const endOfDay = admin.firestore.Timestamp.fromDate(new Date(yesterday.setHours(23, 59, 59, 999)));
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
        firebase_functions_1.logger.info("Daily statistics generated:", sessionStats);
    }
    catch (error) {
        firebase_functions_1.logger.error("Error generating daily statistics:", error);
        firebase_functions_1.logger.error("Error occurred:", error);
        throw error;
    }
});
// Cache performance monitoring
exports.trackCachePerformance = (0, https_1.onCall)(async (request) => {
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
    }
    catch (error) {
        firebase_functions_1.logger.error("Error tracking cache performance:", error);
        firebase_functions_1.logger.error("Error occurred:", error);
        throw error;
    }
});
// Health check endpoint
exports.healthCheck = (0, https_1.onCall)(async (_request) => {
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
        }
        catch (error) {
            firebase_functions_1.logger.warn("Firestore health check failed:", error);
        }
        // Test Auth connectivity
        try {
            await admin.auth().listUsers(1);
            checks.auth = true;
        }
        catch (error) {
            firebase_functions_1.logger.warn("Auth health check failed:", error);
        }
        // Test Storage connectivity
        try {
            const bucket = admin.storage().bucket();
            await bucket.exists();
            checks.storage = true;
        }
        catch (error) {
            firebase_functions_1.logger.warn("Storage health check failed:", error);
        }
        const allHealthy = Object.values(checks)
            .filter((v) => typeof v === "boolean")
            .every(Boolean);
        return {
            status: allHealthy ? "healthy" : "degraded",
            checks,
            version: "1.0.0",
        };
    }
    catch (error) {
        firebase_functions_1.logger.error("Health check failed:", error);
        firebase_functions_1.logger.error("Error occurred:", error);
        return {
            status: "error",
            error: error.message,
            timestamp: admin.firestore.Timestamp.now(),
        };
    }
});
// User activity tracking
exports.trackUserActivity = (0, https_1.onCall)(async (request) => {
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
            .doc("analytics")
            .collection("user_activity")
            .add({
            userId: auth.uid,
            activityType: data.activityType,
            metadata: data.metadata || {},
            timestamp: admin.firestore.Timestamp.now(),
        });
        return { success: true };
    }
    catch (error) {
        firebase_functions_1.logger.error("Error tracking user activity:", error);
        firebase_functions_1.logger.error("Error occurred:", error);
        throw error;
    }
});
// Notify on new feedback
exports.notifyOnFeedback = (0, firestore_1.onDocumentCreated)("feedback/{feedbackId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        firebase_functions_1.logger.warn("Feedback snapshot is null, skipping notification");
        return;
    }
    const feedback = snapshot.data();
    const feedbackId = event.params.feedbackId;
    firebase_functions_1.logger.info(`New feedback received: ${feedbackId}`, feedback);
    // Get configuration from environment variables
    const adminEmail = process.env.ADMIN_EMAIL || "admin@schools-in-check.web.app";
    const baseUrl = process.env.BASE_URL || "https://schools-in-check.web.app";
    // Email configuration - supports multiple providers
    const emailConfig = {
        // Option 1: SendGrid (recommended for production)
        sendGridApiKey: process.env.SENDGRID_API_KEY,
        // Option 2: SMTP (Gmail, custom SMTP server)
        smtpHost: process.env.SMTP_HOST,
        smtpPort: parseInt(process.env.SMTP_PORT || "587"),
        smtpUser: process.env.SMTP_USER,
        smtpPassword: process.env.SMTP_PASSWORD,
        smtpFrom: process.env.SMTP_FROM || adminEmail,
    };
    const emailSubject = `New Feedback: ${feedback.category} - ${feedback.severity}`;
    const feedbackUrl = `${baseUrl}/admin/feedback/${feedbackId}`;
    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .footer { background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; 
          border-radius: 0 0 5px 5px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; 
          text-decoration: none; border-radius: 5px; margin-top: 15px; }
        .info-row { margin: 10px 0; }
        .label { font-weight: bold; color: #374151; }
        .description { background-color: white; padding: 15px; border-left: 4px solid #4F46E5; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>New Feedback Received</h2>
        </div>
        <div class="content">
          <div class="info-row">
            <span class="label">From:</span> ${feedback.providerName || "Unknown"} 
            (${feedback.providerEmail || "No email"})
          </div>
          <div class="info-row">
            <span class="label">Category:</span> ${feedback.category}
          </div>
          <div class="info-row">
            <span class="label">Severity:</span> ${feedback.severity}
          </div>
          ${feedback.url ?
        `<div class="info-row"><span class="label">URL:</span> ${feedback.url}</div>` :
        ""}
          <div class="description">
            <strong>Description:</strong><br>
            ${feedback.description.replace(/\n/g, "<br>")}
          </div>
          <a href="${feedbackUrl}" class="button">View in Admin Console</a>
        </div>
        <div class="footer">
          <p>This is an automated notification from Schools-In Feedback System</p>
        </div>
      </div>
    </body>
    </html>
  `;
    const emailText = `
New feedback received from ${feedback.providerName || "Unknown"} (${feedback.providerEmail || "No email"}).

Category: ${feedback.category}
Severity: ${feedback.severity}
${feedback.url ? `URL: ${feedback.url}\n` : ""}
Description:
${feedback.description}

View in Admin Console: ${feedbackUrl}
  `.trim();
    try {
        // Use SendGrid SMTP if API key is configured (SendGrid SMTP relay)
        if (emailConfig.sendGridApiKey) {
            // const nodemailer = require("nodemailer"); // Imported at top
            const transporter = nodemailer.createTransport({
                host: "smtp.sendgrid.net",
                port: 587,
                secure: false,
                auth: {
                    user: "apikey",
                    pass: emailConfig.sendGridApiKey,
                },
            });
            await transporter.sendMail({
                from: emailConfig.smtpFrom,
                to: adminEmail,
                subject: emailSubject,
                text: emailText,
                html: emailHtml,
            });
            firebase_functions_1.logger.info(`Email sent via SendGrid SMTP to ${adminEmail} for feedback ${feedbackId}`);
            return;
        }
        // Fallback to custom SMTP if configured
        if (emailConfig.smtpHost &&
            emailConfig.smtpUser &&
            emailConfig.smtpPassword) {
            // const nodemailer = require("nodemailer"); // Imported at top
            const transporter = nodemailer.createTransport({
                host: emailConfig.smtpHost,
                port: emailConfig.smtpPort,
                secure: emailConfig.smtpPort === 465,
                auth: {
                    user: emailConfig.smtpUser,
                    pass: emailConfig.smtpPassword,
                },
            });
            await transporter.sendMail({
                from: emailConfig.smtpFrom,
                to: adminEmail,
                subject: emailSubject,
                text: emailText,
                html: emailHtml,
            });
            firebase_functions_1.logger.info(`Email sent via SMTP to ${adminEmail} for feedback ${feedbackId}`);
            return;
        }
        // If no email provider is configured, log the email payload
        firebase_functions_1.logger.warn("No email provider configured. Email notification not sent.", {
            to: adminEmail,
            subject: emailSubject,
            feedbackId,
        });
        // Log the email payload for manual sending or debugging
        firebase_functions_1.logger.info("Email notification payload (not sent):", {
            to: adminEmail,
            subject: emailSubject,
            text: emailText,
            html: emailHtml,
        });
    }
    catch (error) {
        firebase_functions_1.logger.error("Error sending feedback notification email:", error);
        // Don't throw - we don't want to fail the feedback creation if email fails
        // The feedback is already saved, email is just a notification
    }
});
//# sourceMappingURL=index.js.map