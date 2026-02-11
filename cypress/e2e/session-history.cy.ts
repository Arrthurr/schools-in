/// <reference types="cypress" />

describe("Session History Page", () => {
  beforeEach(() => {
    cy.visitAndWaitForLoad("/dashboard/history");
    cy.get("main").should("be.visible");
  });

  it("renders the page header", () => {
    cy.contains("Session History").should("be.visible");
    cy.contains("Review your recent check-in and check-out activity.").should(
      "be.visible"
    );
  });

  it("displays filter controls", () => {
    cy.contains("Filters").should("be.visible");
    cy.contains("Start date").should("be.visible");
    cy.contains("End date").should("be.visible");
    cy.contains("Location").should("be.visible");
    cy.contains("button", "Reset").should("be.visible");
    cy.contains("button", "Apply").should("be.visible");
  });

  it("filter controls include location dropdown with All locations", () => {
    // The SimpleSelect should render with "All locations" as the default option
    cy.get("#history-location-select").should("exist");
    cy.contains("All locations").should("be.visible");
  });

  it("Reset button is clickable", () => {
    cy.contains("button", "Reset").should("be.visible").and("not.be.disabled").click();
    // After reset, filters should still be visible (page doesn't navigate away)
    cy.contains("Filters").should("be.visible");
  });

  it("Apply button is clickable", () => {
    cy.contains("button", "Apply").should("be.visible").and("not.be.disabled").click();
    // After apply, the history section should still be rendered
    cy.contains("History").should("be.visible");
  });

  it("renders chart sections", () => {
    cy.contains("Hours by location").should("be.visible");
    cy.contains("Session duration distribution").should("be.visible");
  });

  it("chart cards display descriptions", () => {
    cy.contains("Top locations from your history.").should("be.visible");
    cy.contains("How long your sessions typically last.").should("be.visible");
  });

  it("renders the history section", () => {
    cy.contains("History").should("be.visible");
    cy.contains("Completed sessions in reverse chronological order.").should(
      "be.visible"
    );
  });

  it("renders empty state or session list in History section", () => {
    // Either the empty state message or session entries should be visible
    cy.get("main").then(($main) => {
      if ($main.text().includes("No completed sessions yet.")) {
        cy.contains("No completed sessions yet.").should("be.visible");
        cy.contains("Your history will appear after you check out from a school.").should(
          "be.visible"
        );
      } else {
        // Session entries should be rendered in the list
        cy.get('[class*="rounded-lg border"]').should("have.length.at.least", 1);
      }
    });
  });

  it("displays the Last 30 days date range label", () => {
    cy.contains("Last 30 days").should("be.visible");
  });

  it("displays the formatted date range text", () => {
    // The date range shows "startDate – endDate" below "Last 30 days"
    cy.contains("Last 30 days")
      .parent()
      .within(() => {
        // The formatted date range (e.g., "1/12/2026 – 2/11/2026") should be visible
        cy.get("p").should("have.length", 2);
        cy.get("p").last().invoke("text").should("match", /\d+\/\d+\/\d+\s*–\s*\d+\/\d+\/\d+/);
      });
  });

  it("works on mobile viewport", () => {
    cy.setMobileViewport();
    cy.visitAndWaitForLoad("/dashboard/history");
    cy.get("main").should("be.visible");
    cy.contains("Session History").should("be.visible");
    cy.contains("Filters").should("be.visible");
    cy.contains("Hours by location").should("be.visible");
    cy.contains("History").should("be.visible");
  });

  it("works on tablet viewport", () => {
    cy.setTabletViewport();
    cy.visitAndWaitForLoad("/dashboard/history");
    cy.get("main").should("be.visible");
    cy.contains("Session History").should("be.visible");
    cy.contains("Filters").should("be.visible");
    cy.contains("Hours by location").should("be.visible");
    cy.contains("Session duration distribution").should("be.visible");
    cy.contains("History").should("be.visible");
    cy.contains("Last 30 days").should("be.visible");
  });

  it("passes accessibility checks", () => {
    cy.checkA11y();
  });
});
