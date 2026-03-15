import {
  getAllUsers,
  getUserById,
  createUser,
  updateUserRole,
  toggleUserStatus,
  updateUserProfile,
  deleteUser,
  bulkUpdateUserStatus,
  bulkDeleteUsers,
  getUserStats,
  getProvidersWithSchools,
  searchUsers,
} from "./userService";

const mockCollection = jest.fn(() => "collection-ref");
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockGetDocs = jest.fn();
const mockGetDoc = jest.fn();
const mockDoc = jest.fn(() => "doc-ref");
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockSetDoc = jest.fn();
const mockWriteBatch = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchDelete = jest.fn();
const mockBatchCommit = jest.fn();

jest.mock("firebase/firestore", () => ({
  collection: (...args: any[]) => mockCollection(...args),
  query: (...args: any[]) => mockQuery(...args),
  where: (...args: any[]) => mockWhere(...args),
  orderBy: (...args: any[]) => mockOrderBy(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  doc: (...args: any[]) => mockDoc(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
  setDoc: (...args: any[]) => mockSetDoc(...args),
  writeBatch: () => mockWriteBatch(),
  Timestamp: {
    now: jest.fn(() => ({ seconds: 1000, nanoseconds: 0, toDate: () => new Date() })),
  },
}));

jest.mock("../../../firebase.config", () => ({
  db: {} as any,
}));

jest.mock("../firebase/firestore", () => ({
  COLLECTIONS: { USERS: "users" },
}));

describe("userService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc.mockReturnValue("doc-ref");
    mockWriteBatch.mockReturnValue({
      update: mockBatchUpdate,
      delete: mockBatchDelete,
      commit: mockBatchCommit,
    });
  });

  describe("getAllUsers", () => {
    it("returns all users ordered by createdAt desc", async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: "u1", data: () => ({ email: "a@b.com", role: "admin" }) },
          { id: "u2", data: () => ({ email: "c@d.com", role: "provider" }) },
        ],
      });

      const result = await getAllUsers();

      expect(mockCollection).toHaveBeenCalledWith(expect.anything(), "users");
      expect(mockOrderBy).toHaveBeenCalledWith("createdAt", "desc");
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: "u1", email: "a@b.com", role: "admin" });
    });

    it("applies role filter", async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      await getAllUsers({ role: "admin" });

      expect(mockWhere).toHaveBeenCalledWith("role", "==", "admin");
    });

    it("applies isActive filter", async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      await getAllUsers({ isActive: true });

      expect(mockWhere).toHaveBeenCalledWith("isActive", "==", true);
    });

    it("throws on Firestore error", async () => {
      mockGetDocs.mockRejectedValue(new Error("Firestore error"));

      await expect(getAllUsers()).rejects.toThrow("Failed to fetch users");
    });
  });

  describe("getUserById", () => {
    it("returns user when found", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: "u1",
        data: () => ({ email: "a@b.com", role: "admin" }),
      });

      const result = await getUserById("u1");

      expect(mockDoc).toHaveBeenCalledWith(expect.anything(), "users", "u1");
      expect(result).toEqual({ id: "u1", email: "a@b.com", role: "admin" });
    });

    it("returns null when not found", async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      const result = await getUserById("missing");

      expect(result).toBeNull();
    });

    it("throws on Firestore error", async () => {
      mockGetDoc.mockRejectedValue(new Error("fail"));

      await expect(getUserById("u1")).rejects.toThrow("Failed to fetch user");
    });
  });

  describe("createUser", () => {
    it("creates a new user document and returns its id", async () => {
      mockDoc.mockReturnValue({ id: "new-id" });
      mockSetDoc.mockResolvedValue(undefined);

      const result = await createUser({
        displayName: "Test User",
        email: "test@example.com",
        role: "provider",
        isActive: true,
      });

      expect(mockSetDoc).toHaveBeenCalledWith(
        { id: "new-id" },
        expect.objectContaining({
          uid: "new-id",
          email: "test@example.com",
          displayName: "Test User",
          role: "provider",
          isActive: true,
          autoGeofenceCheckEnabled: false,
        })
      );
      expect(result).toBe("new-id");
    });

    it("throws on Firestore error", async () => {
      mockSetDoc.mockRejectedValue(new Error("fail"));

      await expect(
        createUser({ displayName: "X", email: "x@y.com", role: "admin", isActive: true })
      ).rejects.toThrow("Failed to create user");
    });
  });

  describe("updateUserRole", () => {
    it("updates the role field", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateUserRole("u1", "admin");

      expect(mockDoc).toHaveBeenCalledWith(expect.anything(), "users", "u1");
      expect(mockUpdateDoc).toHaveBeenCalledWith("doc-ref", expect.objectContaining({ role: "admin" }));
    });

    it("throws on Firestore error", async () => {
      mockUpdateDoc.mockRejectedValue(new Error("fail"));

      await expect(updateUserRole("u1", "admin")).rejects.toThrow("Failed to update user role");
    });
  });

  describe("toggleUserStatus", () => {
    it("updates the isActive field", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await toggleUserStatus("u1", false);

      expect(mockUpdateDoc).toHaveBeenCalledWith("doc-ref", expect.objectContaining({ isActive: false }));
    });

    it("throws on Firestore error", async () => {
      mockUpdateDoc.mockRejectedValue(new Error("fail"));

      await expect(toggleUserStatus("u1", true)).rejects.toThrow("Failed to update user status");
    });
  });

  describe("updateUserProfile", () => {
    it("updates partial user data", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateUserProfile("u1", { displayName: "New Name" });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        "doc-ref",
        expect.objectContaining({ displayName: "New Name" })
      );
    });

    it("throws on Firestore error", async () => {
      mockUpdateDoc.mockRejectedValue(new Error("fail"));

      await expect(updateUserProfile("u1", {})).rejects.toThrow("Failed to update user profile");
    });
  });

  describe("deleteUser", () => {
    it("deletes the user document", async () => {
      mockDeleteDoc.mockResolvedValue(undefined);

      await deleteUser("u1");

      expect(mockDoc).toHaveBeenCalledWith(expect.anything(), "users", "u1");
      expect(mockDeleteDoc).toHaveBeenCalledWith("doc-ref");
    });

    it("throws on Firestore error", async () => {
      mockDeleteDoc.mockRejectedValue(new Error("fail"));

      await expect(deleteUser("u1")).rejects.toThrow("Failed to delete user");
    });
  });

  describe("bulkUpdateUserStatus", () => {
    it("batch-updates isActive for multiple users", async () => {
      mockBatchCommit.mockResolvedValue(undefined);

      await bulkUpdateUserStatus(["u1", "u2"], true);

      expect(mockBatchUpdate).toHaveBeenCalledTimes(2);
      expect(mockBatchCommit).toHaveBeenCalled();
    });

    it("throws on batch commit error", async () => {
      mockBatchCommit.mockRejectedValue(new Error("fail"));

      await expect(bulkUpdateUserStatus(["u1"], false)).rejects.toThrow(
        "Failed to bulk update user status"
      );
    });
  });

  describe("bulkDeleteUsers", () => {
    it("batch-deletes multiple users", async () => {
      mockBatchCommit.mockResolvedValue(undefined);

      await bulkDeleteUsers(["u1", "u2", "u3"]);

      expect(mockBatchDelete).toHaveBeenCalledTimes(3);
      expect(mockBatchCommit).toHaveBeenCalled();
    });

    it("throws on batch commit error", async () => {
      mockBatchCommit.mockRejectedValue(new Error("fail"));

      await expect(bulkDeleteUsers(["u1"])).rejects.toThrow("Failed to bulk delete users");
    });
  });

  describe("getUserStats", () => {
    it("computes stats from all users", async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { data: () => ({ role: "admin", isActive: true }) },
          { data: () => ({ role: "provider", isActive: true }) },
          { data: () => ({ role: "provider", isActive: false }) },
        ],
      });

      const stats = await getUserStats();

      expect(stats).toEqual({
        totalUsers: 3,
        totalAdmins: 1,
        totalProviders: 2,
        activeUsers: 2,
        inactiveUsers: 1,
      });
    });

    it("throws on Firestore error", async () => {
      mockGetDocs.mockRejectedValue(new Error("fail"));

      await expect(getUserStats()).rejects.toThrow("Failed to fetch user statistics");
    });
  });

  describe("getProvidersWithSchools", () => {
    it("queries providers ordered by displayName", async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: "p1", data: () => ({ displayName: "Alice", role: "provider" }) },
        ],
      });

      const result = await getProvidersWithSchools();

      expect(mockWhere).toHaveBeenCalledWith("role", "==", "provider");
      expect(mockOrderBy).toHaveBeenCalledWith("displayName");
      expect(result).toEqual([{ id: "p1", displayName: "Alice", role: "provider" }]);
    });

    it("throws on Firestore error", async () => {
      mockGetDocs.mockRejectedValue(new Error("fail"));

      await expect(getProvidersWithSchools()).rejects.toThrow("Failed to fetch providers");
    });
  });

  describe("searchUsers", () => {
    it("filters users by email match", async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: "u1", data: () => ({ email: "alice@example.com", displayName: "Alice" }) },
          { id: "u2", data: () => ({ email: "bob@example.com", displayName: "Bob" }) },
        ],
      });

      const result = await searchUsers("alice");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("u1");
    });

    it("filters users by displayName match", async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: "u1", data: () => ({ email: "a@b.com", displayName: "Alice Smith" }) },
          { id: "u2", data: () => ({ email: "c@d.com", displayName: "Bob Jones" }) },
        ],
      });

      const result = await searchUsers("bob");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("u2");
    });

    it("is case-insensitive", async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: "u1", data: () => ({ email: "ALICE@TEST.COM", displayName: null }) },
        ],
      });

      const result = await searchUsers("alice");

      expect(result).toHaveLength(1);
    });

    it("throws on Firestore error", async () => {
      mockGetDocs.mockRejectedValue(new Error("fail"));

      await expect(searchUsers("test")).rejects.toThrow("Failed to search users");
    });
  });
});
