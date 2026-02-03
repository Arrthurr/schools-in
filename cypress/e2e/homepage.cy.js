describe("Landing and Access", () => {
  beforeEach(() => {
    cy.visitAndWaitForLoad("/");
  });

  it("renders primary content", () => {
    cy.get("main").should("be.visible");
    cy.get("h1").should("be.visible");
  });

  it("shows a primary action", () => {
    cy.get("button").should("have.length.greaterThan", 0);
  });

  it("has proper semantic structure", () => {
    cy.get("main").should("exist");
    cy.get("h1").should("exist");
    cy.checkA11y({ exclude: [".firebase-emulator-warning"] });
  });
});

describe("Landing Responsive Design", () => {
  it("works on mobile devices", () => {
    cy.setMobileViewport();
    cy.visitAndWaitForLoad("/");
    cy.get("h1").should("be.visible");
  });

  it("works on tablet devices", () => {
    cy.setTabletViewport();
    cy.visitAndWaitForLoad("/");
    cy.get("h1").should("be.visible");
  });

  it("works on desktop", () => {
    cy.setDesktopViewport();
    cy.visitAndWaitForLoad("/");
    cy.get("h1").should("be.visible");
  });
});
