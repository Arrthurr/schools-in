// Unit tests for utility functions

import { cn } from "./utils";

describe("cn (className utility)", () => {
  it("merges class names correctly", () => {
    expect(cn("class1", "class2")).toBe("class1 class2");
  });

  it("handles undefined and null values", () => {
    expect(cn("class1", undefined, null, "class2")).toBe("class1 class2");
  });

  it("handles empty strings", () => {
    expect(cn("class1", "", "class2")).toBe("class1 class2");
  });

  it("handles falsy values", () => {
    expect(cn("class1", false && "conditional", "class2")).toBe(
      "class1 class2"
    );
  });

  it("handles array of classes", () => {
    expect(cn(["class1", "class2"], "class3")).toBe("class1 class2 class3");
  });

  it("handles nested arrays", () => {
    expect(cn(["class1", ["class2", "class3"]], "class4")).toBe(
      "class1 class2 class3 class4"
    );
  });

  it("handles object syntax", () => {
    expect(cn({ class1: true, class2: false, class3: true })).toBe(
      "class1 class3"
    );
  });

  it("returns empty string for no valid classes", () => {
    expect(cn(undefined, null, "", false)).toBe("");
  });

  it("handles single class name", () => {
    expect(cn("single-class")).toBe("single-class");
  });

  it("handles Tailwind CSS conflicts correctly", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("preserves important classes", () => {
    expect(cn("!text-red-500", "text-blue-500")).toBe(
      "!text-red-500 text-blue-500"
    );
  });
});
