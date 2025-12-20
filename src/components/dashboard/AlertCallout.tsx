"use client";

import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

interface AlertCalloutProps {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  variant?: "default" | "warning" | "info" | "success";
  className?: string;
}

/**
 * AlertCallout - Prominent callout/alert component for important information
 * Used for Active Sessions alerts and other important notices
 */
export function AlertCallout({
  title,
  description,
  action,
  variant = "default",
  className,
}: AlertCalloutProps) {
  const variantStyles = {
    default: "border-border bg-card",
    warning: "border-orange-200 bg-orange-50 dark:bg-orange-950/20",
    info: "border-blue-200 bg-blue-50 dark:bg-blue-950/20",
    success: "border-green-200 bg-green-50 dark:bg-green-950/20",
  };

  const textStyles = {
    default: "text-foreground",
    warning: "text-orange-800 dark:text-orange-200",
    info: "text-blue-800 dark:text-blue-200",
    success: "text-green-800 dark:text-green-200",
  };

  const ActionIcon = action?.icon;

  return (
    <Card className={cn(variantStyles[variant], className)}>
      <CardHeader>
        <CardTitle className={cn("text-lg", textStyles[variant])}>
          {title}
        </CardTitle>
        <CardDescription className={cn("text-sm", textStyles[variant])}>
          {description}
        </CardDescription>
      </CardHeader>
      {action && (
        <CardContent>
          <Button
            variant="outline"
            className="touch-target w-full sm:w-auto"
            onClick={action.onClick}
          >
            {ActionIcon && <ActionIcon className="h-4 w-4 mr-2" />}
            {action.label}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

