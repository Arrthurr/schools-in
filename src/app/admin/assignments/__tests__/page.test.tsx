import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import AssignmentManagementPage from "../page";
import {
  getAssignmentStats,
  getAvailableProviders,
  getSchoolAssignments,
  getUnassignedProviders,
} from "@/lib/services/assignmentService";

jest.mock("@/components/auth/ProtectedRoute", () => ({
  ProtectedRoute: ({ children }: any) => (
    <div data-testid="protected-route">{children}</div>
  ),
}));

jest.mock("@/components/admin/AdminNavigation", () => ({
  AdminNavigation: ({ children }: any) => (
    <div data-testid="admin-navigation">{children}</div>
  ),
}));

jest.mock("@/components/admin/AssignmentModal", () => ({
  AssignmentModal: ({ isOpen }: any) =>
    isOpen ? <div data-testid="assignment-modal" /> : null,
}));

jest.mock("@/lib/services/assignmentService", () => ({
  getSchoolAssignments: jest.fn(),
  getAssignmentStats: jest.fn(),
  getAvailableProviders: jest.fn(),
  getUnassignedProviders: jest.fn(),
  removeProviderFromSchool: jest.fn(),
}));

const mockAssignments = [
  {
    schoolId: "school-1",
    schoolName: "Central High",
    schoolAddress: "123 Main St",
    totalProviders: 1,
    assignedProviders: [
      {
        userId: "provider-1",
        displayName: "Provider One",
        userEmail: "one@example.com",
        isActive: true,
      },
    ],
    isActive: true,
    lastUpdated: { toDate: () => new Date("2024-01-01") },
  },
];

const mockStats = {
  totalSchools: 1,
  schoolsWithProviders: 1,
  schoolsWithoutProviders: 0,
  totalAssignments: 1,
  activeProviders: 1,
};

const mockAvailableProviders = [
  {
    uid: "provider-1",
    displayName: "Provider One",
    email: "one@example.com",
    role: "provider",
  },
];

const mockUnassignedProviders = [
  { uid: "p2", displayName: "Provider Two", email: "two@example.com" },
  { uid: "p3", displayName: "Provider Three", email: "three@example.com" },
];

describe("AssignmentManagementPage", () => {
  beforeEach(() => {
    (getSchoolAssignments as jest.Mock).mockResolvedValue(mockAssignments);
    (getAssignmentStats as jest.Mock).mockResolvedValue(mockStats);
    (getAvailableProviders as jest.Mock).mockResolvedValue(
      mockAvailableProviders
    );
    (getUnassignedProviders as jest.Mock).mockResolvedValue(
      mockUnassignedProviders
    );
  });

  it("renders assignment summary and list inside admin shell", async () => {
    render(<AssignmentManagementPage />);

    await waitFor(() => {
      expect(getSchoolAssignments).toHaveBeenCalled();
    });

    expect(screen.getByTestId("protected-route")).toBeInTheDocument();
    expect(screen.getByTestId("admin-navigation")).toBeInTheDocument();
    expect(await screen.findByText("Central High")).toBeInTheDocument();
    expect(
      await screen.findByText(/Total Schools/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
  });

  it("shows unassigned providers alert and supports bulk actions", async () => {
    render(<AssignmentManagementPage />);

    const alerts = await screen.findAllByRole("alert");
    expect(
      alerts.some((alert) =>
        alert.textContent?.includes("providers are not assigned to any schools")
      )
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /select all/i }));
    expect(
      await screen.findByText(/schools selected/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /bulk assignment/i }));
    expect(screen.getByTestId("assignment-modal")).toBeInTheDocument();
  });
});
