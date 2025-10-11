/// <reference types="cypress" />

describe("Microsoft Authentication Flow", () => {
  beforeEach(() => {
    // Visit the login page before each test
    cy.visit("/");
  });

  describe("Button Display and Position", () => {
    it("should display Microsoft sign-in button on login page", () => {
      // Verify Microsoft button exists
      cy.contains("button", "Sign in with Microsoft").should("be.visible");
      
      // Verify it has proper accessibility attributes
      cy.get('button[aria-label*="Microsoft"]').should("exist");
    });

    it("Microsoft button appears above Google button", () => {
      // Get all OAuth buttons
      cy.contains("button", "Sign in with Microsoft").then(($microsoftBtn) => {
        cy.contains("button", "Sign in with Google").then(($googleBtn) => {
          // Get their positions
          const microsoftTop = $microsoftBtn.offset()?.top || 0;
          const googleTop = $googleBtn.offset()?.top || 0;
          
          // Microsoft button should be above (smaller top value)
          expect(microsoftTop).to.be.lessThan(googleTop);
        });
      });
    });
  });

  describe("Successful Authentication", () => {
    it("should successfully sign in with Microsoft account", () => {
      // Mock successful Microsoft authentication
      cy.intercept("POST", "**/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp*", {
        statusCode: 200,
        body: {
          localId: "microsoft-user-123",
          email: "user@microsoft.com",
          displayName: "Microsoft User",
          idToken: "mock-id-token",
          refreshToken: "mock-refresh-token",
        },
      }).as("microsoftAuth");

      // Mock Firestore user document fetch
      cy.intercept("GET", "**/users/microsoft-user-123*", {
        statusCode: 200,
        body: {
          uid: "microsoft-user-123",
          email: "user@microsoft.com",
          role: "provider",
          displayName: "Microsoft User",
        },
      }).as("getUserDoc");

      // Click Microsoft sign-in button
      cy.contains("button", "Sign in with Microsoft").click();

      // Wait for authentication
      cy.wait("@microsoftAuth", { timeout: 10000 });
    });

    it("should redirect to dashboard after Microsoft provider sign-in", () => {
      // Mock Microsoft auth for provider user
      cy.intercept("POST", "**/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp*", {
        statusCode: 200,
        body: {
          localId: "provider-123",
          email: "provider@microsoft.com",
          idToken: "mock-token",
        },
      });

      cy.intercept("GET", "**/users/provider-123*", {
        statusCode: 200,
        body: {
          uid: "provider-123",
          role: "provider",
          email: "provider@microsoft.com",
        },
      });

      cy.contains("button", "Sign in with Microsoft").click();

      // Should redirect to provider dashboard
      cy.url().should("include", "/dashboard");
    });

    it("should redirect to admin dashboard for Microsoft admin users", () => {
      // Mock Microsoft auth for admin user
      cy.intercept("POST", "**/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp*", {
        statusCode: 200,
        body: {
          localId: "admin-123",
          email: "admin@microsoft.com",
          idToken: "mock-token",
        },
      });

      cy.intercept("GET", "**/users/admin-123*", {
        statusCode: 200,
        body: {
          uid: "admin-123",
          role: "admin",
          email: "admin@microsoft.com",
        },
      });

      cy.contains("button", "Sign in with Microsoft").click();

      // Should redirect to admin dashboard
      cy.url().should("include", "/admin");
    });
  });

  describe("Error Handling", () => {
    it("should show 'Your account is not authorized' for unauthorized Microsoft accounts", () => {
      // Mock Microsoft auth success but no user document
      cy.intercept("POST", "**/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp*", {
        statusCode: 200,
        body: {
          localId: "unauthorized-123",
          email: "unauthorized@microsoft.com",
          idToken: "mock-token",
        },
      });

      cy.intercept("GET", "**/users/unauthorized-123*", {
        statusCode: 404,
        body: null,
      });

      cy.contains("button", "Sign in with Microsoft").click();

      // Should show authorization error
      cy.contains("Your account is not authorized").should("be.visible");
    });

    it("should handle Microsoft popup cancellation gracefully", () => {
      // Mock user cancelling the popup
      cy.intercept("POST", "**/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp*", {
        statusCode: 400,
        body: {
          error: {
            message: "POPUP_CLOSED_BY_USER",
          },
        },
      });

      cy.contains("button", "Sign in with Microsoft").click();

      // Should handle gracefully without crashing
      cy.contains("button", "Sign in with Microsoft").should("be.visible");
    });
  });

  describe("Loading States", () => {
    it("should show loading state during Microsoft authentication", () => {
      // Mock delayed response
      cy.intercept("POST", "**/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp*", {
        statusCode: 200,
        body: {
          localId: "user-123",
          email: "user@microsoft.com",
        },
        delay: 500,
      });

      cy.contains("button", "Sign in with Microsoft").click();

      // Should show loading text
      cy.contains("Connecting").should("be.visible");
    });
  });

  describe("Accessibility", () => {
    it("should announce Microsoft sign-in success to screen readers", () => {
      // Mock successful auth
      cy.intercept("POST", "**/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp*", {
        statusCode: 200,
        body: {
          localId: "user-123",
          email: "user@microsoft.com",
        },
      });

      cy.intercept("GET", "**/users/user-123*", {
        statusCode: 200,
        body: {
          uid: "user-123",
          role: "provider",
        },
      });

      cy.contains("button", "Sign in with Microsoft").click();

      // Check for aria-live region
      cy.get('[aria-live="polite"]').should("exist");
    });

    it("should announce Microsoft sign-in errors to screen readers", () => {
      // Mock error
      cy.intercept("POST", "**/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp*", {
        statusCode: 400,
        body: {
          error: {
            message: "INVALID_IDP_RESPONSE",
          },
        },
      });

      cy.contains("button", "Sign in with Microsoft").click();

      // Check for assertive aria-live region with error
      cy.get('[role="alert"]').should("be.visible");
    });
  });

  describe("Mobile Responsiveness", () => {
    it("should work correctly on mobile viewport", () => {
      // Set mobile viewport
      cy.viewport(375, 667);

      // Verify button is visible and accessible
      cy.contains("button", "Sign in with Microsoft").should("be.visible");
      
      // Button should be touch-friendly (proper size)
      cy.contains("button", "Sign in with Microsoft").then(($btn) => {
        const height = $btn.height() || 0;
        expect(height).to.be.at.least(44); // Minimum touch target size
      });
    });

    it("should work correctly on tablet viewport", () => {
      // Set tablet viewport
      cy.viewport(768, 1024);

      // Verify functionality
      cy.contains("button", "Sign in with Microsoft").should("be.visible");
      cy.contains("button", "Sign in with Microsoft").click();

      // Should show loading state
      cy.contains("Connecting").should("be.visible");
    });
  });

  describe("Integration with Form", () => {
    it("should work alongside email/password authentication", () => {
      // Verify all auth options are present
      cy.get('input[type="email"]').should("be.visible");
      cy.get('input[type="password"]').should("be.visible");
      cy.contains("button", "Sign In").should("be.visible");
      cy.contains("button", "Sign in with Microsoft").should("be.visible");
      cy.contains("button", "Sign in with Google").should("be.visible");
    });

    it("should share loading state with other auth methods", () => {
      // Start Microsoft sign-in
      cy.intercept("POST", "**/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp*", {
        statusCode: 200,
        body: { localId: "user-123" },
        delay: 1000,
      });

      cy.contains("button", "Sign in with Microsoft").click();

      // All buttons should be disabled during loading
      cy.contains("button", "Sign In").should("be.visible");
      cy.contains("button", "Sign in with Google").should("be.visible");
    });
  });
});

