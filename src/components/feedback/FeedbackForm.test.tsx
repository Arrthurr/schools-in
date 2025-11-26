import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FeedbackForm } from "./FeedbackForm";
import { feedbackService } from "@/lib/services/feedbackService";

// Mock dependencies
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => "/provider/feedback",
}));

jest.mock("@/lib/hooks/useCachedAuth", () => ({
  useCachedAuth: () => ({
    user: { uid: "user-123", email: "test@example.com", displayName: "Test User" },
  }),
}));

jest.mock("@/lib/services/feedbackService", () => ({
  feedbackService: {
    submitFeedback: jest.fn(),
  },
}));

jest.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

describe("FeedbackForm", () => {
  it("renders the form correctly", () => {
    render(<FeedbackForm />);
    
    expect(screen.getByRole("button", { name: /submit feedback/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
  });

  it("submits valid data", async () => {
    (feedbackService.submitFeedback as jest.Mock).mockResolvedValue("new-id");
    
    render(<FeedbackForm />);
    
    // Fill description
    fireEvent.change(screen.getByLabelText(/Description/i), {
      target: { value: "This is a test feedback description that is long enough." },
    });

    // Submit
    fireEvent.click(screen.getByRole("button", { name: "Submit Feedback" }));

    await waitFor(() => {
      expect(feedbackService.submitFeedback).toHaveBeenCalledWith(expect.objectContaining({
        description: "This is a test feedback description that is long enough.",
        providerId: "user-123",
      }));
    });
  });

  it("validates required fields", async () => {
    render(<FeedbackForm />);
    
    // Submit without description
    fireEvent.click(screen.getByRole("button", { name: "Submit Feedback" }));

    await waitFor(() => {
      expect(screen.getByText("Description must be at least 10 characters.")).toBeInTheDocument();
    });
    
    expect(feedbackService.submitFeedback).not.toHaveBeenCalled();
  });
});

