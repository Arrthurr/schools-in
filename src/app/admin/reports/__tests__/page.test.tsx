import { render, screen } from "@testing-library/react";
import ReportsPage from "../page";

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

jest.mock("@/components/admin/SessionReports", () => ({
  SessionReports: () => <div data-testid="session-reports" />,
}));

jest.mock("@/components/admin/AttendanceSummary", () => ({
  AttendanceSummary: () => <div data-testid="attendance-summary" />,
}));

jest.mock("@/components/admin/SessionManagement", () => ({
  SessionManagement: () => <div data-testid="session-management" />,
}));

jest.mock("@/components/admin/SessionAnalytics", () => ({
  SessionAnalytics: () => <div data-testid="session-analytics" />,
}));

jest.mock("@/components/admin/ReportScheduler", () => ({
  ReportScheduler: () => <div data-testid="report-scheduler" />,
}));

describe("admin/reports page", () => {
  it("wraps content in ProtectedRoute and renders default tab", () => {
    render(<ReportsPage />);

    expect(screen.getByTestId("protected-route")).toBeInTheDocument();
    expect(screen.getByTestId("protected-route")).toHaveAttribute(
      "data-roles",
      "admin"
    );
    expect(screen.getByTestId("admin-navigation")).toBeInTheDocument();
    expect(screen.getByText(/Reports & Management/i)).toBeInTheDocument();
    expect(screen.getByTestId("session-reports")).toBeInTheDocument();
  });
});
