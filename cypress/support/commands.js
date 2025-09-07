// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

// Custom command for login (will be implemented later with Firebase Auth)
Cypress.Commands.add('login', (email, password) => {
  cy.log('Custom login command - to be implemented with Firebase Auth')
  // Implementation will be added when Firebase Auth is set up
})

// Custom command to visit page and wait for it to load
Cypress.Commands.add('visitAndWaitForLoad', (url) => {
  cy.visit(url)
  cy.get('main').should('be.visible')
})

// Custom command to check accessibility (can be enhanced with axe-core later)
Cypress.Commands.add('checkA11y', () => {
  cy.log('Accessibility check - can be enhanced with axe-core')
  // Basic accessibility checks
  cy.get('main').should('exist')
  cy.get('h1').should('exist')
})

// Custom command for mobile viewport testing
Cypress.Commands.add('setMobileViewport', () => {
  cy.viewport(375, 667) // iPhone SE dimensions
})

// Custom command for tablet viewport testing
Cypress.Commands.add('setTabletViewport', () => {
  cy.viewport(768, 1024) // iPad dimensions
})

// Custom command for desktop viewport testing
Cypress.Commands.add('setDesktopViewport', () => {
  cy.viewport(1280, 720) // Standard desktop
})

// Custom command to check for loading states
Cypress.Commands.add('waitForNoLoadingSpinner', () => {
  cy.get('[data-testid="loading"]').should('not.exist')
  cy.get('.animate-spin').should('not.exist')
})
