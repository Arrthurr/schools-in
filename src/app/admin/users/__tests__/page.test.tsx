import { render, screen, waitFor } from "@testing-library/react";
import UserManagementPage from "../page";

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

jest.mock("@/components/admin/UserForm", () => ({
  UserForm: (props: any) => (
    <div data-testid="user-form" data-open={props.isOpen} />
  ),
}));

jest.mock("@/components/schedules/ScheduleManager", () => ({
  ScheduleManager: (props: any) => (
    <div data-testid="schedule-manager" data-open={props.isOpen} />
  ),
}));

jest.mock("@/lib/services/userService", () => ({
  getAllUsers: jest.fn().mockResolvedValue([
    {
      id: "u1",
      email: "a@example.com",
      displayName: "Alice",
      role: "provider",
      isActive: true,
      assignedSchools: [],
      createdAt: { toDate: () => new Date("2024-01-01") },
    },
  ]),
  getUserStats: jest.fn().mockResolvedValue({
    totalUsers: 1,
    totalProviders: 1,
    totalAdmins: 0,
    activeUsers: 1,
    inactiveUsers: 0,
  }),
  updateUserRole: jest.fn(),
  toggleUserStatus: jest.fn(),
  bulkUpdateUserStatus: jest.fn(),
  bulkDeleteUsers: jest.fn(),
  searchUsers: jest.fn().mockResolvedValue([]),
}));

describe("admin/users page", () => {
  it("wraps content in admin ProtectedRoute and navigation", async () => {
    render(<UserManagementPage />);

    expect(screen.getByTestId("protected-route")).toBeInTheDocument();
    expect(screen.getByTestId("protected-route")).toHaveAttribute(
      "data-roles",
      "admin"
    );
    expect(screen.getByTestId("admin-navigation")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/User Management/i)).toBeInTheDocument();
      expect(screen.getByText(/Total Users/i)).toBeInTheDocument();
      expect(screen.getByText(/Users \(1\)/i)).toBeInTheDocument();
    });
  });
});
