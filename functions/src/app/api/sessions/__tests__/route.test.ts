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
  getSessionsByUser: jest.fn(),
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

describe("API /api/sessions", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("GET", () => {
    it("should return sessions for a valid user ID", async () => {
      const mockSessions = [{ id: "session1", userId: "user1" }];
      (firestore.getSessionsByUser as jest.Mock).mockResolvedValue(
        mockSessions
      );

      const req = {
        url: "http://localhost/api/sessions?userId=user1",
      } as NextRequest;
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.sessions).toEqual(mockSessions);
      expect(firestore.getSessionsByUser).toHaveBeenCalledWith("user1", 50);
    });

    it("should return 400 if userId is missing", async () => {
      const req = { url: "http://localhost/api/sessions" } as NextRequest;
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe("User ID is required");
    });

    it("should return 500 on error", async () => {
      (firestore.getSessionsByUser as jest.Mock).mockRejectedValue(
        new Error("Firestore error")
      );

      const req = {
        url: "http://localhost/api/sessions?userId=user1",
      } as NextRequest;
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBe("Failed to fetch sessions");
    });
  });

  describe("POST", () => {
    it("should create a new session and return it", async () => {
      const newSessionId = "newSessionId";
      const sessionData = {
        userId: "user1",
        schoolId: "school1",
        checkInLocation: { lat: 1, lng: 1 },
      };
      (firestore.createDocument as jest.Mock).mockResolvedValue(newSessionId);

      const req = {
        json: async () => sessionData,
      } as NextRequest;
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.id).toBe(newSessionId);
      expect(body.userId).toBe(sessionData.userId);
      expect(firestore.createDocument).toHaveBeenCalledWith(
        firestore.COLLECTIONS.SESSIONS,
        expect.any(Object)
      );
    });

    it("should return 400 if required fields are missing", async () => {
      const req = {
        json: async () => ({ userId: "user1" }),
      } as NextRequest;
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe(
        "User ID, School ID, and check-in location are required"
      );
    });
  });

  describe("PUT", () => {
    it("should update a session and return it", async () => {
      const sessionId = "session1";
      const updateData = {
        sessionId,
        checkOutLocation: { lat: 2, lng: 2 },
      };
      const updatedSessionData = { status: "completed" };

      (firestore.updateDocument as jest.Mock).mockResolvedValue(undefined);
      (firestore.getDocument as jest.Mock).mockResolvedValue(
        updatedSessionData
      );

      const req = {
        json: async () => updateData,
      } as NextRequest;
      const res = await PUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({ id: sessionId, ...updatedSessionData });
      expect(firestore.updateDocument).toHaveBeenCalledWith(
        firestore.COLLECTIONS.SESSIONS,
        sessionId,
        expect.any(Object)
      );
    });

    it("should return 400 if sessionId is missing", async () => {
      const req = {
        json: async () => ({}),
      } as NextRequest;
      const res = await PUT(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe("Session ID is required");
    });
  });

  describe("DELETE", () => {
    it("should delete a session", async () => {
      const sessionId = "session1";
      (firestore.deleteDocument as jest.Mock).mockResolvedValue(undefined);

      const req = {
        url: `http://localhost/api/sessions?sessionId=${sessionId}`,
      } as NextRequest;
      const res = await DELETE(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.message).toBe("Session deleted successfully");
      expect(firestore.deleteDocument).toHaveBeenCalledWith(
        firestore.COLLECTIONS.SESSIONS,
        sessionId
      );
    });

    it("should return 400 if sessionId is missing", async () => {
      const req = {
        url: "http://localhost/api/sessions",
      } as NextRequest;
      const res = await DELETE(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe("Session ID is required");
    });
  });
});
