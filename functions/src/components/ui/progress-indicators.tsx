import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "success" | "warning" | "error";
  showText?: boolean;
  animated?: boolean;
}

function ProgressIndicator({
  value,
  max = 100,
  size = "md",
  variant = "primary",
  showText = false,
  animated = true,
  className,
  ...props
}: ProgressIndicatorProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const sizeClasses = {
    sm: "h-2",
    md: "h-3",
    lg: "h-4",
  };

  const variantClasses = {
    primary: "bg-brand-primary",
    success: "bg-green-500",
    warning: "bg-yellow-500",
    error: "bg-red-500",
  };

  return (
    <div className={cn("space-y-2", className)} {...props}>
      {showText && (
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Progress</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
      <div
        className={cn(
          "w-full bg-muted rounded-full overflow-hidden",
          sizeClasses[size]
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300 ease-out",
            variantClasses[variant],
            animated && "transition-[width]"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

interface StepProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  steps: Array<{
    id: string;
    label: string;
    status: "pending" | "current" | "completed" | "error";
  }>;
  orientation?: "horizontal" | "vertical";
}

function StepProgress({
  steps,
  orientation = "horizontal",
  className,
  ...props
}: StepProgressProps) {
  const getStepIcon = (status: string, index: number) => {
    switch (status) {
      case "completed":
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-white">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        );
      case "current":
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-brand-primary bg-white">
            <div className="h-4 w-4 rounded-full bg-brand-primary animate-pulse" />
          </div>
        );
      case "error":
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        );
      default:
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-300 bg-white text-gray-500">
            {index + 1}
          </div>
        );
    }
  };

  const getStepLineColor = (currentStatus: string, nextStatus: string) => {
    if (currentStatus === "completed") return "bg-brand-primary";
    if (currentStatus === "current" && nextStatus === "pending")
      return "bg-gray-300";
    return "bg-gray-300";
  };

  if (orientation === "vertical") {
    return (
      <div className={cn("space-y-4", className)} {...props}>
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-start space-x-4">
            <div className="flex flex-col items-center">
              {getStepIcon(step.status, index)}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "w-0.5 h-8 mt-2",
                    getStepLineColor(step.status, steps[index + 1]?.status)
                  )}
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  "text-sm font-medium",
                  step.status === "completed"
                    ? "text-brand-primary"
                    : step.status === "current"
                    ? "text-foreground"
                    : step.status === "error"
                    ? "text-red-600"
                    : "text-muted-foreground"
                )}
              >
                {step.label}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center", className)} {...props}>
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <div className="flex flex-col items-center space-y-2">
            {getStepIcon(step.status, index)}
            <p
              className={cn(
                "text-xs font-medium text-center max-w-20",
                step.status === "completed"
                  ? "text-brand-primary"
                  : step.status === "current"
                  ? "text-foreground"
                  : step.status === "error"
                  ? "text-red-600"
                  : "text-muted-foreground"
              )}
            >
              {step.label}
            </p>
          </div>
          {index < steps.length - 1 && (
            <div
              className={cn(
                "flex-1 h-0.5 mx-4",
                getStepLineColor(step.status, steps[index + 1]?.status)
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

interface CircularProgressProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  variant?: "primary" | "success" | "warning" | "error";
  showText?: boolean;
  className?: string;
}

function CircularProgress({
  value,
  max = 100,
  size = 120,
  strokeWidth = 8,
  variant = "primary",
  showText = true,
  className,
}: CircularProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  const variantColors = {
    primary: "#154690",
    success: "#10b981",
    warning: "#f59e0b",
    error: "#ef4444",
  };

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        className
      )}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={variantColors[variant]}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-300 ease-out"
        />
      </svg>
      {showText && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-semibold text-foreground">
            {Math.round(percentage)}%
          </span>
        </div>
      )}
    </div>
  );
}

export { ProgressIndicator, StepProgress, CircularProgress };
