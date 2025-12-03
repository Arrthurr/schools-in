import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SchoolManagementPage from "../page";

jest.mock("@/components/auth/ProtectedRoute", () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="protected-route">{children}</div>
  ),
}));

jest.mock("@/components/admin/AdminNavigation", () => ({
  AdminNavigation: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="admin-navigation">{children}</div>
  ),
}));

jest.mock("@/components/admin/SchoolForm", () => ({
  SchoolForm: ({ isOpen, onClose, onSubmit, school }: any) => {
    if (!isOpen) {
      return null;
    }

    const submission = school
      ? {
          name: `${school.name} Updated`,
          address: `${school.address} Suite 100`,
          latitude: school.latitude ?? 41.0,
          longitude: school.longitude ?? -87.0,
          radius: (school.radius ?? 100) + 25,
          description: "Updated description",
        }
      : {
          name: "Test School",
          address: "123 Test St",
          latitude: 41.8781,
          longitude: -87.6298,
          radius: 150,
          description: "Test description",
        };

    return (
      <div data-testid="school-form">
        <button onClick={onClose}>Close</button>
        <button onClick={() => onSubmit(submission)}>Submit</button>
      </div>
    );
  },
}));

jest.mock("@/lib/services/cachedSchoolService", () => ({
  CachedSchoolService: {
    getAllSchools: jest.fn(),
    createSchool: jest.fn(),
    getSchoolById: jest.fn(),
    updateSchool: jest.fn(),
    deleteSchool: jest.fn(),
  },
}));

const cachedSchoolServiceMocks = (jest.requireMock("@/lib/services/cachedSchoolService")
  .CachedSchoolService) as Record<string, jest.Mock>;

const mockSchools = [
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
  {
    id: "school-2",
    name: "Jones College Prep High School",
    address: "700 S State St, Chicago, IL",
    radius: 125,
    assignedProviders: ["provider-2"],
    geo: { latitude: 41.87, longitude: -87.63 },
    description: "College prep focus",
    activeProviders: 2,
    totalSessions: 18,
  },
];

const cloneSchools = () => mockSchools.map((school) => ({ ...school }));

describe("SchoolManagementPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    cachedSchoolServiceMocks.getAllSchools.mockResolvedValue(cloneSchools());
    cachedSchoolServiceMocks.createSchool.mockResolvedValue("new-school-id");
    cachedSchoolServiceMocks.getSchoolById.mockImplementation(async (id: string) => {
      if (id === "new-school-id") {
        return {
          id,
          name: "Test School",
          address: "123 Test St",
          radius: 150,
          assignedProviders: [],
          geo: { latitude: 41.8781, longitude: -87.6298 },
          description: "Test description",
          activeProviders: 0,
          totalSessions: 0,
        };
      }
      return cloneSchools().find((school) => school.id === id) ?? null;
    });
    cachedSchoolServiceMocks.updateSchool.mockResolvedValue(undefined);
    cachedSchoolServiceMocks.deleteSchool.mockResolvedValue(undefined);
  });

  const renderPage = () => render(<SchoolManagementPage />);

  it("renders the management layout and initial schools", async () => {
    renderPage();

    expect(screen.getByText("School Management")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search schools/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText("Walter Payton College Preparatory High School")
      ).toBeInTheDocument();
      expect(screen.getByText("Jones College Prep High School")).toBeInTheDocument();
    });
  });

  it("filters schools via the search input", async () => {
    renderPage();

    await screen.findByText("Walter Payton College Preparatory High School");

    const searchInput = screen.getByPlaceholderText(/search schools/i);
    fireEvent.change(searchInput, { target: { value: "Walter" } });

    await waitFor(() => {
      expect(
        screen.getByText("Walter Payton College Preparatory High School")
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Jones College Prep High School")
      ).not.toBeInTheDocument();
    });
  });

  it("creates a new school from the form", async () => {
    renderPage();

    fireEvent.click(screen.getByText("Add School"));

    await waitFor(() => expect(screen.getByTestId("school-form")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Submit"));

    await waitFor(() => {
      expect(cachedSchoolServiceMocks.createSchool).toHaveBeenCalled();
      expect(screen.getByText("Test School")).toBeInTheDocument();
    });
  });

  it("edits an existing school", async () => {
    cachedSchoolServiceMocks.getSchoolById.mockImplementation(async (id: string) => {
      if (id === "school-1") {
        return {
          ...mockSchools[0],
          name: "Walter Payton Updated",
          description: "Updated description",
        };
      }
      return cloneSchools().find((school) => school.id === id) ?? null;
    });

    renderPage();

    await screen.findByText("Walter Payton College Preparatory High School");

    fireEvent.click(screen.getAllByText("Edit")[0]);
    await waitFor(() => expect(screen.getByTestId("school-form")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Submit"));

    await waitFor(() => {
      expect(cachedSchoolServiceMocks.updateSchool).toHaveBeenCalledWith(
        "school-1",
        expect.any(Object)
      );
      expect(screen.getByText("Walter Payton Updated")).toBeInTheDocument();
    });
  });

  it("deletes a school when confirmed", async () => {
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);

    renderPage();
    await screen.findByText("Walter Payton College Preparatory High School");

    fireEvent.click(screen.getByRole("button", { name: /delete walter payton/i }));

    await waitFor(() => {
      expect(cachedSchoolServiceMocks.deleteSchool).toHaveBeenCalledWith("school-1");
      expect(
        screen.queryByText("Walter Payton College Preparatory High School")
      ).not.toBeInTheDocument();
    });

    confirmSpy.mockRestore();
  });

  it("forces a refresh when the refresh button is clicked", async () => {
    renderPage();

    await screen.findByText("Walter Payton College Preparatory High School");

    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() => {
      expect(cachedSchoolServiceMocks.getAllSchools).toHaveBeenLastCalledWith(
        {},
        expect.objectContaining({ forceRefresh: true })
      );
    });
  });
});
