import { render, screen, waitFor } from "@testing-library/react";
import ServiceManagementPage from "../page";

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

jest.mock("@/lib/services/serviceService", () => ({
  getAllServices: jest.fn().mockResolvedValue([
    {
      id: "svc1",
      name: "Reading Support",
      code: "READ",
      description: "Reading help",
      isActive: true,
    },
  ]),
  createService: jest.fn(),
  updateService: jest.fn(),
}));

describe("admin/services page", () => {
  it("wraps content in ProtectedRoute and shows service stats", async () => {
    render(<ServiceManagementPage />);

    expect(screen.getByTestId("protected-route")).toBeInTheDocument();
    expect(screen.getByTestId("protected-route")).toHaveAttribute(
      "data-roles",
      "admin"
    );
    expect(screen.getByTestId("admin-navigation")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Service Management/i)).toBeInTheDocument();
      expect(screen.getByText("Total Services")).toBeInTheDocument();
      expect(screen.getByText("Reading Support")).toBeInTheDocument();
    });
  });
});
