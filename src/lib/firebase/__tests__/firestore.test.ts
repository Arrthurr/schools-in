import { getSessionsByUser } from "../firestore";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
} from "firebase/firestore";

jest.mock("../../../../firebase.config", () => ({
  db: {},
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  getDocs: jest.fn(),
  Timestamp: {
    fromDate: jest.fn((date) => ({ toDate: () => date })),
  },
}));

const mockGetDocs = getDocs as jest.MockedFunction<typeof getDocs>;
const mockQuery = query as jest.MockedFunction<typeof query>;
const mockWhere = where as jest.MockedFunction<typeof where>;
const mockCollection = collection as jest.MockedFunction<typeof collection>;
const mockOrderBy = orderBy as jest.MockedFunction<typeof orderBy>;
const mockLimit = limit as jest.MockedFunction<typeof limit>;

const createMockDoc = (id: string, data: Record<string, unknown>) => ({
  id,
  data: () => data,
});

describe("getSessionsByUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCollection.mockReturnValue("sessions-collection" as never);
    mockWhere.mockImplementation((...args) => args as never);
    mockOrderBy.mockImplementation((...args) => args as never);
    mockLimit.mockImplementation((n) => n as never);
    mockQuery.mockImplementation((...args) => args as never);
  });

  it("returns sessions for a user with default pagination", async () => {
    const mockDocs = [
      createMockDoc("session1", {
        userId: "user1",
        schoolId: "school1",
        checkInTime: { toDate: () => new Date("2024-01-15") },
      }),
      createMockDoc("session2", {
        userId: "user1",
        schoolId: "school2",
        checkInTime: { toDate: () => new Date("2024-01-14") },
      }),
    ];

    mockGetDocs
      .mockResolvedValueOnce({ size: 2, docs: [] } as never)
      .mockResolvedValueOnce({ docs: mockDocs } as never);

    const result = await getSessionsByUser("user1");

    expect(result.sessions).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.hasMore).toBe(false);
    expect(result.sessions[0].id).toBe("session1");
  });

  it("applies schoolId filter when provided", async () => {
    const mockDocs = [
      createMockDoc("session1", {
        userId: "user1",
        schoolId: "school1",
        checkInTime: { toDate: () => new Date("2024-01-15") },
      }),
    ];

    mockGetDocs
      .mockResolvedValueOnce({ size: 1, docs: [] } as never)
      .mockResolvedValueOnce({ docs: mockDocs } as never);

    const result = await getSessionsByUser("user1", 1, 10, {
      schoolId: "school1",
    });

    expect(mockWhere).toHaveBeenCalledWith("schoolId", "==", "school1");
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0].id).toBe("session1");
  });

  it("applies date range filters (startDate and endDate)", async () => {
    const startDate = new Date("2024-01-01");
    const endDate = new Date("2024-01-31");

    mockGetDocs
      .mockResolvedValueOnce({ size: 1, docs: [] } as never)
      .mockResolvedValueOnce({
        docs: [
          createMockDoc("session1", {
            userId: "user1",
            checkInTime: { toDate: () => new Date("2024-01-15") },
          }),
        ],
      } as never);

    await getSessionsByUser("user1", 1, 10, { startDate, endDate });

    expect(Timestamp.fromDate).toHaveBeenCalledWith(startDate);
    expect(Timestamp.fromDate).toHaveBeenCalledWith(expect.any(Date));
    expect(mockWhere).toHaveBeenCalledWith(
      "startTime",
      ">=",
      expect.anything()
    );
    expect(mockWhere).toHaveBeenCalledWith(
      "startTime",
      "<=",
      expect.anything()
    );
  });

  it("handles pagination correctly (page 1, page 2)", async () => {
    const allDocs = Array.from({ length: 25 }, (_, i) =>
      createMockDoc(`session${i + 1}`, {
        userId: "user1",
        checkInTime: { toDate: () => new Date() },
      })
    );

    mockGetDocs
      .mockResolvedValueOnce({ size: 25, docs: [] } as never)
      .mockResolvedValueOnce({ docs: allDocs.slice(0, 11) } as never);

    const page1 = await getSessionsByUser("user1", 1, 10);
    expect(page1.sessions).toHaveLength(10);
    expect(page1.hasMore).toBe(true);

    mockGetDocs
      .mockResolvedValueOnce({ size: 25, docs: [] } as never)
      .mockResolvedValueOnce({ docs: allDocs.slice(0, 21) } as never);

    const page2 = await getSessionsByUser("user1", 2, 10);
    expect(page2.sessions).toHaveLength(10);
    expect(page2.hasMore).toBe(true);
  });

  it("returns hasMore=true when more results exist", async () => {
    const mockDocs = Array.from({ length: 12 }, (_, i) =>
      createMockDoc(`session${i + 1}`, {
        userId: "user1",
        checkInTime: { toDate: () => new Date() },
      })
    );

    mockGetDocs
      .mockResolvedValueOnce({ size: 15, docs: [] } as never)
      .mockResolvedValueOnce({ docs: mockDocs } as never);

    const result = await getSessionsByUser("user1", 1, 10);

    expect(result.hasMore).toBe(true);
    expect(result.sessions).toHaveLength(10);
  });

  it("returns hasMore=false on last page", async () => {
    const mockDocs = [
      createMockDoc("session1", {
        userId: "user1",
        checkInTime: { toDate: () => new Date() },
      }),
      createMockDoc("session2", {
        userId: "user1",
        checkInTime: { toDate: () => new Date() },
      }),
    ];

    mockGetDocs
      .mockResolvedValueOnce({ size: 2, docs: [] } as never)
      .mockResolvedValueOnce({ docs: mockDocs } as never);

    const result = await getSessionsByUser("user1", 1, 10);

    expect(result.hasMore).toBe(false);
    expect(result.sessions).toHaveLength(2);
  });

  it("returns empty array when no sessions found", async () => {
    mockGetDocs
      .mockResolvedValueOnce({ size: 0, docs: [] } as never)
      .mockResolvedValueOnce({ docs: [] } as never);

    const result = await getSessionsByUser("user1");

    expect(result.sessions).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.hasMore).toBe(false);
  });
});
