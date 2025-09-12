// Unit tests for Firestore utilities

import {
  createDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  getCollection,
  getUserByEmail,
  getLocationsByProvider,
  getSessionsByUser,
  getActiveSessions,
  COLLECTIONS,
} from "./firestore";
import { Timestamp } from "firebase/firestore";

// Mock Firestore
const mockDocRef = {
  id: "mock-doc-id",
};

const mockCollectionRef = {
  id: "mock-collection-id",
};

const mockQuery = {
  id: "mock-query-id",
};

const mockDocSnap = {
  id: "mock-doc-id",
  exists: () => true,
  data: () => ({ name: "Test Document", createdAt: Timestamp.now() }),
};

const mockEmptyDocSnap = {
  id: "nonexistent-id",
  exists: () => false,
  data: () => null,
};

const mockQuerySnap = {
  docs: [mockDocSnap],
  forEach: (callback: (doc: any) => void) => {
    mockQuerySnap.docs.forEach(callback);
  },
};

jest.mock("../../../firebase.config", () => ({
  db: {},
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn(() => mockDocRef),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(() => mockQuery),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ toMillis: () => Date.now() })),
  },
}));

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";

describe("Firestore Utilities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("COLLECTIONS", () => {
    it("exports correct collection names", () => {
      expect(COLLECTIONS.USERS).toBe("users");
      expect(COLLECTIONS.SESSIONS).toBe("sessions");
      expect(COLLECTIONS.LOCATIONS).toBe("locations");
    });
  });

  describe("createDocument", () => {
    it("creates document and returns ID", async () => {
      (addDoc as jest.Mock).mockResolvedValue(mockDocRef);

      const testData = { name: "Test Document" };
      const result = await createDocument("test-collection", testData);

      expect(addDoc).toHaveBeenCalledWith(
        expect.any(Object), // collection reference
        testData
      );
      expect(result).toBe("mock-doc-id");
    });

    it("throws error when creation fails", async () => {
      const mockError = new Error("Permission denied");
      (addDoc as jest.Mock).mockRejectedValue(mockError);

      await expect(createDocument("test-collection", {})).rejects.toThrow(
        "Permission denied"
      );
    });
  });

  describe("getDocument", () => {
    it("returns document data when document exists", async () => {
      (getDoc as jest.Mock).mockResolvedValue(mockDocSnap);

      const result = await getDocument<{ name: string }>(
        "test-collection",
        "mock-doc-id"
      );

      expect(getDoc).toHaveBeenCalledWith(
        expect.any(Object) // doc reference
      );
      expect(result).toEqual({
        id: "mock-doc-id",
        name: "Test Document",
        createdAt: expect.any(Object),
      });
    });

    it("returns null when document does not exist", async () => {
      (getDoc as jest.Mock).mockResolvedValue(mockEmptyDocSnap);

      const result = await getDocument("test-collection", "nonexistent-id");

      expect(result).toBeNull();
    });

    it("throws error when get operation fails", async () => {
      const mockError = new Error("Network error");
      (getDoc as jest.Mock).mockRejectedValue(mockError);

      await expect(
        getDocument("test-collection", "mock-doc-id")
      ).rejects.toThrow("Network error");
    });
  });

  describe("updateDocument", () => {
    it("updates document successfully", async () => {
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const updateData = { name: "Updated Name" };
      await expect(
        updateDocument("test-collection", "mock-doc-id", updateData)
      ).resolves.toBeUndefined();

      expect(updateDoc).toHaveBeenCalledWith(
        expect.any(Object), // doc reference
        updateData
      );
    });

    it("throws error when update fails", async () => {
      const mockError = new Error("Document not found");
      (updateDoc as jest.Mock).mockRejectedValue(mockError);

      await expect(
        updateDocument("test-collection", "mock-doc-id", {})
      ).rejects.toThrow("Document not found");
    });
  });

  describe("deleteDocument", () => {
    it("deletes document successfully", async () => {
      (deleteDoc as jest.Mock).mockResolvedValue(undefined);

      await expect(
        deleteDocument("test-collection", "mock-doc-id")
      ).resolves.toBeUndefined();

      expect(deleteDoc).toHaveBeenCalledWith(
        expect.any(Object) // doc reference
      );
    });

    it("throws error when deletion fails", async () => {
      const mockError = new Error("Permission denied");
      (deleteDoc as jest.Mock).mockRejectedValue(mockError);

      await expect(
        deleteDocument("test-collection", "mock-doc-id")
      ).rejects.toThrow("Permission denied");
    });
  });

  describe("getCollection", () => {
    it("returns all documents in collection", async () => {
      (getDocs as jest.Mock).mockResolvedValue(mockQuerySnap);

      const result = await getCollection<{ name: string }>("test-collection");

      expect(getDocs).toHaveBeenCalledWith(
        expect.any(Object) // collection reference
      );
      expect(result).toEqual([
        {
          id: "mock-doc-id",
          name: "Test Document",
          createdAt: expect.any(Object),
        },
      ]);
    });

    it("returns empty array when no documents exist", async () => {
      const emptyQuerySnap = { docs: [], forEach: () => {} };
      (getDocs as jest.Mock).mockResolvedValue(emptyQuerySnap);

      const result = await getCollection("test-collection");

      expect(result).toEqual([]);
    });

    it("throws error when query fails", async () => {
      const mockError = new Error("Network error");
      (getDocs as jest.Mock).mockRejectedValue(mockError);

      await expect(getCollection("test-collection")).rejects.toThrow(
        "Network error"
      );
    });
  });

  describe("getUserByEmail", () => {
    it("returns user when found by email", async () => {
      (getDocs as jest.Mock).mockResolvedValue(mockQuerySnap);

      const result = await getUserByEmail("test@example.com");

      expect(getDocs).toHaveBeenCalledWith(
        expect.any(Object) // query object
      );
      expect(result).toEqual({
        uid: "mock-doc-id",
        name: "Test Document",
        createdAt: expect.any(Object),
      });
    });

    it("returns null when user not found", async () => {
      const emptyQuerySnap = { docs: [], empty: true };
      (getDocs as jest.Mock).mockResolvedValue(emptyQuerySnap);

      const result = await getUserByEmail("nonexistent@example.com");

      expect(result).toBeNull();
    });

    it("throws error when query fails", async () => {
      const mockError = new Error("Query failed");
      (getDocs as jest.Mock).mockRejectedValue(mockError);

      await expect(getUserByEmail("test@example.com")).rejects.toThrow(
        "Query failed"
      );
    });
  });

  describe("getLocationsByProvider", () => {
    it("returns locations assigned to provider", async () => {
      (getDocs as jest.Mock).mockResolvedValue(mockQuerySnap);

      const result = await getLocationsByProvider("provider123");

      expect(getDocs).toHaveBeenCalledWith(
        expect.any(Object) // query object
      );
      expect(result).toEqual([
        {
          id: "mock-doc-id",
          name: "Test Document",
          createdAt: expect.any(Object),
        },
      ]);
    });

    it("returns empty array when no locations found", async () => {
      const emptyQuerySnap = { docs: [] };
      (getDocs as jest.Mock).mockResolvedValue(emptyQuerySnap);

      const result = await getLocationsByProvider("provider123");

      expect(result).toEqual([]);
    });
  });

  describe("getActiveSessions", () => {
    it("returns active sessions", async () => {
      (getDocs as jest.Mock).mockResolvedValue(mockQuerySnap);

      const result = await getActiveSessions();

      expect(getDocs).toHaveBeenCalledWith(
        expect.any(Object) // query object
      );
      expect(result).toEqual([
        {
          id: "mock-doc-id",
          name: "Test Document",
          createdAt: expect.any(Object),
        },
      ]);
    });

    it("returns empty array when no active sessions", async () => {
      const emptyQuerySnap = { docs: [] };
      (getDocs as jest.Mock).mockResolvedValue(emptyQuerySnap);

      const result = await getActiveSessions();

      expect(result).toEqual([]);
    });
  });
});
