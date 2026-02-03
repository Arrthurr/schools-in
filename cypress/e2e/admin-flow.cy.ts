/// <reference types="cypress" />

describe("Admin Management Workflows", () => {
  it("renders the admin dashboard", () => {
    cy.visit("/admin");
    cy.get("main").should("be.visible");
    cy.contains("Admin Dashboard").should("be.visible");
  });

  it("shows admin navigation items", () => {
    cy.visit("/admin");
    cy.contains("Schools").should("be.visible");
    cy.contains("Reports").should("be.visible");
    cy.contains("Users").should("be.visible");
    cy.contains("Assignments").should("be.visible");
  });

  it("opens school management", () => {
    cy.visit("/admin/schools");
    cy.contains("School Management").should("be.visible");
    cy.get('input[placeholder*="Search schools"]').should("be.visible");
  });

  it("opens reports and management", () => {
    cy.visit("/admin/reports");
    cy.contains("Reports & Management").should("be.visible");
  });

  it("opens user management", () => {
    cy.visit("/admin/users");
    cy.contains("User Management").should("be.visible");
  });

  it("opens assignments", () => {
    cy.visit("/admin/assignments");
    cy.contains("School-Provider Assignments").should("be.visible");
  });

  it("shows the mobile navigation toggle", () => {
    cy.setMobileViewport();
    cy.visit("/admin");
    cy.get('button[aria-label="Open navigation menu"]').should("be.visible");
  });
});
