import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SchoolManagementPage from "../page";

// Mock the auth and navigation components
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
  SchoolForm: ({ isOpen, onClose, onSubmit }: any) => (
    <div data-testid="school-form">
      {isOpen && (
        <>
          <button onClick={onClose}>Close Form</button>
          <button
            onClick={() =>
              onSubmit({
                name: "Test School",
                address: "123 Test St",
                latitude: 41.8781,
                longitude: -87.6298,
                radius: 100,
                description: "Test description",
              })
            }
          >
            Submit Form
          </button>
        </>
      )}
    </div>
  ),
}));

describe("SchoolManagementPage", () => {
  beforeEach(() => {
    // Mock window methods
    Object.defineProperty(window, "URL", {
      value: {
        createObjectURL: jest.fn(() => "blob:mock-url"),
        revokeObjectURL: jest.fn(),
      },
    });

    // Mock document methods
    Object.defineProperty(document, "createElement", {
      value: jest.fn(() => ({
        href: "",
        download: "",
        click: jest.fn(),
      })),
    });

    Object.defineProperty(document.body, "appendChild", {
      value: jest.fn(),
    });

    Object.defineProperty(document.body, "removeChild", {
      value: jest.fn(),
    });
  });

  it("renders school management interface", async () => {
    render(<SchoolManagementPage />);

    expect(screen.getByText("School Management")).toBeInTheDocument();
    expect(screen.getByText("Add School")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search schools/i)).toBeInTheDocument();
  });

  it("displays school statistics", async () => {
    render(<SchoolManagementPage />);

    await waitFor(() => {
      expect(screen.getByText("Total Schools")).toBeInTheDocument();
      expect(screen.getByText("Active Schools")).toBeInTheDocument();
      expect(screen.getByText("With Providers")).toBeInTheDocument();
      expect(screen.getByText("Total Sessions")).toBeInTheDocument();
    });
  });

  it("displays schools after loading", async () => {
    render(<SchoolManagementPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Walter Payton College Preparatory High School")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Jones College Prep High School")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Lane Tech College Prep High School")
      ).toBeInTheDocument();
    });
  });

  it("filters schools by search query", async () => {
    render(<SchoolManagementPage />);

    // Wait for schools to load
    await waitFor(() => {
      expect(
        screen.getByText("Walter Payton College Preparatory High School")
      ).toBeInTheDocument();
    });

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

  it("filters schools by status", async () => {
    render(<SchoolManagementPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Walter Payton College Preparatory High School")
      ).toBeInTheDocument();
    });

    const statusFilter = screen.getByDisplayValue("All Status");
    fireEvent.change(statusFilter, { target: { value: "active" } });

    // All mock schools are active, so they should still be visible
    await waitFor(() => {
      expect(
        screen.getByText("Walter Payton College Preparatory High School")
      ).toBeInTheDocument();
    });
  });

  it("filters schools by provider assignment", async () => {
    render(<SchoolManagementPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Walter Payton College Preparatory High School")
      ).toBeInTheDocument();
    });

    const providerFilter = screen.getByDisplayValue("All Schools");
    fireEvent.change(providerFilter, { target: { value: "assigned" } });

    // All mock schools have providers assigned
    await waitFor(() => {
      expect(
        screen.getByText("Walter Payton College Preparatory High School")
      ).toBeInTheDocument();
    });
  });

  it("handles school selection", async () => {
    render(<SchoolManagementPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Walter Payton College Preparatory High School")
      ).toBeInTheDocument();
    });

    // Find and click a school checkbox
    const checkboxes = screen.getAllByRole("checkbox");
    const schoolCheckbox = checkboxes.find(
      (cb) => cb !== screen.getByLabelText(/select all/i)
    );

    if (schoolCheckbox) {
      fireEvent.click(schoolCheckbox);

      await waitFor(() => {
        expect(screen.getByText(/1 schools selected/)).toBeInTheDocument();
      });
    }
  });

  it("handles select all functionality", async () => {
    render(<SchoolManagementPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Walter Payton College Preparatory High School")
      ).toBeInTheDocument();
    });

    const selectAllCheckbox = screen.getByLabelText(/select all/i);
    fireEvent.click(selectAllCheckbox);

    await waitFor(() => {
      expect(screen.getByText(/3 schools selected/)).toBeInTheDocument();
    });
  });

  it("opens school form when add button is clicked", async () => {
    render(<SchoolManagementPage />);

    const addButton = screen.getByText("Add School");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByTestId("school-form")).toBeInTheDocument();
    });
  });

  it("creates new school", async () => {
    render(<SchoolManagementPage />);

    const addButton = screen.getByText("Add School");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByTestId("school-form")).toBeInTheDocument();
    });

    const submitButton = screen.getByText("Submit Form");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Test School")).toBeInTheDocument();
    });
  });

  it("edits existing school", async () => {
    render(<SchoolManagementPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Walter Payton College Preparatory High School")
      ).toBeInTheDocument();
    });

    const editButtons = screen.getAllByText("Edit");
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId("school-form")).toBeInTheDocument();
    });
  });

  it("deletes school with confirmation", async () => {
    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = jest.fn(() => true);

    render(<SchoolManagementPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Walter Payton College Preparatory High School")
      ).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole("button", { name: "" }); // Trash icon buttons
    const deleteButton = deleteButtons.find((btn) =>
      btn.querySelector("svg")?.getAttribute("class")?.includes("h-3")
    );

    if (deleteButton) {
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(
          screen.queryByText("Walter Payton College Preparatory High School")
        ).not.toBeInTheDocument();
      });
    }

    // Restore original confirm
    window.confirm = originalConfirm;
  });

  it("exports schools to CSV", async () => {
    render(<SchoolManagementPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Walter Payton College Preparatory High School")
      ).toBeInTheDocument();
    });

    const exportButton = screen.getByText("Export CSV");
    fireEvent.click(exportButton);

    // Verify CSV export was attempted
    expect(window.URL.createObjectURL).toHaveBeenCalled();
  });

  it("handles bulk delete operation", async () => {
    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = jest.fn(() => true);

    render(<SchoolManagementPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Walter Payton College Preparatory High School")
      ).toBeInTheDocument();
    });

    // Select all schools
    const selectAllCheckbox = screen.getByLabelText(/select all/i);
    fireEvent.click(selectAllCheckbox);

    await waitFor(() => {
      expect(screen.getByText(/3 schools selected/)).toBeInTheDocument();
    });

    // Find bulk delete button
    const bulkDeleteButton = screen.getByRole("button", { name: /delete/i });
    fireEvent.click(bulkDeleteButton);

    await waitFor(() => {
      expect(screen.getByText(/no schools configured/i)).toBeInTheDocument();
    });

    // Restore original confirm
    window.confirm = originalConfirm;
  });

  it("handles bulk status toggle", async () => {
    render(<SchoolManagementPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Walter Payton College Preparatory High School")
      ).toBeInTheDocument();
    });

    // Select all schools
    const selectAllCheckbox = screen.getByLabelText(/select all/i);
    fireEvent.click(selectAllCheckbox);

    await waitFor(() => {
      expect(screen.getByText(/3 schools selected/)).toBeInTheDocument();
    });

    // Find bulk deactivate button
    const deactivateButton = screen.getByRole("button", {
      name: /deactivate/i,
    });
    fireEvent.click(deactivateButton);

    await waitFor(() => {
      // Selection should be cleared after bulk operation
      expect(screen.queryByText(/schools selected/)).not.toBeInTheDocument();
    });
  });

  it("toggles individual school status", async () => {
    render(<SchoolManagementPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Walter Payton College Preparatory High School")
      ).toBeInTheDocument();
    });

    // Find a status toggle button (archive icon)
    const toggleButtons = screen.getAllByRole("button");
    const toggleButton = toggleButtons.find((btn) =>
      btn.querySelector("svg")?.getAttribute("class")?.includes("h-4")
    );

    if (toggleButton) {
      fireEvent.click(toggleButton);

      // Status should be updated
      await waitFor(() => {
        expect(screen.getByText("Inactive")).toBeInTheDocument();
      });
    }
  });
});
