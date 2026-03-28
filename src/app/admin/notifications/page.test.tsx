/**
 * Page smoke test for admin notifications page
 */

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/components/auth/ProtectedRoute", () => ({
  ProtectedRoute: ({ children, roles }: { children: React.ReactNode; roles: string[] }) => (
    <div data-testid="protected-route" data-roles={roles.join(",")}>
      {children}
    </div>
  ),
}));

jest.mock("@/components/admin/AdminNavigation", () => ({
  AdminNavigation: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="admin-navigation">{children}</div>
  ),
}));

jest.mock("@/components/admin/AdminNotifications", () => ({
  AdminNotifications: () => <div data-testid="admin-notifications" />,
}));

import AdminNotificationsPage from "./page";

describe("Admin NotificationsPage", () => {
  it("renders with admin-only role", () => {
    render(<AdminNotificationsPage />);
    const route = screen.getByTestId("protected-route");
    expect(route).toHaveAttribute("data-roles", "admin");
  });

  it("renders AdminNotifications component", () => {
    render(<AdminNotificationsPage />);
    expect(screen.getByTestId("admin-notifications")).toBeInTheDocument();
  });

  it("renders AdminNavigation wrapper", () => {
    render(<AdminNotificationsPage />);
    expect(screen.getByTestId("admin-navigation")).toBeInTheDocument();
  });
});
