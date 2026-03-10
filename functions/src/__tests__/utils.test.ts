/**
 * Unit tests for Cloud Functions utility functions
 *
 * Tests the pure/extractable logic from the functions codebase:
 * - calculateDistance (Haversine formula)
 * - requireAuth (authentication validation)
 * - isAdminGroup / getAdminGroupConfig (M365 group matching)
 * - initializeWebPush (VAPID configuration)
 * - sendPushNotification (push delivery)
 * - getM365AccessToken (token acquisition)
 * - getUserM365Groups (group fetching)
 * - Constants (session timeouts, grace periods)
 */

// Mock firebase-functions before importing utils
jest.mock("firebase-functions", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("firebase-functions/v2/https", () => ({
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "HttpsError";
    }
  },
}));

jest.mock("web-push", () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

import {
  calculateDistance,
  requireAuth,
  isAdminGroup,
  getAdminGroupConfig,
  initializeWebPush,
  sendPushNotification,
  getM365AccessToken,
  getUserM365Groups,
  PRODUCTION_CONFIG,
  SESSION_LIMIT_MS,
  RECENTLY_CREATED_GRACE_MS,
  DEFAULT_ADMIN_GROUP_NAME,
  normalizeCanonicalName,
  locationMatchesGroup,
} from "../utils";

import * as webpush from "web-push";

// ============================================================================
// Constants
// ============================================================================

describe("Constants", () => {
  test("SESSION_LIMIT_MS equals 9 hours in milliseconds", () => {
    expect(SESSION_LIMIT_MS).toBe(9 * 60 * 60 * 1000); // 32,400,000
  });

  test("RECENTLY_CREATED_GRACE_MS equals 15 minutes in milliseconds", () => {
    expect(RECENTLY_CREATED_GRACE_MS).toBe(15 * 60 * 1000); // 900,000
  });

  test("PRODUCTION_CONFIG has expected session timeout", () => {
    expect(PRODUCTION_CONFIG.sessionTimeoutHours).toBe(9);
  });

  test("PRODUCTION_CONFIG has expected cleanup interval", () => {
    expect(PRODUCTION_CONFIG.cleanupIntervalHours).toBe(1);
  });

  test("PRODUCTION_CONFIG has expected max batch size", () => {
    expect(PRODUCTION_CONFIG.maxBatchSize).toBe(500);
  });

  test("DEFAULT_ADMIN_GROUP_NAME is DMDL Office", () => {
    expect(DEFAULT_ADMIN_GROUP_NAME).toBe("DMDL Office");
  });
});

// ============================================================================
// calculateDistance
// ============================================================================

describe("calculateDistance", () => {
  test("returns 0 for identical coordinates", () => {
    const distance = calculateDistance(34.0522, -118.2437, 34.0522, -118.2437);
    expect(distance).toBe(0);
  });

  test("calculates distance between two known points accurately", () => {
    // New York City to Los Angeles: ~3,944 km
    const distance = calculateDistance(
      40.7128, -74.006, // NYC
      34.0522, -118.2437 // LA
    );
    // Should be approximately 3,944 km (allow 5% tolerance)
    expect(distance).toBeGreaterThan(3_900_000);
    expect(distance).toBeLessThan(4_000_000);
  });

  test("calculates short distance (< 1km) accurately", () => {
    // Two points about 100m apart
    const distance = calculateDistance(
      34.0522, -118.2437,
      34.0531, -118.2437 // ~100m north
    );
    expect(distance).toBeGreaterThan(90);
    expect(distance).toBeLessThan(110);
  });

  test("calculates distance across the equator", () => {
    const distance = calculateDistance(1.0, 0, -1.0, 0);
    // 2 degrees of latitude ≈ 222 km
    expect(distance).toBeGreaterThan(220_000);
    expect(distance).toBeLessThan(224_000);
  });

  test("calculates distance across the prime meridian", () => {
    const distance = calculateDistance(0, -1.0, 0, 1.0);
    // 2 degrees of longitude at equator ≈ 222 km
    expect(distance).toBeGreaterThan(220_000);
    expect(distance).toBeLessThan(224_000);
  });

  test("is symmetric (A to B === B to A)", () => {
    const d1 = calculateDistance(40.7128, -74.006, 34.0522, -118.2437);
    const d2 = calculateDistance(34.0522, -118.2437, 40.7128, -74.006);
    expect(d1).toBeCloseTo(d2, 5);
  });

  test("handles geofence boundary distance (300m)", () => {
    // Point approximately 300m away from origin
    // At lat 34°N, 1 degree lat ≈ 111,045m, so 300m ≈ 0.002703°
    const distance = calculateDistance(
      34.0522, -118.2437,
      34.05490, -118.2437
    );
    expect(distance).toBeGreaterThan(280);
    expect(distance).toBeLessThan(320);
  });
});

// ============================================================================
// requireAuth
// ============================================================================

describe("requireAuth", () => {
  test("returns uid and email from auth token", () => {
    const request = {
      auth: { uid: "user-123", token: { email: "user@example.com" } },
      data: {},
    };
    const result = requireAuth(request);
    expect(result).toEqual({ uid: "user-123", email: "user@example.com" });
  });

  test("throws HttpsError when auth is missing", () => {
    const request = { auth: null, data: {} };
    expect(() => requireAuth(request)).toThrow("Authentication required");
  });

  test("throws HttpsError when auth is undefined", () => {
    const request = { data: {} };
    expect(() => requireAuth(request)).toThrow("Authentication required");
  });

  test("prefers email from data over auth token", () => {
    const request = {
      auth: { uid: "user-123", token: { email: "token@example.com" } },
      data: { email: "data@example.com" },
    };
    const result = requireAuth(request);
    expect(result.email).toBe("data@example.com");
  });

  test("trims email from data", () => {
    const request = {
      auth: { uid: "user-123", token: { email: "token@example.com" } },
      data: { email: "  spaced@example.com  " },
    };
    const result = requireAuth(request);
    expect(result.email).toBe("spaced@example.com");
  });

  test("falls back to auth token email when data.email is not a string", () => {
    const request = {
      auth: { uid: "user-123", token: { email: "token@example.com" } },
      data: { email: 123 }, // not a string
    };
    const result = requireAuth(request);
    expect(result.email).toBe("token@example.com");
  });

  test("throws when neither data nor auth token has email", () => {
    const request = {
      auth: { uid: "user-123", token: {} },
      data: {},
    };
    expect(() => requireAuth(request)).toThrow(
      "User email not available in authentication token"
    );
  });

  test("ignores empty string email in data", () => {
    const request = {
      auth: { uid: "user-123", token: { email: "token@example.com" } },
      data: { email: "   " }, // whitespace-only
    };
    // After trim, "   " becomes "", which is falsy, so it falls through to token email
    const result = requireAuth(request);
    expect(result.email).toBe("token@example.com");
  });
});

// ============================================================================
// getAdminGroupConfig / isAdminGroup
// ============================================================================

describe("getAdminGroupConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("returns default admin group name when env vars not set", () => {
    delete process.env.DMDL_OFFICE_GROUP_ID;
    delete process.env.DMDL_OFFICE_GROUP_NAME;
    const config = getAdminGroupConfig();
    expect(config.adminGroupId).toBeUndefined();
    expect(config.adminGroupName).toBe("dmdl office");
  });

  test("returns group ID from env var (lowercased)", () => {
    process.env.DMDL_OFFICE_GROUP_ID = "ABC-123-DEF";
    const config = getAdminGroupConfig();
    expect(config.adminGroupId).toBe("abc-123-def");
  });

  test("returns custom group name from env var (lowercased)", () => {
    process.env.DMDL_OFFICE_GROUP_NAME = "Custom Admin Group";
    const config = getAdminGroupConfig();
    expect(config.adminGroupName).toBe("custom admin group");
  });
});

describe("isAdminGroup", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.DMDL_OFFICE_GROUP_ID;
    delete process.env.DMDL_OFFICE_GROUP_NAME;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("matches admin group by default name (case-insensitive)", () => {
    expect(
      isAdminGroup({ id: "some-id", displayName: "DMDL Office" })
    ).toBe(true);
    expect(
      isAdminGroup({ id: "some-id", displayName: "dmdl office" })
    ).toBe(true);
    expect(
      isAdminGroup({ id: "some-id", displayName: "DMDL OFFICE" })
    ).toBe(true);
  });

  test("does not match non-admin groups", () => {
    expect(
      isAdminGroup({ id: "some-id", displayName: "Springfield Elementary" })
    ).toBe(false);
    expect(
      isAdminGroup({ id: "some-id", displayName: "Other Group" })
    ).toBe(false);
  });

  test("matches admin group by ID when configured", () => {
    process.env.DMDL_OFFICE_GROUP_ID = "admin-group-uuid";
    expect(
      isAdminGroup({ id: "admin-group-uuid", displayName: "Any Name" })
    ).toBe(true);
  });

  test("matches admin group by ID case-insensitively", () => {
    process.env.DMDL_OFFICE_GROUP_ID = "Admin-Group-UUID";
    expect(
      isAdminGroup({ id: "admin-group-uuid", displayName: "Any Name" })
    ).toBe(true);
  });

  test("matches by custom group name when configured", () => {
    process.env.DMDL_OFFICE_GROUP_NAME = "My Admin Team";
    expect(
      isAdminGroup({ id: "some-id", displayName: "My Admin Team" })
    ).toBe(true);
    // Default name should no longer match
    expect(
      isAdminGroup({ id: "some-id", displayName: "DMDL Office" })
    ).toBe(false);
  });

  test("handles group with empty displayName", () => {
    expect(isAdminGroup({ id: "some-id", displayName: "" })).toBe(false);
  });
});

// ============================================================================
// normalizeCanonicalName (M365 group-to-location matching)
// ============================================================================

describe("normalizeCanonicalName", () => {
  test("lowercases and trims", () => {
    expect(normalizeCanonicalName("  HOPE Excel  ")).toBe("hope excel");
  });

  test("collapses multiple spaces", () => {
    expect(normalizeCanonicalName("St   Sabina   Academy")).toBe(
      "st sabina academy"
    );
  });

  test("strips punctuation: period, comma, hyphen, apostrophe, parens", () => {
    expect(normalizeCanonicalName("St. Sabina")).toBe("st sabina");
    expect(normalizeCanonicalName("HOPE Excel Academy")).toBe(
      "hope excel academy"
    );
    expect(normalizeCanonicalName("School (Main)")).toBe("school main");
    expect(normalizeCanonicalName("O'Brien")).toBe("obrien");
  });

  test("St. Sabina vs St Sabina normalize to same string", () => {
    expect(normalizeCanonicalName("St. Sabina")).toBe(normalizeCanonicalName("St Sabina"));
    expect(normalizeCanonicalName("St. Sabina")).toBe("st sabina");
  });

  test("returns empty string for non-string input", () => {
    expect(normalizeCanonicalName("")).toBe("");
    expect(normalizeCanonicalName(null as any)).toBe("");
    expect(normalizeCanonicalName(undefined as any)).toBe("");
  });
});

// ============================================================================
// locationMatchesGroup (M365 group-to-location matching)
// ============================================================================

describe("locationMatchesGroup", () => {
  test("matches by primary name (case-insensitive, canonical)", () => {
    const loc = { id: "loc1", name: "St. Sabina Academy" };
    expect(locationMatchesGroup(loc, "St Sabina Academy")).toEqual({
      match: true,
      matchedBy: "name",
    });
    expect(locationMatchesGroup(loc, "st. sabina academy")).toEqual({
      match: true,
      matchedBy: "name",
    });
  });

  test("matches by groupAliases when group name differs from location name", () => {
    const loc = {
      id: "hope-id",
      name: "HOPE Excel Academy",
      groupAliases: ["HOPE Excel"],
    };
    expect(locationMatchesGroup(loc, "HOPE Excel")).toEqual({
      match: true,
      matchedBy: "alias",
    });
    expect(locationMatchesGroup(loc, "HOPE Excel Academy")).toEqual({
      match: true,
      matchedBy: "name",
    });
  });

  test("does not match similar but incorrect names (false-positive prevention)", () => {
    const loc = { id: "loc1", name: "Springfield Elementary" };
    expect(locationMatchesGroup(loc, "Springfield High")).toEqual({
      match: false,
    });
    expect(locationMatchesGroup(loc, "Springfield")).toEqual({ match: false });
    expect(locationMatchesGroup(loc, "Elementary")).toEqual({ match: false });
  });

  test("returns match: false for empty group name", () => {
    const loc = { id: "loc1", name: "Test School" };
    expect(locationMatchesGroup(loc, "")).toEqual({ match: false });
  });

  test("handles missing or empty groupAliases", () => {
    const loc = { id: "loc1", name: "Test School" };
    expect(locationMatchesGroup(loc, "Test School")).toEqual({
      match: true,
      matchedBy: "name",
    });
    expect(locationMatchesGroup({ ...loc, groupAliases: [] }, "Test School")).toEqual({
      match: true,
      matchedBy: "name",
    });
  });
});

// ============================================================================
// initializeWebPush
// ============================================================================

describe("initializeWebPush", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("returns false when VAPID keys are not configured", () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    process.env.VAPID_EMAIL = "test@example.com";
    expect(initializeWebPush()).toBe(false);
  });

  test("falls back to default mailto when VAPID_EMAIL is empty", () => {
    process.env.VAPID_PUBLIC_KEY = "pub-key";
    process.env.VAPID_PRIVATE_KEY = "priv-key";
    process.env.VAPID_EMAIL = "";

    (webpush.setVapidDetails as jest.Mock).mockImplementation(() => {});
    expect(initializeWebPush()).toBe(true);
    // Empty string is falsy, so the default "mailto:admin@..." kicks in
    expect(webpush.setVapidDetails).toHaveBeenCalledWith(
      "mailto:admin@schools-in-check.web.app",
      "pub-key",
      "priv-key"
    );
  });

  test("returns false when VAPID email is not valid URL or email", () => {
    process.env.VAPID_PUBLIC_KEY = "pub-key";
    process.env.VAPID_PRIVATE_KEY = "priv-key";
    process.env.VAPID_EMAIL = "not-an-email";
    expect(initializeWebPush()).toBe(false);
  });

  test("prepends mailto: to plain email address", () => {
    process.env.VAPID_PUBLIC_KEY = "pub-key";
    process.env.VAPID_PRIVATE_KEY = "priv-key";
    process.env.VAPID_EMAIL = "admin@example.com";

    (webpush.setVapidDetails as jest.Mock).mockImplementation(() => {});
    initializeWebPush();

    expect(webpush.setVapidDetails).toHaveBeenCalledWith(
      "mailto:admin@example.com",
      "pub-key",
      "priv-key"
    );
  });

  test("accepts mailto: prefixed email as-is", () => {
    process.env.VAPID_PUBLIC_KEY = "pub-key";
    process.env.VAPID_PRIVATE_KEY = "priv-key";
    process.env.VAPID_EMAIL = "mailto:admin@example.com";

    (webpush.setVapidDetails as jest.Mock).mockImplementation(() => {});
    initializeWebPush();

    expect(webpush.setVapidDetails).toHaveBeenCalledWith(
      "mailto:admin@example.com",
      "pub-key",
      "priv-key"
    );
  });

  test("accepts https: prefixed URL as-is", () => {
    process.env.VAPID_PUBLIC_KEY = "pub-key";
    process.env.VAPID_PRIVATE_KEY = "priv-key";
    process.env.VAPID_EMAIL = "https://example.com/contact";

    (webpush.setVapidDetails as jest.Mock).mockImplementation(() => {});
    initializeWebPush();

    expect(webpush.setVapidDetails).toHaveBeenCalledWith(
      "https://example.com/contact",
      "pub-key",
      "priv-key"
    );
  });

  test("returns true on successful configuration", () => {
    process.env.VAPID_PUBLIC_KEY = "pub-key";
    process.env.VAPID_PRIVATE_KEY = "priv-key";
    process.env.VAPID_EMAIL = "mailto:admin@example.com";

    (webpush.setVapidDetails as jest.Mock).mockImplementation(() => {});
    expect(initializeWebPush()).toBe(true);
  });

  test("returns false when setVapidDetails throws", () => {
    process.env.VAPID_PUBLIC_KEY = "bad-key";
    process.env.VAPID_PRIVATE_KEY = "bad-key";
    process.env.VAPID_EMAIL = "mailto:admin@example.com";

    (webpush.setVapidDetails as jest.Mock).mockImplementation(() => {
      throw new Error("Invalid VAPID key");
    });
    expect(initializeWebPush()).toBe(false);
  });
});

// ============================================================================
// sendPushNotification
// ============================================================================

describe("sendPushNotification", () => {
  const mockSubscription = {
    endpoint: "https://push.example.com/sub-123",
    expirationTime: null,
    keys: { p256dh: "p256dh-key", auth: "auth-key" },
    platform: "web",
    userAgent: "Chrome",
  };

  test("returns true on successful send", async () => {
    (webpush.sendNotification as jest.Mock).mockResolvedValue({});
    const result = await sendPushNotification(mockSubscription, {
      title: "Test",
      body: "Test body",
    });
    expect(result).toBe(true);
  });

  test("sends correct payload structure", async () => {
    (webpush.sendNotification as jest.Mock).mockResolvedValue({});
    await sendPushNotification(mockSubscription, {
      title: "Hello",
      body: "World",
      data: { type: "test" },
    });

    expect(webpush.sendNotification).toHaveBeenCalledWith(
      {
        endpoint: "https://push.example.com/sub-123",
        keys: { p256dh: "p256dh-key", auth: "auth-key" },
      },
      expect.any(String)
    );

    const payload = JSON.parse(
      (webpush.sendNotification as jest.Mock).mock.calls[0][1]
    );
    expect(payload.title).toBe("Hello");
    expect(payload.body).toBe("World");
    expect(payload.data).toEqual({ type: "test" });
    expect(payload.icon).toBe("/icons/icon-192x192.png");
    expect(payload.requireInteraction).toBe(true);
  });

  test("returns false for expired subscription (410)", async () => {
    (webpush.sendNotification as jest.Mock).mockRejectedValue({
      statusCode: 410,
    });
    const result = await sendPushNotification(mockSubscription, {
      title: "Test",
      body: "Test",
    });
    expect(result).toBe(false);
  });

  test("returns false for not-found subscription (404)", async () => {
    (webpush.sendNotification as jest.Mock).mockRejectedValue({
      statusCode: 404,
    });
    const result = await sendPushNotification(mockSubscription, {
      title: "Test",
      body: "Test",
    });
    expect(result).toBe(false);
  });

  test("returns false for other errors", async () => {
    (webpush.sendNotification as jest.Mock).mockRejectedValue(
      new Error("Network error")
    );
    const result = await sendPushNotification(mockSubscription, {
      title: "Test",
      body: "Test",
    });
    expect(result).toBe(false);
  });

  test("defaults data to empty object when not provided", async () => {
    (webpush.sendNotification as jest.Mock).mockResolvedValue({});
    await sendPushNotification(mockSubscription, {
      title: "Test",
      body: "Test",
    });

    const payload = JSON.parse(
      (webpush.sendNotification as jest.Mock).mock.calls[0][1]
    );
    expect(payload.data).toEqual({});
  });
});

// ============================================================================
// getM365AccessToken
// ============================================================================

describe("getM365AccessToken", () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.MS_TENANT_ID = "tenant-123";
    process.env.MS_CLIENT_ID = "client-456";
    process.env.MS_CLIENT_SECRET = "secret-789";
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  test("throws when MS_TENANT_ID is missing", async () => {
    delete process.env.MS_TENANT_ID;
    await expect(getM365AccessToken()).rejects.toThrow(
      "Microsoft 365 configuration missing"
    );
  });

  test("throws when MS_CLIENT_ID is missing", async () => {
    delete process.env.MS_CLIENT_ID;
    await expect(getM365AccessToken()).rejects.toThrow(
      "Microsoft 365 configuration missing"
    );
  });

  test("throws when MS_CLIENT_SECRET is missing", async () => {
    delete process.env.MS_CLIENT_SECRET;
    await expect(getM365AccessToken()).rejects.toThrow(
      "Microsoft 365 configuration missing"
    );
  });

  test("returns access token on successful response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "mock-token-abc" }),
    });

    const token = await getM365AccessToken();
    expect(token).toBe("mock-token-abc");
  });

  test("sends correct request to Microsoft token endpoint", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "token" }),
    });

    await getM365AccessToken();

    expect(global.fetch).toHaveBeenCalledWith(
      "https://login.microsoftonline.com/tenant-123/oauth2/v2.0/token",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      })
    );

    // Verify body contains correct params
    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    const body = callArgs[1].body;
    expect(body).toContain("client_id=client-456");
    expect(body).toContain("client_secret=secret-789");
    expect(body).toContain("grant_type=client_credentials");
  });

  test("throws on non-OK response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    await expect(getM365AccessToken()).rejects.toThrow(
      "Failed to acquire M365 access token: 401"
    );
  });
});

// ============================================================================
// getUserM365Groups
// ============================================================================

describe("getUserM365Groups", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("returns groups from a single page", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        value: [
          {
            "@odata.type": "#microsoft.graph.group",
            id: "group-1",
            displayName: "Springfield Elementary",
          },
          {
            "@odata.type": "#microsoft.graph.group",
            id: "group-2",
            displayName: "DMDL Office",
          },
        ],
      }),
    });

    const groups = await getUserM365Groups("token", "user@example.com");
    expect(groups).toHaveLength(2);
    expect(groups[0]).toEqual({
      id: "group-1",
      displayName: "Springfield Elementary",
    });
    expect(groups[1]).toEqual({ id: "group-2", displayName: "DMDL Office" });
  });

  test("filters out non-group directory objects", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        value: [
          {
            "@odata.type": "#microsoft.graph.group",
            id: "group-1",
            displayName: "Valid Group",
          },
          {
            "@odata.type": "#microsoft.graph.directoryRole",
            id: "role-1",
            displayName: "Global Admin",
          },
          {
            "@odata.type": "#microsoft.graph.group",
            id: "group-2",
            displayName: "", // Empty display name
          },
        ],
      }),
    });

    const groups = await getUserM365Groups("token", "user@example.com");
    expect(groups).toHaveLength(1);
    expect(groups[0].displayName).toBe("Valid Group");
  });

  test("handles pagination with @odata.nextLink", async () => {
    (global.fetch as jest.Mock) = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            {
              "@odata.type": "#microsoft.graph.group",
              id: "g1",
              displayName: "Group 1",
            },
          ],
          "@odata.nextLink": "https://graph.microsoft.com/next-page",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            {
              "@odata.type": "#microsoft.graph.group",
              id: "g2",
              displayName: "Group 2",
            },
          ],
        }),
      });

    const groups = await getUserM365Groups("token", "user@example.com");
    expect(groups).toHaveLength(2);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("throws on non-OK response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
    });

    await expect(
      getUserM365Groups("token", "user@example.com")
    ).rejects.toThrow("Failed to fetch user groups: 403");
  });

  test("returns empty array when no groups", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ value: [] }),
    });

    const groups = await getUserM365Groups("token", "user@example.com");
    expect(groups).toHaveLength(0);
  });

  test("encodes user email in URL", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ value: [] }),
    });

    await getUserM365Groups("token", "user+special@example.com");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("user%2Bspecial%40example.com"),
      expect.any(Object)
    );
  });

  test("sends authorization header with token", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ value: [] }),
    });

    await getUserM365Groups("my-access-token", "user@example.com");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer my-access-token",
        }),
      })
    );
  });
});
