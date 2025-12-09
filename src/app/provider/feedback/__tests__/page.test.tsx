import { render, screen } from "@testing-library/react";
import FeedbackPage from "../page";

jest.mock("@/components/feedback/FeedbackForm", () => ({
  FeedbackForm: () => <div data-testid="feedback-form" />,
}));

describe("provider/feedback page", () => {
  it("renders header and feedback form", () => {
    render(<FeedbackPage />);

    expect(screen.getByText(/Help & Feedback/i)).toBeInTheDocument();
    expect(screen.getByTestId("feedback-form")).toBeInTheDocument();
  });
});
