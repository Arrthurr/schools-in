import { toCSV, downloadCSV, sessionsToCSV } from "../csv";
import { Session } from "@/lib/firebase/types";
import { Timestamp } from "firebase/firestore";

// Mock DOM methods for downloadCSV tests
const mockCreateElement = jest.fn();
const mockAppendChild = jest.fn();
const mockRemoveChild = jest.fn();
const mockClick = jest.fn();
const mockSetAttribute = jest.fn();
const mockCreateObjectURL = jest.fn();
const mockRevokeObjectURL = jest.fn();

// Setup DOM mocks
Object.defineProperty(document, "createElement", {
  value: mockCreateElement,
});

Object.defineProperty(document.body, "appendChild", {
  value: mockAppendChild,
});

Object.defineProperty(document.body, "removeChild", {
  value: mockRemoveChild,
});

Object.defineProperty(URL, "createObjectURL", {
  value: mockCreateObjectURL,
});

Object.defineProperty(URL, "revokeObjectURL", {
  value: mockRevokeObjectURL,
});

describe("CSV Utilities", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations
    mockCreateElement.mockReturnValue({
      click: mockClick,
      setAttribute: mockSetAttribute,
      href: "",
    });

    mockCreateObjectURL.mockReturnValue("blob:mock-url");
  });

  describe("toCSV", () => {
    it("should return empty string for empty array", () => {
      expect(toCSV([])).toBe("");
    });

    it("should convert simple data to CSV format", () => {
      const data = [
        { name: "John", age: 30, active: true },
        { name: "Jane", age: 25, active: false },
      ];

      const result = toCSV(data);
      const expected = "name,age,active\nJohn,30,true\nJane,25,false";

      expect(result).toBe(expected);
    });

    it("should handle null and undefined values", () => {
      const data = [
        { name: "John", age: null, active: undefined },
        { name: undefined, age: 25, active: true },
      ];

      const result = toCSV(data);
      const expected = "name,age,active\nJohn,,\n,25,true";

      expect(result).toBe(expected);
    });

    it("should escape values containing commas", () => {
      const data = [{ name: "John, Jr.", city: "New York, NY" }];

      const result = toCSV(data);
      const expected = 'name,city\n"John, Jr.","New York, NY"';

      expect(result).toBe(expected);
    });

    it("should escape values containing quotes", () => {
      const data = [
        { name: 'John "Johnny" Doe', description: 'He said "hello"' },
      ];

      const result = toCSV(data);
      const expected =
        'name,description\n"John ""Johnny"" Doe","He said ""hello"""';

      expect(result).toBe(expected);
    });

    it("should escape values containing newlines", () => {
      const data = [{ name: "John", notes: "Line 1\nLine 2" }];

      const result = toCSV(data);
      const expected = 'name,notes\nJohn,"Line 1\nLine 2"';

      expect(result).toBe(expected);
    });

    it("should use custom headers when provided", () => {
      const data = [{ name: "John", age: 30, city: "NYC" }];

      const result = toCSV(data, ["name", "city"]);
      const expected = "name,city\nJohn,NYC";

      expect(result).toBe(expected);
    });
  });

  describe("downloadCSV", () => {
    it("should create blob with correct CSV content", () => {
      const filename = "test.csv";
      const csvContent = "name,age\nJohn,30";

      downloadCSV(filename, csvContent);

      expect(mockCreateObjectURL).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "text/csv;charset=utf-8;",
        })
      );
    });

    it("should create download link with correct attributes", () => {
      const filename = "test.csv";
      const csvContent = "name,age\nJohn,30";

      const mockElement = {
        click: mockClick,
        setAttribute: mockSetAttribute,
        href: "",
      };

      mockCreateElement.mockReturnValue(mockElement);

      downloadCSV(filename, csvContent);

      expect(mockCreateElement).toHaveBeenCalledWith("a");
      expect(mockSetAttribute).toHaveBeenCalledWith("download", filename);
      expect(mockElement.href).toBe("blob:mock-url");
    });

    it("should trigger download and cleanup resources", () => {
      const filename = "test.csv";
      const csvContent = "name,age\nJohn,30";

      const mockElement = {
        click: mockClick,
        setAttribute: mockSetAttribute,
        href: "",
      };

      mockCreateElement.mockReturnValue(mockElement);

      downloadCSV(filename, csvContent);

      expect(mockAppendChild).toHaveBeenCalledWith(mockElement);
      expect(mockClick).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalledWith(mockElement);
      expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    });
  });

  describe("sessionsToCSV", () => {
    const mockSession: Session = {
      id: "session-123",
      userId: "user-456",
      locationId: "location-789",
      status: "completed",
      startTime: Timestamp.fromDate(new Date("2024-01-15T16:00:00Z")), // 4 PM UTC = 10 AM Chicago
      endTime: Timestamp.fromDate(new Date("2024-01-15T18:30:00Z")), // 6:30 PM UTC = 12:30 PM Chicago
      durationMinutes: 150,
      checkInMethod: "geo",
      distanceFromCenterAtCheckIn: 25.5,
      dayKey: "2024-01-15",
      notes: "Great session with students",
      createdAt: Timestamp.fromDate(new Date("2024-01-15T16:00:00Z")),
      updatedAt: Timestamp.fromDate(new Date("2024-01-15T18:30:00Z")),
    };

    it("should return empty string for empty sessions array", () => {
      expect(sessionsToCSV([])).toBe("");
    });

    it("should convert session to CSV with all data included", () => {
      const enrichedSession = {
        ...mockSession,
        providerName: "John Doe",
        providerEmail: "john@example.com",
        locationName: "Test School",
        locationAddress: "123 Main St",
      };

      const result = sessionsToCSV([enrichedSession]);

      expect(result).toContain(
        "sessionId,status,startTime,endTime,durationMinutes,durationHours"
      );
      expect(result).toContain("session-123,completed");
      expect(result).toContain("150,2.5"); // Duration in hours
      expect(result).toContain("John Doe,john@example.com");
      expect(result).toContain("Test School,123 Main St");
    });

    it("should exclude user data when includeUserData is false", () => {
      const enrichedSession = {
        ...mockSession,
        providerName: "John Doe",
        providerEmail: "john@example.com",
        locationName: "Test School",
      };

      const result = sessionsToCSV([enrichedSession], false, true);

      expect(result).not.toContain("providerId,providerName,providerEmail");
      expect(result).not.toContain("John Doe");
      expect(result).toContain("locationName");
      expect(result).toContain("Test School");
    });

    it("should exclude location data when includeLocationData is false", () => {
      const enrichedSession = {
        ...mockSession,
        providerName: "John Doe",
        locationName: "Test School",
      };

      const result = sessionsToCSV([enrichedSession], true, false);

      expect(result).toContain("providerName");
      expect(result).toContain("John Doe");
      expect(result).not.toContain("locationId,locationName,locationAddress");
      expect(result).not.toContain("Test School");
    });

    it("should handle missing optional data gracefully", () => {
      const basicSession = {
        ...mockSession,
        providerName: undefined,
        locationName: undefined,
      };

      const result = sessionsToCSV([basicSession]);

      expect(result).toContain("session-123");
      expect(result).toContain("completed");
      // Should still include headers but with empty values
    });

    it("should format dates with America/Chicago timezone", () => {
      const session = {
        ...mockSession,
        startTime: Timestamp.fromDate(new Date("2024-01-15T16:00:00Z")), // 4 PM UTC
        endTime: Timestamp.fromDate(new Date("2024-01-15T18:30:00Z")), // 6:30 PM UTC
      };

      const result = sessionsToCSV([session]);

      // In Chicago time, this should be 10:00 AM and 12:30 PM
      expect(result).toMatch(/01\/15\/2024.*10:00:00.*AM/);
      expect(result).toMatch(/01\/15\/2024.*12:30:00.*PM/);
    });

    it("should handle Firestore Timestamp objects", () => {
      // Use the actual Timestamp object
      const session = {
        ...mockSession,
        startTime: Timestamp.fromDate(new Date("2024-01-15T16:00:00Z")),
        endTime: Timestamp.fromDate(new Date("2024-01-15T18:30:00Z")),
      };

      const result = sessionsToCSV([session]);

      expect(result).toContain("01/15/2024");
    });

    it("should calculate duration in hours correctly", () => {
      const session = {
        ...mockSession,
        durationMinutes: 90, // 1.5 hours
      };

      const result = sessionsToCSV([session]);

      expect(result).toContain("90,1.5");
    });

    it("should handle multiple sessions", () => {
      const session1 = { ...mockSession, id: "session-1" };
      const session2 = {
        ...mockSession,
        id: "session-2",
        status: "active" as const,
      };

      const result = sessionsToCSV([session1, session2]);

      expect(result).toContain("session-1");
      expect(result).toContain("session-2");
      expect(result).toContain("completed");
      expect(result).toContain("active");
    });

    it("should escape special characters in session data", () => {
      const session = {
        ...mockSession,
        notes: 'Session notes with "quotes" and, commas',
        locationName: "School, Elementary #1",
      };

      const result = sessionsToCSV([session]);

      expect(result).toContain('"Session notes with ""quotes"" and, commas"');
      expect(result).toContain('"School, Elementary #1"');
    });

    it("should filter out empty columns from headers", () => {
      const sessionWithoutNotes = {
        ...mockSession,
        notes: undefined,
      };

      const result = sessionsToCSV([sessionWithoutNotes]);

      // Should not include 'notes' in headers if all sessions have empty notes
      const lines = result.split("\n");
      const headers = lines[0];

      if (!sessionWithoutNotes.notes) {
        expect(headers).not.toContain("notes");
      }
    });
  });
});
