"use client";

import * as React from "react";

// Screen Reader utilities
export function ScreenReaderOnly({
  children,
  as: Component = "span",
  ...props
}: {
  children: React.ReactNode;
  as?: React.ElementType;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Component className="sr-only" {...props}>
      {children}
    </Component>
  );
}

// Live region for dynamic announcements
export function LiveRegion({
  children,
  politeness = "polite",
  atomic = false,
  className,
  ...props
}: {
  children: React.ReactNode;
  politeness?: "off" | "polite" | "assertive";
  atomic?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-live={politeness}
      aria-atomic={atomic}
      className={`sr-only ${className || ""}`}
      {...props}
    >
      {children}
    </div>
  );
}

// Skip to content link
export function SkipToContent({
  targetId = "main-content",
  className,
  children = "Skip to main content",
}: {
  targetId?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Only run on client side
    if (typeof window === "undefined") return;

    // Ensure the target element receives focus
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <a
      href={`#${targetId}`}
      className={`
        absolute left-[-9999px] top-auto w-1 h-1 overflow-hidden z-[999999]
        focus:fixed focus:top-4 focus:left-4 focus:w-auto focus:h-auto 
        focus:bg-brand-primary focus:text-white focus:px-4 focus:py-2 
        focus:rounded-md focus:no-underline focus:z-[999999]
        ${className || ""}
      `}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}

// Focus trap for modals and dialogs
export function useFocusTrap(containerRef: React.RefObject<HTMLElement>) {
  React.useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") return;

    const container = containerRef.current;
    if (!container) return;

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[
      focusableElements.length - 1
    ] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement?.focus();
          e.preventDefault();
        }
      }
    };

    container.addEventListener("keydown", handleTabKey);
    firstElement?.focus();

    return () => {
      container.removeEventListener("keydown", handleTabKey);
    };
  }, [containerRef]);
}

// Announce content changes to screen readers
export function useAnnouncement() {
  const announce = React.useCallback(
    (message: string, politeness: "polite" | "assertive" = "polite") => {
      const region = document.getElementById("announcement-region");
      if (region) {
        // By creating a new element each time, we ensure that screen readers announce the message,
        // even if the text content is the same as the previous one.
        const newAnnouncement = document.createElement("div");
        newAnnouncement.textContent = message;
        newAnnouncement.setAttribute("role", "log");
        newAnnouncement.setAttribute("aria-live", politeness);
        newAnnouncement.setAttribute("aria-atomic", "true");

        // Clear previous announcements
        while (region.firstChild) {
          region.removeChild(region.firstChild);
        }

        region.appendChild(newAnnouncement);

        // Clean up the announcement after a short delay to avoid cluttering the DOM
        setTimeout(() => {
          if (region.contains(newAnnouncement)) {
            region.removeChild(newAnnouncement);
          }
        }, 5000); // Keep it long enough for screen readers to pick up
      }
    },
    []
  );

  return { announce };
}

// High contrast mode detection
export function useHighContrastMode() {
  const [isHighContrast, setIsHighContrast] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-contrast: high)");
    setIsHighContrast(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsHighContrast(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isHighContrast;
}

// Reduced motion preference detection
export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return prefersReducedMotion;
}

// Keyboard navigation helpers
export function useKeyboardNavigation(
  items: React.RefObject<HTMLElement>[],
  options: {
    wrap?: boolean;
    orientation?: "horizontal" | "vertical";
    onSelect?: (index: number) => void;
  } = {}
) {
  const { wrap = true, orientation = "vertical", onSelect } = options;
  const [activeIndex, setActiveIndex] = React.useState(0);

  const handleKeyDown = React.useCallback(
    (e: KeyboardEvent) => {
      const isVertical = orientation === "vertical";
      const nextKey = isVertical ? "ArrowDown" : "ArrowRight";
      const prevKey = isVertical ? "ArrowUp" : "ArrowLeft";

      switch (e.key) {
        case nextKey:
          e.preventDefault();
          setActiveIndex((prev) => {
            const next = prev + 1;
            if (next >= items.length) {
              return wrap ? 0 : prev;
            }
            return next;
          });
          break;
        case prevKey:
          e.preventDefault();
          setActiveIndex((prev) => {
            const next = prev - 1;
            if (next < 0) {
              return wrap ? items.length - 1 : prev;
            }
            return next;
          });
          break;
        case "Home":
          e.preventDefault();
          setActiveIndex(0);
          break;
        case "End":
          e.preventDefault();
          setActiveIndex(items.length - 1);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          onSelect?.(activeIndex);
          break;
      }
    },
    [items.length, wrap, orientation, onSelect, activeIndex]
  );

  React.useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  React.useEffect(() => {
    const activeElement = items[activeIndex]?.current;
    if (activeElement) {
      activeElement.focus();
    }
  }, [activeIndex, items]);

  return { activeIndex, setActiveIndex };
}

// ARIA helpers
export const ARIA = {
  // Generate unique IDs for ARIA relationships
  useId: (prefix: string = "id") => {
    const [id] = React.useState(
      () => `${prefix}-${Math.random().toString(36).substr(2, 9)}`
    );
    return id;
  },

  // Common ARIA attributes for form controls
  getFormControlProps: (
    id: string,
    options: {
      label?: string;
      description?: string;
      error?: string;
      required?: boolean;
      invalid?: boolean;
    } = {}
  ) => {
    const { label, description, error, required, invalid } = options;

    return {
      id,
      "aria-label": label,
      "aria-describedby":
        [description && `${id}-description`, error && `${id}-error`]
          .filter(Boolean)
          .join(" ") || undefined,
      "aria-invalid": invalid,
      "aria-required": required,
    };
  },

  // Common ARIA attributes for buttons
  getButtonProps: (
    options: {
      pressed?: boolean;
      expanded?: boolean;
      controls?: string;
      describedBy?: string;
      label?: string;
    } = {}
  ) => {
    const { pressed, expanded, controls, describedBy, label } = options;

    return {
      "aria-pressed": pressed,
      "aria-expanded": expanded,
      "aria-controls": controls,
      "aria-describedby": describedBy,
      "aria-label": label,
    };
  },

  // Common ARIA attributes for lists
  getListProps: (itemCount: number) => ({
    role: "list",
    "aria-setsize": itemCount,
  }),

  getListItemProps: (index: number, itemCount: number) => ({
    role: "listitem",
    "aria-setsize": itemCount,
    "aria-posinset": index + 1,
  }),

  // Additional utility methods
  live: (politeness: "polite" | "assertive" | "off" = "polite") => ({
    "aria-live": politeness,
    "aria-atomic": "true",
  }),
  label: (text: string) => ({
    "aria-label": text,
  }),
  describedBy: (id: string) => ({
    "aria-describedby": id,
  }),
};

// Standalone announcement region for screen readers
export const AnnouncementRegion = () => (
  <div
    id="announcement-region"
    style={{
      position: "absolute",
      width: "1px",
      height: "1px",
      padding: "0",
      margin: "-1px",
      overflow: "hidden",
      clip: "rect(0, 0, 0, 0)",
      whiteSpace: "nowrap",
      border: "0",
    }}
  />
);

export default {
  ScreenReaderOnly,
  LiveRegion,
  SkipToContent,
  useFocusTrap,
  useAnnouncement,
  useHighContrastMode,
  useReducedMotion,
  useKeyboardNavigation,
  ARIA,
};
