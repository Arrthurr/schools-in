import { render, screen } from "@testing-library/react";
import AdminFeedbackList from "../page";

jest.mock("@/lib/services/feedbackService", () => ({
  feedbackService: {
    getAllFeedback: jest.fn().mockResolvedValue([
      {
        id: "fb1",
        status: "open",
        category: "bug",
        severity: "high",
        providerName: "Tester",
        providerEmail: "tester@example.com",
        providerId: "uid-1",
        description: "Something broke",
        createdAt: { toDate: () => new Date("2024-01-01") },
        userAgent: "jest",
      },
    ]),
    updateStatus: jest.fn(),
  },
}));

jest.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

describe("admin/feedback page", () => {
  it("renders feedback list heading and counts", async () => {
    render(<AdminFeedbackList />);

    expect(await screen.findByText(/Provider Feedback/i)).toBeInTheDocument();
    expect(await screen.findByText(/Recent Feedback \(1\)/i)).toBeInTheDocument();
    expect(await screen.findByText(/Something broke/i)).toBeInTheDocument();
  });
});
