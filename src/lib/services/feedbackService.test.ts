import { feedbackService } from "./feedbackService";
import { collection, addDoc, getDocs, getDoc, updateDoc, Timestamp } from "firebase/firestore";

// Mock Firebase
jest.mock("../../../firebase.config", () => ({
  db: {},
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => "collection-ref"),
  addDoc: jest.fn(),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  doc: jest.fn(() => "doc-ref"),
  updateDoc: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  where: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date() })),
  },
}));

describe("feedbackService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("submitFeedback", () => {
    it("should add a new feedback document", async () => {
      (addDoc as jest.Mock).mockResolvedValue({ id: "new-feedback-id" });
      
      const input = {
        providerId: "user-123",
        category: "bug" as const,
        severity: "medium" as const,
        description: "Test bug",
      };

      const result = await feedbackService.submitFeedback(input);

      expect(collection).toHaveBeenCalledWith(expect.anything(), "feedback");
      expect(addDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        ...input,
        status: "open",
        createdAt: expect.anything(),
        updatedAt: expect.anything(),
      }));
      expect(result).toBe("new-feedback-id");
    });
  });

  describe("getAllFeedback", () => {
    it("should fetch and map feedback documents", async () => {
      const mockDocs = [
        { id: "1", data: () => ({ description: "Test 1" }) },
        { id: "2", data: () => ({ description: "Test 2" }) },
      ];
      (getDocs as jest.Mock).mockResolvedValue({ docs: mockDocs });

      const result = await feedbackService.getAllFeedback();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: "1", description: "Test 1" });
    });
  });

  describe("updateStatus", () => {
    it("should update the status field", async () => {
      await feedbackService.updateStatus("123", "resolved");

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: "resolved",
          updatedAt: expect.anything(),
        })
      );
    });
  });
});

