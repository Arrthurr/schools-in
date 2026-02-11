import React from "react";
import { render, screen } from "@testing-library/react";
import { SessionTimerDisplay } from "./SessionTimerDisplay";

// Simple mock for Timestamp
const mockTimestamp = {
  toMillis: () => Date.now() - 30 * 60 * 1000, // 30 minutes ago
};

describe("SessionTimerDisplay", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders with basic props", async () => {
    render(
      <SessionTimerDisplay checkInTime={mockTimestamp as any} isActive={true} />
    );

    // Should render without crashing
    expect(screen.getByText(/Session Active:/)).toBeInTheDocument();

    // Duration is derived from Date.now(); keep test deterministic.
    expect(await screen.findByText(/30m/)).toBeInTheDocument();
  });

  it("renders in compact mode", async () => {
    render(
      <SessionTimerDisplay
        checkInTime={mockTimestamp as any}
        isActive={true}
        compact={true}
      />
    );

    expect(await screen.findByText(/30m/)).toBeInTheDocument();
    expect(screen.queryByText(/Session Active:/)).not.toBeInTheDocument();
  });

  it("handles completed sessions", () => {
    render(
      <SessionTimerDisplay
        checkInTime={mockTimestamp as any}
        isActive={false}
      />
    );

    expect(screen.getByText(/Session Duration:/)).toBeInTheDocument();
  });
});
