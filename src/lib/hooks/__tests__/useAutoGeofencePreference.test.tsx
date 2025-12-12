import { act, renderHook, waitFor } from "@testing-library/react";
import { useAutoGeofencePreference } from "../useAutoGeofencePreference";
import {
  getAutoGeofencePreference,
  getAutoGeofencePreferenceFromStorage,
  setAutoGeofencePreference,
} from "@/lib/services/userPreferences";

jest.mock("@/lib/hooks/useCachedAuth", () => ({
  useCachedAuth: () => ({ user: { uid: "user-1" } }),
}));

jest.mock("@/lib/services/userPreferences");

describe("useAutoGeofencePreference", () => {
  beforeEach(() => {
    (getAutoGeofencePreferenceFromStorage as jest.Mock).mockReturnValue(true);
    (getAutoGeofencePreference as jest.Mock).mockResolvedValue(true);
    (setAutoGeofencePreference as jest.Mock).mockResolvedValue(undefined);
  });

  it("loads preference from storage/remote and toggles", async () => {
    const { result } = renderHook(() => useAutoGeofencePreference());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.enabled).toBe(true);

    await act(async () => {
      await result.current.setEnabled(false);
    });

    expect(setAutoGeofencePreference).toHaveBeenCalledWith("user-1", false);
  });
});
