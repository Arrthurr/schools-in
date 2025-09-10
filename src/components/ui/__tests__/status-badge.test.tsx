import React from "react";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "../status-badge";

// Mock the session config util so tests are deterministic
jest.mock("@/lib/utils/session", () => ({
  getSessionStatusConfig: (status: string) => {
    const map: Record<string, any> = {
      active: {
        label: "Active",
        color: "bg-green-50 text-green-700",
        icon: "CheckCircle",
        description: "Session is active",
      },
      syncing: {
        label: "Syncing",
        color: "bg-yellow-50 text-yellow-700",
        icon: "Clock",
        description: "Sync in progress",
      },
      error: {
        label: "Error",
        color: "bg-red-50 text-red-700",
        icon: "AlertCircle",
        description: "Session error",
      },
    };
    return (
      map[status] || {
        label: status,
        color: "bg-gray-50 text-gray-700",
        icon: "HelpCircle",
        description: "",
      }
    );
  },
}));

describe("StatusBadge", () => {
  it("renders label and icon by default", () => {
    render(<StatusBadge status="active" />);

    expect(screen.getByText("Active")).toBeInTheDocument();
    // icon should render as an svg element
    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("hides icon when showIcon is false", () => {
    render(<StatusBadge status="active" showIcon={false} />);

    expect(screen.getByText("Active")).toBeInTheDocument();
    // no svg should be present
    const svg = document.querySelector("svg");
    expect(svg).not.toBeInTheDocument();
  });

  it("shows title/description when showDescription is true", () => {
    render(<StatusBadge status="syncing" showDescription={true} />);

    const badge = screen.getByText("Syncing");
    // title attribute should contain description
    expect(badge.closest("[title]")).toHaveAttribute(
      "title",
      "Sync in progress"
    );
  });

  it("applies size classes for large size", () => {
    render(<StatusBadge status="error" size="lg" />);

    const badge = screen.getByText("Error");
    // should have padding class for large
    expect(badge.closest("div")?.className).toEqual(
      expect.stringContaining("px-3")
    );
  });
});
