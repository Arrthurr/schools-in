describe('Homepage', () => {
  beforeEach(() => {
    cy.visitAndWaitForLoad('/')
  })

  it('displays the main heading and description', () => {
    cy.get('h1').should('contain.text', 'Welcome to Schools-In')
    cy.get('p').should('contain.text', 'Streamlined location-based check-in and check-out system')
  })

  it('shows the Get Started and Learn More buttons', () => {
    cy.get('button').contains('Get Started').should('be.visible')
    cy.get('button').contains('Learn More').should('be.visible')
  })

  it('displays all feature cards', () => {
    const features = [
      'Provider Dashboard',
      'Admin Panel', 
      'Session History',
      'Mobile PWA'
    ]

    features.forEach(feature => {
      cy.contains(feature).should('be.visible')
    })
  })

  it('shows the component demo section', () => {
    cy.contains('shadcn/ui Components Demo').should('be.visible')
    cy.get('[class*="bg-primary"]').should('have.length.greaterThan', 0)
  })

  it('has proper semantic structure', () => {
    cy.get('main').should('exist')
    cy.get('h1').should('exist')
    cy.checkA11y()
  })

  it('displays beta badge', () => {
    cy.contains('Beta').should('be.visible')
  })
})

describe('Homepage Responsive Design', () => {
  it('works on mobile devices', () => {
    cy.setMobileViewport()
    cy.visitAndWaitForLoad('/')
    
    cy.get('h1').should('be.visible')
    cy.get('button').contains('Get Started').should('be.visible')
  })

  it('works on tablet devices', () => {
    cy.setTabletViewport()
    cy.visitAndWaitForLoad('/')
    
    cy.get('h1').should('be.visible')
    cy.get('button').contains('Get Started').should('be.visible')
  })

  it('works on desktop', () => {
    cy.setDesktopViewport()
    cy.visitAndWaitForLoad('/')
    
    cy.get('h1').should('be.visible')
    cy.get('button').contains('Get Started').should('be.visible')
  })
})
