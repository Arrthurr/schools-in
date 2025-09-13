"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorDisplayProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryText?: string;
  isLoading?: boolean;
}

export const ErrorDisplay = ({
  title = "An Error Occurred",
  message,
  onRetry,
  retryText = "Retry",
  isLoading = false,
}: ErrorDisplayProps) => {
  if (!message) return null;

  return (
    <Alert variant="destructive" className="mt-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {message}
        {onRetry && (
          <div className="mt-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={onRetry}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {isLoading ? "Retrying..." : retryText}
            </Button>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
};
