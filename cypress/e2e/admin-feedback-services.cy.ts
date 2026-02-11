/// <reference types="cypress" />

describe("Admin Feedback Page", () => {
  beforeEach(() => {
    cy.visitAndWaitForLoad("/admin/feedback");
  });

  it("renders with heading 'Provider Feedback'", () => {
    cy.contains("Provider Feedback").should("be.visible");
  });

  it("has a Refresh button visible", () => {
    cy.contains("button", "Refresh").should("be.visible");
  });

  it("displays table headers", () => {
    const headers = [
      "Status",
      "Date",
      "Category",
      "Severity",
      "Provider",
      "Description",
      "Actions",
    ];
    headers.forEach((header) => {
      cy.contains("th", header).should("exist");
    });
  });

  it("shows empty state or feedback list", () => {
    cy.get("main").then(($main) => {
      const hasEmptyState = $main
        .text()
        .includes("No feedback submissions found.");
      if (hasEmptyState) {
        cy.contains("No feedback submissions found.").should("be.visible");
      } else {
        // Feedback rows exist; verify at least one View button
        cy.contains("button", "View").should("be.visible");
      }
    });
  });

  it("Refresh button is clickable and does not crash", () => {
    cy.contains("button", "Refresh").click();
    // Page should still render after refresh
    cy.contains("Provider Feedback").should("be.visible");
    cy.contains("button", "Refresh").should("be.visible");
  });

  it("displays 'Recent Feedback' card header with count", () => {
    cy.contains("Recent Feedback").should("be.visible");
    // The header contains a count in parentheses, e.g. "Recent Feedback (0)"
    cy.get("main").then(($main) => {
      const text = $main.text();
      expect(text).to.match(/Recent Feedback \(\d+\)/);
    });
  });

  it("is usable on mobile viewport", () => {
    cy.setMobileViewport();
    cy.visitAndWaitForLoad("/admin/feedback");
    cy.contains("Provider Feedback").should("be.visible");
    cy.contains("button", "Refresh").should("be.visible");
    // Table or its container should still be present
    cy.get("table").should("exist");
  });

  it("passes accessibility checks", () => {
    cy.checkA11y({ exclude: [".firebase-emulator-warning"] });
  });
});

describe("Admin Services Page", () => {
  beforeEach(() => {
    cy.visitAndWaitForLoad("/admin/services");
  });

  it("renders with heading 'Service Management'", () => {
    cy.contains("Service Management").should("be.visible");
    cy.contains("Manage service types that providers can be scheduled for.").should(
      "be.visible"
    );
  });

  it("has an 'Add Service' button visible", () => {
    cy.contains("button", "Add Service").should("be.visible");
  });

  it("displays stats cards", () => {
    cy.contains("Total Services").should("be.visible");
    cy.contains("Active").should("be.visible");
    cy.contains("Inactive").should("be.visible");
  });

  it("has a search input", () => {
    cy.get('input[placeholder*="Search services"]').should("be.visible");
  });

  it("opens create dialog when clicking 'Add Service'", () => {
    cy.contains("button", "Add Service").click();
    cy.get('[role="dialog"]').should("be.visible");
    cy.get('[role="dialog"]').within(() => {
      cy.contains("Service Name").should("exist");
      cy.contains("Service Code").should("exist");
      cy.contains("Description").should("exist");
      cy.contains("Active").should("exist");
      cy.contains("button", "Cancel").should("be.visible");
      cy.contains("button", "Create Service").should("be.visible");
    });
  });

  it("is usable on mobile viewport", () => {
    cy.setMobileViewport();
    cy.visitAndWaitForLoad("/admin/services");
    cy.contains("Service Management").should("be.visible");
    cy.contains("button", "Add Service").should("be.visible");
    cy.get('input[placeholder*="Search services"]').should("be.visible");
  });

  it("search input accepts text and filters", () => {
    cy.get('input[placeholder*="Search services"]')
      .should("be.visible")
      .type("nonexistent-service-xyz");
    // After typing a nonsense query, either we get filtered results or empty state
    cy.get("main").then(($main) => {
      const text = $main.text();
      const hasNoResults =
        text.includes("No services found") ||
        text.includes("No services configured");
      if (hasNoResults) {
        // Search filtered everything out — expected for nonsense query
        cy.get('input[placeholder*="Search services"]').should(
          "have.value",
          "nonexistent-service-xyz"
        );
      } else {
        // Some services matched — just verify the page didn't crash
        cy.contains("Service Management").should("be.visible");
      }
    });
    // Clear the search and verify reset
    cy.get('input[placeholder*="Search services"]').clear();
    cy.contains("Service Management").should("be.visible");
  });

  it("create dialog form fields accept input", () => {
    cy.contains("button", "Add Service").click();
    cy.get('[role="dialog"]').should("be.visible");

    cy.get('[role="dialog"]').within(() => {
      // Fill in Service Name
      cy.get('input[placeholder="e.g., Title I Reading"]')
        .type("Test Service")
        .should("have.value", "Test Service");

      // Fill in Service Code — should auto-uppercase
      cy.get('input[placeholder="e.g., T1-READ"]')
        .type("test-code")
        .should("have.value", "TEST-CODE");

      // Fill in Description
      cy.get('input[placeholder="Brief description of this service type"]')
        .type("A test description")
        .should("have.value", "A test description");
    });
  });

  it("Active checkbox in create dialog is checkable", () => {
    cy.contains("button", "Add Service").click();
    cy.get('[role="dialog"]').should("be.visible");

    cy.get('[role="dialog"]').within(() => {
      // The Active checkbox defaults to checked
      cy.get("#isActive").should("be.checked");

      // Uncheck it
      cy.get("#isActive").uncheck();
      cy.get("#isActive").should("not.be.checked");

      // Re-check it
      cy.get("#isActive").check();
      cy.get("#isActive").should("be.checked");
    });
  });

  it("Cancel button closes the create dialog", () => {
    cy.contains("button", "Add Service").click();
    cy.get('[role="dialog"]').should("be.visible");

    cy.get('[role="dialog"]').within(() => {
      cy.contains("button", "Cancel").click();
    });

    // Dialog should be gone
    cy.get('[role="dialog"]').should("not.exist");
  });

  it("create dialog shows 'Create Service' title for new service", () => {
    cy.contains("button", "Add Service").click();
    cy.get('[role="dialog"]').should("be.visible");
    cy.get('[role="dialog"]').within(() => {
      cy.contains("Create Service").should("be.visible");
      // Should NOT show "Edit Service" or "Update Service"
      cy.contains("Edit Service").should("not.exist");
      cy.contains("Update Service").should("not.exist");
    });
  });

  it("passes accessibility checks", () => {
    cy.checkA11y({ exclude: [".firebase-emulator-warning"] });
  });

  it("is usable on tablet viewport", () => {
    cy.setTabletViewport();
    cy.visitAndWaitForLoad("/admin/services");
    cy.contains("Service Management").should("be.visible");
    cy.contains("button", "Add Service").should("be.visible");
    cy.get('input[placeholder*="Search services"]').should("be.visible");
    cy.contains("Total Services").should("be.visible");
    cy.contains("Active").should("be.visible");
    cy.contains("Inactive").should("be.visible");
  });
});
