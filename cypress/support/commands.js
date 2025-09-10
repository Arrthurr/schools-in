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

// Custom command to check accessibility (can be enhanced with axe-core later)
Cypress.Commands.add("checkA11y", () => {
  cy.log("Accessibility check - can be enhanced with axe-core");
  // Basic accessibility checks
  cy.get("main").should("exist");
  cy.get("h1").should("exist");
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
