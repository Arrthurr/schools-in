import {
  BulkSchoolOperationsService,
  bulkSchoolOperations,
} from "./bulkSchoolOperations";

// Use a fresh instance per test to avoid shared state from the singleton
let service: BulkSchoolOperationsService;

const makeSchool = (id: string, overrides: Record<string, any> = {}) => ({
  id,
  name: `School ${id}`,
  address: "123 Main St, Chicago, IL 60601",
  latitude: 41.8781,
  longitude: -87.6298,
  radius: 300,
  isActive: true,
  activeProviders: 2,
  totalSessions: 10,
  assignedProviders: ["p1"],
  description: "A test school",
  contactEmail: "test@example.com",
  contactPhone: "555-1234",
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-06-01"),
  ...overrides,
});

beforeEach(() => {
  service = new BulkSchoolOperationsService();
  jest.useFakeTimers();
  // Default: Math.random returns 0.5 (above 0.05 threshold, so no simulated failures)
  jest.spyOn(Math, "random").mockReturnValue(0.5);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// Helper to flush all pending timers/promises
const flushAsync = async () => {
  jest.runAllTimers();
  await Promise.resolve();
};

describe("BulkSchoolOperationsService", () => {
  // ── createOperation / getOperation / listOperations ──────────────────

  describe("createOperation", () => {
    it("creates an operation and returns an id", () => {
      const id = service.createOperation("activate", ["s1", "s2"]);
      expect(id).toMatch(/^bulk_/);

      const op = service.getOperation(id);
      expect(op).not.toBeNull();
      expect(op!.type).toBe("activate");
      expect(op!.status).toBe("pending");
      expect(op!.schoolIds).toEqual(["s1", "s2"]);
      expect(op!.total).toBe(2);
      expect(op!.progress).toBe(0);
    });

    it("stores optional data", () => {
      const id = service.createOperation("update", ["s1"], { radius: 500 });
      expect(service.getOperation(id)!.data).toEqual({ radius: 500 });
    });
  });

  describe("getOperation", () => {
    it("returns null for unknown id", () => {
      expect(service.getOperation("nope")).toBeNull();
    });
  });

  describe("listOperations", () => {
    it("returns operations sorted newest first", () => {
      const id1 = service.createOperation("activate", ["s1"]);
      jest.advanceTimersByTime(100);
      const id2 = service.createOperation("deactivate", ["s2"]);

      const list = service.listOperations();
      expect(list).toHaveLength(2);
      expect(list[0].id).toBe(id2);
      expect(list[1].id).toBe(id1);
    });

    it("returns empty array when no operations exist", () => {
      expect(service.listOperations()).toEqual([]);
    });
  });

  // ── executeBulkStatusUpdate ──────────────────────────────────────────

  describe("executeBulkStatusUpdate", () => {
    it("processes all schools successfully", async () => {
      const schools = [makeSchool("s1"), makeSchool("s2")];
      const opId = service.createOperation("activate", ["s1", "s2"]);

      const promise = service.executeBulkStatusUpdate(opId, true, schools);
      // Each school iteration creates a new setTimeout, so advance repeatedly
      for (let i = 0; i < schools.length; i++) {
        jest.advanceTimersByTime(200);
        await Promise.resolve();
      }
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(2);
      expect(result.errorCount).toBe(0);

      const op = service.getOperation(opId);
      expect(op!.status).toBe("completed");
      expect(op!.endTime).toBeDefined();
      expect(op!.progress).toBe(2);
    });

    it("reports error when school is not found", async () => {
      const schools = [makeSchool("s1")];
      const opId = service.createOperation("activate", ["s1", "missing"]);

      const promise = service.executeBulkStatusUpdate(opId, true, schools);
      await flushAsync();
      const result = await promise;

      expect(result.processedCount).toBe(1);
      expect(result.errorCount).toBe(1);
      expect(result.errors[0]).toEqual({
        schoolId: "missing",
        schoolName: "Unknown",
        error: "School not found",
      });
      expect(result.success).toBe(false);
    });

    it("catches simulated network errors (random < 0.05)", async () => {
      // Force the random failure path
      (Math.random as jest.Mock).mockReturnValue(0.01);

      const schools = [makeSchool("s1")];
      const opId = service.createOperation("activate", ["s1"]);

      const promise = service.executeBulkStatusUpdate(opId, false, schools);
      await flushAsync();
      const result = await promise;

      expect(result.processedCount).toBe(0);
      expect(result.errorCount).toBe(1);
      expect(result.errors[0].error).toBe("Network error during update");
    });

    it("throws when operation id does not exist", async () => {
      await expect(
        service.executeBulkStatusUpdate("bad-id", true, [])
      ).rejects.toThrow("Operation not found");
    });
  });

  // ── executeBulkUpdate ────────────────────────────────────────────────

  describe("executeBulkUpdate", () => {
    it("successfully updates schools", async () => {
      const schools = [makeSchool("s1")];
      const opId = service.createOperation("update", ["s1"]);

      const promise = service.executeBulkUpdate(
        opId,
        { description: "updated" },
        schools
      );
      await flushAsync();
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(1);
    });

    it("rejects invalid radius", async () => {
      const schools = [makeSchool("s1")];
      const opId = service.createOperation("update", ["s1"]);

      const promise = service.executeBulkUpdate(
        opId,
        { radius: 5 },
        schools
      );
      await flushAsync();
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.errors[0].error).toBe(
        "Radius must be between 10 and 1000 meters"
      );
    });

    it("rejects radius above 1000", async () => {
      const schools = [makeSchool("s1")];
      const opId = service.createOperation("update", ["s1"]);

      const promise = service.executeBulkUpdate(
        opId,
        { radius: 1500 },
        schools
      );
      await flushAsync();
      const result = await promise;

      expect(result.errors[0].error).toBe(
        "Radius must be between 10 and 1000 meters"
      );
    });

    it("rejects invalid email format", async () => {
      const schools = [makeSchool("s1")];
      const opId = service.createOperation("update", ["s1"]);

      const promise = service.executeBulkUpdate(
        opId,
        { contactEmail: "not-an-email" },
        schools
      );
      await flushAsync();
      const result = await promise;

      expect(result.errors[0].error).toBe("Invalid email format");
    });

    it("reports school-not-found errors", async () => {
      const opId = service.createOperation("update", ["missing"]);

      const promise = service.executeBulkUpdate(
        opId,
        { description: "x" },
        []
      );
      await flushAsync();
      const result = await promise;

      expect(result.errors[0].error).toBe("School not found");
    });

    it("throws when operation id does not exist", async () => {
      await expect(
        service.executeBulkUpdate("bad", { description: "x" }, [])
      ).rejects.toThrow("Operation not found");
    });
  });

  // ── executeBulkProviderAssignment ────────────────────────────────────

  describe("executeBulkProviderAssignment", () => {
    it("successfully assigns providers", async () => {
      const schools = [makeSchool("s1")];
      const opId = service.createOperation("assign_providers", ["s1"]);

      const promise = service.executeBulkProviderAssignment(
        opId,
        { providerIds: ["p1", "p2"], action: "assign" },
        schools
      );
      await flushAsync();
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(1);
    });

    it("errors when no providers specified", async () => {
      const schools = [makeSchool("s1")];
      const opId = service.createOperation("assign_providers", ["s1"]);

      const promise = service.executeBulkProviderAssignment(
        opId,
        { providerIds: [], action: "assign" },
        schools
      );
      await flushAsync();
      const result = await promise;

      expect(result.errors[0].error).toBe(
        "No providers specified for assignment"
      );
    });

    it("reports school-not-found errors", async () => {
      const opId = service.createOperation("assign_providers", ["gone"]);

      const promise = service.executeBulkProviderAssignment(
        opId,
        { providerIds: ["p1"], action: "remove" },
        []
      );
      await flushAsync();
      const result = await promise;

      expect(result.errors[0].error).toBe("School not found");
    });

    it("throws when operation id does not exist", async () => {
      await expect(
        service.executeBulkProviderAssignment(
          "bad",
          { providerIds: ["p1"], action: "assign" },
          []
        )
      ).rejects.toThrow("Operation not found");
    });
  });

  // ── executeBulkLocationValidation ────────────────────────────────────

  describe("executeBulkLocationValidation", () => {
    it("validates a school with no issues", async () => {
      const schools = [makeSchool("s1")];
      const opId = service.createOperation("validate_locations", ["s1"]);

      const promise = service.executeBulkLocationValidation(opId, schools);
      await flushAsync();
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results![0].isValid).toBe(true);
      expect(result.results![0].issues).toEqual([]);
    });

    it("flags missing GPS coordinates (lat=0 or lon=0)", async () => {
      const schools = [makeSchool("s1", { latitude: 0, longitude: 0 })];
      const opId = service.createOperation("validate_locations", ["s1"]);

      const promise = service.executeBulkLocationValidation(opId, schools);
      await flushAsync();
      const result = await promise;

      expect(result.results![0].issues).toContain("Missing GPS coordinates");
    });

    it("flags incomplete address", async () => {
      const schools = [makeSchool("s1", { address: "Short" })];
      const opId = service.createOperation("validate_locations", ["s1"]);

      const promise = service.executeBulkLocationValidation(opId, schools);
      await flushAsync();
      const result = await promise;

      expect(result.results![0].issues).toContain("Address is incomplete");
    });

    it("flags radius too small", async () => {
      const schools = [makeSchool("s1", { radius: 10 })];
      const opId = service.createOperation("validate_locations", ["s1"]);

      const promise = service.executeBulkLocationValidation(opId, schools);
      await flushAsync();
      const result = await promise;

      expect(result.results![0].issues).toContain(
        "Check-in radius may be too small"
      );
    });

    it("flags radius too large", async () => {
      const schools = [makeSchool("s1", { radius: 600 })];
      const opId = service.createOperation("validate_locations", ["s1"]);

      const promise = service.executeBulkLocationValidation(opId, schools);
      await flushAsync();
      const result = await promise;

      expect(result.results![0].issues).toContain(
        "Check-in radius may be too large"
      );
    });

    it("reports school-not-found errors", async () => {
      const opId = service.createOperation("validate_locations", ["gone"]);

      const promise = service.executeBulkLocationValidation(opId, []);
      await flushAsync();
      const result = await promise;

      expect(result.errors[0].error).toBe("School not found");
    });

    it("throws when operation id does not exist", async () => {
      await expect(
        service.executeBulkLocationValidation("bad", [])
      ).rejects.toThrow("Operation not found");
    });
  });

  // ── importSchools ────────────────────────────────────────────────────

  describe("importSchools", () => {
    it("imports valid school data", async () => {
      const csvData = [
        { name: "New School", address: "100 Oak Ave", latitude: 41.0, longitude: -87.0 },
      ];

      const promise = service.importSchools(csvData);
      await flushAsync();
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(1);
      expect(result.results).toHaveLength(1);
      expect(result.results![0].name).toBe("New School");
      expect(result.results![0].isActive).toBe(true);
      expect(result.results![0].radius).toBe(300); // default
    });

    it("uses provided radius instead of default", async () => {
      const csvData = [
        { name: "School", address: "100 St", radius: 150 },
      ];

      const promise = service.importSchools(csvData);
      await flushAsync();
      const result = await promise;

      expect(result.results![0].radius).toBe(150);
    });

    it("errors on missing name", async () => {
      const csvData = [{ name: "", address: "100 St" }];

      const promise = service.importSchools(csvData);
      await flushAsync();
      const result = await promise;

      expect(result.errorCount).toBe(1);
      expect(result.errors[0].error).toBe("Name and address are required");
    });

    it("errors on missing address", async () => {
      const csvData = [{ name: "School", address: "" }];

      const promise = service.importSchools(csvData);
      await flushAsync();
      const result = await promise;

      expect(result.errors[0].error).toBe("Name and address are required");
    });

    it("errors on invalid email format", async () => {
      const csvData = [
        { name: "School", address: "100 St", contactEmail: "bad" },
      ];

      const promise = service.importSchools(csvData);
      await flushAsync();
      const result = await promise;

      expect(result.errors[0].error).toBe("Invalid email format");
    });

    it("errors on invalid latitude", async () => {
      const csvData = [
        { name: "School", address: "100 St", latitude: 100 },
      ];

      const promise = service.importSchools(csvData);
      await flushAsync();
      const result = await promise;

      expect(result.errors[0].error).toBe("Invalid latitude");
    });

    it("errors on invalid longitude", async () => {
      const csvData = [
        { name: "School", address: "100 St", longitude: -200 },
      ];

      const promise = service.importSchools(csvData);
      await flushAsync();
      const result = await promise;

      expect(result.errors[0].error).toBe("Invalid longitude");
    });

    it("errors on radius out of range", async () => {
      const csvData = [
        { name: "School", address: "100 St", radius: 5 },
      ];

      const promise = service.importSchools(csvData);
      await flushAsync();
      const result = await promise;

      expect(result.errors[0].error).toBe(
        "Radius must be between 10 and 1000 meters"
      );
    });

    it("uses row number as fallback name in errors", async () => {
      const csvData = [{ name: "", address: "" }];

      const promise = service.importSchools(csvData);
      await flushAsync();
      const result = await promise;

      expect(result.errors[0].schoolName).toBe("Row 1");
    });
  });

  // ── generateCSVExport ────────────────────────────────────────────────

  describe("generateCSVExport", () => {
    const school = makeSchool("s1");

    it("generates CSV with all columns by default", () => {
      const csv = service.generateCSVExport([school]);
      const lines = csv.split("\n");

      expect(lines[0]).toContain("Name");
      expect(lines[0]).toContain("Latitude");
      expect(lines[0]).toContain("Active Providers");
      expect(lines[0]).toContain("Assigned Providers");
      expect(lines).toHaveLength(2); // header + 1 row
    });

    it("excludes location columns when includeLocation is false", () => {
      const csv = service.generateCSVExport([school], {
        includeLocation: false,
      });
      expect(csv.split("\n")[0]).not.toContain("Latitude");
    });

    it("excludes stats columns when includeStats is false", () => {
      const csv = service.generateCSVExport([school], {
        includeStats: false,
      });
      expect(csv.split("\n")[0]).not.toContain("Active Providers");
    });

    it("excludes providers column when includeProviders is false", () => {
      const csv = service.generateCSVExport([school], {
        includeProviders: false,
      });
      expect(csv.split("\n")[0]).not.toContain("Assigned Providers");
    });

    it("shows Active/Inactive status", () => {
      const active = service.generateCSVExport([school]);
      expect(active).toContain("Active");

      const inactive = service.generateCSVExport([
        makeSchool("s2", { isActive: false }),
      ]);
      expect(inactive).toContain("Inactive");
    });

    it("handles missing optional fields gracefully", () => {
      const sparse = makeSchool("s1", {
        activeProviders: undefined,
        totalSessions: undefined,
        assignedProviders: undefined,
        description: undefined,
        contactEmail: undefined,
        contactPhone: undefined,
        createdAt: undefined,
        updatedAt: undefined,
      });

      const csv = service.generateCSVExport([sparse]);
      expect(csv.split("\n")).toHaveLength(2);
    });
  });

  // ── parseCSVImport ───────────────────────────────────────────────────

  describe("parseCSVImport", () => {
    it("parses basic CSV with all fields", () => {
      const csv = `Name,Address,Latitude,Longitude,Radius,Description,Contact Email,Contact Phone
"Test School","100 Main St",41.8,-87.6,200,"Desc","a@b.com","555-1234"`;

      const result = service.parseCSVImport(csv);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: "Test School",
        address: "100 Main St",
        latitude: 41.8,
        longitude: -87.6,
        radius: 200,
        description: "Desc",
        contactEmail: "a@b.com",
        contactPhone: "555-1234",
      });
    });

    it("handles 'email' and 'phone' as alternate header names", () => {
      const csv = `Name,Address,Email,Phone
"School","123 St","a@b.com","555"`;

      const result = service.parseCSVImport(csv);
      expect(result[0].contactEmail).toBe("a@b.com");
      expect(result[0].contactPhone).toBe("555");
    });

    it("skips rows without name or address", () => {
      const csv = `Name,Address
"","123 St"
"School",""
"Valid","456 Ave"`;

      const result = service.parseCSVImport(csv);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Valid");
    });

    it("parses CSV with commas inside quotes", () => {
      const csv = `Name,Address
"School, B","456, Elm St"`;

      const result = service.parseCSVImport(csv);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("School, B");
      expect(result[0].address).toBe("456, Elm St");
    });

    it("parses CSV with escaped quotes", () => {
      const csv = `Name,Address,Description
"School A","123 Main St","A ""Great"" School"`;

      const result = service.parseCSVImport(csv);
      expect(result[0].description).toBe('A "Great" School');
    });

    it("throws for header-only CSV", () => {
      expect(() => service.parseCSVImport("Name,Address")).toThrow(
        "CSV must have at least a header and one data row"
      );
    });

    it("throws for empty CSV", () => {
      expect(() => service.parseCSVImport("")).toThrow(
        "CSV must have at least a header and one data row"
      );
    });

    it("leaves numeric fields undefined when empty", () => {
      const csv = `Name,Address,Latitude,Longitude,Radius
"School","123 St",,,`;

      const result = service.parseCSVImport(csv);
      expect(result[0].latitude).toBeUndefined();
      expect(result[0].longitude).toBeUndefined();
      expect(result[0].radius).toBeUndefined();
    });
  });

  // ── clearCompletedOperations ─────────────────────────────────────────

  describe("clearCompletedOperations", () => {
    it("removes completed and failed operations", async () => {
      const schools = [makeSchool("s1")];

      // Create a completed operation
      const id1 = service.createOperation("activate", ["s1"]);
      const p1 = service.executeBulkStatusUpdate(id1, true, schools);
      await flushAsync();
      await p1;

      // Create a pending operation
      const id2 = service.createOperation("deactivate", ["s1"]);

      expect(service.listOperations()).toHaveLength(2);

      service.clearCompletedOperations();

      const remaining = service.listOperations();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(id2);
    });

    it("does nothing when no completed operations exist", () => {
      service.createOperation("activate", ["s1"]);
      service.clearCompletedOperations();
      expect(service.listOperations()).toHaveLength(1);
    });
  });

  // ── singleton export ─────────────────────────────────────────────────

  describe("singleton", () => {
    it("exports a singleton instance", () => {
      expect(bulkSchoolOperations).toBeInstanceOf(BulkSchoolOperationsService);
    });
  });
});
