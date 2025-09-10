/// <reference types="cypress" />

describe("Admin Management Workflows", () => {
  beforeEach(() => {
    // Mock Firebase auth for admin user
    cy.login("admin@test.com", "password", { role: "admin" });
    
    // Mock admin dashboard data
    cy.intercept("GET", "/api/admin/stats", {
      statusCode: 200,
      body: {
        totalSchools: 12,
        activeProviders: 8,
        activeSessions: 3,
        todayCheckIns: 15,
        totalSessions: 156,
        avgSessionDuration: 240000 // 4 minutes in ms
      }
    }).as("getDashboardStats");

    // Mock recent activity
    cy.intercept("GET", "/api/admin/activity", {
      statusCode: 200,
      body: {
        activities: [
          {
            id: "1",
            type: "check-in",
            message: "John Doe checked in to Sunset Elementary",
            timestamp: new Date().toISOString(),
            providerName: "John Doe",
            schoolName: "Sunset Elementary"
          },
          {
            id: "2", 
            type: "school-added",
            message: "New school 'Maple High' added",
            timestamp: new Date(Date.now() - 300000).toISOString(),
            schoolName: "Maple High"
          }
        ]
      }
    }).as("getRecentActivity");
  });

  describe("Admin Dashboard", () => {
    beforeEach(() => {
      cy.visit("/admin");
      cy.wait(["@getDashboardStats", "@getRecentActivity"]);
    });

    it("should display dashboard statistics correctly", () => {
      // Check main stats cards
      cy.contains("Total Schools").should("be.visible");
      cy.contains("12").should("be.visible"); // Total schools
      
      cy.contains("Active Providers").should("be.visible");
      cy.contains("8").should("be.visible"); // Active providers
      
      cy.contains("Active Sessions").should("be.visible");
      cy.contains("3").should("be.visible"); // Active sessions
      
      cy.contains("Today's Check-ins").should("be.visible");
      cy.contains("15").should("be.visible"); // Today's check-ins
    });

    it("should show recent activity feed", () => {
      cy.contains("Recent Activity").should("be.visible");
      cy.contains("John Doe checked in to Sunset Elementary").should("be.visible");
      cy.contains("New school 'Maple High' added").should("be.visible");
    });

    it("should provide navigation to management sections", () => {
      // Check navigation links
      cy.contains("Schools").should("be.visible");
      cy.contains("Providers").should("be.visible");
      cy.contains("Sessions").should("be.visible");
      cy.contains("Reports").should("be.visible");
      
      // Test navigation
      cy.contains("Schools").click();
      cy.url().should("include", "/admin/schools");
    });

    it("should show quick action buttons", () => {
      cy.contains("Add School").should("be.visible");
      cy.contains("Add Provider").should("be.visible");
      cy.contains("View Reports").should("be.visible");
    });
  });

  describe("School Management", () => {
    beforeEach(() => {
      // Mock schools data
      cy.intercept("GET", "/api/admin/schools", {
        statusCode: 200,
        body: {
          schools: [
            {
              id: "school1",
              name: "Sunset Elementary",
              address: "123 Main St, City, ST 12345",
              latitude: 40.7128,
              longitude: -74.0060,
              radius: 500,
              description: "Elementary school in downtown",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              activeProviders: 2,
              totalSessions: 45
            },
            {
              id: "school2",
              name: "Maple High School",
              address: "456 Oak Ave, City, ST 12345",
              latitude: 40.7589,
              longitude: -73.9851,
              radius: 300,
              description: "High school campus",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              activeProviders: 1,
              totalSessions: 28
            }
          ]
        }
      }).as("getSchools");

      cy.visit("/admin/schools");
      cy.wait("@getSchools");
    });

    it("should display schools list with search functionality", () => {
      // Check schools are displayed
      cy.contains("Sunset Elementary").should("be.visible");
      cy.contains("Maple High School").should("be.visible");
      cy.contains("123 Main St, City, ST 12345").should("be.visible");
      
      // Test search functionality
      cy.get('input[placeholder*="Search schools"]').type("Sunset");
      cy.contains("Sunset Elementary").should("be.visible");
      cy.contains("Maple High School").should("not.be.visible");
    });

    it("should allow creating a new school", () => {
      // Mock geocoding response
      cy.intercept("GET", "**/geocoding/**", {
        statusCode: 200,
        body: {
          results: [{
            geometry: {
              location: { lat: 40.7128, lng: -74.0060 }
            }
          }]
        }
      }).as("geocoding");

      // Mock school creation
      cy.intercept("POST", "/api/admin/schools", {
        statusCode: 201,
        body: {
          id: "new-school",
          name: "New Test School",
          address: "789 Test St, City, ST 12345"
        }
      }).as("createSchool");

      // Open new school form
      cy.contains("Add School").click();
      cy.contains("Add New School").should("be.visible");

      // Fill out form
      cy.get('input[name="name"]').type("New Test School");
      cy.get('input[name="address"]').type("789 Test St, City, ST 12345");
      cy.get('input[name="radius"]').clear().type("400");
      cy.get('textarea[name="description"]').type("Test school description");

      // Verify GPS coordinates button
      cy.contains("Get GPS Coordinates").click();
      cy.wait("@geocoding");

      // Submit form
      cy.contains("Create School").click();
      cy.wait("@createSchool");

      // Verify success
      cy.contains("School created successfully").should("be.visible");
    });

    it("should allow editing existing schools", () => {
      // Mock update response
      cy.intercept("PUT", "/api/admin/schools/school1", {
        statusCode: 200,
        body: { success: true }
      }).as("updateSchool");

      // Click edit button for first school
      cy.get('[data-testid="edit-school-school1"]').click();
      
      // Verify form is pre-populated
      cy.get('input[name="name"]').should("have.value", "Sunset Elementary");
      
      // Make changes
      cy.get('input[name="name"]').clear().type("Updated Elementary");
      cy.get('textarea[name="description"]').clear().type("Updated description");
      
      // Save changes
      cy.contains("Update School").click();
      cy.wait("@updateSchool");
      
      // Verify success
      cy.contains("School updated successfully").should("be.visible");
    });

    it("should allow deleting schools with confirmation", () => {
      // Mock delete response
      cy.intercept("DELETE", "/api/admin/schools/school2", {
        statusCode: 200,
        body: { success: true }
      }).as("deleteSchool");

      // Click delete button
      cy.get('[data-testid="delete-school-school2"]').click();
      
      // Confirm deletion dialog
      cy.contains("Delete School").should("be.visible");
      cy.contains("Are you sure you want to delete").should("be.visible");
      cy.contains("Maple High School").should("be.visible");
      
      // Cancel first to test cancellation
      cy.contains("Cancel").click();
      cy.contains("Maple High School").should("still.be.visible");
      
      // Try deletion again and confirm
      cy.get('[data-testid="delete-school-school2"]').click();
      cy.contains("Delete").click();
      cy.wait("@deleteSchool");
      
      // Verify success
      cy.contains("School deleted successfully").should("be.visible");
    });

    it("should show school statistics and provider assignments", () => {
      // Check school cards show statistics
      cy.contains("2 Active Providers").should("be.visible");
      cy.contains("45 Total Sessions").should("be.visible");
      
      // Check provider assignment button
      cy.contains("Assign Providers").should("be.visible");
    });
  });

  describe("Provider Management", () => {
    beforeEach(() => {
      // Mock providers data
      cy.intercept("GET", "/api/admin/providers", {
        statusCode: 200,
        body: {
          providers: [
            {
              id: "provider1",
              name: "John Doe",
              email: "john@test.com",
              role: "provider",
              status: "active",
              assignedSchools: ["school1"],
              totalSessions: 23,
              createdAt: new Date().toISOString()
            },
            {
              id: "provider2", 
              name: "Jane Smith",
              email: "jane@test.com",
              role: "provider", 
              status: "inactive",
              assignedSchools: ["school1", "school2"],
              totalSessions: 15,
              createdAt: new Date().toISOString()
            }
          ]
        }
      }).as("getProviders");

      cy.visit("/admin/providers");
      cy.wait("@getProviders");
    });

    it("should display providers list with filtering", () => {
      // Check providers are displayed
      cy.contains("John Doe").should("be.visible");
      cy.contains("Jane Smith").should("be.visible");
      cy.contains("john@test.com").should("be.visible");
      
      // Check status badges
      cy.contains("Active").should("be.visible");
      cy.contains("Inactive").should("be.visible");
      
      // Test filtering
      cy.get('[data-testid="status-filter"]').select("Active");
      cy.contains("John Doe").should("be.visible");
      cy.contains("Jane Smith").should("not.be.visible");
    });

    it("should allow creating new providers", () => {
      // Mock provider creation
      cy.intercept("POST", "/api/admin/providers", {
        statusCode: 201,
        body: {
          id: "new-provider",
          name: "New Provider",
          email: "new@test.com"
        }
      }).as("createProvider");

      // Open new provider form
      cy.contains("Add Provider").click();
      
      // Fill form
      cy.get('input[name="name"]').type("New Provider");
      cy.get('input[name="email"]').type("new@test.com");
      cy.get('select[name="role"]').select("provider");
      
      // Submit
      cy.contains("Create Provider").click();
      cy.wait("@createProvider");
      
      // Verify success
      cy.contains("Provider created successfully").should("be.visible");
    });

    it("should allow assigning schools to providers", () => {
      // Mock assignment update
      cy.intercept("PUT", "/api/admin/providers/provider1/assignments", {
        statusCode: 200,
        body: { success: true }
      }).as("updateAssignments");

      // Open assignment modal
      cy.get('[data-testid="assign-schools-provider1"]').click();
      
      // Check current assignments
      cy.contains("Assigned Schools").should("be.visible");
      
      // Make changes
      cy.get('[data-testid="school-checkbox-school2"]').check();
      
      // Save
      cy.contains("Update Assignments").click();
      cy.wait("@updateAssignments");
      
      // Verify success
      cy.contains("Assignments updated").should("be.visible");
    });
  });

  describe("Session Reporting and Management", () => {
    beforeEach(() => {
      // Mock session data
      cy.intercept("GET", "/api/admin/sessions", {
        statusCode: 200,
        body: {
          sessions: [
            {
              id: "session1",
              providerId: "provider1",
              providerName: "John Doe",
              schoolId: "school1",
              schoolName: "Sunset Elementary",
              status: "completed",
              checkInTime: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
              checkOutTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
              duration: 3600000, // 1 hour
              location: { lat: 40.7128, lng: -74.0060 }
            },
            {
              id: "session2",
              providerId: "provider2",
              providerName: "Jane Smith", 
              schoolId: "school2",
              schoolName: "Maple High School",
              status: "active",
              checkInTime: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
              location: { lat: 40.7589, lng: -73.9851 }
            }
          ]
        }
      }).as("getSessions");

      cy.visit("/admin/reports");
      cy.wait("@getSessions");
    });

    it("should display session reports with filtering", () => {
      // Check sessions are displayed
      cy.contains("John Doe").should("be.visible");
      cy.contains("Jane Smith").should("be.visible");
      cy.contains("Sunset Elementary").should("be.visible");
      cy.contains("Maple High School").should("be.visible");
      
      // Check status indicators
      cy.contains("Completed").should("be.visible");
      cy.contains("Active").should("be.visible");
      
      // Check duration display
      cy.contains("1h 0m").should("be.visible");
    });

    it("should allow filtering sessions by date range", () => {
      // Open date filter
      cy.get('input[name="startDate"]').type("2024-01-01");
      cy.get('input[name="endDate"]').type("2024-12-31");
      
      // Apply filter
      cy.contains("Apply Filters").click();
      
      // Verify API call with filter parameters
      cy.wait("@getSessions");
    });

    it("should allow filtering by provider and school", () => {
      // Filter by provider
      cy.get('select[name="providerId"]').select("John Doe");
      
      // Filter by school
      cy.get('select[name="schoolId"]').select("Sunset Elementary");
      
      // Apply filters
      cy.contains("Apply Filters").click();
      
      // Only relevant sessions should show
      cy.contains("John Doe").should("be.visible");
      cy.contains("Jane Smith").should("not.be.visible");
    });

    it("should allow exporting session data to CSV", () => {
      // Mock CSV export
      cy.intercept("GET", "/api/admin/sessions/export", {
        statusCode: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": "attachment; filename=sessions.csv"
        },
        body: "Provider,School,Status,Check In,Check Out,Duration\nJohn Doe,Sunset Elementary,completed,2024-01-01 10:00,2024-01-01 11:00,1h 0m"
      }).as("exportCSV");

      // Click export button
      cy.contains("Export to CSV").click();
      cy.wait("@exportCSV");
      
      // Verify download initiated
      cy.contains("Export started").should("be.visible");
    });

    it("should allow force-closing active sessions", () => {
      // Mock force close
      cy.intercept("PUT", "/api/admin/sessions/session2/force-close", {
        statusCode: 200,
        body: { success: true }
      }).as("forceClose");

      // Click force close on active session
      cy.get('[data-testid="force-close-session2"]').click();
      
      // Confirm action
      cy.contains("Force Close Session").should("be.visible");
      cy.contains("Are you sure").should("be.visible");
      cy.contains("Force Close").click();
      cy.wait("@forceClose");
      
      // Verify success
      cy.contains("Session closed successfully").should("be.visible");
    });

    it("should display session analytics and summaries", () => {
      // Check summary statistics
      cy.contains("Total Sessions").should("be.visible");
      cy.contains("Average Duration").should("be.visible");
      cy.contains("Active Sessions").should("be.visible");
      
      // Check charts/visualizations if present
      cy.get('[data-testid="session-chart"]').should("be.visible");
    });
  });

  describe("Bulk Operations", () => {
    it("should allow bulk operations on schools", () => {
      cy.visit("/admin/schools");
      cy.wait("@getSchools");

      // Select multiple schools
      cy.get('[data-testid="select-school-school1"]').check();
      cy.get('[data-testid="select-school-school2"]').check();
      
      // Open bulk actions
      cy.contains("Bulk Actions").click();
      cy.contains("Assign Provider").should("be.visible");
      cy.contains("Export Selected").should("be.visible");
      cy.contains("Delete Selected").should("be.visible");
    });

    it("should allow bulk provider assignments", () => {
      // Mock bulk assignment
      cy.intercept("POST", "/api/admin/bulk/assign-provider", {
        statusCode: 200,
        body: { success: true, updated: 2 }
      }).as("bulkAssign");

      cy.visit("/admin/schools");
      cy.wait("@getSchools");

      // Select schools and assign provider
      cy.get('[data-testid="select-school-school1"]').check();
      cy.get('[data-testid="select-school-school2"]').check();
      
      cy.contains("Bulk Actions").click();
      cy.contains("Assign Provider").click();
      
      // Select provider in modal
      cy.get('select[name="providerId"]').select("John Doe");
      cy.contains("Assign to Selected").click();
      cy.wait("@bulkAssign");
      
      // Verify success
      cy.contains("2 schools updated").should("be.visible");
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle API errors gracefully", () => {
      // Mock API error
      cy.intercept("GET", "/api/admin/schools", {
        statusCode: 500,
        body: { error: "Server error" }
      }).as("schoolsError");

      cy.visit("/admin/schools");
      cy.wait("@schoolsError");
      
      // Should show error state
      cy.contains("Error loading schools").should("be.visible");
      cy.contains("Try Again").should("be.visible");
    });

    it("should handle form validation errors", () => {
      cy.visit("/admin/schools");
      
      // Open new school form
      cy.contains("Add School").click();
      
      // Try to submit without required fields
      cy.contains("Create School").click();
      
      // Should show validation errors
      cy.contains("School name is required").should("be.visible");
      cy.contains("Address is required").should("be.visible");
    });

    it("should handle network connectivity issues", () => {
      // Go offline
      cy.goOffline();
      
      cy.visit("/admin");
      
      // Should show offline message
      cy.contains("You are currently offline").should("be.visible");
      
      // Go back online
      cy.goOnline();
      
      // Should retry and load
      cy.contains("Back online").should("be.visible");
    });
  });

  describe("Mobile Responsiveness", () => {
    it("should work correctly on mobile viewport", () => {
      cy.setMobileViewport();
      
      cy.visit("/admin");
      cy.wait(["@getDashboardStats", "@getRecentActivity"]);
      
      // Mobile navigation should be present
      cy.get('[data-testid="mobile-menu-button"]').should("be.visible");
      
      // Stats cards should stack vertically
      cy.get('[data-testid="stats-grid"]').should("have.class", "grid-cols-1");
    });

    it("should handle touch interactions on mobile", () => {
      cy.setMobileViewport();
      
      cy.visit("/admin/schools");
      cy.wait("@getSchools");
      
      // Touch interactions should work
      cy.contains("Sunset Elementary").click();
      cy.contains("School Details").should("be.visible");
    });
  });

  describe("Accessibility", () => {
    it("should be keyboard navigable", () => {
      cy.visit("/admin");
      
      // Tab through interface
      cy.get("body").tab();
      cy.focused().should("be.visible");
      
      // Enter key should activate buttons
      cy.contains("Add School").focus().type("{enter}");
      cy.contains("Add New School").should("be.visible");
    });

    it("should have proper ARIA labels and roles", () => {
      cy.visit("/admin");
      
      // Check for proper ARIA attributes
      cy.get('[role="main"]').should("exist");
      cy.get('[aria-label]').should("exist");
      cy.get('[role="button"]').should("exist");
    });

    it("should provide screen reader announcements", () => {
      cy.visit("/admin/schools");
      
      // Add new school should announce success
      cy.contains("Add School").click();
      cy.get('input[name="name"]').type("Test School");
      
      // Form submission should announce result
      cy.get('[aria-live="polite"]').should("exist");
    });
  });

  describe("Performance and Loading States", () => {
    it("should show loading states during data fetching", () => {
      // Delay API response
      cy.intercept("GET", "/api/admin/schools", {
        statusCode: 200,
        body: { schools: [] },
        delay: 2000
      }).as("slowSchools");

      cy.visit("/admin/schools");
      
      // Should show loading skeleton
      cy.get('[data-testid="loading-skeleton"]').should("be.visible");
      
      cy.wait("@slowSchools");
      
      // Loading should disappear
      cy.get('[data-testid="loading-skeleton"]').should("not.exist");
    });

    it("should handle large datasets efficiently", () => {
      // Mock large dataset
      const largeSchoolList = Array.from({ length: 100 }, (_, i) => ({
        id: `school${i}`,
        name: `School ${i}`,
        address: `${i} Test St`,
        latitude: 40.7128,
        longitude: -74.0060,
        radius: 500
      }));

      cy.intercept("GET", "/api/admin/schools", {
        statusCode: 200,
        body: { schools: largeSchoolList }
      }).as("getLargeSchoolList");

      cy.visit("/admin/schools");
      cy.wait("@getLargeSchoolList");
      
      // Should implement pagination or virtual scrolling
      cy.contains("School 0").should("be.visible");
      cy.contains("School 99").should("not.be.visible");
      
      // Test pagination if implemented
      cy.get('[data-testid="next-page"]').click();
    });
  });
});
