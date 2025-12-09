import { render, screen } from "@testing-library/react";
import ProfilePage from "../page";

jest.mock("@/components/auth/ProtectedRoute", () => ({
  ProtectedRoute: ({ roles, children }: any) => (
    <div data-testid="protected-route" data-roles={(roles || []).join(",")}>
      {children}
    </div>
  ),
}));

jest.mock("@/components/auth/UserProfile", () => ({
  UserProfile: () => <div data-testid="user-profile" />,
}));

describe("profile page", () => {
  it("renders profile inside ProtectedRoute with provider/admin roles", () => {
    render(<ProfilePage />);

    expect(screen.getByTestId("protected-route")).toBeInTheDocument();
    expect(screen.getByTestId("protected-route")).toHaveAttribute(
      "data-roles",
      "provider,admin"
    );
    expect(screen.getByTestId("user-profile")).toBeInTheDocument();
  });
});
