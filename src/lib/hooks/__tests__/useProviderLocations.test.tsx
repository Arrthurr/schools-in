import { renderHook, waitFor, act } from "@testing-library/react";
import { useProviderLocations } from "../useProviderLocations";
import {
  getCachedLocationsByProvider,
  subscribeToCachedCollection,
} from "@/lib/firebase/cachedFirestore";
import { syncUserFromM365 } from "@/lib/firebase/auth";
import { Location } from "@/lib/firebase/types";

jest.mock("@/lib/firebase/cachedFirestore", () => ({
  COLLECTIONS: { LOCATIONS: "locations" },
  getCachedLocationsByProvider: jest.fn(),
  subscribeToCachedCollection: jest.fn(),
}));

jest.mock("@/lib/firebase/auth", () => ({
  syncUserFromM365: jest.fn(),
}));

const mockGetCachedLocationsByProvider =
  getCachedLocationsByProvider as jest.MockedFunction<
    typeof getCachedLocationsByProvider
  >;
const mockSubscribeToCachedCollection =
  subscribeToCachedCollection as jest.MockedFunction<
    typeof subscribeToCachedCollection
  >;
const mockSyncUserFromM365 = syncUserFromM365 as jest.MockedFunction<
  typeof syncUserFromM365
>;

const mockLocations: Location[] = [
  {
    id: "loc-1",
    name: "School A",
    active: true,
    assignedProviders: ["user-123"],
  } as Location,
  {
    id: "loc-2",
    name: "School B",
    active: true,
    assignedProviders: ["user-123"],
  } as Location,
];

describe("useProviderLocations", () => {
  let mockUnsubscribe: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUnsubscribe = jest.fn();
    mockSubscribeToCachedCollection.mockReturnValue(mockUnsubscribe);
    mockGetCachedLocationsByProvider.mockResolvedValue([]);
    mockSyncUserFromM365.mockResolvedValue({ success: true } as any);
  });

  describe("when no userId provided", () => {
    it("returns empty locations and loading=false", async () => {
      const { result } = renderHook(() => useProviderLocations(undefined));

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.locations).toEqual([]);
      expect(result.current.error).toBeNull();
      expect(mockGetCachedLocationsByProvider).not.toHaveBeenCalled();
      expect(mockSubscribeToCachedCollection).not.toHaveBeenCalled();
    });
  });

  describe("when enabled=false", () => {
    it("returns empty locations and does not fetch", async () => {
      const { result } = renderHook(() =>
        useProviderLocations("user-123", { enabled: false })
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.locations).toEqual([]);
      expect(mockGetCachedLocationsByProvider).not.toHaveBeenCalled();
      expect(mockSubscribeToCachedCollection).not.toHaveBeenCalled();
    });
  });

  describe("when userId provided and enabled", () => {
    it("fetches cached locations on mount and subscribes to live updates", async () => {
      mockGetCachedLocationsByProvider.mockResolvedValue(mockLocations);

      const { result } = renderHook(() => useProviderLocations("user-123"));

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(mockGetCachedLocationsByProvider).toHaveBeenCalledWith(
          "user-123"
        );
      });

      await waitFor(() => {
        expect(result.current.locations).toEqual(mockLocations);
      });

      expect(mockSubscribeToCachedCollection).toHaveBeenCalledWith(
        "locations",
        expect.any(Function),
        expect.objectContaining({
          filters: [
            {
              field: "assignedProviders",
              operator: "array-contains",
              value: "user-123",
            },
            { field: "active", operator: "==", value: true },
          ],
          orderByField: "name",
          orderDirection: "asc",
        }),
        expect.any(Function)
      );
    });

    it("updates locations when subscription callback is invoked", async () => {
      mockGetCachedLocationsByProvider.mockResolvedValue([]);

      let subscriptionCallback: ((data: Location[]) => void) | undefined;
      mockSubscribeToCachedCollection.mockImplementation(
        (_collection, onData) => {
          subscriptionCallback = onData as (data: Location[]) => void;
          return mockUnsubscribe;
        }
      );

      const { result } = renderHook(() => useProviderLocations("user-123"));

      await waitFor(() => {
        expect(subscriptionCallback).toBeDefined();
      });

      act(() => {
        subscriptionCallback!(mockLocations);
      });

      expect(result.current.locations).toEqual(mockLocations);
      expect(result.current.loading).toBe(false);
    });

    it("handles errors from getCachedLocationsByProvider", async () => {
      mockGetCachedLocationsByProvider.mockRejectedValue(
        new Error("Cache fetch failed")
      );

      const { result } = renderHook(() => useProviderLocations("user-123"));

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBe("Cache fetch failed");
      expect(result.current.locations).toEqual([]);
    });

    it("handles subscription errors", async () => {
      mockGetCachedLocationsByProvider.mockResolvedValue([]);

      let errorCallback: ((err: Error) => void) | undefined;
      mockSubscribeToCachedCollection.mockImplementation(
        (_collection, _onData, _options, onError) => {
          errorCallback = onError as (err: Error) => void;
          return mockUnsubscribe;
        }
      );

      const { result } = renderHook(() => useProviderLocations("user-123"));

      await waitFor(() => {
        expect(errorCallback).toBeDefined();
      });

      act(() => {
        errorCallback!(new Error("Subscription error"));
      });

      expect(result.current.error).toBe("Subscription error");
      expect(result.current.loading).toBe(false);
    });

    it("unsubscribes on unmount", async () => {
      mockGetCachedLocationsByProvider.mockResolvedValue([]);

      const { unmount } = renderHook(() => useProviderLocations("user-123"));

      await waitFor(() => {
        expect(mockSubscribeToCachedCollection).toHaveBeenCalled();
      });

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe("refreshLocations", () => {
    it("force-refreshes and updates state", async () => {
      let subscriptionCallback: ((data: Location[]) => void) | undefined;
      mockGetCachedLocationsByProvider.mockResolvedValue([]);
      mockSubscribeToCachedCollection.mockImplementation(
        (_collection, onData) => {
          subscriptionCallback = onData as (data: Location[]) => void;
          setTimeout(() => subscriptionCallback!([]), 0);
          return mockUnsubscribe;
        }
      );

      const { result } = renderHook(() => useProviderLocations("user-123"));

      await waitFor(() => expect(result.current.loading).toBe(false));

      mockGetCachedLocationsByProvider.mockResolvedValue(mockLocations);

      await act(async () => {
        await result.current.refreshLocations();
      });

      expect(mockGetCachedLocationsByProvider).toHaveBeenCalledWith(
        "user-123",
        { forceRefresh: true }
      );
      expect(result.current.locations).toEqual(mockLocations);
      expect(result.current.refreshing).toBe(false);
    });

    it("sets refreshing state during refresh", async () => {
      let subscriptionCallback: ((data: Location[]) => void) | undefined;
      mockGetCachedLocationsByProvider.mockResolvedValue([]);
      mockSubscribeToCachedCollection.mockImplementation(
        (_collection, onData) => {
          subscriptionCallback = onData as (data: Location[]) => void;
          setTimeout(() => subscriptionCallback!([]), 0);
          return mockUnsubscribe;
        }
      );

      const { result } = renderHook(() => useProviderLocations("user-123"));

      await waitFor(() => expect(result.current.loading).toBe(false));

      let resolveRefresh: (value: Location[]) => void;
      mockGetCachedLocationsByProvider.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveRefresh = resolve;
          })
      );

      let refreshPromise: Promise<void>;
      act(() => {
        refreshPromise = result.current.refreshLocations();
      });

      await waitFor(() => {
        expect(result.current.refreshing).toBe(true);
      });

      await act(async () => {
        resolveRefresh!(mockLocations);
        await refreshPromise;
      });

      expect(result.current.refreshing).toBe(false);
    });

    it("handles refresh errors", async () => {
      let subscriptionCallback: ((data: Location[]) => void) | undefined;
      mockGetCachedLocationsByProvider.mockResolvedValue([]);
      mockSubscribeToCachedCollection.mockImplementation(
        (_collection, onData) => {
          subscriptionCallback = onData as (data: Location[]) => void;
          setTimeout(() => subscriptionCallback!([]), 0);
          return mockUnsubscribe;
        }
      );

      const { result } = renderHook(() => useProviderLocations("user-123"));

      await waitFor(() => expect(result.current.loading).toBe(false));

      mockGetCachedLocationsByProvider.mockRejectedValue(
        new Error("Refresh failed")
      );

      await act(async () => {
        try {
          await result.current.refreshLocations();
        } catch {
          // Expected error
        }
      });

      expect(result.current.error).toBe("Refresh failed");
      expect(result.current.refreshing).toBe(false);
    });

    it("does nothing when userId is not provided", async () => {
      const { result } = renderHook(() => useProviderLocations(undefined));

      await waitFor(() => expect(result.current.loading).toBe(false));

      mockGetCachedLocationsByProvider.mockClear();

      await act(async () => {
        await result.current.refreshLocations();
      });

      expect(mockGetCachedLocationsByProvider).not.toHaveBeenCalled();
    });

    it("does nothing when enabled=false", async () => {
      const { result } = renderHook(() =>
        useProviderLocations("user-123", { enabled: false })
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      mockGetCachedLocationsByProvider.mockClear();

      await act(async () => {
        await result.current.refreshLocations();
      });

      expect(mockGetCachedLocationsByProvider).not.toHaveBeenCalled();
    });
  });

  describe("refreshAssignments", () => {
    it("calls syncUserFromM365 then refreshLocations", async () => {
      let subscriptionCallback: ((data: Location[]) => void) | undefined;
      mockGetCachedLocationsByProvider.mockResolvedValue([]);
      mockSubscribeToCachedCollection.mockImplementation(
        (_collection, onData) => {
          subscriptionCallback = onData as (data: Location[]) => void;
          setTimeout(() => subscriptionCallback!([]), 0);
          return mockUnsubscribe;
        }
      );

      const { result } = renderHook(() => useProviderLocations("user-123"));

      await waitFor(() => expect(result.current.loading).toBe(false));

      mockGetCachedLocationsByProvider.mockResolvedValue(mockLocations);

      await act(async () => {
        await result.current.refreshAssignments();
      });

      expect(mockSyncUserFromM365).toHaveBeenCalled();
      expect(mockGetCachedLocationsByProvider).toHaveBeenCalledWith(
        "user-123",
        { forceRefresh: true }
      );
      expect(result.current.locations).toEqual(mockLocations);
    });

    it("sets refreshing state during the entire operation", async () => {
      let subscriptionCallback: ((data: Location[]) => void) | undefined;
      mockGetCachedLocationsByProvider.mockResolvedValue([]);
      mockSubscribeToCachedCollection.mockImplementation(
        (_collection, onData) => {
          subscriptionCallback = onData as (data: Location[]) => void;
          setTimeout(() => subscriptionCallback!([]), 0);
          return mockUnsubscribe;
        }
      );

      const { result } = renderHook(() => useProviderLocations("user-123"));

      await waitFor(() => expect(result.current.loading).toBe(false));

      let resolveSyncM365: (value: any) => void;
      mockSyncUserFromM365.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSyncM365 = resolve;
          })
      );

      let refreshPromise: Promise<void>;
      act(() => {
        refreshPromise = result.current.refreshAssignments();
      });

      await waitFor(() => {
        expect(result.current.refreshing).toBe(true);
      });

      await act(async () => {
        resolveSyncM365!({ success: true });
        await refreshPromise;
      });

      expect(result.current.refreshing).toBe(false);
    });

    it("handles syncUserFromM365 errors", async () => {
      let subscriptionCallback: ((data: Location[]) => void) | undefined;
      mockGetCachedLocationsByProvider.mockResolvedValue([]);
      mockSubscribeToCachedCollection.mockImplementation(
        (_collection, onData) => {
          subscriptionCallback = onData as (data: Location[]) => void;
          setTimeout(() => subscriptionCallback!([]), 0);
          return mockUnsubscribe;
        }
      );

      const { result } = renderHook(() => useProviderLocations("user-123"));

      await waitFor(() => expect(result.current.loading).toBe(false));

      mockSyncUserFromM365.mockRejectedValue(new Error("M365 sync failed"));

      await act(async () => {
        try {
          await result.current.refreshAssignments();
        } catch {
          // Expected error
        }
      });

      expect(result.current.error).toBe("M365 sync failed");
      expect(result.current.refreshing).toBe(false);
    });

    it("does nothing when userId is not provided", async () => {
      const { result } = renderHook(() => useProviderLocations(undefined));

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.refreshAssignments();
      });

      expect(mockSyncUserFromM365).not.toHaveBeenCalled();
    });

    it("does nothing when enabled=false", async () => {
      const { result } = renderHook(() =>
        useProviderLocations("user-123", { enabled: false })
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.refreshAssignments();
      });

      expect(mockSyncUserFromM365).not.toHaveBeenCalled();
    });
  });

  describe("cleanup and unmount behavior", () => {
    it("does not update state after unmount", async () => {
      let subscriptionCallback: ((data: Location[]) => void) | undefined;
      mockGetCachedLocationsByProvider.mockResolvedValue([]);
      mockSubscribeToCachedCollection.mockImplementation(
        (_collection, onData) => {
          subscriptionCallback = onData as (data: Location[]) => void;
          return mockUnsubscribe;
        }
      );

      const { unmount } = renderHook(() => useProviderLocations("user-123"));

      await waitFor(() => {
        expect(subscriptionCallback).toBeDefined();
      });

      unmount();

      // This should not throw or update state after unmount
      act(() => {
        subscriptionCallback!(mockLocations);
      });

      // If we got here without errors, the isMounted check is working
      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it("resubscribes when userId changes", async () => {
      mockGetCachedLocationsByProvider.mockResolvedValue([]);

      const { rerender } = renderHook(
        ({ userId }) => useProviderLocations(userId),
        { initialProps: { userId: "user-123" } }
      );

      await waitFor(() => {
        expect(mockSubscribeToCachedCollection).toHaveBeenCalledTimes(1);
      });

      rerender({ userId: "user-456" });

      await waitFor(() => {
        expect(mockUnsubscribe).toHaveBeenCalled();
        expect(mockSubscribeToCachedCollection).toHaveBeenCalledTimes(2);
      });

      expect(mockGetCachedLocationsByProvider).toHaveBeenLastCalledWith(
        "user-456"
      );
    });
  });
});
