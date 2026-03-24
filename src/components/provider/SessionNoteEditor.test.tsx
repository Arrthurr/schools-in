/**
 * Tests for SessionNoteEditor component
 *
 * Covers rendering, character counter, save/cancel behavior,
 * disabled states, and "Saved" feedback.
 */

import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SessionNoteEditor } from "./SessionNoteEditor";

describe("SessionNoteEditor", () => {
  const defaultProps = {
    onSave: jest.fn().mockResolvedValue(true),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ---------- Rendering -----------------------------------------------------

  it("renders textarea with default placeholder", () => {
    render(<SessionNoteEditor {...defaultProps} />);
    expect(
      screen.getByPlaceholderText(/add a note/i)
    ).toBeInTheDocument();
  });

  it("renders initial value in textarea", () => {
    render(<SessionNoteEditor {...defaultProps} initialValue="Existing note" />);
    expect(screen.getByLabelText("Session note")).toHaveValue("Existing note");
  });

  it("renders custom placeholder", () => {
    render(
      <SessionNoteEditor {...defaultProps} placeholder="Custom placeholder" />
    );
    expect(screen.getByPlaceholderText("Custom placeholder")).toBeInTheDocument();
  });

  // ---------- Character counter ---------------------------------------------

  it("shows character counter at 0/500 initially", () => {
    render(<SessionNoteEditor {...defaultProps} />);
    expect(screen.getByText("0/500")).toBeInTheDocument();
  });

  it("updates character counter as user types", () => {
    render(<SessionNoteEditor {...defaultProps} />);
    const textarea = screen.getByLabelText("Session note");
    fireEvent.change(textarea, { target: { value: "Hello" } });
    expect(screen.getByText("5/500")).toBeInTheDocument();
  });

  it("shows warning style near limit (>90%)", () => {
    render(<SessionNoteEditor {...defaultProps} />);
    const textarea = screen.getByLabelText("Session note");
    fireEvent.change(textarea, { target: { value: "a".repeat(451) } });
    const counter = screen.getByText("451/500");
    expect(counter).toHaveClass("text-amber-600");
  });

  it("shows destructive style when over limit", () => {
    render(<SessionNoteEditor {...defaultProps} />);
    const textarea = screen.getByLabelText("Session note");
    fireEvent.change(textarea, { target: { value: "a".repeat(501) } });
    const counter = screen.getByText("501/500");
    expect(counter).toHaveClass("text-destructive");
  });

  // ---------- Save button disabled states -----------------------------------

  it("disables save button when note is unchanged", () => {
    render(<SessionNoteEditor {...defaultProps} initialValue="Same text" />);
    expect(screen.getByRole("button", { name: /save note/i })).toBeDisabled();
  });

  it("disables save button when over character limit", () => {
    render(<SessionNoteEditor {...defaultProps} />);
    const textarea = screen.getByLabelText("Session note");
    fireEvent.change(textarea, { target: { value: "x".repeat(501) } });
    expect(screen.getByRole("button", { name: /save note/i })).toBeDisabled();
  });

  it("enables save button when note is changed and within limit", () => {
    render(<SessionNoteEditor {...defaultProps} />);
    const textarea = screen.getByLabelText("Session note");
    fireEvent.change(textarea, { target: { value: "New note" } });
    expect(screen.getByRole("button", { name: /save note/i })).toBeEnabled();
  });

  // ---------- Save behavior -------------------------------------------------

  it("calls onSave with trimmed text", async () => {
    const onSave = jest.fn().mockResolvedValue(true);
    render(<SessionNoteEditor onSave={onSave} />);

    const textarea = screen.getByLabelText("Session note");
    fireEvent.change(textarea, { target: { value: "  hello world  " } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save note/i }));
    });

    expect(onSave).toHaveBeenCalledWith("hello world");
  });

  it("shows saving state while onSave is pending", async () => {
    let resolvePromise: (value: boolean) => void;
    const onSave = jest.fn(
      () => new Promise<boolean>((resolve) => { resolvePromise = resolve; })
    );
    render(<SessionNoteEditor onSave={onSave} />);

    const textarea = screen.getByLabelText("Session note");
    fireEvent.change(textarea, { target: { value: "Note" } });

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /save note/i }));
    });

    // Should show "Saving..." while pending
    await waitFor(() => {
      expect(screen.getByText(/saving/i)).toBeInTheDocument();
    });

    // Resolve the save
    await act(async () => {
      resolvePromise!(true);
    });

    expect(screen.queryByText(/saving/i)).not.toBeInTheDocument();
  });

  it("shows 'Saved' on successful save", async () => {
    const onSave = jest.fn().mockResolvedValue(true);
    render(<SessionNoteEditor onSave={onSave} />);

    const textarea = screen.getByLabelText("Session note");
    fireEvent.change(textarea, { target: { value: "Saved note" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save note/i }));
    });

    expect(screen.getByText("Saved")).toBeInTheDocument();

    // "Saved" should disappear after 2 seconds
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("does not show 'Saved' when onSave returns false", async () => {
    const onSave = jest.fn().mockResolvedValue(false);
    render(<SessionNoteEditor onSave={onSave} />);

    const textarea = screen.getByLabelText("Session note");
    fireEvent.change(textarea, { target: { value: "Failing note" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save note/i }));
    });

    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  // ---------- Cancel button -------------------------------------------------

  it("renders cancel button when onCancel is provided", () => {
    const onCancel = jest.fn();
    render(<SessionNoteEditor {...defaultProps} onCancel={onCancel} />);
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("does not render cancel button when onCancel is absent", () => {
    render(<SessionNoteEditor {...defaultProps} />);
    expect(screen.queryByRole("button", { name: /cancel/i })).not.toBeInTheDocument();
  });

  it("calls onCancel when cancel is clicked", () => {
    const onCancel = jest.fn();
    render(<SessionNoteEditor {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
