import {
  getAssignedLocations,
  getLocationById,
  calculateDistance,
  isWithinRadius,
  addDistances,
  sortByDistance,
  assignProviderToLocation,
  removeProviderFromLocation,
  replaceLocationProviders,
} from "./locationService";

const mockCollection = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockGetDocs = jest.fn();
const mockGetDoc = jest.fn();
const mockDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockArrayUnion = jest.fn((v) => ({ arrayUnion: v }));
const mockArrayRemove = jest.fn((v) => ({ arrayRemove: v }));

jest.mock("firebase/firestore", () => ({
  collection: (...args: any[]) => mockCollection(...args),
  query: (...args: any[]) => mockQuery(...args),
  where: (...args: any[]) => mockWhere(...args),
  orderBy: (...args: any[]) => mockOrderBy(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  doc: (...args: any[]) => mockDoc(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  arrayUnion: (v: unknown) => mockArrayUnion(v),
  arrayRemove: (v: unknown) => mockArrayRemove(v),
  Timestamp: { now: () => "now" },
  GeoPoint: jest.fn(),
}));

jest.mock("../../../firebase.config", () => ({
  db: {} as any,
}));

describe("locationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc.mockReturnValue("doc-ref");
  });

  it("returns assigned locations for provider", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: "loc1", data: () => ({ name: "School 1", assignedProviders: [] }) },
      ],
    });

    const result = await getAssignedLocations("provider-123");

    expect(mockQuery).toHaveBeenCalled();
    expect(mockGetDocs).toHaveBeenCalled();
    expect(result).toEqual([{ id: "loc1", name: "School 1", assignedProviders: [] }]);
  });

  it("gets location by id when it exists", async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: "loc2",
      data: () => ({ name: "School 2", assignedProviders: ["p1"] }),
    });

    const result = await getLocationById("loc2");

    expect(mockDoc).toHaveBeenCalled();
    expect(result).toEqual({
      id: "loc2",
      name: "School 2",
      assignedProviders: ["p1"],
    });
  });

  it("returns null when location does not exist", async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => false,
    });

    const result = await getLocationById("missing");
    expect(result).toBeNull();
  });

  it("calculates distance and radius checks", () => {
    const zero = calculateDistance(10, 10, 10, 10);
    expect(zero).toBeCloseTo(0);

    const within = isWithinRadius(10, 10, {
      geo: { latitude: 10.0001, longitude: 10.0001 },
      radiusMeters: 50,
    } as any);
    expect(within).toBe(true);
  });

  it("adds and sorts by distance", () => {
    const locations = [
      { id: "a", geo: { latitude: 0, longitude: 0 } },
      { id: "b", geo: { latitude: 0.1, longitude: 0.1 } },
    ] as any[];

    const withDistances = addDistances(locations, 0, 0);
    expect(withDistances[0].distance).toBeDefined();

    const sorted = sortByDistance(withDistances);
    expect(sorted[0].id).toBe("a");
  });

  it("assigns and removes provider from location", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await assignProviderToLocation("p1", "loc1");
    expect(mockArrayUnion).toHaveBeenCalledWith("p1");
    expect(mockUpdateDoc).toHaveBeenCalled();

    await removeProviderFromLocation("p1", "loc1");
    expect(mockArrayRemove).toHaveBeenCalledWith("p1");
  });

  it("replaces location providers", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await replaceLocationProviders("loc1", ["p1", "p2"]);

    expect(mockUpdateDoc).toHaveBeenCalledWith("doc-ref", {
      assignedProviders: ["p1", "p2"],
      updatedAt: "now",
    });
  });
});
