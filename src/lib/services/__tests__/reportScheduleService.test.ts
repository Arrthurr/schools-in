import { reportScheduleService } from "../reportScheduleService";

const mockAddDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockDoc = jest.fn();
const mockTimestampNow = { seconds: 1234567890, nanoseconds: 0 };
const mockOrderBy = jest.fn();

jest.mock("firebase/firestore", () => ({
  addDoc: (...args: any[]) => mockAddDoc(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  collection: (...args: any[]) => ({ collectionArgs: args }),
  doc: (...args: any[]) => mockDoc(...args),
  query: (...args: any[]) => ({ queryArgs: args }),
  orderBy: (...args: any[]) => mockOrderBy(...args),
  Timestamp: { now: () => mockTimestampNow },
}));

jest.mock("../../../../firebase.config", () => ({ db: {} }));

function makeReportDoc(overrides: Record<string, any> = {}) {
  const data = {
    name: "Weekly Report",
    description: "Weekly sessions summary",
    reportType: "sessions",
    frequency: "weekly",
    deliveryTime: "08:00",
    recipients: ["admin@test.com"],
    filters: {},
    format: "pdf",
    isActive: true,
    createdAt: mockTimestampNow,
    createdBy: "admin1",
    ...overrides,
  };
  return {
    id: overrides.id ?? "report1",
    data: () => data,
  };
}

describe("reportScheduleService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAll", () => {
    it("returns schedules ordered by createdAt desc", async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          makeReportDoc({ id: "r1", name: "Report One" }),
          makeReportDoc({ id: "r2", name: "Report Two" }),
        ],
      });

      const result = await reportScheduleService.getAll();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("r1");
      expect(result[1].id).toBe("r2");
      expect(mockOrderBy).toHaveBeenCalledWith("createdAt", "desc");
    });

    it("maps doc id and data correctly", async () => {
      mockGetDocs.mockResolvedValue({
        docs: [makeReportDoc({ id: "r1", name: "My Report" })],
      });

      const result = await reportScheduleService.getAll();

      expect(result[0]).toMatchObject({
        id: "r1",
        name: "My Report",
        reportType: "sessions",
      });
    });
  });

  describe("create", () => {
    it("adds createdAt timestamp and returns doc ID", async () => {
      mockAddDoc.mockResolvedValue({ id: "new-report-id" });

      const input = {
        name: "Daily Report",
        description: "Daily summary",
        reportType: "sessions" as const,
        frequency: "daily" as const,
        deliveryTime: "07:00",
        recipients: ["admin@test.com"],
        filters: {},
        format: "csv" as const,
        isActive: true,
        createdBy: "admin1",
      };

      const id = await reportScheduleService.create(input);

      expect(id).toBe("new-report-id");
      expect(mockAddDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: "Daily Report",
          createdAt: mockTimestampNow,
        })
      );
    });
  });

  describe("update", () => {
    it("calls updateDoc with correct args", async () => {
      const docRef = { id: "report1" };
      mockDoc.mockReturnValue(docRef);

      await reportScheduleService.update("report1", { name: "Updated Name" });

      expect(mockDoc).toHaveBeenCalled();
      expect(mockUpdateDoc).toHaveBeenCalledWith(docRef, {
        name: "Updated Name",
      });
    });
  });

  describe("toggleActive", () => {
    it("sets isActive and nextRun", async () => {
      const docRef = { id: "report1" };
      mockDoc.mockReturnValue(docRef);
      const nextRun = { seconds: 9999999999, nanoseconds: 0 } as any;

      await reportScheduleService.toggleActive("report1", true, nextRun);

      expect(mockUpdateDoc).toHaveBeenCalledWith(docRef, {
        isActive: true,
        nextRun,
      });
    });

    it("sets nextRun to null when not provided", async () => {
      const docRef = { id: "report1" };
      mockDoc.mockReturnValue(docRef);

      await reportScheduleService.toggleActive("report1", false);

      expect(mockUpdateDoc).toHaveBeenCalledWith(docRef, {
        isActive: false,
        nextRun: null,
      });
    });
  });

  describe("recordRun", () => {
    it("sets lastRun to now and nextRun to provided value", async () => {
      const docRef = { id: "report1" };
      mockDoc.mockReturnValue(docRef);
      const nextRun = { seconds: 8888888888, nanoseconds: 0 } as any;

      await reportScheduleService.recordRun("report1", nextRun);

      expect(mockUpdateDoc).toHaveBeenCalledWith(docRef, {
        lastRun: mockTimestampNow,
        nextRun,
      });
    });
  });

  describe("delete", () => {
    it("calls deleteDoc with correct doc reference", async () => {
      const docRef = { id: "report1" };
      mockDoc.mockReturnValue(docRef);

      await reportScheduleService.delete("report1");

      expect(mockDeleteDoc).toHaveBeenCalledWith(docRef);
    });
  });
});
