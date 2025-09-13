import * as React from "react";
import {
  AlertCircle,
  RefreshCw,
  Wifi,
  WifiOff,
  School,
  Users,
  FileText,
  Search,
  MapPin,
  Clock,
} from "lucide-react";
import { Button } from "./button";
import { Alert, AlertDescription, AlertTitle } from "./alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./card";

interface ErrorStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  type?: "generic" | "network" | "auth" | "location" | "permission";
  showRetry?: boolean;
  className?: string;
}

export function ErrorState({
  title,
  message,
  actionLabel = "Try Again",
  onAction,
  type = "generic",
  showRetry = true,
  className = "",
}: ErrorStateProps) {
  const getErrorConfig = () => {
    switch (type) {
      case "network":
        return {
          icon: WifiOff,
          defaultTitle: "Connection Error",
          defaultMessage:
            "Unable to connect to the server. Please check your internet connection and try again.",
          iconColor: "text-red-500",
        };
      case "auth":
        return {
          icon: AlertCircle,
          defaultTitle: "Authentication Error",
          defaultMessage:
            "You need to be signed in to access this feature. Please sign in and try again.",
          iconColor: "text-orange-500",
        };
      case "location":
        return {
          icon: MapPin,
          defaultTitle: "Location Error",
          defaultMessage:
            "Unable to access your location. Please enable location services and try again.",
          iconColor: "text-blue-500",
        };
      case "permission":
        return {
          icon: AlertCircle,
          defaultTitle: "Permission Denied",
          defaultMessage:
            "You don't have permission to access this feature. Please contact your administrator.",
          iconColor: "text-red-500",
        };
      default:
        return {
          icon: AlertCircle,
          defaultTitle: "Something went wrong",
          defaultMessage: "An unexpected error occurred. Please try again.",
          iconColor: "text-red-500",
        };
    }
  };

  const config = getErrorConfig();
  const Icon = config.icon;

  return (
    <Card className={`text-center ${className}`}>
      <CardContent className="pt-6">
        <div className="flex flex-col items-center space-y-4">
          <Icon className={`h-12 w-12 ${config.iconColor}`} />
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900">
              {title || config.defaultTitle}
            </h3>
            <p className="text-sm text-gray-600 max-w-sm">
              {message || config.defaultMessage}
            </p>
          </div>
          {showRetry && onAction && (
            <Button onClick={onAction} variant="outline" className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              {actionLabel}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface EmptyStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  type?:
    | "schools"
    | "sessions"
    | "users"
    | "search"
    | "assignments"
    | "reports"
    | "generic";
  showAction?: boolean;
  className?: string;
}

export function EmptyState({
  title,
  message,
  actionLabel = "Get Started",
  onAction,
  type = "generic",
  showAction = true,
  className = "",
}: EmptyStateProps) {
  const getEmptyConfig = () => {
    switch (type) {
      case "schools":
        return {
          icon: School,
          defaultTitle: "No schools assigned",
          defaultMessage:
            "You don't have any schools assigned yet. Contact your administrator to get started.",
          defaultAction: "Contact Support",
          iconColor: "text-blue-500",
        };
      case "sessions":
        return {
          icon: Clock,
          defaultTitle: "No sessions found",
          defaultMessage:
            "No check-in sessions have been recorded yet. Start your first session to see it here.",
          defaultAction: "Start Session",
          iconColor: "text-green-500",
        };
      case "users":
        return {
          icon: Users,
          defaultTitle: "No users found",
          defaultMessage:
            "No users match your current filters. Try adjusting your search criteria.",
          defaultAction: "Clear Filters",
          iconColor: "text-purple-500",
        };
      case "search":
        return {
          icon: Search,
          defaultTitle: "No results found",
          defaultMessage:
            "We couldn't find anything matching your search. Try different keywords or check your spelling.",
          defaultAction: "Clear Search",
          iconColor: "text-gray-500",
        };
      case "assignments":
        return {
          icon: FileText,
          defaultTitle: "No assignments",
          defaultMessage:
            "No assignments have been created yet. Create your first assignment to get started.",
          defaultAction: "Create Assignment",
          iconColor: "text-indigo-500",
        };
      case "reports":
        return {
          icon: FileText,
          defaultTitle: "No reports available",
          defaultMessage:
            "No reports are available for the selected criteria. Try adjusting your filters.",
          defaultAction: "Clear Filters",
          iconColor: "text-orange-500",
        };
      default:
        return {
          icon: FileText,
          defaultTitle: "Nothing here yet",
          defaultMessage:
            "This section is empty. Start by adding some content.",
          defaultAction: "Get Started",
          iconColor: "text-gray-500",
        };
    }
  };

  const config = getEmptyConfig();
  const Icon = config.icon;

  return (
    <Card className={`text-center ${className}`}>
      <CardContent className="pt-6">
        <div className="flex flex-col items-center space-y-4">
          <Icon className={`h-12 w-12 ${config.iconColor}`} />
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900">
              {title || config.defaultTitle}
            </h3>
            <p className="text-sm text-gray-600 max-w-sm">
              {message || config.defaultMessage}
            </p>
          </div>
          {showAction && onAction && (
            <Button onClick={onAction} className="mt-4">
              {actionLabel || config.defaultAction}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Compact versions for smaller spaces
export function CompactErrorState({
  message = "Something went wrong",
  onRetry,
  className = "",
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>{message}</span>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="ml-2 h-7"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

export function CompactEmptyState({
  message = "Nothing to show",
  className = "",
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div className={`text-center py-8 text-gray-500 ${className}`}>
      <p className="text-sm">{message}</p>
    </div>
  );
}

// Network status component
export function NetworkStatus({ isOnline }: { isOnline: boolean }) {
  if (isOnline) return null;

  return (
    <Alert variant="destructive" className="mb-4">
      <WifiOff className="h-4 w-4" />
      <AlertTitle>You're offline</AlertTitle>
      <AlertDescription>
        Some features may be limited while you're offline. Changes will sync
        when connection is restored.
      </AlertDescription>
    </Alert>
  );
}
