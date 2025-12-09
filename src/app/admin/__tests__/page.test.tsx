import { render, screen } from "@testing-library/react";
import AdminDashboardPage, { metadata } from "../page";

jest.mock("@/components/auth/ProtectedRoute", () => ({
  ProtectedRoute: ({ roles, children }: any) => (
    <div data-testid="protected-route" data-roles={(roles || []).join(",")}>
      {children}
    </div>
  ),
}));

jest.mock("@/components/admin/AdminNavigation", () => ({
  AdminNavigation: ({ children }: any) => (
    <div data-testid="admin-navigation">{children}</div>
  ),
}));

jest.mock("@/components/admin/AdminDashboard", () => ({
  AdminDashboard: () => <div data-testid="admin-dashboard">Dashboard</div>,
}));

describe("AdminDashboardPage", () => {
  it("wraps dashboard content in ProtectedRoute with admin role", () => {
    render(<AdminDashboardPage />);

    expect(screen.getByTestId("protected-route")).toBeInTheDocument();
    expect(screen.getByTestId("protected-route")).toHaveAttribute(
      "data-roles",
      "admin"
    );
    expect(screen.getByTestId("admin-navigation")).toBeInTheDocument();
    expect(screen.getByTestId("admin-dashboard")).toBeInTheDocument();
  });

  it("exports descriptive metadata", () => {
    expect(metadata.title).toContain("Admin Dashboard");
    expect(metadata.description).toMatch(/admin dashboard/i);
  });
});
