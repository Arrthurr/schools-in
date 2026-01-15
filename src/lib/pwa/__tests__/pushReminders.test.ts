import {
  getPushPermissionState,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  savePushSubscriptionToFirebase,
  removePushSubscriptionFromFirebase,
  saveAdminAlertSubscriptionToFirebase,
  removeAdminAlertSubscriptionFromFirebase,
} from "../pushReminders";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import type { PushSubscriptionData } from "../pushReminders";
import { doc, setDoc, deleteDoc } from "firebase/firestore";

jest.mock("@/lib/logging/appLogger", () => ({
  appLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("pushReminders helpers", () => {
  const baseSubscription: PushSubscriptionData = {
    endpoint: "https://example.test/endpoint",
    expirationTime: null,
    keys: { p256dh: "p256", auth: "auth" },
  };

  class MockNotification {
    static permission: NotificationPermission = "default";
    static requestPermission = jest.fn(async () => "granted" as const);
  }

  function setPushSupportedEnv() {
    // Make `"Notification" in window` and `"PushManager" in window` true
    // In Jest+JSDOM, code may read Notification from either `window` or `globalThis`
    ;(globalThis as any).Notification = MockNotification;
    (window as any).Notification = MockNotification;
    (window as any).PushManager = function PushManager() {};

    const registration = {
      pushManager: {
        getSubscription: jest.fn(),
        subscribe: jest.fn(),
      },
    };

    Object.defineProperty(navigator, "serviceWorker", {
      value: { ready: Promise.resolve(registration) },
      configurable: true,
    });

    return registration;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    // Clean up any previous global mutations
    delete (window as any).PushManager;
    delete (window as any).Notification;
    delete (globalThis as any).Notification;
    // Remove serviceWorker hook entirely so `"serviceWorker" in navigator` is false by default
    // (use `setPushSupportedEnv()` to add it back for tests that need it)
    delete (navigator as any).serviceWorker;
    localStorage.clear();
  });

  it("reports unsupported when push primitives are not present", () => {
    expect(isPushSupported()).toBe(false);
    expect(getPushPermissionState()).toBe("unsupported");
  });

  it("subscribes and caches subscription when permission is granted", async () => {
    const registration = setPushSupportedEnv();
    MockNotification.permission = "granted";

    const subscription = {
      endpoint: baseSubscription.endpoint,
      expirationTime: baseSubscription.expirationTime,
      toJSON: () => ({ keys: baseSubscription.keys }),
    } as unknown as PushSubscription;

    registration.pushManager.getSubscription.mockResolvedValueOnce(null);
    registration.pushManager.subscribe.mockResolvedValueOnce(subscription);

    // Must be valid base64/base64url since `subscribeToPush` calls `window.atob(...)`
    const result = await subscribeToPush("dGVzdA"); // "test"

    expect(result).toEqual(baseSubscription);
    expect(registration.pushManager.subscribe).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("push-subscription")).toBeTruthy();
  });

  it("returns null if permission is not granted", async () => {
    setPushSupportedEnv();
    MockNotification.permission = "default";

    const result = await subscribeToPush("dGVzdA");
    expect(result).toBeNull();
  });

  it("unsubscribes when a subscription exists and clears local cache", async () => {
    const registration = setPushSupportedEnv();
    MockNotification.permission = "granted";

    localStorage.setItem("push-subscription", JSON.stringify(baseSubscription));

    const unsubscribe = jest.fn().mockResolvedValue(true);
    const subscription = {
      unsubscribe,
      toJSON: () => ({ keys: baseSubscription.keys }),
    } as unknown as PushSubscription;

    registration.pushManager.getSubscription.mockResolvedValueOnce(subscription);

    const ok = await unsubscribeFromPush();

    expect(ok).toBe(true);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("push-subscription")).toBeNull();
  });

  it("saves/removes push subscription in Firebase using default subscriptionId = 'default'", async () => {
    await savePushSubscriptionToFirebase("user-1", baseSubscription);
    expect(doc).toHaveBeenCalledWith(
      expect.anything(),
      COLLECTIONS.USERS,
      "user-1",
      "pushSubscriptions",
      "default"
    );
    expect(setDoc).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();

    await removePushSubscriptionFromFirebase("user-1");
    expect(doc).toHaveBeenCalledWith(
      expect.anything(),
      COLLECTIONS.USERS,
      "user-1",
      "pushSubscriptions",
      "default"
    );
    expect(deleteDoc).toHaveBeenCalledTimes(1);
  });

  it("uses adminAlerts subscriptionId for admin alert helpers", async () => {
    await saveAdminAlertSubscriptionToFirebase("user-1", baseSubscription);
    expect(doc).toHaveBeenCalledWith(
      expect.anything(),
      COLLECTIONS.USERS,
      "user-1",
      "pushSubscriptions",
      "adminAlerts"
    );

    jest.clearAllMocks();

    await removeAdminAlertSubscriptionFromFirebase("user-1");
    expect(doc).toHaveBeenCalledWith(
      expect.anything(),
      COLLECTIONS.USERS,
      "user-1",
      "pushSubscriptions",
      "adminAlerts"
    );
  });
});

