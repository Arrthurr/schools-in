import { render, screen } from "@testing-library/react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "../dropdown-menu";

describe("dropdown menu UI primitives", () => {
  it("renders basic menu content and items", () => {
    render(
      <DropdownMenu open onOpenChange={() => {}}>
        <DropdownMenuTrigger data-testid="trigger">Open</DropdownMenuTrigger>
        <DropdownMenuContent data-testid="content">
          <DropdownMenuLabel>Label</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem>Item 1</DropdownMenuItem>
            <DropdownMenuCheckboxItem checked>
              Checkbox Item
            </DropdownMenuCheckboxItem>
          </DropdownMenuGroup>
          <DropdownMenuRadioGroup value="one">
            <DropdownMenuRadioItem value="one">Radio One</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    expect(screen.getByTestId("trigger")).toBeInTheDocument();
    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Checkbox Item")).toBeInTheDocument();
    expect(screen.getByText("Radio One")).toBeInTheDocument();
  });
});
