describe("Offline Functionality", () => {
  beforeEach(() => {
    cy.visitAndWaitForLoad("/");
  });

  it("shows an offline banner when offline", () => {
    cy.goOffline();
    cy.contains("You are currently offline").should("be.visible");
  });

  it("hides the offline banner when back online", () => {
    cy.goOffline();
    cy.contains("You are currently offline").should("be.visible");
    cy.goOnline();
    cy.contains("You are currently offline").should("not.exist");
  });
});
