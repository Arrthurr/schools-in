import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SchoolForm } from "./SchoolForm";

describe("SchoolForm", () => {
  const mockOnSubmit = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onSubmit: mockOnSubmit,
  };

  it("renders form with all required fields", () => {
    render(<SchoolForm {...defaultProps} />);

    expect(screen.getByLabelText(/school name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/latitude/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/longitude/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/check-in radius/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });

  it("displays 'Add New School' title when creating", () => {
    render(<SchoolForm {...defaultProps} />);
    expect(screen.getByText("Add New School")).toBeInTheDocument();
  });

  it("displays 'Edit School' title when editing", () => {
    const school = {
      id: "1",
      name: "Test School",
      address: "123 Main St",
      latitude: 41.8781,
      longitude: -87.6298,
      radius: 100,
      description: "Test description",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    render(<SchoolForm {...defaultProps} school={school} />);
    expect(screen.getByText("Edit School")).toBeInTheDocument();
  });

  it("pre-fills form when editing existing school", () => {
    const school = {
      id: "1",
      name: "Test School",
      address: "123 Main St",
      latitude: 41.8781,
      longitude: -87.6298,
      radius: 100,
      description: "Test description",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    render(<SchoolForm {...defaultProps} school={school} />);

    expect(screen.getByDisplayValue("Test School")).toBeInTheDocument();
    expect(screen.getByDisplayValue("123 Main St")).toBeInTheDocument();
    expect(screen.getByDisplayValue("41.8781")).toBeInTheDocument();
    expect(screen.getByDisplayValue("-87.6298")).toBeInTheDocument();
    expect(screen.getByDisplayValue("100")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Test description")).toBeInTheDocument();
  });

  it("validates required fields", async () => {
    render(<SchoolForm {...defaultProps} />);

    const submitButton = screen.getByRole("button", { name: /create school/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("School name is required")).toBeInTheDocument();
    });
  });

  it("validates coordinates", async () => {
    render(<SchoolForm {...defaultProps} />);

    const nameInput = screen.getByLabelText(/school name/i);
    const addressInput = screen.getByLabelText(/address/i);

    fireEvent.change(nameInput, { target: { value: "Test School" } });
    fireEvent.change(addressInput, { target: { value: "123 Main St" } });

    const submitButton = screen.getByRole("button", { name: /create school/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Valid coordinates are required")
      ).toBeInTheDocument();
    });
  });

  it("calls onSubmit with form data", async () => {
    render(<SchoolForm {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/school name/i), {
      target: { value: "Test School" },
    });
    fireEvent.change(screen.getByLabelText(/address/i), {
      target: { value: "123 Main St" },
    });
    fireEvent.change(screen.getByLabelText(/latitude/i), {
      target: { value: "41.8781" },
    });
    fireEvent.change(screen.getByLabelText(/longitude/i), {
      target: { value: "-87.6298" },
    });
    fireEvent.change(screen.getByLabelText(/check-in radius/i), {
      target: { value: "150" },
    });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: "Test description" },
    });

    const submitButton = screen.getByRole("button", { name: /create school/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        name: "Test School",
        address: "123 Main St",
        latitude: 41.8781,
        longitude: -87.6298,
        radius: 150,
        description: "Test description",
      });
    });
  });

  it("calls onClose when cancel button is clicked", () => {
    render(<SchoolForm {...defaultProps} />);

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("shows loading state", () => {
    render(<SchoolForm {...defaultProps} isLoading={true} />);

    expect(screen.getByText(/creating.../i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /creating.../i })).toBeDisabled();
  });

  it("handles geocoding button click", async () => {
    render(<SchoolForm {...defaultProps} />);

    const addressInput = screen.getByLabelText(/address/i);
    fireEvent.change(addressInput, { target: { value: "123 Main St" } });

    const geocodeButton = screen.getByRole("button", { name: /get coords/i });
    fireEvent.click(geocodeButton);

    expect(
      screen.getByRole("button", { name: /finding.../i })
    ).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    render(<SchoolForm {...defaultProps} isOpen={false} />);

    expect(screen.queryByText("Add New School")).not.toBeInTheDocument();
  });
});
