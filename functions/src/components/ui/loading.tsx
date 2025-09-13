import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2, RefreshCw } from "lucide-react";

interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "muted";
  showText?: boolean;
  text?: string;
}

function LoadingSpinner({
  size = "md",
  variant = "primary",
  showText = false,
  text = "Loading...",
  className,
  ...props
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  const variantClasses = {
    primary: "text-brand-primary",
    secondary: "text-muted-foreground",
    muted: "text-gray-400",
  };

  const textSizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  return (
    <div
      className={cn(
        "flex items-center justify-center",
        showText && "space-x-2",
        className
      )}
      {...props}
    >
      <Loader2
        className={cn(
          "animate-spin",
          sizeClasses[size],
          variantClasses[variant]
        )}
      />
      {showText && (
        <span
          className={cn(
            "font-medium",
            textSizeClasses[size],
            variantClasses[variant]
          )}
        >
          {text}
        </span>
      )}
    </div>
  );
}

interface LoadingButtonProps {
  isLoading: boolean;
  children: React.ReactNode;
  loadingText?: string;
  className?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
}

function LoadingButton({
  isLoading,
  children,
  loadingText,
  className,
  disabled,
  size = "md",
  variant = "default",
  ...props
}: LoadingButtonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const spinnerSize = size === "sm" ? "sm" : size === "lg" ? "md" : "sm";

  const variantClasses = {
    default: "btn-brand-primary",
    destructive:
      "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    outline:
      "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    link: "text-brand-primary underline-offset-4 hover:underline",
  };

  return (
    <button
      className={cn(
        variantClasses[variant],
        "relative flex items-center justify-center",
        "transition-all duration-200",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        isLoading && "cursor-not-allowed",
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <LoadingSpinner
            size={spinnerSize}
            variant="secondary"
            showText={!!loadingText}
            text={loadingText}
          />
        </div>
      )}
      <span
        className={cn(
          "transition-opacity duration-200",
          isLoading ? "opacity-0" : "opacity-100"
        )}
      >
        {children}
      </span>
    </button>
  );
}

interface LoadingOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  isLoading: boolean;
  text?: string;
  backdrop?: boolean;
}

function LoadingOverlay({
  isLoading,
  text = "Loading...",
  backdrop = true,
  className,
  children,
  ...props
}: LoadingOverlayProps) {
  if (!isLoading) return <>{children}</>;

  return (
    <div className={cn("relative", className)} {...props}>
      {children}
      <div
        className={cn(
          "absolute inset-0 z-50",
          "flex items-center justify-center",
          backdrop && "bg-background/80 backdrop-blur-sm"
        )}
      >
        <div className="text-center space-y-3">
          <LoadingSpinner size="lg" variant="primary" />
          <p className="text-sm font-medium text-muted-foreground">{text}</p>
        </div>
      </div>
    </div>
  );
}

interface PulseLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  dots?: number;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "muted";
}

function PulseLoader({
  dots = 3,
  size = "md",
  variant = "primary",
  className,
  ...props
}: PulseLoaderProps) {
  const dotSizeClasses = {
    sm: "h-2 w-2",
    md: "h-3 w-3",
    lg: "h-4 w-4",
  };

  const variantClasses = {
    primary: "bg-brand-primary",
    secondary: "bg-muted-foreground",
    muted: "bg-gray-400",
  };

  return (
    <div className={cn("flex items-center space-x-1", className)} {...props}>
      {Array.from({ length: dots }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "rounded-full animate-pulse",
            dotSizeClasses[size],
            variantClasses[variant]
          )}
          style={{
            animationDelay: `${i * 0.2}s`,
            animationDuration: "1s",
          }}
        />
      ))}
    </div>
  );
}

interface RefreshSpinnerProps {
  isRefreshing: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "muted";
  className?: string;
}

function RefreshSpinner({
  isRefreshing,
  size = "md",
  variant = "primary",
  className,
}: RefreshSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  const variantClasses = {
    primary: "text-brand-primary",
    secondary: "text-muted-foreground",
    muted: "text-gray-400",
  };

  return (
    <RefreshCw
      className={cn(
        "transition-transform duration-300",
        isRefreshing && "animate-spin",
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
    />
  );
}

export {
  LoadingSpinner,
  LoadingButton,
  LoadingOverlay,
  PulseLoader,
  RefreshSpinner,
};
