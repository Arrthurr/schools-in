/// <reference types="cypress" />

describe("Schools Page", () => {
  beforeEach(() => {
    cy.visitAndWaitForLoad("/dashboard/schools");
  });

  it("renders the page heading", () => {
    cy.contains("h1", "My Schools").should("be.visible");
  });

  it("shows the description text", () => {
    cy.contains("View and manage your assigned school locations").should(
      "be.visible"
    );
  });

  it("shows the location status hint", () => {
    cy.contains("Select a school to view details or check in").should(
      "be.visible"
    );
  });

  it("displays the Quick Tips card", () => {
    cy.contains("Quick Tips").should("be.visible");
  });

  it("displays the Location Status legend with all statuses", () => {
    cy.contains("Location Status").should("be.visible");
    cy.contains("In Range - Ready to check in").should("be.visible");
    cy.contains("Out of Range - Move closer").should("be.visible");
    cy.contains("Location Unknown - Enable GPS").should("be.visible");
  });

  it("displays the Need Help card with Contact Support button", () => {
    cy.contains("Need Help?").should("be.visible");
    cy.contains("button", "Contact Support").should("be.visible");
  });

  it("works on mobile viewport", () => {
    cy.setMobileViewport();
    cy.visitAndWaitForLoad("/dashboard/schools");
    cy.contains("h1", "My Schools").should("be.visible");
    cy.contains("Quick Tips").should("be.visible");
    cy.contains("Location Status").should("be.visible");
    cy.contains("button", "Contact Support").should("be.visible");
  });

  it("passes accessibility checks", () => {
    cy.checkA11y({ exclude: [".firebase-emulator-warning"] });
  });

  // --- New tests ---

  it("Quick Tips card contains helpful check-in guidance", () => {
    cy.contains("Quick Tips")
      .closest("[class*='card']")
      .within(() => {
        cy.contains("View Details").should("be.visible");
        cy.contains("Enable location services").should("be.visible");
        cy.contains("within the check-in radius").should("be.visible");
      });
  });

  it("Location Status legend has colored indicators for each status", () => {
    cy.contains("Location Status")
      .closest("[class*='card']")
      .within(() => {
        // Green indicator for In Range
        cy.contains("In Range - Ready to check in")
          .parent()
          .find("[class*='bg-green']")
          .should("exist")
          .and("have.class", "rounded-full");

        // Yellow indicator for Out of Range
        cy.contains("Out of Range - Move closer")
          .parent()
          .find("[class*='bg-yellow']")
          .should("exist")
          .and("have.class", "rounded-full");

        // Gray indicator for Location Unknown
        cy.contains("Location Unknown - Enable GPS")
          .parent()
          .find("[class*='bg-gray']")
          .should("exist")
          .and("have.class", "rounded-full");
      });
  });

  it("Contact Support button is clickable and enabled", () => {
    cy.contains("button", "Contact Support")
      .should("be.visible")
      .and("be.enabled")
      .click();
  });

  it("main content area has proper structure with cards and sections", () => {
    // Page wrapper
    cy.get("[class*='max-w-7xl']").should("exist");

    // Information cards section contains three cards
    cy.get("[class*='lg:grid-cols-3']").within(() => {
      cy.get("[class*='card']").should("have.length.at.least", 3);
    });

    // Each card has a header and content area
    cy.contains("Quick Tips")
      .closest("[class*='card']")
      .find("[class*='card-header'], [class*='CardHeader']")
      .should("exist");

    cy.contains("Location Status")
      .closest("[class*='card']")
      .find("[class*='card-header'], [class*='CardHeader']")
      .should("exist");

    cy.contains("Need Help?")
      .closest("[class*='card']")
      .find("[class*='card-header'], [class*='CardHeader']")
      .should("exist");
  });

  it("works on tablet viewport", () => {
    cy.setTabletViewport();
    cy.visitAndWaitForLoad("/dashboard/schools");
    cy.contains("h1", "My Schools").should("be.visible");
    cy.contains("View and manage your assigned school locations").should(
      "be.visible"
    );
    cy.contains("Quick Tips").should("be.visible");
    cy.contains("Location Status").should("be.visible");
    cy.contains("Need Help?").should("be.visible");
    cy.contains("button", "Contact Support").should("be.visible");
  });

  it("heading hierarchy is correct with h1 for My Schools", () => {
    // Only one h1 on the page
    cy.get("h1").should("have.length", 1);
    cy.get("h1").should("contain.text", "My Schools");

    // Card titles should not be h1
    cy.contains("Quick Tips").should("not.match", "h1");
    cy.contains("Location Status").should("not.match", "h1");
    cy.contains("Need Help?").should("not.match", "h1");
  });

  it("recovers gracefully after going offline and coming back online", () => {
    // Verify page is loaded
    cy.contains("h1", "My Schools").should("be.visible");

    // Simulate offline
    cy.goOffline();

    // Page content should still be visible (already rendered)
    cy.contains("h1", "My Schools").should("be.visible");
    cy.contains("Quick Tips").should("be.visible");

    // Come back online
    cy.goOnline();

    // Verify page is still functional after reconnecting
    cy.contains("h1", "My Schools").should("be.visible");
    cy.contains("View and manage your assigned school locations").should(
      "be.visible"
    );
    cy.contains("Quick Tips").should("be.visible");
    cy.contains("Location Status").should("be.visible");
    cy.contains("button", "Contact Support").should("be.visible").and("be.enabled");
  });
});
