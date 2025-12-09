import { render, screen, waitFor } from "@testing-library/react";
import SchoolManagementPage from "../page";

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

jest.mock("@/components/admin/SchoolForm", () => ({
  SchoolForm: () => <div data-testid="school-form" />,
}));

jest.mock("@/lib/services/cachedSchoolService", () => ({
  CachedSchoolService: {
    getAllSchools: jest.fn().mockResolvedValue([
      {
        id: "school-1",
        name: "Walter Payton College Preparatory High School",
        address: "1034 N Wells St, Chicago, IL",
        radius: 100,
        assignedProviders: ["provider-1"],
        geo: { latitude: 41.9, longitude: -87.64 },
        description: "STEM focused magnet school",
        activeProviders: 3,
        totalSessions: 25,
      },
    ]),
  },
}));

describe("SchoolManagementPage", () => {
  it("wraps school management in admin ProtectedRoute and shows data", async () => {
    render(<SchoolManagementPage />);

    expect(screen.getByTestId("protected-route")).toBeInTheDocument();
    expect(screen.getByTestId("protected-route")).toHaveAttribute(
      "data-roles",
      "admin"
    );
    expect(screen.getByTestId("admin-navigation")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/School Management/i)).toBeInTheDocument();
      expect(
        screen.getByText("Walter Payton College Preparatory High School")
      ).toBeInTheDocument();
    });
  });
});
