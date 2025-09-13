import { NextRequest, NextResponse } from "next/server";
import { GET, POST, PUT, DELETE } from "../route";
import * as firestore from "@/lib/firebase/firestore";
import { Timestamp } from "firebase/firestore";

// Mock next/server
jest.mock("next/server", () => ({
  ...jest.requireActual("next/server"),
  NextResponse: {
    json: jest.fn((data, init) => {
      return {
        json: async () => data,
        status: init?.status || 200,
      };
    }),
  },
}));

// Mock the firestore functions
jest.mock("@/lib/firebase/firestore", () => ({
  ...jest.requireActual("@/lib/firebase/firestore"),
  getCollection: jest.fn(),
  getLocationsByProvider: jest.fn(),
  createDocument: jest.fn(),
  updateDocument: jest.fn(),
  deleteDocument: jest.fn(),
  getDocument: jest.fn(),
}));

// Mock Timestamp
jest.mock("firebase/firestore", () => ({
  ...jest.requireActual("firebase/firestore"),
  Timestamp: {
    now: jest.fn(() => ({
      toDate: () => new Date(),
      toMillis: () => Date.now(),
    })),
  },
}));

describe("API /api/locations", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("GET", () => {
    it("should return all schools when no providerId is given", async () => {
      const mockSchools = [{ id: "school1", name: "Test School" }];
      (firestore.getCollection as jest.Mock).mockResolvedValue(mockSchools);

      const req = {
        url: "http://localhost/api/locations",
      } as NextRequest;
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.schools).toEqual(mockSchools);
      expect(firestore.getCollection).toHaveBeenCalledWith(
        firestore.COLLECTIONS.LOCATIONS
      );
    });

    it("should return schools for a specific provider when providerId is given", async () => {
      const mockSchools = [{ id: "school1", name: "Provider School" }];
      (firestore.getLocationsByProvider as jest.Mock).mockResolvedValue(
        mockSchools
      );

      const req = {
        url: "http://localhost/api/locations?providerId=provider1",
      } as NextRequest;
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.schools).toEqual(mockSchools);
      expect(firestore.getLocationsByProvider).toHaveBeenCalledWith(
        "provider1"
      );
    });

    it("should return 500 on error", async () => {
      (firestore.getCollection as jest.Mock).mockRejectedValue(
        new Error("Firestore error")
      );

      const req = {
        url: "http://localhost/api/locations",
      } as NextRequest;
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBe("Failed to fetch schools");
    });
  });

  describe("POST", () => {
    it("should create a new school and return it", async () => {
      const newSchoolId = "newSchoolId";
      const schoolData = {
        name: "New School",
        address: "123 Main St",
        coordinates: { lat: 1, lng: 1 },
        radius: 100,
      };
      (firestore.createDocument as jest.Mock).mockResolvedValue(newSchoolId);

      const req = {
        json: async () => schoolData,
      } as NextRequest;
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.id).toBe(newSchoolId);
      expect(body.name).toBe(schoolData.name);
      expect(firestore.createDocument).toHaveBeenCalledWith(
        firestore.COLLECTIONS.LOCATIONS,
        expect.any(Object)
      );
    });

    it("should return 400 if required fields are missing", async () => {
      const req = {
        json: async () => ({ name: "Incomplete School" }),
      } as NextRequest;
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe(
        "Name, address, coordinates, and radius are required"
      );
    });
  });

  describe("PUT", () => {
    it("should update a school and return it", async () => {
      const schoolId = "school1";
      const updateData = {
        schoolId,
        name: "Updated School Name",
      };
      const updatedSchoolData = { name: "Updated School Name" };

      (firestore.updateDocument as jest.Mock).mockResolvedValue(undefined);
      (firestore.getDocument as jest.Mock).mockResolvedValue(updatedSchoolData);

      const req = {
        json: async () => updateData,
      } as NextRequest;
      const res = await PUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({ id: schoolId, ...updatedSchoolData });
      expect(firestore.updateDocument).toHaveBeenCalledWith(
        firestore.COLLECTIONS.LOCATIONS,
        schoolId,
        expect.any(Object)
      );
    });

    it("should return 400 if schoolId is missing", async () => {
      const req = {
        json: async () => ({}),
      } as NextRequest;
      const res = await PUT(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe("School ID is required");
    });
  });

  describe("DELETE", () => {
    it("should delete a school", async () => {
      const schoolId = "school1";
      (firestore.deleteDocument as jest.Mock).mockResolvedValue(undefined);

      const req = {
        url: `http://localhost/api/locations?schoolId=${schoolId}`,
      } as NextRequest;
      const res = await DELETE(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.message).toBe("School deleted successfully");
      expect(firestore.deleteDocument).toHaveBeenCalledWith(
        firestore.COLLECTIONS.LOCATIONS,
        schoolId
      );
    });

    it("should return 400 if schoolId is missing", async () => {
      const req = {
        url: "http://localhost/api/locations",
      } as NextRequest;
      const res = await DELETE(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe("School ID is required");
    });
  });
});
