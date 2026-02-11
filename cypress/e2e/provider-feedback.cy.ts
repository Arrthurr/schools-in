/// <reference types="cypress" />

describe("Provider Feedback Page", () => {
  beforeEach(() => {
    cy.visitAndWaitForLoad("/provider/feedback");
  });

  it("renders the page heading", () => {
    cy.contains("Help & Feedback").should("be.visible");
  });

  it("displays the description text", () => {
    cy.contains("We value your input").should("be.visible");
  });

  it("renders the feedback form card", () => {
    cy.contains("Submit Feedback").should("be.visible");
    cy.contains("Report a bug, request a feature, or send us general feedback.").should(
      "be.visible"
    );
  });

  it("renders form fields", () => {
    // Category and Severity labels
    cy.contains("label", "Category").should("be.visible");
    cy.contains("label", "Severity").should("be.visible");

    // Description textarea
    cy.contains("label", "Description").should("be.visible");
    cy.get("textarea").should("be.visible");

    // Contact email
    cy.contains("label", "Contact Email").should("be.visible");
    cy.get('input[placeholder="your@email.com"]').should("be.visible");
  });

  it("has submit and cancel buttons", () => {
    cy.contains("button", "Submit Feedback").should("be.visible");
    cy.contains("button", "Cancel").should("be.visible");
  });

  it("textarea accepts input text", () => {
    const testText = "This is a test description for feedback submission.";
    cy.get("textarea").clear().type(testText);
    cy.get("textarea").should("have.value", testText);
  });

  it("email input accepts input", () => {
    const testEmail = "test@example.com";
    cy.get('input[placeholder="your@email.com"]').clear().type(testEmail);
    cy.get('input[placeholder="your@email.com"]').should("have.value", testEmail);
  });

  it("shows validation error when submitting with empty description", () => {
    // Clear the description field to ensure it's empty
    cy.get("textarea").clear();
    // Click the submit button
    cy.contains("button", "Submit Feedback").click();
    // Validation error should appear
    cy.contains("Description must be at least 10 characters.").should("be.visible");
  });

  it("displays description help text", () => {
    cy.contains("Include steps to reproduce if reporting a bug.").should("be.visible");
  });

  it("displays email help text", () => {
    cy.contains("We may contact you if we need more information.").should("be.visible");
  });

  it("description textarea has placeholder text", () => {
    cy.get("textarea").should(
      "have.attr",
      "placeholder",
      "Please describe the issue or idea in detail..."
    );
  });

  it("renders correctly on mobile viewport", () => {
    cy.setMobileViewport();
    cy.visitAndWaitForLoad("/provider/feedback");
    cy.contains("Help & Feedback").should("be.visible");
    cy.contains("Submit Feedback").should("be.visible");
    cy.get("textarea").should("be.visible");
    cy.contains("button", "Submit Feedback").should("be.visible");
  });

  it("renders correctly on tablet viewport", () => {
    cy.setTabletViewport();
    cy.visitAndWaitForLoad("/provider/feedback");
    cy.contains("Help & Feedback").should("be.visible");
    cy.contains("Submit Feedback").should("be.visible");
    cy.get("textarea").should("be.visible");
    cy.contains("button", "Submit Feedback").should("be.visible");
    cy.contains("button", "Cancel").should("be.visible");
  });

  it("passes accessibility checks", () => {
    cy.checkA11y({ exclude: [".firebase-emulator-warning"] });
  });
});
