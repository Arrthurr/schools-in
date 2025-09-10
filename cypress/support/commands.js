// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

// Custom command for login (will be implemented later with Firebase Auth)
Cypress.Commands.add("login", (email, password, options = {}) => {
  // For now, we'll just set a cookie to simulate the user being logged in
  // This will be replaced with actual Firebase logic
  cy.setCookie("auth-token", "fake-token");
  cy.setCookie("user-role", options.role || "provider");
  cy.log(`Logged in as ${options.role || "provider"}`);
});

// Custom command to mock geolocation
Cypress.Commands.add("mockGeolocation", (latitude, longitude) => {
  cy.window().then((win) => {
    cy.stub(win.navigator.geolocation, "getCurrentPosition", (cb) => {
      return cb({
        coords: {
          latitude,
          longitude,
          accuracy: 20,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
      });
    });
  });
});

// Custom command to visit page and wait for it to load
Cypress.Commands.add("visitAndWaitForLoad", (url) => {
  cy.visit(url);
  cy.get("main").should("be.visible");
});

// Enhanced accessibility testing with axe-core
Cypress.Commands.add("checkA11y", (context, options) => {
  cy.injectAxe();
  cy.configureAxe({
    rules: [
      // WCAG 2.1 AA rules
      { id: 'color-contrast', enabled: true },
      { id: 'focus-order-semantics', enabled: true },
      { id: 'keyboard-navigation', enabled: true },
      { id: 'aria-labels', enabled: true },
      { id: 'heading-order', enabled: true },
      { id: 'landmark-roles', enabled: true }
    ],
    tags: ['wcag2a', 'wcag2aa', 'wcag21aa']
  });
  
  cy.checkA11y(context, options);
});

// Custom command for mobile viewport testing
Cypress.Commands.add("setMobileViewport", () => {
  cy.viewport(375, 667); // iPhone SE dimensions
});

// Custom command for tablet viewport testing
Cypress.Commands.add("setTabletViewport", () => {
  cy.viewport(768, 1024); // iPad dimensions
});

// Custom command for desktop viewport testing
Cypress.Commands.add("setDesktopViewport", () => {
  cy.viewport(1280, 720); // Standard desktop
});

// Custom command to check for loading states
Cypress.Commands.add("waitForNoLoadingSpinner", () => {
  cy.get('[data-testid="loading"]').should("not.exist");
  cy.get(".animate-spin").should("not.exist");
});

// Custom command for keyboard navigation testing
Cypress.Commands.add("tab", { prevSubject: "element" }, (subject) => {
  return cy.wrap(subject).trigger("keydown", { key: "Tab" });
});

// Custom command to wait for page transitions
Cypress.Commands.add("waitForPageLoad", () => {
  cy.get("main").should("be.visible");
  cy.waitForNoLoadingSpinner();
});

// Custom command to simulate offline mode
Cypress.Commands.add("goOffline", () => {
  cy.window().then((win) => {
    win.navigator.onLine = false;
    win.dispatchEvent(new Event("offline"));
  });
});

// Custom command to simulate online mode
Cypress.Commands.add("goOnline", () => {
  cy.window().then((win) => {
    win.navigator.onLine = true;
    win.dispatchEvent(new Event("online"));
  });
});

// Custom command to check for active session state
Cypress.Commands.add("shouldHaveActiveSession", (schoolName) => {
  cy.contains("Session Active").should("be.visible");
  cy.contains("Check Out").should("be.visible");
  if (schoolName) {
    cy.contains(schoolName).should("be.visible");
  }
  cy.get('[role="timer"]').should("be.visible");
});

// Custom command to check for inactive session state  
Cypress.Commands.add("shouldHaveInactiveSession", () => {
  cy.contains("Check In").should("be.visible");
  cy.contains("Session Active").should("not.exist");
  cy.contains("Check Out").should("not.exist");
});

// Custom command to mock API error responses
Cypress.Commands.add("mockApiError", (method, url, statusCode = 500) => {
  cy.intercept(method, url, {
    statusCode,
    body: { error: "Mocked API error" }
  });
});

// Performance testing commands
Cypress.Commands.add("measurePageLoad", (url) => {
  cy.window().its('performance').then((perf) => {
    const startTime = perf.now();
    
    cy.visit(url);
    cy.get("main").should("be.visible");
    
    cy.window().its('performance').then((endPerf) => {
      const endTime = endPerf.now();
      const loadTime = endTime - startTime;
      
      cy.log(`Page load time: ${loadTime}ms`);
      
      // Assert reasonable load time (under 2 seconds)
      expect(loadTime).to.be.lessThan(2000);
      
      // Store for reporting
      Cypress.env('lastPageLoadTime', loadTime);
    });
  });
});

Cypress.Commands.add("measureWebVitals", () => {
  cy.window().then((win) => {
    const observer = new win.PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.name === 'first-contentful-paint') {
          cy.log(`FCP: ${entry.startTime}ms`);
          expect(entry.startTime).to.be.lessThan(1800);
        }
        if (entry.name === 'largest-contentful-paint') {
          cy.log(`LCP: ${entry.startTime}ms`);
          expect(entry.startTime).to.be.lessThan(2500);
        }
      });
    });
    
    observer.observe({ entryTypes: ['paint', 'largest-contentful-paint'] });
  });
});

Cypress.Commands.add("checkMemoryUsage", () => {
  cy.window().then((win) => {
    if (win.performance && win.performance.memory) {
      const memory = win.performance.memory;
      cy.log(`Memory usage: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
      
      // Alert if memory usage is excessive (over 50MB)
      if (memory.usedJSHeapSize > 50 * 1024 * 1024) {
        cy.log('WARNING: High memory usage detected');
      }
    }
  });
});

Cypress.Commands.add("lighthouse", (url, options = {}) => {
  // Basic lighthouse-like checks in Cypress
  cy.visit(url);
  
  // Performance checks
  cy.measureWebVitals();
  
  // Accessibility checks
  cy.checkA11y();
  
  // SEO checks
  cy.get('title').should('exist').should('not.be.empty');
  cy.get('meta[name="description"]').should('exist');
  
  // Best practices
  cy.get('img').each(($img) => {
    cy.wrap($img).should('have.attr', 'alt');
  });
  
  cy.checkMemoryUsage();
});
