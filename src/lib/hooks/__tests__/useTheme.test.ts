import { renderHook, act } from "@testing-library/react";
import { useTheme } from "../useTheme";

const mockSetTheme = jest.fn();

jest.mock("next-themes", () => ({
  useTheme: jest.fn(),
}));

const mockUseNextTheme = require("next-themes").useTheme as jest.Mock;

describe("useTheme", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("normalizes system theme to concrete values", () => {
    mockUseNextTheme.mockReturnValue({
      theme: "system",
      systemTheme: "dark",
      setTheme: mockSetTheme,
    });

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe("dark");
    expect(result.current.isDark).toBe(true);
    expect(result.current.isLight).toBe(false);
  });

  it("toggles between light and dark themes", () => {
    mockUseNextTheme.mockReturnValue({
      theme: "dark",
      systemTheme: "dark",
      setTheme: mockSetTheme,
    });

    const { result, rerender } = renderHook(() => useTheme());

    act(() => {
      result.current.toggleTheme();
    });

    expect(mockSetTheme).toHaveBeenCalledWith("light");

    mockUseNextTheme.mockReturnValue({
      theme: "light",
      systemTheme: "light",
      setTheme: mockSetTheme,
    });
    rerender();

    act(() => {
      result.current.toggleTheme();
    });

    expect(mockSetTheme).toHaveBeenLastCalledWith("dark");
    expect(result.current.isLight).toBe(true);
  });
});
