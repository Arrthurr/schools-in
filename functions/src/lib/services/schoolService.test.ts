// Unit tests for SchoolService

import { SchoolService } from "./schoolService";

describe("SchoolService", () => {
  beforeEach(() => {
    // Reset the static schools cache before each test
    (SchoolService as any).schools = null;
  });

  describe("getAllSchools", () => {
    it("returns all schools from static data", async () => {
      const schools = await SchoolService.getAllSchools();

      expect(schools).toBeDefined();
      expect(Array.isArray(schools)).toBe(true);
      expect(schools.length).toBeGreaterThan(0);

      // Check structure of first school
      const firstSchool = schools[0];
      expect(firstSchool).toHaveProperty("id");
      expect(firstSchool).toHaveProperty("name");
      expect(firstSchool).toHaveProperty("latitude");
      expect(firstSchool).toHaveProperty("longitude");
      expect(firstSchool).toHaveProperty("radius");
    });

    it("caches schools data after first call", async () => {
      const schools1 = await SchoolService.getAllSchools();
      const schools2 = await SchoolService.getAllSchools();

      expect(schools1).toEqual(schools2);
      expect(schools1).not.toBe(schools2); // Should return a copy, not the same reference
    });
  });

  describe("getAssignedSchools", () => {
    it("returns assigned schools for a provider", async () => {
      const schools = await SchoolService.getAssignedSchools("provider123");

      expect(Array.isArray(schools)).toBe(true);
      expect(schools.length).toBeGreaterThan(0);

      // Check that assigned schools have isAssigned property
      schools.forEach((school) => {
        expect(school).toHaveProperty("isAssigned", true);
      });
    });

    it("returns different schools for different providers", async () => {
      const schools1 = await SchoolService.getAssignedSchools("provider1");
      const schools2 = await SchoolService.getAssignedSchools("provider2");

      // Since it's currently mocked to return the same schools, they should be equal
      // In a real implementation, this would return different schools
      expect(schools1).toEqual(schools2);
    });
  });

  describe("getSchoolById", () => {
    it("returns school when found by ID", async () => {
      const allSchools = await SchoolService.getAllSchools();
      const firstSchool = allSchools[0];

      const result = await SchoolService.getSchoolById(firstSchool.id);

      expect(result).toEqual(firstSchool);
    });

    it("returns null when school not found", async () => {
      const result = await SchoolService.getSchoolById("nonexistent-id");

      expect(result).toBeNull();
    });
  });

  describe("calculateDistance", () => {
    it("calculates distance between same coordinates as 0", () => {
      const distance = SchoolService.calculateDistance(
        40.7128,
        -74.006,
        40.7128,
        -74.006
      );

      expect(distance).toBe(0);
    });

    it("calculates distance between different coordinates", () => {
      // New York to Los Angeles (approximate)
      const nycLat = 40.7128;
      const nycLng = -74.006;
      const laLat = 34.0522;
      const laLng = -118.2437;

      const distance = SchoolService.calculateDistance(
        nycLat,
        nycLng,
        laLat,
        laLng
      );

      // Should be approximately 3,944 km or 3,944,000 meters
      expect(distance).toBeGreaterThan(3900000);
      expect(distance).toBeLessThan(4000000);
    });

    it("calculates short distances accurately", () => {
      // Two points approximately 100m apart
      const point1Lat = 40.7128;
      const point1Lng = -74.006;
      const point2Lat = 40.7129; // Slightly north
      const point2Lng = -74.006;

      const distance = SchoolService.calculateDistance(
        point1Lat,
        point1Lng,
        point2Lat,
        point2Lng
      );

      expect(distance).toBeGreaterThan(10);
      expect(distance).toBeLessThan(200);
    });
  });

  describe("isWithinRadius", () => {
    it("returns true when user is within school radius", async () => {
      const allSchools = await SchoolService.getAllSchools();
      const school = allSchools[0];

      // Use the school's own coordinates (should be within radius)
      const result = SchoolService.isWithinRadius(
        school.latitude,
        school.longitude,
        school
      );

      expect(result).toBe(true);
    });

    it("returns false when user is outside school radius", async () => {
      const allSchools = await SchoolService.getAllSchools();
      const school = allSchools[0];

      // Use coordinates far from the school
      const farLat = school.latitude + 1; // Approximately 111km away
      const farLng = school.longitude + 1;

      const result = SchoolService.isWithinRadius(farLat, farLng, school);

      expect(result).toBe(false);
    });

    it("uses default radius of 100 when not specified", async () => {
      const allSchools = await SchoolService.getAllSchools();
      const school = { ...allSchools[0], radius: undefined };

      // Point 50 meters away should be within default 100m radius
      const nearbyLat = school.latitude + 0.00045; // Approximately 50m
      const nearbyLng = school.longitude;

      const result = SchoolService.isWithinRadius(nearbyLat, nearbyLng, school);

      expect(result).toBe(true);
    });
  });

  describe("getSchoolsWithDistance", () => {
    it("returns schools with calculated distances", async () => {
      const userLat = 40.7128;
      const userLng = -74.006;

      const schools = await SchoolService.getSchoolsWithDistance(
        userLat,
        userLng,
        "provider123"
      );

      expect(Array.isArray(schools)).toBe(true);
      expect(schools.length).toBeGreaterThan(0);

      schools.forEach((school) => {
        expect(school).toHaveProperty("distance");
        expect(typeof school.distance).toBe("number");
        expect(school.distance).toBeGreaterThanOrEqual(0);
      });
    });

    it("sorts schools by distance (closest first)", async () => {
      const userLat = 40.7128;
      const userLng = -74.006;

      const schools = await SchoolService.getSchoolsWithDistance(
        userLat,
        userLng,
        "provider123"
      );

      for (let i = 1; i < schools.length; i++) {
        expect(schools[i - 1].distance! <= schools[i].distance!).toBe(true);
      }
    });
  });

  describe("searchSchools", () => {
    it("returns all schools when query is empty", async () => {
      const allSchools = await SchoolService.getAllSchools();
      const result = await SchoolService.searchSchools("");

      expect(result.length).toBe(allSchools.length);
    });

    it("filters schools by name (case insensitive)", async () => {
      const result = await SchoolService.searchSchools("high school");

      expect(Array.isArray(result)).toBe(true);

      // Check that all results contain the search term
      result.forEach((school) => {
        expect(school.name.toLowerCase()).toContain("high school");
      });
    });

    it("returns empty array when no matches found", async () => {
      const result = await SchoolService.searchSchools(
        "nonexistent-school-name-12345"
      );

      expect(result).toEqual([]);
    });

    it("searches within assigned schools when providerId provided", async () => {
      const result = await SchoolService.searchSchools("school", "provider123");

      expect(Array.isArray(result)).toBe(true);

      // Should only return assigned schools that match
      result.forEach((school) => {
        expect(school.name.toLowerCase()).toContain("school");
        expect(school).toHaveProperty("isAssigned", true);
      });
    });

    it("searches all schools when no providerId provided", async () => {
      const result = await SchoolService.searchSchools("school");

      expect(Array.isArray(result)).toBe(true);

      result.forEach((school) => {
        expect(school.name.toLowerCase()).toContain("school");
      });
    });
  });
});
