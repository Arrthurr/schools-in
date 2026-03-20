import {
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getSchedulesByProvider,
  getSchedulesByLocation,
  getSchedulesByProviderAndLocation,
  getSchedulesForDay,
  getEarliestScheduleForDay,
  softDeleteSchedulesForProviderAtLocation,
} from "../scheduleService";

const mockAddDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDoc = jest.fn((...args: any[]) => ({ docArgs: args }));
const mockQuery = jest.fn();
const mockTimestampNow = { seconds: 1234567890, nanoseconds: 0 };

jest.mock("firebase/firestore", () => ({
  addDoc: (...args: any[]) => mockAddDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  collection: (...args: any[]) => ({ collectionArgs: args }),
  doc: (...args: any[]) => mockDoc(...args),
  query: (...args: any[]) => mockQuery(...args),
  where: (...args: any[]) => ({ whereArgs: args }),
  orderBy: (...args: any[]) => ({ orderByArgs: args }),
  limit: (...args: any[]) => ({ limitArgs: args }),
  Timestamp: { now: () => mockTimestampNow },
  DocumentSnapshot: jest.fn(),
}));

jest.mock("../../../../firebase.config", () => ({ db: {} }));
jest.mock("../../firebase/firestore", () => ({
  COLLECTIONS: {
    SCHEDULES: "schedules",
    SERVICES: "services",
  },
}));

const mockIsProviderAssigned = jest.fn();
jest.mock("../locationService", () => ({
  isProviderAssigned: (...args: any[]) => mockIsProviderAssigned(...args),
}));

const baseInput = {
  providerId: "prov1",
  locationId: "loc1",
  serviceId: "svc1",
  dayOfWeek: 1,
  startTime: "08:00",
  endTime: "17:00",
  createdBy: "admin1",
};

function makeScheduleDoc(overrides: Record<string, any> = {}) {
  const data = {
    providerId: "prov1",
    locationId: "loc1",
    serviceId: "svc1",
    dayOfWeek: 1,
    startTime: "08:00",
    endTime: "17:00",
    isActive: true,
    createdBy: "admin1",
    createdAt: mockTimestampNow,
    updatedAt: mockTimestampNow,
    ...overrides,
  };
  return {
    id: overrides.id ?? "sched1",
    data: () => data,
  };
}

describe("scheduleService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createSchedule", () => {
    it("creates schedule when provider is assigned and service exists", async () => {
      mockIsProviderAssigned.mockResolvedValue(true);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ isActive: true }),
      });
      mockAddDoc.mockResolvedValue({ id: "new-sched-id" });

      const id = await createSchedule(baseInput);

      expect(id).toBe("new-sched-id");
      expect(mockIsProviderAssigned).toHaveBeenCalledWith("prov1", "loc1");
      expect(mockAddDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          providerId: "prov1",
          locationId: "loc1",
          serviceId: "svc1",
          isActive: true,
          createdAt: mockTimestampNow,
          updatedAt: mockTimestampNow,
        })
      );
    });

    it("throws when provider is not assigned", async () => {
      mockIsProviderAssigned.mockResolvedValue(false);

      await expect(createSchedule(baseInput)).rejects.toThrow(
        "Provider is not assigned to this location"
      );
      expect(mockAddDoc).not.toHaveBeenCalled();
    });

    it("throws when service not found", async () => {
      mockIsProviderAssigned.mockResolvedValue(true);
      mockGetDoc.mockResolvedValue({ exists: () => false });

      await expect(createSchedule(baseInput)).rejects.toThrow(
        "Service not found"
      );
      expect(mockAddDoc).not.toHaveBeenCalled();
    });

    it("throws when service is inactive", async () => {
      mockIsProviderAssigned.mockResolvedValue(true);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ isActive: false }),
      });

      await expect(createSchedule(baseInput)).rejects.toThrow(
        "Service is inactive"
      );
      expect(mockAddDoc).not.toHaveBeenCalled();
    });

    it("sets isActive to true by default", async () => {
      mockIsProviderAssigned.mockResolvedValue(true);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ isActive: true }),
      });
      mockAddDoc.mockResolvedValue({ id: "id1" });

      await createSchedule({ ...baseInput, isActive: undefined });

      expect(mockAddDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ isActive: true })
      );
    });

    it("returns the document ID", async () => {
      mockIsProviderAssigned.mockResolvedValue(true);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ isActive: true }),
      });
      mockAddDoc.mockResolvedValue({ id: "returned-id" });

      const result = await createSchedule(baseInput);
      expect(result).toBe("returned-id");
    });
  });

  describe("updateSchedule", () => {
    it("updates schedule fields", async () => {
      await updateSchedule("sched1", { startTime: "09:00" });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          startTime: "09:00",
          updatedAt: mockTimestampNow,
        })
      );
    });

    it("validates service if serviceId is provided", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ isActive: true }),
      });

      await updateSchedule("sched1", { serviceId: "svc2" });

      expect(mockGetDoc).toHaveBeenCalled();
      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it("throws when updated serviceId is not found", async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      await expect(
        updateSchedule("sched1", { serviceId: "bad-svc" })
      ).rejects.toThrow("Service not found");
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("skips service validation if no serviceId in update", async () => {
      await updateSchedule("sched1", { dayOfWeek: 3 });

      expect(mockGetDoc).not.toHaveBeenCalled();
      expect(mockUpdateDoc).toHaveBeenCalled();
    });
  });

  describe("deleteSchedule", () => {
    it("sets isActive to false (soft delete)", async () => {
      await deleteSchedule("sched1");

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isActive: false,
          updatedAt: mockTimestampNow,
        })
      );
    });
  });

  describe("getSchedulesByProvider", () => {
    it("returns active schedules sorted by dayOfWeek then startTime", async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          makeScheduleDoc({ id: "s1", dayOfWeek: 2, startTime: "10:00" }),
          makeScheduleDoc({ id: "s2", dayOfWeek: 1, startTime: "09:00" }),
          makeScheduleDoc({ id: "s3", dayOfWeek: 1, startTime: "08:00" }),
        ],
      });

      const result = await getSchedulesByProvider("prov1");

      expect(result.map((s) => s.id)).toEqual(["s3", "s2", "s1"]);
    });

    it("filters out inactive schedules by default", async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          makeScheduleDoc({ id: "active", isActive: true }),
          makeScheduleDoc({ id: "inactive", isActive: false }),
        ],
      });

      const result = await getSchedulesByProvider("prov1");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("active");
    });

    it("returns all schedules when includeInactive=true", async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          makeScheduleDoc({ id: "active", isActive: true }),
          makeScheduleDoc({ id: "inactive", isActive: false }),
        ],
      });

      const result = await getSchedulesByProvider("prov1", true);

      expect(result).toHaveLength(2);
    });
  });

  describe("getSchedulesByLocation", () => {
    it("returns active schedules sorted correctly", async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          makeScheduleDoc({ id: "s1", dayOfWeek: 3, startTime: "07:00" }),
          makeScheduleDoc({ id: "s2", dayOfWeek: 1, startTime: "12:00" }),
        ],
      });

      const result = await getSchedulesByLocation("loc1");

      expect(result.map((s) => s.id)).toEqual(["s2", "s1"]);
    });

    it("respects includeInactive flag", async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          makeScheduleDoc({ id: "a", isActive: true }),
          makeScheduleDoc({ id: "b", isActive: false }),
        ],
      });

      const active = await getSchedulesByLocation("loc1");
      expect(active).toHaveLength(1);

      const all = await getSchedulesByLocation("loc1", true);
      expect(all).toHaveLength(2);
    });
  });

  describe("getSchedulesByProviderAndLocation", () => {
    it("returns schedules filtered and sorted", async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          makeScheduleDoc({ id: "s1", dayOfWeek: 2, startTime: "08:00" }),
          makeScheduleDoc({ id: "s2", dayOfWeek: 1, startTime: "09:00" }),
        ],
      });

      const result = await getSchedulesByProviderAndLocation("prov1", "loc1");

      expect(result.map((s) => s.id)).toEqual(["s2", "s1"]);
    });

    it("filters out inactive by default", async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          makeScheduleDoc({ id: "a", isActive: true }),
          makeScheduleDoc({ id: "b", isActive: false }),
        ],
      });

      const result = await getSchedulesByProviderAndLocation("prov1", "loc1");
      expect(result).toHaveLength(1);

      const all = await getSchedulesByProviderAndLocation(
        "prov1",
        "loc1",
        true
      );
      expect(all).toHaveLength(2);
    });
  });

  describe("getSchedulesForDay", () => {
    it("returns only active schedules for specific day", async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          makeScheduleDoc({ id: "s1", isActive: true }),
          makeScheduleDoc({ id: "s2", isActive: false }),
        ],
      });

      const result = await getSchedulesForDay("prov1", 1);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("s1");
    });
  });

  describe("getEarliestScheduleForDay", () => {
    it("returns the earliest active schedule", async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          makeScheduleDoc({ id: "s1", startTime: "07:00", isActive: true }),
        ],
      });

      const result = await getEarliestScheduleForDay("prov1", 1);

      expect(result).not.toBeNull();
      expect(result!.id).toBe("s1");
    });

    it("returns null when no schedules exist", async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await getEarliestScheduleForDay("prov1", 1);

      expect(result).toBeNull();
    });

    it("skips inactive schedules", async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          makeScheduleDoc({ id: "s1", startTime: "07:00", isActive: false }),
        ],
      });

      const result = await getEarliestScheduleForDay("prov1", 1);

      expect(result).toBeNull();
    });
  });

  describe("softDeleteSchedulesForProviderAtLocation", () => {
    it("soft deletes all schedules for provider at location", async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          makeScheduleDoc({ id: "s1", isActive: true }),
          makeScheduleDoc({ id: "s2", isActive: true }),
        ],
      });
      // ensureServiceExists calls in updateSchedule — serviceId is not in the
      // update payload so getDoc won't be called; updateDoc just resolves.
      mockUpdateDoc.mockResolvedValue(undefined);

      await softDeleteSchedulesForProviderAtLocation("prov1", "loc1");

      // Each schedule should get a soft-delete updateDoc call
      expect(mockUpdateDoc).toHaveBeenCalledTimes(2);
    });
  });
});
