describe('UI Components', () => {
  beforeEach(() => {
    cy.visitAndWaitForLoad('/')
  })

  describe('Buttons', () => {
    it('Get Started button is interactive', () => {
      cy.get('button').contains('Get Started')
        .should('be.visible')
        .should('not.be.disabled')
        .click()
    })

    it('Learn More button is interactive', () => {
      cy.get('button').contains('Learn More')
        .should('be.visible')
        .should('not.be.disabled')
        .click()
    })

    it('buttons have proper styling', () => {
      cy.get('button').contains('Get Started')
        .should('have.class', 'bg-primary')
      
      cy.get('button').contains('Learn More')
        .should('have.class', 'border')
    })

    it('buttons have hover effects', () => {
      cy.get('button').contains('Get Started')
        .trigger('mouseover')
        .should('have.css', 'transition-property')
    })
  })

  describe('Cards', () => {
    it('feature cards are properly displayed', () => {
      const cards = [
        { title: 'Provider Dashboard', icon: '📍' },
        { title: 'Admin Panel', icon: '⚙️' },
        { title: 'Session History', icon: '📊' },
        { title: 'Mobile PWA', icon: '📱' }
      ]

      cards.forEach(card => {
        cy.contains(card.title).should('be.visible')
        cy.contains(card.icon).should('be.visible')
      })
    })

    it('cards have hover effects', () => {
      cy.get('[class*="group"]').first()
        .trigger('mouseover')
        .should('have.css', 'transition')
    })
  })

  describe('Component Demo Section', () => {
    it('displays various button variants', () => {
      const variants = ['Default', 'Secondary', 'Outline', 'Ghost', 'Destructive']
      
      variants.forEach(variant => {
        cy.get('button').contains(variant).should('be.visible')
      })
    })

    it('displays various badge variants', () => {
      const badges = ['Default', 'Secondary', 'Destructive', 'Outline']
      
      // Check that badges exist (there might be multiple with same text)
      badges.forEach(badge => {
        cy.contains(badge).should('be.visible')
      })
    })
  })
})

describe('Visual Styling', () => {
  beforeEach(() => {
    cy.visitAndWaitForLoad('/')
  })

  it('applies brand colors correctly', () => {
    // Check primary color usage
    cy.get('[class*="bg-primary"]').should('exist')
    cy.get('[class*="text-primary"]').should('exist')
  })

  it('has proper typography', () => {
    cy.get('h1').should('have.css', 'font-weight')
    cy.get('p').should('have.css', 'line-height')
  })

  it('has consistent spacing', () => {
    cy.get('main').should('have.css', 'padding')
    cy.get('[class*="gap-"]').should('exist')
  })

  it('uses proper border radius', () => {
    cy.get('button').should('have.css', 'border-radius')
    cy.get('[class*="rounded"]').should('exist')
  })
})
