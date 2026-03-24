/**
 * Page smoke tests for provider and admin notes pages
 *
 * Verifies correct ProtectedRoute roles and component composition.
 */

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/components/auth/ProtectedRoute", () => ({
  ProtectedRoute: ({ children, roles }: { children: React.ReactNode; roles: string[] }) => (
    <div data-testid="protected-route" data-roles={roles.join(",")}>
      {children}
    </div>
  ),
}));

jest.mock("@/components/provider/ProviderNavigation", () => ({
  ProviderNavigation: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="provider-navigation">{children}</div>
  ),
}));

jest.mock("@/components/provider/SessionNotesList", () => ({
  SessionNotesList: () => <div data-testid="session-notes-list" />,
}));

import SessionNotesPage from "./page";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Provider SessionNotesPage", () => {
  it("renders with provider and admin roles", () => {
    render(<SessionNotesPage />);

    const route = screen.getByTestId("protected-route");
    expect(route).toHaveAttribute("data-roles", "provider,admin");
  });

  it("renders page title", () => {
    render(<SessionNotesPage />);
    expect(screen.getByText("Session Notes")).toBeInTheDocument();
  });

  it("renders SessionNotesList component", () => {
    render(<SessionNotesPage />);
    expect(screen.getByTestId("session-notes-list")).toBeInTheDocument();
  });

  it("renders ProviderNavigation wrapper", () => {
    render(<SessionNotesPage />);
    expect(screen.getByTestId("provider-navigation")).toBeInTheDocument();
  });
});
