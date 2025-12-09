import {
  getSchoolAssignments,
  assignProviderToSchool,
  removeProviderFromSchool,
  bulkAssignProvidersToSchool,
  bulkRemoveProvidersFromSchool,
} from "../assignmentService";
import { softDeleteSchedulesForProviderAtLocation } from "../scheduleService";

const mockUpdateDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockArrayUnion = (...args: any[]) => ({ arrayUnionArgs: args });
const mockArrayRemove = (...args: any[]) => ({ arrayRemoveArgs: args });
const mockTimestampNow = { toDate: () => new Date("2024-01-01") } as any;
const mockBatch = {
  update: jest.fn(),
  commit: jest.fn(),
};

jest.mock("../../../../firebase.config", () => ({
  db: {},
}));

jest.mock("firebase/firestore", () => ({
  collection: (...args: any[]) => ({ collectionArgs: args }),
  query: (...args: any[]) => ({ queryArgs: args }),
  where: (...args: any[]) => ({ whereArgs: args }),
  orderBy: (...args: any[]) => ({ orderByArgs: args }),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  doc: (...args: any[]) => ({ docArgs: args }),
  writeBatch: () => ({
    update: mockBatch.update,
    commit: mockBatch.commit,
  }),
  Timestamp: { now: () => mockTimestampNow },
  arrayUnion: (...args: any[]) => mockArrayUnion(...args),
  arrayRemove: (...args: any[]) => mockArrayRemove(...args),
}));

jest.mock("../scheduleService", () => ({
  softDeleteSchedulesForProviderAtLocation: jest.fn(),
}));

describe("assignmentService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("builds assignments from locations and provider lookups", async () => {
    mockGetDocs.mockImplementation((q: any) => {
      // locations query returns one location
      if (q?.queryArgs?.[0]?.collectionArgs?.[1] === "locations") {
        return {
          docs: [
            {
              id: "loc1",
              data: () => ({
                name: "Test School",
                address: "123 Main",
                assignedProviders: ["prov1"],
                createdAt: mockTimestampNow,
              }),
            },
          ],
        };
      }
      // providers query
      return {
        docs: [
          {
            id: "prov1",
            data: () => ({
              email: "p@example.com",
              displayName: "Provider One",
              isActive: true,
              createdAt: mockTimestampNow,
            }),
          },
        ],
      };
    });

    const result = await getSchoolAssignments();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      schoolId: "loc1",
      schoolName: "Test School",
      schoolAddress: "123 Main",
      totalProviders: 1,
      assignedProviders: [
        expect.objectContaining({
          userId: "prov1",
          displayName: "Provider One",
        }),
      ],
    });
  });

  it("assigns a provider to a school after verifying user exists", async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ role: "provider" }),
    });

    await assignProviderToSchool("prov1", "loc1");

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ docArgs: expect.arrayContaining(["locations", "loc1"]) }),
      expect.objectContaining({
        assignedProviders: expect.objectContaining({ arrayUnionArgs: ["prov1"] }),
        updatedAt: mockTimestampNow,
      })
    );
  });

  it("removes provider and soft deletes schedules", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await removeProviderFromSchool("prov1", "loc1");

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ docArgs: expect.arrayContaining(["locations", "loc1"]) }),
      expect.objectContaining({
        assignedProviders: expect.objectContaining({ arrayRemoveArgs: ["prov1"] }),
        updatedAt: mockTimestampNow,
      })
    );
    expect(softDeleteSchedulesForProviderAtLocation).toHaveBeenCalledWith(
      "prov1",
      "loc1"
    );
  });

  it("bulk assigns providers without duplicates", async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        assignedProviders: ["prov1"],
      }),
    });

    await bulkAssignProvidersToSchool(["prov1", "prov2"], "loc1");

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        assignedProviders: expect.arrayContaining(["prov1", "prov2"]),
      })
    );
  });

  it("bulk removes providers and updates assignments + schedules", async () => {
    mockUpdateDoc.mockClear();
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        assignedProviders: ["prov1", "prov2"],
      }),
    });

    await bulkRemoveProvidersFromSchool(["prov1", "prov2"], "loc1");

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        assignedProviders: [],
        updatedAt: mockTimestampNow,
      })
    );
    expect(softDeleteSchedulesForProviderAtLocation).toHaveBeenCalledTimes(2);
  });
});
