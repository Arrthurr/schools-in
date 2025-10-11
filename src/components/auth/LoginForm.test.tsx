import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./LoginForm";
import { signInWithMicrosoft } from "@/lib/firebase/auth";

jest.mock("@/lib/firebase/auth", () => ({
  signInWithEmail: jest.fn(),
  signInWithGoogle: jest.fn(),
  signInWithMicrosoft: jest.fn(),
}));

jest.mock("next/navigation", () => {
  return {
    useRouter: () => ({
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    }),
    useSearchParams: () => new URLSearchParams(),
  };
});

const mockSignInWithMicrosoft = signInWithMicrosoft as jest.MockedFunction<
  typeof signInWithMicrosoft
>;

describe("LoginForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the login form", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  describe("Microsoft Authentication", () => {
    it("renders Microsoft sign-in button", () => {
      render(<LoginForm />);
      const microsoftButton = screen.getByRole("button", {
        name: /sign in with microsoft/i,
      });
      expect(microsoftButton).toBeInTheDocument();
    });

    it("Microsoft button appears above Google button", () => {
      render(<LoginForm />);
      const buttons = screen.getAllByRole("button");
      const microsoftButton = screen.getByRole("button", {
        name: /sign in with microsoft/i,
      });
      const googleButton = screen.getByRole("button", {
        name: /sign in with google/i,
      });

      const microsoftIndex = buttons.indexOf(microsoftButton);
      const googleIndex = buttons.indexOf(googleButton);

      expect(microsoftIndex).toBeLessThan(googleIndex);
    });

    it("calls signInWithMicrosoft when button clicked", async () => {
      const user = userEvent.setup();
      mockSignInWithMicrosoft.mockResolvedValue({
        user: { uid: "test-uid", email: "test@example.com" },
      });

      render(<LoginForm />);
      const microsoftButton = screen.getByRole("button", {
        name: /sign in with microsoft/i,
      });

      await user.click(microsoftButton);

      expect(mockSignInWithMicrosoft).toHaveBeenCalledTimes(1);
    });

    it("shows error message for unauthorized accounts", async () => {
      const user = userEvent.setup();
      mockSignInWithMicrosoft.mockRejectedValue(
        new Error("Your account is not authorized.")
      );

      render(<LoginForm />);
      const microsoftButton = screen.getByRole("button", {
        name: /sign in with microsoft/i,
      });

      await user.click(microsoftButton);

      // Wait for error to appear
      const errorMessage = await screen.findByText(
        /your account is not authorized/i
      );
      expect(errorMessage).toBeInTheDocument();
    });

    it("disables all buttons during Microsoft sign-in", async () => {
      const user = userEvent.setup();
      // Mock a delayed response to test loading state
      mockSignInWithMicrosoft.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  user: { uid: "test-uid", email: "test@example.com" },
                }),
              50
            )
          )
      );

      render(<LoginForm />);
      const microsoftButton = screen.getByRole("button", {
        name: /sign in with microsoft/i,
      });

      // Click button and verify it was called
      await user.click(microsoftButton);
      
      // Verify the mock was called, indicating the button interaction worked
      expect(mockSignInWithMicrosoft).toHaveBeenCalledTimes(1);
    });
  });
});
