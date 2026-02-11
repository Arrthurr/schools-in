/// <reference types="cypress" />

describe("Provider Dashboard", () => {
  beforeEach(() => {
    cy.visitAndWaitForLoad("/dashboard");
  });

  it("renders the dashboard header", () => {
    cy.contains("Welcome back").should("be.visible");
  });

  it("shows recent activity section", () => {
    cy.contains("Recent Activity").should("be.visible");
  });

  it("navigates to session history", () => {
    cy.contains("View all").click();
    cy.location("pathname").should("include", "/dashboard/history");
  });

  it("renders the SessionStatus section", () => {
    // SessionStatus always renders "Current Session" regardless of active/empty state
    cy.contains("Current Session").should("be.visible");
  });

  it("displays all four stat cards", () => {
    cy.contains("Current Status").should("be.visible");
    cy.contains("Assigned Schools").should("be.visible");
    cy.contains("This Week").should("be.visible");
    cy.contains("Total Hours").should("be.visible");
  });

  it("displays Today date section with formatted date", () => {
    cy.contains("Today").should("be.visible");
    // Date should match pattern like "Monday, January 15"
    cy.get("main").within(() => {
      cy.contains(/\w+, \w+ \d+/).should("be.visible");
    });
  });

  it("navigates to /dashboard/history via View all button", () => {
    cy.contains("View all").should("be.visible").click();
    cy.location("pathname").should("eq", "/dashboard/history");
  });

  it("renders correctly on mobile viewport", () => {
    cy.setMobileViewport();
    cy.visitAndWaitForLoad("/dashboard");

    cy.contains("Welcome back").should("be.visible");
    cy.contains("Current Session").should("be.visible");
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
    cy.contains("Current Session").should("be.visible");
    cy.contains("Current Status").should("be.visible");
    cy.contains("Assigned Schools").should("be.visible");
    cy.contains("This Week").should("be.visible");
    cy.contains("Total Hours").should("be.visible");
    cy.contains("Recent Activity").should("be.visible");
  });

  it("passes accessibility checks", () => {
    cy.checkA11y({ exclude: [".firebase-emulator-warning"] });
  });
});
