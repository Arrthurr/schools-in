// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";

// Polyfill fetch for Node.js testing environment
import "whatwg-fetch";

// Mock Firebase modules
jest.mock("./firebase.config", () => ({
  auth: {
    currentUser: null,
    signInWithPopup: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChanged: jest.fn(),
  },
  db: {},
  storage: {},
}));

// Mock Firebase Auth
jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({})),
  onAuthStateChanged: jest.fn(),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
  OAuthProvider: jest.fn(() => ({
    setCustomParameters: jest.fn(),
  })),
}));

// Mock Firebase Firestore
jest.mock("firebase/firestore", () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn(),
  doc: jest.fn(),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  setDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  onSnapshot: jest.fn(() => jest.fn()),
  Timestamp: {
    now: jest.fn(() => ({
      seconds: Date.now() / 1000,
      nanoseconds: 0,
      toDate: jest.fn(() => new Date()),
      toMillis: jest.fn(() => Date.now()),
    })),
    fromDate: jest.fn((date) => ({
      seconds: date.getTime() / 1000,
      nanoseconds: 0,
      toDate: jest.fn(() => date),
      toMillis: jest.fn(() => date.getTime()),
    })),
  },
  GeoPoint: jest.fn((lat, lng) => ({ latitude: lat, longitude: lng })),
}));

// Mock Firebase Storage
jest.mock("firebase/storage", () => ({
  getStorage: jest.fn(() => ({})),
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
  deleteObject: jest.fn(),
}));

// Mock Next.js router
jest.mock("next/router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    pathname: "/",
    route: "/",
    asPath: "/",
    query: {},
    isReady: true,
  }),
}));

// Mock Next.js navigation (App Router)
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Note: window.location mock removed due to JSDOM conflicts
// If needed, mock location in individual tests

// Mock IndexedDB (idb library)
jest.mock("idb", () => ({
  openDB: jest.fn(() =>
    Promise.resolve({
      get: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      getAll: jest.fn(() => Promise.resolve([])),
      getAllFromIndex: jest.fn(() => Promise.resolve([])),
      transaction: jest.fn(() => ({
        store: {
          get: jest.fn(),
          put: jest.fn(),
          delete: jest.fn(),
          getAll: jest.fn(() => Promise.resolve([])),
          index: jest.fn(() => ({
            getAll: jest.fn(() => Promise.resolve([])),
          })),
        },
        done: Promise.resolve(),
      })),
      close: jest.fn(),
    })
  ),
  deleteDB: jest.fn(() => Promise.resolve()),
}));

// Silence appLogger output during tests (keeps test output readable)
jest.mock("@/lib/logging/appLogger", () => ({
  appLogger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Filter out known noisy console warnings/errors coming from intentionally-failing paths
// and React test environment warnings. (We still allow unexpected messages through.)
const suppressedConsolePatterns = [
  // React testing warnings
  /not wrapped in act/i,
  /Function components cannot be given refs/i,

  // Expected failures from mocked integrations
  /Failed to fetch VAPID public key/i,
  /Failed to check admin alert subscription/i,
  /Failed to enable admin alerts/i,
  /Microsoft Graph API error/i,
  /M365 sync failed/i,

  // Expected service-level errors exercised by unit tests
  /Error fetching provider metrics/i,
  /Session service error/i,
  /Error starting session/i,
  /Error ending session/i,
  /Error pausing session/i,
  /Error resuming session/i,
  /Error validating geofence/i,
  /Error deleting session/i,

  // Expected UI flows that log errors/warnings
  /Sign-in error/i,
  /Check-in error/i,
  /Location validation warnings/i,
  /Failed to preload critical data/i,
  /Preloading critical data for offline use/i,

  // Misc noisy errors from mocked PushSubscription objects in jsdom
  /Cannot read properties of undefined \(reading '_url'\)/i,
];

const shouldSuppressConsole = (args) => {
  try {
    const text = args
      .map((a) => {
        if (typeof a === "string") return a;
        if (a instanceof Error) return a.message;
        return JSON.stringify(a);
      })
      .join(" ");

    return suppressedConsolePatterns.some((p) => p.test(text));
  } catch {
    return false;
  }
};

// Set JEST_SHOW_CONSOLE=true to disable suppression while debugging.
const suppressTestConsole = process.env.JEST_SHOW_CONSOLE !== "true";

if (suppressTestConsole) {
  const originalConsoleError = console.error;
  console.error = (...args) => {
    if (shouldSuppressConsole(args)) return;
    originalConsoleError(...args);
  };

  const originalConsoleWarn = console.warn;
  console.warn = (...args) => {
    if (shouldSuppressConsole(args)) return;
    originalConsoleWarn(...args);
  };

  // Most console.log/info/debug output is noise in tests.
  console.log = (...args) => {
    if (shouldSuppressConsole(args)) return;
  };
  console.info = (...args) => {
    if (shouldSuppressConsole(args)) return;
  };
  console.debug = (...args) => {
    if (shouldSuppressConsole(args)) return;
  };
}
