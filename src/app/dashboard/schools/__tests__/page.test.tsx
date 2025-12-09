import { render, screen } from "@testing-library/react";
import React from "react";
import SchoolsPage from "../page";

jest.mock("@/components/auth/ProtectedRoute", () => ({
  ProtectedRoute: ({ roles, children }: any) => (
    <div data-testid="protected-route" data-roles={(roles || []).join(",")}>
      {children}
    </div>
  ),
}));

let triggerDetail = false;

jest.mock("@/components/provider/SchoolList", () => ({
  SchoolList: (props: any) => {
    React.useEffect(() => {
      if (triggerDetail && props.onSchoolDetail) {
        props.onSchoolDetail({
          id: "s1",
          name: "Test School",
          address: "123 St",
          radiusMeters: 100,
        });
      }
    }, [props.onSchoolDetail]);

    return (
      <div
        data-testid="school-list"
        data-show-checkin={props.showCheckInButtons}
        data-show-detail={props.showDetailButtons}
      />
    );
  },
}));

jest.mock("@/components/provider/SchoolDetailView", () => ({
  SchoolDetailView: (props: any) => (
    <div data-testid="school-detail" data-name={props.school?.name} />
  ),
}));

describe("dashboard/schools page", () => {
  beforeEach(() => {
    triggerDetail = false;
  });

  it("renders list view inside ProtectedRoute", () => {
    render(<SchoolsPage />);

    expect(screen.getByTestId("protected-route")).toBeInTheDocument();
    expect(screen.getByTestId("protected-route")).toHaveAttribute(
      "data-roles",
      "provider,admin"
    );
    expect(screen.getByTestId("school-list")).toBeInTheDocument();
  });

  it("can render detail view when a school is selected", async () => {
    triggerDetail = true;
    render(<SchoolsPage />);

    expect(await screen.findByTestId("school-detail")).toBeInTheDocument();
    expect(screen.getByTestId("school-detail")).toHaveAttribute(
      "data-name",
      "Test School"
    );
  });
});
