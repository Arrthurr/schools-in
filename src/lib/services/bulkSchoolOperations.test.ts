import { bulkSchoolOperations } from "./bulkSchoolOperations";

describe("BulkSchoolOperationsService", () => {
  describe("parseCSVImport", () => {
    it("should correctly parse CSV with commas inside quotes", () => {
      const csvContent = `Name,Address
"School, B","456, Elm St"`;

      const result = bulkSchoolOperations.parseCSVImport(csvContent);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("School, B");
      expect(result[0].address).toBe("456, Elm St");
    });

    it("should correctly parse CSV with escaped quotes", () => {
      // "A ""Great"" School" should become A "Great" School
      const csvContent = `Name,Address,Description
"School A","123 Main St","A ""Great"" School"`;

      const result = bulkSchoolOperations.parseCSVImport(csvContent);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("School A");
      expect(result[0].address).toBe("123 Main St");
      expect(result[0].description).toBe('A "Great" School');
    });
  });
});
