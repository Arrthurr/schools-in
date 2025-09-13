"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ResponsiveCardProps
  extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "mobile-first" | "touch-friendly";
  size?: "sm" | "md" | "lg";
}

const ResponsiveCard = React.forwardRef<HTMLDivElement, ResponsiveCardProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          // Base styles
          "rounded-lg border bg-card text-card-foreground shadow-sm",
          // Responsive spacing
          {
            "p-3 sm:p-4": size === "sm",
            "p-4 sm:p-6": size === "md",
            "p-6 sm:p-8": size === "lg",
          },
          // Variant styles
          {
            "transition-colors": variant === "default",
            "touch-manipulation":
              variant === "mobile-first" || variant === "touch-friendly",
          },
          // Touch-friendly enhancements
          variant === "touch-friendly" && [
            "min-h-touch",
            "active:scale-[0.98]",
            "transition-transform",
            "cursor-pointer",
          ],
          // Mobile-first optimizations
          variant === "mobile-first" && [
            "w-full",
            "focus-within:ring-2",
            "focus-within:ring-primary",
            "focus-within:ring-offset-2",
          ],
          className
        )}
        {...props}
      />
    );
  }
);

ResponsiveCard.displayName = "ResponsiveCard";

const ResponsiveCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-col space-y-1.5",
      "pb-3 sm:pb-4 lg:pb-6",
      className
    )}
    {...props}
  />
));
ResponsiveCardHeader.displayName = "ResponsiveCardHeader";

const ResponsiveCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "font-semibold leading-none tracking-tight",
      "text-base sm:text-lg lg:text-xl",
      "truncate",
      className
    )}
    {...props}
  />
));
ResponsiveCardTitle.displayName = "ResponsiveCardTitle";

const ResponsiveCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      "text-muted-foreground",
      "text-sm sm:text-base",
      "break-words",
      className
    )}
    {...props}
  />
));
ResponsiveCardDescription.displayName = "ResponsiveCardDescription";

const ResponsiveCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("space-y-3 sm:space-y-4", className)}
    {...props}
  />
));
ResponsiveCardContent.displayName = "ResponsiveCardContent";

const ResponsiveCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center",
      "pt-3 sm:pt-4 lg:pt-6",
      "flex-col sm:flex-row",
      "gap-2 sm:gap-4",
      className
    )}
    {...props}
  />
));
ResponsiveCardFooter.displayName = "ResponsiveCardFooter";

export {
  ResponsiveCard,
  ResponsiveCardHeader,
  ResponsiveCardTitle,
  ResponsiveCardDescription,
  ResponsiveCardContent,
  ResponsiveCardFooter,
};
