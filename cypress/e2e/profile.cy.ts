/// <reference types="cypress" />

describe("Profile Page", () => {
  beforeEach(() => {
    cy.visitAndWaitForLoad("/profile");
  });

  it("renders the page with main content visible", () => {
    cy.contains("User Profile").should("be.visible");
    cy.contains("Email").should("be.visible");
    cy.contains("Role").should("be.visible");
  });

  it("displays profile form elements", () => {
    cy.get('input#displayName').should("be.visible");
    cy.contains("label", "Display Name").should("be.visible");
    cy.contains("button", "Update Profile").should("be.visible").and("be.enabled");
  });

  it("shows check-in mode section", () => {
    cy.contains(/Automatic Check-In\/Out|Manual Check-In\/Out/).should(
      "be.visible"
    );
  });

  it("works on mobile viewport", () => {
    cy.setMobileViewport();
    cy.visitAndWaitForLoad("/profile");
    cy.contains("User Profile").should("be.visible");
    cy.get('input#displayName').should("be.visible");
    cy.contains("button", "Update Profile").should("be.visible");
  });

  it("passes accessibility checks", () => {
    cy.checkA11y({ exclude: [".firebase-emulator-warning"] });
  });
});
