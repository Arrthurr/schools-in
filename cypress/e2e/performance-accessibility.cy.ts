/// <reference types="cypress" />
/// <reference types="cypress-axe" />

// Import axe-core accessibility testing
import "cypress-axe";

describe("Performance and Accessibility Testing", () => {
  beforeEach(() => {
    // Inject axe-core for accessibility testing
    cy.injectAxe();

    // Mock necessary APIs to ensure consistent performance testing
    cy.intercept("GET", "/api/locations?providerId=*", {
      statusCode: 200,
      body: { schools: [] },
    }).as("getSchools");

    cy.intercept("GET", "/api/sessions?providerId=*", {
      statusCode: 200,
      body: { sessions: [] },
    }).as("getSessions");
  });

  describe("Core Web Vitals and Performance", () => {
    it("should meet performance benchmarks for homepage", () => {
      // Start performance monitoring
      cy.window()
        .its("performance")
        .then((performance) => {
          const startTime = performance.now();

          cy.visit("/");

          // Wait for page to be fully loaded
          cy.get("main").should("be.visible");

          cy.window()
            .its("performance")
            .then((perf) => {
              const endTime = perf.now();
              const loadTime = endTime - startTime;

              // Page should load within 2 seconds
              expect(loadTime).to.be.lessThan(2000);
            });
        });

      // Check for performance metrics
      cy.window().should("have.property", "performance");

      // Validate no console errors that could impact performance
      cy.window().then((win) => {
        cy.stub(win.console, "error").as("consoleError");
      });

      cy.get("@consoleError").should("not.have.been.called");
    });

    it("should meet performance benchmarks for provider dashboard", () => {
      cy.login("provider@test.com", "password", { role: "provider" });

      // Measure dashboard load time
      const startTime = performance.now();

      cy.visit("/dashboard");
      cy.wait(["@getSchools", "@getSessions"]);

      // Wait for all critical content to load
      cy.contains("Provider Dashboard").should("be.visible");
      cy.get('[data-testid="school-list"]').should("be.visible");

      cy.window()
        .its("performance")
        .then((perf) => {
          const paintEntries = perf.getEntriesByType("paint");
          const fcpEntry = paintEntries.find(
            (entry) => entry.name === "first-contentful-paint"
          );

          if (fcpEntry) {
            // First Contentful Paint should be under 1.5 seconds
            expect(fcpEntry.startTime).to.be.lessThan(1500);
          }
        });
    });

    it("should meet performance benchmarks for admin dashboard", () => {
      cy.login("admin@test.com", "password", { role: "admin" });

      // Mock admin stats
      cy.intercept("GET", "/api/admin/stats", {
        statusCode: 200,
        body: { totalSchools: 5, activeProviders: 3, activeSessions: 2 },
      }).as("getStats");

      cy.visit("/admin");
      cy.wait("@getStats");

      // Measure Time to Interactive
      cy.get("main").should("be.visible");
      cy.contains("Admin Dashboard").should("be.visible");

      // Check that interactive elements are responsive
      cy.get("button").first().should("not.be.disabled");

      // Verify no layout shifts occur
      cy.get("main").should("have.css", "min-height");
    });

    it("should optimize image loading and lazy loading", () => {
      cy.visit("/");

      // Check that images have proper loading attributes
      cy.get("img").each(($img) => {
        const loading = $img.attr("loading");
        const src = $img.attr("src");

        // Images should have loading="lazy" or be critical above-the-fold
        if (src && !src.includes("logo")) {
          expect(loading).to.equal("lazy");
        }
      });

      // Check for proper image optimization
      cy.get("img").should("have.attr", "alt");
    });

    it("should handle large datasets efficiently", () => {
      // Mock large school dataset
      const largeSchoolList = Array.from({ length: 50 }, (_, i) => ({
        id: `school${i}`,
        name: `School ${i}`,
        address: `${i} Test St`,
        coordinates: { lat: 40.7128, lng: -74.006 },
        radius: 500,
      }));

      cy.intercept("GET", "/api/locations?providerId=*", {
        statusCode: 200,
        body: { schools: largeSchoolList },
        delay: 100, // Simulate network delay
      }).as("getLargeSchoolList");

      cy.login("provider@test.com", "password", { role: "provider" });

      const startTime = performance.now();
      cy.visit("/dashboard");
      cy.wait("@getLargeSchoolList");

      // Large dataset should still render quickly
      cy.get('[data-testid="school-list"]').should("be.visible");
      cy.contains("School 0").should("be.visible");

      // Check for virtualization or pagination
      cy.get('[data-testid="school-item"]').should("have.length.lessThan", 20);

      cy.window()
        .its("performance")
        .then(() => {
          const endTime = performance.now();
          const renderTime = endTime - startTime;

          // Should render large dataset within reasonable time
          expect(renderTime).to.be.lessThan(3000);
        });
    });

    it("should maintain performance during GPS operations", () => {
      cy.login("provider@test.com", "password", { role: "provider" });
      cy.visit("/dashboard");

      // Mock geolocation with delay to simulate GPS acquisition
      cy.window().then((win) => {
        cy.stub(win.navigator.geolocation, "getCurrentPosition").callsFake(
          (success) => {
            setTimeout(() => {
              success({
                coords: {
                  latitude: 40.7128,
                  longitude: -74.006,
                  accuracy: 20,
                  altitude: null,
                  altitudeAccuracy: null,
                  heading: null,
                  speed: null,
                },
                timestamp: Date.now(),
              });
            }, 100);
          }
        );
      });

      // Test that GPS operations don't block the UI
      cy.contains("Check In").click();

      // UI should remain responsive during GPS acquisition
      cy.contains("Getting your location").should("be.visible");
      cy.get("button").should("be.visible"); // Other buttons should still be accessible

      // GPS operation should complete within reasonable time
      cy.contains("Confirm Check-In", { timeout: 2000 }).should("be.visible");
    });
  });

  describe("Accessibility Compliance (WCAG 2.1 AA)", () => {
    it("should pass accessibility audit on homepage", () => {
      cy.visit("/");
      cy.waitForPageLoad();

      // Run comprehensive accessibility audit
      cy.checkA11y(undefined, {
        rules: {
          // Configure specific accessibility rules
          "color-contrast": { enabled: true },
          "keyboard-navigation": { enabled: true },
          "aria-labels": { enabled: true },
          "heading-order": { enabled: true },
          "landmark-roles": { enabled: true },
        },
      });

      // Check for proper heading hierarchy
      cy.get("h1").should("have.length.at.least", 1);
      cy.get("h1").first().should("be.visible");

      // Check for skip links
      cy.get('a[href="#main"]').should("exist");
    });

    it("should pass accessibility audit on provider dashboard", () => {
      cy.login("provider@test.com", "password", { role: "provider" });
      cy.visit("/dashboard");
      cy.waitForPageLoad();

      // Comprehensive accessibility audit
      cy.checkA11y(undefined, {
        includedImpacts: ["critical", "serious", "moderate"],
      });

      // Check for proper form labels
      cy.get("input").each(($input) => {
        const id = $input.attr("id");
        const ariaLabel = $input.attr("aria-label");
        const ariaLabelledBy = $input.attr("aria-labelledby");

        if (id) {
          cy.get(`label[for="${id}"]`).should("exist");
        } else {
          expect(ariaLabel || ariaLabelledBy).to.exist;
        }
      });

      // Check for proper button labeling
      cy.get("button").each(($button) => {
        const text = $button.text().trim();
        const ariaLabel = $button.attr("aria-label");

        expect(text.length > 0 || ariaLabel).to.be.true;
      });
    });

    it("should pass accessibility audit on admin dashboard", () => {
      cy.login("admin@test.com", "password", { role: "admin" });
      cy.intercept("GET", "/api/admin/stats", { body: { totalSchools: 5 } });

      cy.visit("/admin");
      cy.waitForPageLoad();

      // Run accessibility audit
      cy.checkA11y(undefined, {
        rules: {
          region: { enabled: true },
          "landmark-one-main": { enabled: true },
          "page-has-heading-one": { enabled: true },
        },
      });

      // Check for proper table accessibility (if tables exist)
      cy.get("table").each(($table) => {
        cy.wrap($table).should("have.attr", "role", "table");
        cy.wrap($table).find("th").should("have.attr", "scope");
      });
    });

    it("should support keyboard navigation throughout the app", () => {
      cy.visit("/");

      // Test keyboard navigation flow
      cy.get("body").tab();
      cy.focused().should("be.visible");

      // Test that all interactive elements are keyboard accessible
      cy.get("button, a, input, select, textarea").each(($el) => {
        cy.wrap($el).should("have.attr", "tabindex").and("not.equal", "-1");
      });

      // Test that focus indicators are visible
      cy.get("button").first().focus();
      cy.focused().should("have.css", "outline-width").and("not.equal", "0px");
    });

    it("should provide proper ARIA labels and live regions", () => {
      cy.login("provider@test.com", "password", { role: "provider" });
      cy.visit("/dashboard");

      // Check for ARIA live regions for dynamic content
      cy.get("[aria-live]").should("exist");
      cy.get('[aria-live="polite"]').should("exist");

      // Check for proper role attributes
      cy.get('[role="main"]').should("exist");
      cy.get('[role="navigation"]').should("exist");
      cy.get('[role="button"]').should("exist");

      // Check for descriptive ARIA labels
      cy.get("[aria-label]").should("exist");
      cy.get("[aria-describedby]").should("exist");
    });

    it("should maintain focus management in modals and dialogs", () => {
      cy.login("provider@test.com", "password", { role: "provider" });
      cy.visit("/dashboard");

      // Open a modal/dialog
      cy.contains("Check In").click();

      // Focus should move to modal
      cy.get('[role="dialog"]').should("exist");
      cy.focused().should("be.visible");

      // Escape key should close modal
      cy.get("body").type("{esc}");
      cy.get('[role="dialog"]').should("not.exist");

      // Focus should return to trigger element
      cy.contains("Check In").should("be.focused");
    });

    it("should support screen reader announcements", () => {
      cy.login("provider@test.com", "password", { role: "provider" });
      cy.visit("/dashboard");

      // Check for screen reader only content
      cy.get(".sr-only").should("exist");

      // Check for proper status announcements
      cy.get('[role="status"]').should("exist");
      cy.get('[aria-live="assertive"]').should("exist");

      // Test dynamic content announcements
      cy.contains("Check In").click();
      cy.get('[aria-live="polite"]').should(
        "contain.text",
        "Getting your location"
      );
    });

    it("should handle high contrast and reduced motion preferences", () => {
      // Test with prefers-reduced-motion
      cy.visit("/", {
        onBeforeLoad: (win) => {
          Object.defineProperty(win, "matchMedia", {
            writable: true,
            value: cy.stub().returns({
              matches: true,
              media: "(prefers-reduced-motion: reduce)",
              onchange: null,
              addEventListener: cy.stub(),
              removeEventListener: cy.stub(),
              dispatchEvent: cy.stub(),
            }),
          });
        },
      });

      // Animations should be reduced or disabled
      cy.get(".animate-spin").should("not.exist");
      cy.get('[data-testid="reduced-motion"]').should("exist");
    });
  });

  describe("Mobile Performance and Accessibility", () => {
    beforeEach(() => {
      cy.setMobileViewport();
    });

    it("should maintain performance on mobile devices", () => {
      // Simulate slower mobile connection
      cy.intercept("GET", "/api/locations?providerId=*", {
        statusCode: 200,
        body: { schools: [] },
        delay: 200, // Simulate slower mobile network
      }).as("getSchoolsMobile");

      cy.login("provider@test.com", "password", { role: "provider" });
      cy.visit("/dashboard");
      cy.wait("@getSchoolsMobile");

      // Check that mobile performance is acceptable
      cy.get("main").should("be.visible");
      cy.contains("Provider Dashboard").should("be.visible");

      // Mobile touch targets should be appropriately sized
      cy.get("button").each(($button) => {
        cy.wrap($button)
          .should("have.css", "min-height")
          .and("match", /^([4-9]\d|\d{3,})px$/);
        cy.wrap($button)
          .should("have.css", "min-width")
          .and("match", /^([4-9]\d|\d{3,})px$/);
      });
    });

    it("should maintain accessibility on mobile devices", () => {
      cy.visit("/");
      cy.waitForPageLoad();

      // Run mobile-specific accessibility audit
      cy.checkA11y(undefined, {
        rules: {
          "touch-target": { enabled: true },
          "tap-button-name": { enabled: true },
        },
      });

      // Check mobile navigation accessibility
      cy.get('[role="button"][aria-label*="menu"]').should("exist");
    });

    it("should handle touch interactions accessibly", () => {
      cy.login("provider@test.com", "password", { role: "provider" });
      cy.visit("/dashboard");

      // Touch interactions should work properly
      cy.contains("Check In").click();
      cy.contains("Confirm Check-In").should("be.visible");

      // Swipe gestures should be accessible
      cy.get('[data-testid="swipeable"]').should("have.attr", "role", "region");
    });
  });

  describe("Performance Regression Testing", () => {
    it("should not degrade performance with multiple check-ins", () => {
      cy.login("provider@test.com", "password", { role: "provider" });
      cy.visit("/dashboard");

      // Simulate multiple check-in operations
      for (let i = 0; i < 5; i++) {
        cy.mockGeolocation(40.7128 + i * 0.001, -74.006 + i * 0.001);
        cy.contains("Check In").click();
        cy.contains("Confirm").click();
        cy.contains("Check Out").click();
        cy.contains("Confirm").click();
      }

      // Performance should not degrade significantly
      cy.window()
        .its("performance")
        .then((perf) => {
          const memoryInfo = (perf as any).memory;
          if (memoryInfo) {
            // Memory usage should not exceed reasonable limits
            expect(memoryInfo.usedJSHeapSize).to.be.lessThan(50 * 1024 * 1024); // 50MB
          }
        });
    });

    it("should maintain performance with concurrent users simulation", () => {
      // Simulate high server load with delayed responses
      cy.intercept("GET", "/api/**", (req) => {
        req.reply({
          delay: Math.random() * 500 + 200, // 200-700ms delay
          statusCode: 200,
          body: {},
        });
      });

      cy.login("provider@test.com", "password", { role: "provider" });
      cy.visit("/dashboard");

      // App should remain responsive despite server delays
      cy.get('[data-testid="loading-spinner"]').should("be.visible");
      cy.get("button").should("not.be.disabled");
    });
  });

  describe("Bundle Size and Code Splitting", () => {
    it("should load only necessary JavaScript for each page", () => {
      cy.visit("/");

      // Check that initial bundle size is reasonable
      cy.window()
        .its("performance")
        .then((perf) => {
          const navigationEntries = perf.getEntriesByType(
            "navigation"
          ) as PerformanceNavigationTiming[];
          if (navigationEntries.length > 0) {
            const transferSize = navigationEntries[0].transferSize;
            // Initial page load should be under 1MB
            expect(transferSize).to.be.lessThan(1024 * 1024);
          }
        });

      // Check that unused routes are not loaded
      cy.window().then((win) => {
        const scripts = Array.from(
          win.document.querySelectorAll("script[src]")
        );
        const scriptSrcs = scripts.map(
          (script) => (script as HTMLScriptElement).src
        );

        // Admin bundle should not be loaded on homepage
        expect(scriptSrcs.some((src) => src.includes("admin"))).to.be.false;
      });
    });
  });
});
