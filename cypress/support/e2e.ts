/// <reference types="cypress" />

// Import commands.js using ES2015 syntax:
import './commands.js'

// Custom command type declarations
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to log in a user
       * @param email - User email
       * @param password - User password  
       * @param options - Additional options like role
       */
      login(email: string, password: string, options?: { role?: string }): Chainable<void>
      
      /**
       * Mock geolocation to specific coordinates
       * @param latitude - Latitude coordinate
       * @param longitude - Longitude coordinate
       */
      mockGeolocation(latitude: number, longitude: number): Chainable<void>
      
      /**
       * Visit page and wait for it to load
       * @param url - URL to visit
       */
      visitAndWaitForLoad(url: string): Chainable<void>
      
      /**
       * Check accessibility
       */
      checkA11y(): Chainable<void>
      
      /**
       * Set mobile viewport
       */
      setMobileViewport(): Chainable<void>
      
      /**
       * Set tablet viewport
       */
      setTabletViewport(): Chainable<void>
      
      /**
       * Set desktop viewport
       */
      setDesktopViewport(): Chainable<void>
      
      /**
       * Wait for loading spinners to disappear
       */
      waitForNoLoadingSpinner(): Chainable<void>
      
      /**
       * Tab to next element (keyboard navigation)
       */
      tab(): Chainable<JQuery>
      
      /**
       * Wait for page to fully load
       */
      waitForPageLoad(): Chainable<void>
      
      /**
       * Simulate going offline
       */
      goOffline(): Chainable<void>
      
      /**
       * Simulate going online
       */
      goOnline(): Chainable<void>
      
      /**
       * Check for active session state
       * @param schoolName - Optional school name to verify
       */
      shouldHaveActiveSession(schoolName?: string): Chainable<void>
      
      /**
       * Check for inactive session state
       */
      shouldHaveInactiveSession(): Chainable<void>
      
      /**
       * Mock API error responses
       * @param method - HTTP method
       * @param url - URL pattern
       * @param statusCode - HTTP status code
       */
      mockApiError(method: string, url: string, statusCode?: number): Chainable<void>
      
      /**
       * Enhanced accessibility testing with axe-core
       * @param context - Element or selector to test
       * @param options - Axe options
       */
      checkA11y(context?: string | Node, options?: any): Chainable<void>
      
      /**
       * Inject axe-core for accessibility testing
       */
      injectAxe(): Chainable<void>
      
      /**
       * Configure axe rules and settings
       * @param config - Axe configuration
       */
      configureAxe(config: any): Chainable<void>
      
      /**
       * Measure page load time
       * @param url - URL to visit and measure
       */
      measurePageLoad(url: string): Chainable<void>
      
      /**
       * Measure Core Web Vitals (FCP, LCP, etc.)
       */
      measureWebVitals(): Chainable<void>
      
      /**
       * Check memory usage
       */
      checkMemoryUsage(): Chainable<void>
      
      /**
       * Run comprehensive lighthouse-like checks
       * @param url - URL to test
       * @param options - Testing options
       */
      lighthouse(url: string, options?: any): Chainable<void>
    }
  }
}

export {};
