import React from "react";
import { render, screen } from "@testing-library/react";
import { Textarea } from "../textarea";

describe("Textarea", () => {
  it("renders with placeholder and custom class", () => {
    render(<Textarea placeholder="Enter notes" className="custom-class" />);

    const ta = screen.getByPlaceholderText("Enter notes");
    expect(ta).toBeInTheDocument();
    expect(ta).toHaveClass("custom-class");
  });

  it("supports disabled attribute", () => {
    render(<Textarea placeholder="disabled" disabled />);

    const ta = screen.getByRole("textbox");
    expect(ta).toBeDisabled();
  });

  it("forwards ref to the underlying textarea element", () => {
    const ref = React.createRef<HTMLTextAreaElement>();
    render(<Textarea ref={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });
});
