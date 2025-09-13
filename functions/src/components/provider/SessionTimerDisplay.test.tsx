import React from "react";
import { render, screen } from "@testing-library/react";
import { SessionTimerDisplay } from "./SessionTimerDisplay";

// Simple mock for Timestamp
const mockTimestamp = {
  toMillis: () => Date.now() - 30 * 60 * 1000, // 30 minutes ago
};

describe("SessionTimerDisplay", () => {
  it("renders with basic props", () => {
    render(
      <SessionTimerDisplay checkInTime={mockTimestamp as any} isActive={true} />
    );

    // Should render without crashing
    expect(screen.getByText(/Session Active:/)).toBeInTheDocument();
    expect(screen.getByText(/30m/)).toBeInTheDocument();
  });

  it("renders in compact mode", () => {
    render(
      <SessionTimerDisplay
        checkInTime={mockTimestamp as any}
        isActive={true}
        compact={true}
      />
    );

    expect(screen.getByText(/30m/)).toBeInTheDocument();
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
