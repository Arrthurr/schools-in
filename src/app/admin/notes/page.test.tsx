/**
 * Page smoke test for admin notes page
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

jest.mock("@/components/admin/AdminSessionNotes", () => ({
  AdminSessionNotes: () => <div data-testid="admin-session-notes" />,
}));

import AdminNotesPage from "./page";

describe("Admin NotesPage", () => {
  it("renders with admin-only role", () => {
    render(<AdminNotesPage />);
    const route = screen.getByTestId("protected-route");
    expect(route).toHaveAttribute("data-roles", "admin");
  });

  it("renders AdminSessionNotes component", () => {
    render(<AdminNotesPage />);
    expect(screen.getByTestId("admin-session-notes")).toBeInTheDocument();
  });

  it("renders AdminNavigation wrapper", () => {
    render(<AdminNotesPage />);
    expect(screen.getByTestId("admin-navigation")).toBeInTheDocument();
  });
});
