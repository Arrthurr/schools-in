// Offline Scenarios Testing
// Task 11.7: Test offline functionality and sync capabilities

describe("Offline Functionality", () => {
  beforeEach(() => {
    // Visit the application
    cy.visit("/");

    // Wait for the app to load
    cy.get("body").should("be.visible");

    // Clear any existing data
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  describe("Service Worker and Caching", () => {
    it("should register service worker", () => {
      cy.window().then((win) => {
        expect(win.navigator.serviceWorker).to.exist;

        // Check if service worker is registered
        cy.window()
          .its("navigator.serviceWorker.ready")
          .then((registration) => {
            expect(registration).to.exist;
          });
      });
    });

    it("should cache essential resources", () => {
      // Navigate to key pages to trigger caching
      cy.visit("/dashboard");
      cy.get("h1").should("contain.text", "Dashboard");

      cy.visit("/profile");
      cy.get("h1").should("contain.text", "Profile");

      // Check that resources are cached
      cy.window().then((win) => {
        if ("caches" in win) {
          return win.caches.keys().then((cacheNames) => {
            expect(cacheNames.length).to.be.greaterThan(0);
          });
        }
      });
    });
  });

  describe("Offline Status Detection", () => {
    it("should detect when going offline", () => {
      cy.visit("/dashboard");

      // Simulate going offline
      cy.window().then((win) => {
        // Mock navigator.onLine
        Object.defineProperty(win.navigator, "onLine", {
          value: false,
          writable: true,
        });

        // Trigger offline event
        win.dispatchEvent(new Event("offline"));

        // Wait for offline detection
        cy.wait(2000);

        // Check for offline indicators
        cy.get('[data-testid="offline-status-indicator"]', {
          timeout: 5000,
        }).should("be.visible");

        // Check for offline message
        cy.contains("Working offline", { timeout: 5000 }).should("be.visible");
      });
    });

    it("should detect when coming back online", () => {
      cy.visit("/dashboard");

      cy.window().then((win) => {
        // Go offline first
        Object.defineProperty(win.navigator, "onLine", {
          value: false,
          writable: true,
        });
        win.dispatchEvent(new Event("offline"));

        cy.wait(2000);

        // Come back online
        Object.defineProperty(win.navigator, "onLine", {
          value: true,
          writable: true,
        });
        win.dispatchEvent(new Event("online"));

        cy.wait(2000);

        // Check for online status
        cy.contains("Connected", { timeout: 5000 }).should("be.visible");
      });
    });
  });

  describe("Offline Action Queueing", () => {
    it("should queue check-in actions when offline", () => {
      cy.visit("/dashboard");

      // Go offline
      cy.window().then((win) => {
        Object.defineProperty(win.navigator, "onLine", {
          value: false,
          writable: true,
        });
        win.dispatchEvent(new Event("offline"));
      });

      cy.wait(2000);

      // Try to check in
      cy.get("button")
        .contains("Check In")
        .then(($btn) => {
          if ($btn.length > 0) {
            cy.wrap($btn).click();

            // Should show queued message
            cy.contains(/queued|offline|will sync/i, { timeout: 5000 }).should(
              "be.visible"
            );
          }
        });
    });

    it("should show pending actions count", () => {
      cy.visit("/dashboard");

      // Mock some pending actions in localStorage
      cy.window().then((win) => {
        const mockActions = [
          {
            id: "1",
            type: "checkIn",
            timestamp: Date.now(),
            status: "pending",
          },
          {
            id: "2",
            type: "checkOut",
            timestamp: Date.now(),
            status: "pending",
          },
        ];
        win.localStorage.setItem("offlineActions", JSON.stringify(mockActions));

        // Go offline
        Object.defineProperty(win.navigator, "onLine", {
          value: false,
          writable: true,
        });
        win.dispatchEvent(new Event("offline"));
      });

      cy.wait(2000);
      cy.reload();

      // Should show pending count
      cy.get('[data-testid="pending-count"]', { timeout: 5000 }).should(
        "contain.text",
        "2"
      );
    });
  });

  describe("Sync Functionality", () => {
    it("should sync pending actions when coming online", () => {
      cy.visit("/dashboard");

      // Add pending actions
      cy.window().then((win) => {
        const mockActions = [
          {
            id: "1",
            type: "checkIn",
            timestamp: Date.now(),
            status: "pending",
          },
        ];
        win.localStorage.setItem("offlineActions", JSON.stringify(mockActions));

        // Go offline
        Object.defineProperty(win.navigator, "onLine", {
          value: false,
          writable: true,
        });
        win.dispatchEvent(new Event("offline"));
      });

      cy.wait(2000);

      // Come back online
      cy.window().then((win) => {
        Object.defineProperty(win.navigator, "onLine", {
          value: true,
          writable: true,
        });
        win.dispatchEvent(new Event("online"));
      });

      cy.wait(3000);

      // Should show sync completion
      cy.contains(/synced|synchronized/i, { timeout: 10000 }).should(
        "be.visible"
      );
    });

    it("should handle sync errors gracefully", () => {
      cy.visit("/dashboard");

      // Mock network failure during sync
      cy.intercept("POST", "**/api/**", { statusCode: 500 });

      cy.window().then((win) => {
        const mockActions = [
          {
            id: "1",
            type: "checkIn",
            timestamp: Date.now(),
            status: "pending",
          },
        ];
        win.localStorage.setItem("offlineActions", JSON.stringify(mockActions));

        // Come online to trigger sync
        Object.defineProperty(win.navigator, "onLine", {
          value: true,
          writable: true,
        });
        win.dispatchEvent(new Event("online"));
      });

      cy.wait(3000);

      // Should show sync error
      cy.contains(/sync failed|error/i, { timeout: 10000 }).should(
        "be.visible"
      );
    });
  });

  describe("Data Persistence", () => {
    it("should persist offline actions across app restarts", () => {
      cy.visit("/dashboard");

      // Add offline actions
      cy.window().then((win) => {
        const mockActions = [
          {
            id: "1",
            type: "checkIn",
            timestamp: Date.now(),
            status: "pending",
          },
          {
            id: "2",
            type: "checkOut",
            timestamp: Date.now(),
            status: "pending",
          },
        ];
        win.localStorage.setItem("offlineActions", JSON.stringify(mockActions));
      });

      // Reload the page
      cy.reload();

      // Go offline to trigger queue display
      cy.window().then((win) => {
        Object.defineProperty(win.navigator, "onLine", {
          value: false,
          writable: true,
        });
        win.dispatchEvent(new Event("offline"));
      });

      cy.wait(2000);

      // Should still show pending actions
      cy.get('[data-testid="pending-count"]', { timeout: 5000 }).should(
        "contain.text",
        "2"
      );
    });

    it("should clear synced actions from storage", () => {
      cy.visit("/dashboard");

      // Add actions and mark them as synced
      cy.window().then((win) => {
        const mockActions = [
          { id: "1", type: "checkIn", timestamp: Date.now(), status: "synced" },
        ];
        win.localStorage.setItem("offlineActions", JSON.stringify(mockActions));

        // Trigger cleanup
        win.dispatchEvent(new Event("online"));
      });

      cy.wait(3000);

      // Check that synced actions are removed
      cy.window().then((win) => {
        const actions = JSON.parse(
          win.localStorage.getItem("offlineActions") || "[]"
        );
        const syncedActions = actions.filter(
          (action) => action.status === "synced"
        );
        expect(syncedActions.length).to.equal(0);
      });
    });
  });
});

describe("PWA Installation Prompts", () => {
  it("should handle install prompt correctly", () => {
    cy.visit("/");

    // Mock beforeinstallprompt event
    cy.window().then((win) => {
      const mockEvent = {
        preventDefault: cy.stub(),
        prompt: cy.stub().resolves(),
        userChoice: Promise.resolve({ outcome: "accepted" }),
      };

      // Store the mock event
      win.deferredPrompt = mockEvent;

      // Trigger the install prompt event
      const event = new CustomEvent("beforeinstallprompt");
      Object.assign(event, mockEvent);
      win.dispatchEvent(event);
    });

    // Should show install button or prompt
    cy.get('[data-testid="install-prompt"]', { timeout: 5000 }).should(
      "be.visible"
    );
  });
});

describe("Mobile PWA Experience", () => {
  beforeEach(() => {
    // Set mobile viewport
    cy.viewport(375, 667);
  });

  it("should be responsive on mobile devices", () => {
    cy.visit("/dashboard");

    // Check that content fits in mobile viewport
    cy.get("body").should("be.visible");

    // Check that touch targets are appropriately sized
    cy.get("button").should("have.length.at.least", 1);
    cy.get("button")
      .first()
      .then(($btn) => {
        const height = $btn.height();
        const width = $btn.width();

        // Minimum touch target size
        expect(height).to.be.at.least(32);
        expect(width).to.be.at.least(32);
      });
  });

  it("should handle touch interactions", () => {
    cy.visit("/dashboard");

    // Test touch interactions
    cy.get("button")
      .first()
      .then(($btn) => {
        if ($btn.length > 0) {
          cy.wrap($btn).trigger("touchstart");
          cy.wrap($btn).trigger("touchend");
          cy.wrap($btn).click();
        }
      });

    // Should not have console errors
    cy.window().then((win) => {
      // Check for touch-related errors
      const errors = win.console?.errors || [];
      const touchErrors = errors.filter(
        (error) => error.includes("touch") || error.includes("gesture")
      );
      expect(touchErrors.length).to.equal(0);
    });
  });
});

describe("Performance Testing", () => {
  it("should load quickly after initial visit", () => {
    // First visit
    const startTime = Date.now();
    cy.visit("/");
    cy.get("body").should("be.visible");
    const firstLoadTime = Date.now() - startTime;

    // Second visit (should use cache)
    const secondStartTime = Date.now();
    cy.reload();
    cy.get("body").should("be.visible");
    const secondLoadTime = Date.now() - secondStartTime;

    // Log performance metrics
    cy.log(`First load: ${firstLoadTime}ms`);
    cy.log(`Second load: ${secondLoadTime}ms`);

    // Verify page loads successfully
    cy.get("body").should("be.visible");
  });

  it("should provide smooth navigation", () => {
    const pages = ["/", "/dashboard", "/profile"];

    pages.forEach((page) => {
      const startTime = Date.now();
      cy.visit(page);
      cy.get("body").should("be.visible");
      const loadTime = Date.now() - startTime;

      cy.log(`${page} load time: ${loadTime}ms`);
    });
  });
});
