/// <reference types="cypress" />

describe("Dashboard Workflow", () => {
  beforeEach(() => {
    cy.visitAndWaitForLoad("/dashboard");
  });

  it("renders the welcome header", () => {
    cy.contains("Welcome back").should("be.visible");
    cy.contains("Here's what's happening with your schools today.").should(
      "be.visible"
    );
  });

  it("displays today's date section", () => {
    cy.contains("Today").should("be.visible");
    // Date label should be present (e.g., "Monday, October 23")
    cy.get("main").within(() => {
      cy.contains(/\w+, \w+ \d+/).should("be.visible");
    });
  });

  it("shows all four metrics stat cards", () => {
    cy.contains("Current Status").should("be.visible");
    cy.contains("Assigned Schools").should("be.visible");
    cy.contains("This Week").should("be.visible");
    cy.contains("Total Hours").should("be.visible");
  });

  it("displays the Recent Activity section", () => {
    cy.contains("Recent Activity").should("be.visible");
    cy.contains("Your recent check-ins and sessions").should("be.visible");
  });

  it("navigates to history when clicking View all", () => {
    cy.contains("View all").should("be.visible").click();
    cy.location("pathname").should("eq", "/dashboard/history");
  });

  it("renders correctly on mobile viewport", () => {
    cy.setMobileViewport();
    cy.visitAndWaitForLoad("/dashboard");

    cy.contains("Welcome back").should("be.visible");
    cy.contains("Current Status").should("be.visible");
    cy.contains("Assigned Schools").should("be.visible");
    cy.contains("This Week").should("be.visible");
    cy.contains("Total Hours").should("be.visible");
    cy.contains("Recent Activity").should("be.visible");
  });

  it("renders correctly on tablet viewport", () => {
    cy.setTabletViewport();
    cy.visitAndWaitForLoad("/dashboard");

    cy.contains("Welcome back").should("be.visible");
    cy.contains("Current Status").should("be.visible");
    cy.contains("Assigned Schools").should("be.visible");
    cy.contains("This Week").should("be.visible");
    cy.contains("Total Hours").should("be.visible");
    cy.contains("Recent Activity").should("be.visible");
  });

  it("passes accessibility checks", () => {
    cy.checkA11y({ exclude: [".firebase-emulator-warning"] });
  });

  // --- New tests ---

  it("renders the SessionStatus component area", () => {
    // SessionStatus renders a card with "Current Session" title in both active and empty states
    cy.contains("Current Session").should("be.visible");
    // Should show either active session info or empty state message
    cy.get("main").within(() => {
      cy.contains(/Current Session|No active session/).should("exist");
    });
  });

  it("renders the SchoolList component area", () => {
    // SchoolList always renders with "Assigned Schools" title or an empty state
    cy.get("main").within(() => {
      cy.contains(/Assigned Schools|No schools assigned/).should("be.visible");
    });
  });

  it("displays the description text", () => {
    cy.contains("Here's what's happening with your schools today.").should(
      "be.visible"
    );
  });

  it("stat cards display numeric or text values", () => {
    // Current Status shows "Active" or "Not Active"
    cy.contains("Current Status")
      .closest("[class*='card'], [class*='Card'], div")
      .within(() => {
        cy.contains(/Active|Not Active/).should("be.visible");
      });

    // Assigned Schools shows a number
    cy.contains("Assigned Schools")
      .closest("[class*='card'], [class*='Card'], div")
      .within(() => {
        cy.contains(/\d+/).should("exist");
      });

    // This Week shows a number
    cy.contains("This Week")
      .closest("[class*='card'], [class*='Card'], div")
      .within(() => {
        cy.contains(/\d+/).should("exist");
      });

    // Total Hours shows a decimal number like "0.0" or "12.5"
    cy.contains("Total Hours")
      .closest("[class*='card'], [class*='Card'], div")
      .within(() => {
        cy.contains(/\d+\.\d/).should("exist");
      });
  });

  it("date display includes day of week pattern", () => {
    // The todayLabel format is "weekday, month day" e.g. "Tuesday, February 11"
    cy.get("main").within(() => {
      cy.contains(
        /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (January|February|March|April|May|June|July|August|September|October|November|December) \d+/
      ).should("be.visible");
    });
  });

  it("View all button exists and is clickable", () => {
    cy.contains("View all")
      .should("be.visible")
      .and("not.be.disabled");
  });
});
