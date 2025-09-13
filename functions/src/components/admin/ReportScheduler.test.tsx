import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportScheduler } from "./ReportScheduler";

describe("ReportScheduler", () => {
  it("renders scheduler dashboard", () => {
    render(<ReportScheduler />);

    expect(screen.getByText("Automated Report Scheduling")).toBeInTheDocument();
    expect(screen.getByText("Create Schedule")).toBeInTheDocument();
    expect(
      screen.getByText(/Configure automated delivery of reports/)
    ).toBeInTheDocument();
  });

  it("displays mock schedules", async () => {
    render(<ReportScheduler />);

    await waitFor(() => {
      expect(screen.getByText("Weekly Session Summary")).toBeInTheDocument();
      expect(screen.getByText("Monthly Analytics Report")).toBeInTheDocument();
      expect(screen.getByText("Daily Attendance Check")).toBeInTheDocument();
    });
  });

  it("shows schedule statistics", async () => {
    render(<ReportScheduler />);

    await waitFor(() => {
      expect(screen.getByText("Schedule Statistics")).toBeInTheDocument();
      expect(screen.getByText("Total Schedules")).toBeInTheDocument();
      expect(screen.getAllByText("Active")).toContainEqual(
        expect.objectContaining({
          textContent: "Active",
        })
      );
      expect(screen.getByText("Daily Reports")).toBeInTheDocument();
      expect(screen.getByText("Total Recipients")).toBeInTheDocument();
    });
  });

  it("displays schedule cards with proper information", async () => {
    render(<ReportScheduler />);

    await waitFor(() => {
      // Check for schedule details
      expect(screen.getByText("weekly")).toBeInTheDocument();
      expect(screen.getByText("monthly")).toBeInTheDocument();
      expect(screen.getByText("daily")).toBeInTheDocument();

      // Check for action buttons
      expect(screen.getAllByText("Run Now")).toHaveLength(3);
      expect(screen.getAllByText("Edit")).toHaveLength(3);
      expect(screen.getAllByText("Delete")).toHaveLength(3);
    });
  });

  it("shows active and paused schedules correctly", async () => {
    render(<ReportScheduler />);

    await waitFor(() => {
      // Should show 2 active schedule badges and 1 in statistics (3 total "Active" text)
      expect(screen.getAllByText("Active")).toHaveLength(3);
      expect(screen.getByText("Paused")).toBeInTheDocument();
    });
  });

  it("displays recipient information", async () => {
    render(<ReportScheduler />);

    await waitFor(() => {
      expect(screen.getByText("admin@schoolsin.com")).toBeInTheDocument();
      expect(screen.getByText("analytics@schoolsin.com")).toBeInTheDocument();
      expect(screen.getByText("operations@schoolsin.com")).toBeInTheDocument();
    });
  });

  it("shows format and delivery information", async () => {
    render(<ReportScheduler />);

    await waitFor(() => {
      expect(screen.getByText("PDF format")).toBeInTheDocument();
      expect(screen.getByText("EXCEL format")).toBeInTheDocument();
      expect(screen.getByText("CSV format")).toBeInTheDocument();
    });
  });

  it("handles create schedule button click", async () => {
    const user = userEvent.setup();
    render(<ReportScheduler />);

    const createButton = screen.getByText("Create Schedule");
    await user.click(createButton);

    // Should show dialog content
    await waitFor(() => {
      expect(screen.getByText("Create Report Schedule")).toBeInTheDocument();
    });
  });

  it("displays schedule action buttons", async () => {
    render(<ReportScheduler />);

    await waitFor(() => {
      // Each schedule should have action buttons
      const runButtons = screen.getAllByText("Run Now");
      const editButtons = screen.getAllByText("Edit");
      const deleteButtons = screen.getAllByText("Delete");

      expect(runButtons).toHaveLength(3);
      expect(editButtons).toHaveLength(3);
      expect(deleteButtons).toHaveLength(3);
    });
  });

  it("shows next run dates for active schedules", async () => {
    render(<ReportScheduler />);

    await waitFor(() => {
      // Should show "Next:" labels for active schedules
      expect(screen.getAllByText(/Next:/)).toHaveLength(2); // 2 active schedules
    });
  });
});
