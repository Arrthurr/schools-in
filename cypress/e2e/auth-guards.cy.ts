/// <reference types="cypress" />

/**
 * E2E tests for authentication guards and role-based routing.
 *
 * When `NEXT_PUBLIC_DISABLE_AUTH=true` (the default for tests),
 * `Cypress.env("authBypass")` is `true` and protected pages render
 * their content directly.  When auth is enforced, protected pages
 * should show a loading / verification state or redirect to login.
 */

const PROVIDER_ROUTES = [
  { path: "/dashboard", label: "Dashboard" },
  { path: "/dashboard/history", label: "Session History" },
  { path: "/dashboard/schools", label: "Dashboard Schools" },
  { path: "/profile", label: "Profile" },
  { path: "/provider/feedback", label: "Provider Feedback" },
];

const ADMIN_ROUTES = [
  { path: "/admin", label: "Admin Dashboard" },
  { path: "/admin/schools", label: "Admin Schools" },
  { path: "/admin/reports", label: "Admin Reports" },
  { path: "/admin/users", label: "Admin Users" },
  { path: "/admin/assignments", label: "Admin Assignments" },
  { path: "/admin/feedback", label: "Admin Feedback" },
  { path: "/admin/services", label: "Admin Services" },
];

const ALL_PROTECTED_ROUTES = [...PROVIDER_ROUTES, ...ADMIN_ROUTES];

if (Cypress.env("authBypass")) {
  // ── Auth bypass enabled (default test mode) ───────────────────────────

  describe("Auth bypass – provider routes render content", () => {
    PROVIDER_ROUTES.forEach(({ path, label }) => {
      it(`${label} (${path}) loads without crashing`, () => {
        cy.visit(path);
        cy.get("main").should("be.visible");
        // Should NOT show any auth-gate messages
        cy.contains("Loading...").should("not.exist");
        cy.contains("Verifying authentication...").should("not.exist");
        cy.contains("Loading user permissions...").should("not.exist");
      });
    });
  });

  describe("Auth bypass – admin routes render content", () => {
    ADMIN_ROUTES.forEach(({ path, label }) => {
      it(`${label} (${path}) loads without crashing`, () => {
        cy.visit(path);
        cy.get("main").should("be.visible");
        cy.contains("Loading...").should("not.exist");
        cy.contains("Verifying authentication...").should("not.exist");
        cy.contains("Loading user permissions...").should("not.exist");
      });
    });
  });

  describe("Auth bypass – no route crashes", () => {
    ALL_PROTECTED_ROUTES.forEach(({ path, label }) => {
      it(`${label} (${path}) has visible content`, () => {
        cy.visit(path);
        // Every protected route must render either a <main> or meaningful body content
        cy.get("body").should("not.be.empty");
        cy.get("main").should("exist");
      });
    });
  });
} else {
  // ── Auth enforced ─────────────────────────────────────────────────────

  describe("Auth enforced – protected routes show auth state or redirect", () => {
    ALL_PROTECTED_ROUTES.forEach(({ path, label }) => {
      it(`${label} (${path}) shows loading/auth state or redirects to login`, () => {
        cy.visit(path);

        // The page should either:
        //   a) redirect to "/" (login), OR
        //   b) show one of the ProtectedRoute loading states
        cy.url().then((url) => {
          const { pathname } = new URL(url);

          if (pathname === "/") {
            // Redirected to login – guard is working
            cy.location("pathname").should("eq", "/");
          } else {
            // Still on the page – must be showing an auth loading state
            cy.get("body").then(($body) => {
              const text = $body.text();
              const hasAuthState =
                text.includes("Loading...") ||
                text.includes("Verifying authentication...") ||
                text.includes("Loading user permissions...");
              expect(hasAuthState, "Page shows an auth-gate message").to.be
                .true;
            });
          }
        });
      });
    });
  });

  describe("Auth enforced – unauthenticated users cannot reach dashboard content", () => {
    it("visiting /dashboard does not render main dashboard content", () => {
      cy.visit("/dashboard");

      // Either we were redirected or we see a loading gate
      cy.get("body").then(($body) => {
        const text = $body.text();
        const isProtected =
          !text.includes("Welcome back") ||
          text.includes("Loading...") ||
          text.includes("Verifying authentication...");
        expect(isProtected, "Dashboard content is not exposed").to.be.true;
      });
    });

    it("visiting /admin does not render admin dashboard content", () => {
      cy.visit("/admin");

      cy.get("body").then(($body) => {
        const text = $body.text();
        const isProtected =
          !text.includes("Admin Dashboard") ||
          text.includes("Loading...") ||
          text.includes("Verifying authentication...");
        expect(isProtected, "Admin content is not exposed").to.be.true;
      });
    });
  });
}
