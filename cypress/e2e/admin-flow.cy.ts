/// <reference types="cypress" />

describe("Admin Management Workflows", () => {
  // ──────────────────────────────────────────────────
  // Admin Dashboard (/admin)
  // ──────────────────────────────────────────────────
  describe("Admin Dashboard", () => {
    beforeEach(() => {
      cy.visitAndWaitForLoad("/admin");
    });

    it("renders the admin dashboard", () => {
      cy.contains("Admin Dashboard").should("be.visible");
    });

    it("shows admin navigation items", () => {
      cy.get('nav[aria-label="Admin navigation"]').within(() => {
        cy.contains("Dashboard").should("be.visible");
        cy.contains("Schools").should("be.visible");
        cy.contains("Reports").should("be.visible");
        cy.contains("Users").should("be.visible");
        cy.contains("Services").should("be.visible");
        cy.contains("Assignments").should("be.visible");
        cy.contains("Feedback").should("be.visible");
      });
    });

    it("navigates to Schools page when clicking Schools nav link", () => {
      cy.get('nav[aria-label="Admin navigation"]')
        .contains("Schools")
        .click();
      cy.location("pathname").should("eq", "/admin/schools/");
      cy.contains("School Management").should("be.visible");
    });

    it("navigates to Users page when clicking Users nav link", () => {
      cy.get('nav[aria-label="Admin navigation"]')
        .contains("Users")
        .click();
      cy.location("pathname").should("eq", "/admin/users/");
      cy.contains("User Management").should("be.visible");
    });

    it("navigates to Reports page when clicking Reports nav link", () => {
      cy.get('nav[aria-label="Admin navigation"]')
        .contains("Reports")
        .click();
      cy.location("pathname").should("eq", "/admin/reports/");
      cy.contains("Reports & Management").should("be.visible");
    });

    it("navigates to Assignments page when clicking Assignments nav link", () => {
      cy.get('nav[aria-label="Admin navigation"]')
        .contains("Assignments")
        .click();
      cy.location("pathname").should("eq", "/admin/assignments/");
      cy.contains("School-Provider Assignments").should("be.visible");
    });

    it("renders correctly on tablet viewport", () => {
      cy.setTabletViewport();
      cy.visitAndWaitForLoad("/admin");
      cy.contains("Admin Dashboard").should("be.visible");
    });

    it("shows the mobile navigation toggle", () => {
      cy.setMobileViewport();
      cy.visitAndWaitForLoad("/admin");
      cy.get('button[aria-label="Open navigation menu"]').should("be.visible");
    });

    it("passes accessibility checks", () => {
      cy.checkA11y({ exclude: [".firebase-emulator-warning"] });
    });
  });

  // ──────────────────────────────────────────────────
  // School Management (/admin/schools)
  // ──────────────────────────────────────────────────
  describe("School Management", () => {
    beforeEach(() => {
      cy.visitAndWaitForLoad("/admin/schools");
    });

    it("renders the School Management heading", () => {
      cy.contains("School Management").should("be.visible");
    });

    it("has a visible search input", () => {
      cy.get('input[placeholder*="Search schools"]').should("be.visible");
    });

    it("accepts text in the search input", () => {
      cy.get('input[placeholder*="Search schools"]')
        .type("Lincoln Elementary")
        .should("have.value", "Lincoln Elementary");
    });

    it("clears the search input", () => {
      cy.get('input[placeholder*="Search schools"]')
        .type("test school")
        .clear()
        .should("have.value", "");
    });

    it("has an Add School button", () => {
      cy.contains("button", "Add School").should("be.visible");
    });

    it("opens form dialog when clicking Add School", () => {
      cy.contains("button", "Add School").click();
      cy.get('[role="dialog"]').should("be.visible");
      cy.get('[role="dialog"]').within(() => {
        cy.contains("Add New School").should("exist");
        cy.contains("School Name").should("exist");
        cy.contains("Address").should("exist");
        cy.contains("Cancel").should("be.visible");
      });
    });

    it("closes the Add School dialog on Cancel", () => {
      cy.contains("button", "Add School").click();
      cy.get('[role="dialog"]').should("be.visible");
      cy.get('[role="dialog"]').within(() => {
        cy.contains("button", "Cancel").click();
      });
      cy.get('[role="dialog"]').should("not.exist");
    });

    it("shows school cards or empty state", () => {
      // Wait for loading skeletons to disappear
      cy.get(".animate-pulse").should("not.exist");
      cy.get("main").then(($main) => {
        const hasEmptyState = $main.text().includes("No schools configured") || $main.text().includes("No schools found");
        if (hasEmptyState) {
          cy.contains(/No schools configured|No schools found/).should("be.visible");
        } else {
          cy.contains("Check-in radius:").should("exist");
          cy.contains("Coordinates:").should("exist");
          cy.contains("providers").should("exist");
          cy.contains("button", "Edit").should("exist");
          cy.contains("button", "View schedules").should("exist");
        }
      });
    });

    it("has a Refresh button", () => {
      cy.contains("button", "Refresh").should("be.visible");
    });

    it("renders correctly on tablet viewport", () => {
      cy.setTabletViewport();
      cy.visitAndWaitForLoad("/admin/schools");
      cy.contains("School Management").should("be.visible");
      cy.get('input[placeholder*="Search schools"]').should("be.visible");
      cy.contains("button", "Add School").should("be.visible");
    });

    it("renders correctly on mobile viewport", () => {
      cy.setMobileViewport();
      cy.visitAndWaitForLoad("/admin/schools");
      cy.contains("School Management").should("be.visible");
      cy.get('input[placeholder*="Search schools"]').should("be.visible");
    });

    it("passes accessibility checks", () => {
      cy.checkA11y({ exclude: [".firebase-emulator-warning"] });
    });
  });

  // ──────────────────────────────────────────────────
  // Reports & Management (/admin/reports)
  // ──────────────────────────────────────────────────
  describe("Reports & Management", () => {
    it("opens reports and management", () => {
      cy.visitAndWaitForLoad("/admin/reports");
      cy.contains("Reports & Management").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────
  // User Management (/admin/users)
  // ──────────────────────────────────────────────────
  describe("User Management", () => {
    beforeEach(() => {
      cy.visitAndWaitForLoad("/admin/users");
    });

    it("renders the User Management heading", () => {
      cy.contains("User Management").should("be.visible");
    });

    it("displays all five stats cards", () => {
      cy.contains("Total Users").should("be.visible");
      cy.contains("Providers").should("be.visible");
      cy.contains("Admins").should("be.visible");
      cy.contains("Active").should("be.visible");
      cy.contains("Inactive").should("be.visible");
    });

    it("has a visible search input", () => {
      cy.get('input[placeholder*="Search users by name or email"]').should(
        "be.visible"
      );
    });

    it("accepts text in the search input", () => {
      cy.get('input[placeholder*="Search users by name or email"]')
        .type("john@example.com")
        .should("have.value", "john@example.com");
    });

    it("clears the search input", () => {
      cy.get('input[placeholder*="Search users by name or email"]')
        .type("test")
        .clear()
        .should("have.value", "");
    });

    it("has a status filter dropdown with correct options", () => {
      cy.get('select[aria-label="Filter by status"]').within(() => {
        cy.contains("option", "All Status").should("exist");
        cy.contains("option", "Active").should("exist");
        cy.contains("option", "Inactive").should("exist");
      });
    });

    it("can change the status filter", () => {
      cy.get('select[aria-label="Filter by status"]').select("active");
      cy.get('select[aria-label="Filter by status"]').should(
        "have.value",
        "active"
      );
    });

    it("has a role filter dropdown with correct options", () => {
      cy.get('select[aria-label="Filter by role"]').within(() => {
        cy.contains("option", "All Roles").should("exist");
        cy.contains("option", "Providers").should("exist");
        cy.contains("option", "Admins").should("exist");
      });
    });

    it("can change the role filter", () => {
      cy.get('select[aria-label="Filter by role"]').select("admin");
      cy.get('select[aria-label="Filter by role"]').should(
        "have.value",
        "admin"
      );
    });

    it("has an Export CSV button", () => {
      cy.contains("button", "Export CSV").should("be.visible");
    });

    it("has a Select All button", () => {
      cy.contains("button", "Select All").should("be.visible");
    });

    it("shows user list or empty state", () => {
      // Wait for content to settle after loading
      cy.get("main").should("be.visible");
      cy.get("main").then(($main) => {
        const hasEmpty = $main
          .text()
          .includes("No users found matching your criteria");
        if (hasEmpty) {
          cy.contains("No users found matching your criteria").should(
            "be.visible"
          );
        } else {
          // User list loaded - check for user management elements
          cy.contains("Total Users").should("be.visible");
        }
      });
    });

    it("renders correctly on tablet viewport", () => {
      cy.setTabletViewport();
      cy.visitAndWaitForLoad("/admin/users");
      cy.contains("User Management").should("be.visible");
      cy.contains("Total Users").should("be.visible");
      cy.contains("Providers").should("be.visible");
    });

    it("renders correctly on mobile viewport", () => {
      cy.setMobileViewport();
      cy.visitAndWaitForLoad("/admin/users");
      cy.contains("User Management").should("be.visible");
      cy.contains("Total Users").should("be.visible");
    });

    it("passes accessibility checks", () => {
      cy.checkA11y({ exclude: [".firebase-emulator-warning"] });
    });
  });

  // ──────────────────────────────────────────────────
  // Assignments (/admin/assignments)
  // ──────────────────────────────────────────────────
  describe("Assignments", () => {
    it("opens assignments", () => {
      cy.visitAndWaitForLoad("/admin/assignments");
      cy.contains("School-Provider Assignments").should("be.visible");
    });
  });
});
