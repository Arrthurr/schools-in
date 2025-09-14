describe("Meta tags", () => {
  it("includes mobile-web-app-capable meta", () => {
    cy.visit("/");
    cy.get('head meta[name="mobile-web-app-capable"][content="yes"]').should(
      "exist"
    );
  });
});
