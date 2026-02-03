/// <reference types="cypress" />

describe("Provider Dashboard", () => {
  beforeEach(() => {
    cy.visit("/dashboard");
    cy.get("main").should("be.visible");
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
});
