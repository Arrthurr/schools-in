import { render, screen } from "@testing-library/react";
import { LoginForm } from "./LoginForm";

jest.mock("@/lib/firebase/auth", () => ({
  signInWithEmail: jest.fn(),
  signInWithGoogle: jest.fn(),
}));

describe("LoginForm", () => {
  it("renders the login form", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });
});
