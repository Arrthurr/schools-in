/// <reference types="cypress" />

describe("Provider Check-In/Check-Out Flow", () => {
  beforeEach(() => {
    // Mock Firebase auth and firestore
    cy.login("provider@test.com", "password", { role: "provider" });
    
    // Mock school data consistently
    cy.intercept("GET", "/api/locations?providerId=*", {
      statusCode: 200,
      body: {
        schools: [
          {
            id: "school1",
            name: "Test School 1",
            address: "123 Main St, Anytown, USA",
            coordinates: {
              lat: 34.0522,
              lng: -118.2437
            },
            radius: 500,
            providerId: "provider123"
          },
          {
            id: "school2", 
            name: "Test School 2",
            address: "456 Oak Ave, Anytown, USA",
            coordinates: {
              lat: 34.0532,
              lng: -118.2447
            },
            radius: 300,
            providerId: "provider123"
          }
        ]
      }
    }).as("getSchools");

    // Mock session data
    cy.intercept("GET", "/api/sessions?providerId=*", {
      statusCode: 200,
      body: { sessions: [] }
    }).as("getSessions");

    cy.visit("/dashboard");
    cy.wait("@getSchools");
  });

  describe("Successful Check-In/Check-Out", () => {
    it("should complete a full check-in and check-out cycle when within range", () => {
      // Mock location to be within radius of Test School 1
      cy.mockGeolocation(34.0522, -118.2437);

      // Navigate to school and initiate check-in
      cy.contains("Test School 1").click();
      cy.contains("button", "Check In").should("be.visible").click();

      // Verify GPS loading states
      cy.contains("Getting your location").should("be.visible");
      
      // Mock successful check-in API call
      cy.intercept("POST", "/api/sessions", {
        statusCode: 201,
        body: {
          id: "session123",
          status: "active",
          checkInTime: new Date().toISOString(),
          schoolId: "school1",
          providerId: "provider123",
          location: { lat: 34.0522, lng: -118.2437 }
        }
      }).as("checkIn");

      // Should show confirmation dialog
      cy.contains("Confirm Check-In").should("be.visible");
      cy.contains("Test School 1").should("be.visible");
      cy.contains("button", "Confirm").click();

      cy.wait("@checkIn");

      // Verify active session state
      cy.contains("Session Active").should("be.visible");
      cy.contains("Check Out").should("be.visible");
      cy.contains("Test School 1").should("be.visible");
      
      // Session timer should be visible and updating
      cy.get('[role="timer"]').should("be.visible");

      // Initiate check-out
      cy.contains("button", "Check Out").click();

      // Mock successful check-out API call
      cy.intercept("PUT", "/api/sessions/session123", {
        statusCode: 200,
        body: {
          id: "session123",
          status: "completed",
          checkInTime: new Date(Date.now() - 60000).toISOString(),
          checkOutTime: new Date().toISOString(),
          duration: 60000
        }
      }).as("checkOut");

      // Confirm check-out
      cy.contains("Confirm Check-Out").should("be.visible");
      cy.contains("button", "Confirm").click();

      cy.wait("@checkOut");

      // Should return to initial state
      cy.contains("Check In").should("be.visible");
      cy.contains("Session Active").should("not.exist");
    });

    it("should show session timer during active session", () => {
      cy.mockGeolocation(34.0522, -118.2437);
      
      // Mock active session response
      cy.intercept("POST", "/api/sessions", {
        statusCode: 201,
        body: {
          id: "session123",
          status: "active",
          checkInTime: new Date(Date.now() - 30000).toISOString(), // 30 seconds ago
          schoolId: "school1"
        }
      }).as("checkIn");

      cy.contains("Test School 1").click();
      cy.contains("button", "Check In").click();
      cy.contains("button", "Confirm").click();
      cy.wait("@checkIn");

      // Verify timer shows elapsed time
      cy.get('[role="timer"]').should("be.visible");
      cy.get('[role="timer"]').should("contain", "00:00:3"); // Should show ~30 seconds
    });
  });

  describe("Location-Based Validation", () => {
    it("should prevent check-in when outside school radius", () => {
      // Mock location far from any school
      cy.mockGeolocation(35.0000, -119.0000);

      cy.contains("Test School 1").click();
      cy.contains("button", "Check In").click();

      // Should show out of range error
      cy.contains("Out of Range").should("be.visible");
      cy.contains("You are too far from the school").should("be.visible");
      cy.contains("Distance:").should("be.visible");
      
      // Check-in should be disabled
      cy.contains("button", "Check In").should("be.disabled");
    });

    it("should show distance information in school detail view", () => {
      cy.mockGeolocation(34.0525, -118.2440); // Slightly offset from school

      cy.contains("Test School 1").click();
      
      // Should show distance and status
      cy.contains("Distance:").should("be.visible");
      cy.contains("m away").should("be.visible");
      cy.contains("In Range").should("be.visible");
    });

    it("should handle GPS permission denied gracefully", () => {
      // Mock permission denied
      cy.window().then((win) => {
        cy.stub(win.navigator.geolocation, "getCurrentPosition", (success, error) => {
          error({ code: 1, message: "User denied Geolocation" });
        });
      });

      cy.contains("Test School 1").click();
      cy.contains("button", "Check In").click();

      // Should show permission error
      cy.contains("Location Permission Required").should("be.visible");
      cy.contains("Please enable location access").should("be.visible");
      cy.contains("Retry").should("be.visible");
    });

    it("should handle GPS timeout gracefully", () => {
      // Mock GPS timeout
      cy.window().then((win) => {
        cy.stub(win.navigator.geolocation, "getCurrentPosition", (success, error) => {
          setTimeout(() => {
            error({ code: 3, message: "Timeout expired" });
          }, 100);
        });
      });

      cy.contains("Test School 1").click();
      cy.contains("button", "Check In").click();

      // Should show timeout error
      cy.contains("GPS Timeout").should("be.visible");
      cy.contains("Unable to get your location").should("be.visible");
    });
  });

  describe("Error Handling", () => {
    it("should handle check-in API errors gracefully", () => {
      cy.mockGeolocation(34.0522, -118.2437);

      cy.intercept("POST", "/api/sessions", {
        statusCode: 500,
        body: { error: "Internal server error" }
      }).as("checkInError");

      cy.contains("Test School 1").click();
      cy.contains("button", "Check In").click();
      cy.contains("button", "Confirm").click();

      cy.wait("@checkInError");

      // Should show error message
      cy.contains("Check-in failed").should("be.visible");
      cy.contains("Please try again").should("be.visible");
      
      // Should remain in check-in state
      cy.contains("button", "Check In").should("be.visible");
    });

    it("should handle check-out API errors gracefully", () => {
      cy.mockGeolocation(34.0522, -118.2437);

      // First, successfully check in
      cy.intercept("POST", "/api/sessions", {
        statusCode: 201,
        body: {
          id: "session123",
          status: "active",
          checkInTime: new Date().toISOString()
        }
      }).as("checkIn");

      cy.contains("Test School 1").click();
      cy.contains("button", "Check In").click();
      cy.contains("button", "Confirm").click();
      cy.wait("@checkIn");

      // Mock check-out error
      cy.intercept("PUT", "/api/sessions/session123", {
        statusCode: 500,
        body: { error: "Server error" }
      }).as("checkOutError");

      cy.contains("button", "Check Out").click();
      cy.contains("button", "Confirm").click();

      cy.wait("@checkOutError");

      // Should show error but maintain session state
      cy.contains("Check-out failed").should("be.visible");
      cy.contains("Session Active").should("be.visible");
      cy.contains("button", "Check Out").should("be.visible");
    });

    it("should handle network connectivity issues", () => {
      cy.mockGeolocation(34.0522, -118.2437);

      // Mock network error
      cy.intercept("POST", "/api/sessions", { forceNetworkError: true }).as("networkError");

      cy.contains("Test School 1").click();
      cy.contains("button", "Check In").click();
      cy.contains("button", "Confirm").click();

      cy.wait("@networkError");

      // Should show network error
      cy.contains("Network Error").should("be.visible");
      cy.contains("connection problem").should("be.visible");
    });
  });

  describe("School List and Navigation", () => {
    it("should display assigned schools in dashboard", () => {
      // Schools should be visible
      cy.contains("Test School 1").should("be.visible");
      cy.contains("Test School 2").should("be.visible");
      cy.contains("123 Main St, Anytown, USA").should("be.visible");
      cy.contains("456 Oak Ave, Anytown, USA").should("be.visible");
    });

    it("should allow searching schools", () => {
      // Add search input (if exists)
      cy.get('input[placeholder*="Search"]').should("be.visible").type("Test School 1");
      
      cy.contains("Test School 1").should("be.visible");
      cy.contains("Test School 2").should("not.be.visible");
    });

    it("should show school details when clicked", () => {
      cy.contains("Test School 1").click();
      
      // Should show school details
      cy.contains("School Details").should("be.visible");
      cy.contains("123 Main St, Anytown, USA").should("be.visible");
      cy.contains("GPS Coordinates").should("be.visible");
      cy.contains("Check-in Radius: 500m").should("be.visible");
    });
  });

  describe("Session Status and History", () => {
    it("should show 'no active session' status when not checked in", () => {
      cy.contains("Current Status").should("be.visible");
      cy.contains("Not Active").should("be.visible");
      cy.contains("No current session").should("be.visible");
    });

    it("should update dashboard status during active session", () => {
      cy.mockGeolocation(34.0522, -118.2437);

      cy.intercept("POST", "/api/sessions", {
        statusCode: 201,
        body: {
          id: "session123",
          status: "active",
          checkInTime: new Date().toISOString(),
          schoolId: "school1"
        }
      }).as("checkIn");

      cy.contains("Test School 1").click();
      cy.contains("button", "Check In").click();
      cy.contains("button", "Confirm").click();
      cy.wait("@checkIn");

      // Dashboard should update
      cy.contains("Active").should("be.visible");
      cy.contains("At Test School 1").should("be.visible");
    });
  });

  describe("Mobile Responsiveness", () => {
    it("should work correctly on mobile viewport", () => {
      cy.setMobileViewport();

      // Mobile sidebar should be hidden initially
      cy.get('[data-testid="mobile-sidebar"]').should("not.be.visible");
      
      // Mobile menu button should be visible
      cy.get('button[aria-label="Open menu"]').should("be.visible").click();
      
      // Sidebar should open
      cy.get('[data-testid="mobile-sidebar"]').should("be.visible");
      
      // School list should be responsive
      cy.contains("Test School 1").should("be.visible");
    });

    it("should handle touch interactions on mobile", () => {
      cy.setMobileViewport();
      
      cy.mockGeolocation(34.0522, -118.2437);
      
      // Touch events should work for check-in
      cy.contains("Test School 1").click();
      cy.contains("button", "Check In").click();
      
      cy.contains("Confirm Check-In").should("be.visible");
    });
  });

  describe("Accessibility", () => {
    it("should be keyboard navigable", () => {
      // Tab through check-in button
      cy.get("body").tab();
      cy.focused().should("contain", "Check In");
      
      // Enter key should trigger check-in
      cy.focused().type("{enter}");
      cy.contains("Getting your location").should("be.visible");
    });

    it("should have proper ARIA labels and roles", () => {
      cy.get('[role="button"]').should("exist");
      cy.get('[role="timer"]').should("exist");
      cy.get('[aria-label*="Check"]').should("exist");
    });

    it("should provide screen reader announcements", () => {
      cy.mockGeolocation(34.0522, -118.2437);
      
      cy.contains("Test School 1").click();
      cy.contains("button", "Check In").click();
      
      // Screen reader announcements should exist
      cy.get('[aria-live="polite"]').should("exist");
      cy.get('[role="status"]').should("exist");
    });
  });

  describe("Performance and Loading States", () => {
    it("should show loading states during GPS operations", () => {
      // Delay geolocation response
      cy.window().then((win) => {
        cy.stub(win.navigator.geolocation, "getCurrentPosition", (cb) => {
          setTimeout(() => {
            cb({
              coords: {
                latitude: 34.0522,
                longitude: -118.2437,
                accuracy: 20,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null,
              },
            });
          }, 1000);
        });
      });

      cy.contains("Test School 1").click();
      cy.contains("button", "Check In").click();

      // Should show GPS loading state
      cy.contains("Getting your location").should("be.visible");
      cy.get('[data-testid="gps-spinner"]').should("be.visible");
    });

    it("should show loading states during API calls", () => {
      cy.mockGeolocation(34.0522, -118.2437);

      // Delay API response
      cy.intercept("POST", "/api/sessions", {
        statusCode: 201,
        body: { id: "session123", status: "active" },
        delay: 1000
      }).as("slowCheckIn");

      cy.contains("Test School 1").click();
      cy.contains("button", "Check In").click();
      cy.contains("button", "Confirm").click();

      // Should show API loading state
      cy.contains("Checking you in").should("be.visible");
      cy.get('[data-testid="api-spinner"]').should("be.visible");
    });
  });
});
