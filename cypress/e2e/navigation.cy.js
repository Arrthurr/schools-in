describe('Navigation and Routing', () => {
  it('loads the homepage successfully', () => {
    cy.visit('/')
    cy.get('main').should('be.visible')
    cy.url().should('eq', Cypress.config().baseUrl + '/')
  })

  it('handles 404 pages gracefully', () => {
    cy.visit('/non-existent-page', { failOnStatusCode: false })
    // Next.js will show a 404 page or redirect
    cy.get('body').should('be.visible')
  })

  it('has proper page title and meta tags', () => {
    cy.visit('/')
    cy.title().should('contain', 'Schools-In')
    cy.get('meta[name="description"]').should('exist')
  })
})

describe('Performance and Loading', () => {
  it('loads within acceptable time', () => {
    const start = Date.now()
    cy.visit('/')
    cy.get('main').should('be.visible').then(() => {
      const loadTime = Date.now() - start
      expect(loadTime).to.be.lessThan(5000) // 5 second timeout
    })
  })

  it('loads all critical resources', () => {
    cy.visit('/')
    
    // Check that main content is loaded
    cy.get('h1').should('be.visible')
    cy.get('button').should('have.length.greaterThan', 0)
    
    // Check that styles are applied (Tailwind classes)
    cy.get('[class*="bg-primary"]').should('exist')
  })
})
