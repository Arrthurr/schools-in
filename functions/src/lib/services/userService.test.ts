// Unit tests for user service

import {
  getAllUsers,
  getUserById,
  updateUserRole,
  toggleUserStatus,
  updateUserSchools,
  updateUserProfile,
  deleteUser,
  bulkUpdateUserStatus,
  bulkDeleteUsers,
  getUserStats,
  getProvidersWithSchools,
  searchUsers,
} from "./userService";

// Mock Firestore
const mockUserDoc = {
  id: "user123",
  uid: "user123",
  email: "test@example.com",
  displayName: "Test User",
  role: "provider" as const,
  assignedSchools: ["school1", "school2"],
  createdAt: { toDate: () => new Date("2024-01-01") },
  lastSignIn: { toDate: () => new Date("2024-01-01") },
  isActive: true,
  data: () => ({
    uid: "user123",
    email: "test@example.com",
    displayName: "Test User",
    role: "provider",
    assignedSchools: ["school1", "school2"],
    createdAt: new Date("2024-01-01"),
    lastSignIn: new Date("2024-01-01"),
    isActive: true,
  }),
};

const mockQuerySnap = {
  docs: [mockUserDoc],
  size: 1,
};

const mockEmptyQuerySnap = {
  docs: [],
  size: 0,
};

jest.mock("../../../firebase.config", () => ({
  db: {},
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => "mock-collection"),
  doc: jest.fn(() => "mock-doc"),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(() => "mock-query"),
  where: jest.fn(),
  orderBy: jest.fn(),
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn(),
  })),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date() })),
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
  writeBatch,
  Timestamp,
} from "firebase/firestore";

describe("User Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAllUsers", () => {
    it("returns all users without filters", async () => {
      (getDocs as jest.Mock).mockResolvedValue(mockQuerySnap);

      const result = await getAllUsers();

      expect(result).toEqual([
        {
          id: "user123",
          uid: "user123",
          email: "test@example.com",
          displayName: "Test User",
          role: "provider",
          assignedSchools: ["school1", "school2"],
          createdAt: new Date("2024-01-01"),
          lastSignIn: new Date("2024-01-01"),
          isActive: true,
        },
      ]);
      expect(getDocs).toHaveBeenCalled();
    });

    it("returns users filtered by role", async () => {
      (getDocs as jest.Mock).mockResolvedValue(mockQuerySnap);

      const result = await getAllUsers({ role: "provider" });

      expect(result).toEqual([
        {
          id: "user123",
          uid: "user123",
          email: "test@example.com",
          displayName: "Test User",
          role: "provider",
          assignedSchools: ["school1", "school2"],
          createdAt: new Date("2024-01-01"),
          lastSignIn: new Date("2024-01-01"),
          isActive: true,
        },
      ]);
      expect(query).toHaveBeenCalled();
    });

    it("returns empty array when no users found", async () => {
      (getDocs as jest.Mock).mockResolvedValue(mockEmptyQuerySnap);

      const result = await getAllUsers();

      expect(result).toEqual([]);
    });

    it("throws error when query fails", async () => {
      const mockError = new Error("Network error");
      (getDocs as jest.Mock).mockRejectedValue(mockError);

      await expect(getAllUsers()).rejects.toThrow("Failed to fetch users");
    });
  });

  describe("getUserById", () => {
    it("returns user when found", async () => {
      (getDoc as jest.Mock).mockResolvedValue({
        id: "user123",
        exists: () => true,
        data: () => ({
          uid: "user123",
          email: "test@example.com",
          displayName: "Test User",
          role: "provider",
          assignedSchools: ["school1", "school2"],
          createdAt: new Date("2024-01-01"),
          lastSignIn: new Date("2024-01-01"),
          isActive: true,
        }),
      });

      const result = await getUserById("user123");

      expect(result).toEqual({
        id: "user123",
        uid: "user123",
        email: "test@example.com",
        displayName: "Test User",
        role: "provider",
        assignedSchools: ["school1", "school2"],
        createdAt: new Date("2024-01-01"),
        lastSignIn: new Date("2024-01-01"),
        isActive: true,
      });
      expect(getDoc).toHaveBeenCalled();
    });

    it("returns null when user not found", async () => {
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => false,
        data: () => null,
      });

      const result = await getUserById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("updateUserRole", () => {
    it("updates user role successfully", async () => {
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await expect(updateUserRole("user123", "admin")).resolves.toBeUndefined();
      expect(updateDoc).toHaveBeenCalled();
    });

    it("throws error when update fails", async () => {
      const mockError = new Error("Document not found");
      (updateDoc as jest.Mock).mockRejectedValue(mockError);

      await expect(updateUserRole("user123", "admin")).rejects.toThrow(
        "Failed to update user role"
      );
    });
  });

  describe("toggleUserStatus", () => {
    it("updates user active status successfully", async () => {
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await expect(toggleUserStatus("user123", false)).resolves.toBeUndefined();
      expect(updateDoc).toHaveBeenCalled();
    });
  });

  describe("updateUserSchools", () => {
    it("updates user assigned schools successfully", async () => {
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const schools = ["school1", "school2"];
      await expect(
        updateUserSchools("user123", schools)
      ).resolves.toBeUndefined();
      expect(updateDoc).toHaveBeenCalled();
    });
  });

  describe("updateUserProfile", () => {
    it("updates user profile successfully", async () => {
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const profileData = {
        displayName: "Updated Name",
        isActive: false,
      };

      await expect(
        updateUserProfile("user123", profileData)
      ).resolves.toBeUndefined();
      expect(updateDoc).toHaveBeenCalled();
    });
  });

  describe("bulkUpdateUserStatus", () => {
    it("bulk updates user status successfully", async () => {
      const mockBatch = {
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      (writeBatch as jest.Mock).mockReturnValue(mockBatch);

      const userIds = ["user1", "user2", "user3"];
      await expect(
        bulkUpdateUserStatus(userIds, true)
      ).resolves.toBeUndefined();

      expect(mockBatch.update).toHaveBeenCalledTimes(3);
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  describe("bulkDeleteUsers", () => {
    it("bulk deletes users successfully", async () => {
      const mockBatch = {
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      (writeBatch as jest.Mock).mockReturnValue(mockBatch);

      const userIds = ["user1", "user2"];
      await expect(bulkDeleteUsers(userIds)).resolves.toBeUndefined();

      expect(mockBatch.delete).toHaveBeenCalledTimes(2);
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  describe("getProvidersWithSchools", () => {
    it("returns providers ordered by display name", async () => {
      (getDocs as jest.Mock).mockResolvedValue(mockQuerySnap);

      const result = await getProvidersWithSchools();

      expect(result).toEqual([
        {
          id: "user123",
          uid: "user123",
          email: "test@example.com",
          displayName: "Test User",
          role: "provider",
          assignedSchools: ["school1", "school2"],
          createdAt: new Date("2024-01-01"),
          lastSignIn: new Date("2024-01-01"),
          isActive: true,
        },
      ]);
      expect(query).toHaveBeenCalled();
    });
  });

  describe("searchUsers", () => {
    it("searches users by email", async () => {
      const mockUsers = [
        { id: "1", email: "john@example.com", displayName: "John" },
        { id: "2", email: "jane@example.com", displayName: "Jane" },
      ];

      const mockQuerySnapWithUsers = {
        docs: mockUsers.map((user) => ({
          id: user.id,
          data: () => user,
        })),
      };

      (getDocs as jest.Mock).mockResolvedValue(mockQuerySnapWithUsers);

      const result = await searchUsers("john");

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe("john@example.com");
    });

    it("searches users by display name", async () => {
      const mockUsers = [
        { id: "1", email: "test@example.com", displayName: "John Doe" },
      ];

      const mockQuerySnapWithUsers = {
        docs: mockUsers.map((user) => ({
          id: user.id,
          data: () => user,
        })),
      };

      (getDocs as jest.Mock).mockResolvedValue(mockQuerySnapWithUsers);

      const result = await searchUsers("doe");

      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe("John Doe");
    });
  });

  describe("deleteUser", () => {
    it("deletes user successfully", async () => {
      (deleteDoc as jest.Mock).mockResolvedValue(undefined);

      await expect(deleteUser("user123")).resolves.toBeUndefined();
      expect(deleteDoc).toHaveBeenCalled();
    });

    it("throws error when deletion fails", async () => {
      const mockError = new Error("Permission denied");
      (deleteDoc as jest.Mock).mockRejectedValue(mockError);

      await expect(deleteUser("user123")).rejects.toThrow(
        "Failed to delete user"
      );
    });
  });

  describe("getUserStats", () => {
    it("calculates user statistics correctly", async () => {
      const mockUsers = [
        { role: "provider", isActive: true },
        { role: "provider", isActive: false },
        { role: "admin", isActive: true },
        { role: "admin", isActive: true },
      ];

      const mockQuerySnapWithUsers = {
        docs: mockUsers.map((user, index) => ({
          id: `user${index}`,
          data: () => user,
        })),
        size: mockUsers.length,
      };

      (getDocs as jest.Mock).mockResolvedValue(mockQuerySnapWithUsers);

      const result = await getUserStats();

      expect(result.totalUsers).toBe(4);
      expect(result.totalProviders).toBe(2);
      expect(result.totalAdmins).toBe(2);
      expect(result.activeUsers).toBe(3);
      expect(result.inactiveUsers).toBe(1);
    });

    it("handles empty user list", async () => {
      (getDocs as jest.Mock).mockResolvedValue(mockEmptyQuerySnap);

      const result = await getUserStats();

      expect(result.totalUsers).toBe(0);
      expect(result.totalProviders).toBe(0);
      expect(result.totalAdmins).toBe(0);
      expect(result.activeUsers).toBe(0);
      expect(result.inactiveUsers).toBe(0);
    });
  });
});
