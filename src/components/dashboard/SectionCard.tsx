"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface SectionCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  headerActions?: ReactNode;
}

/**
 * SectionCard - Wrapper for dashboard sections
 * Provides consistent card styling with title and description
 */
export function SectionCard({
  title,
  description,
  children,
  className,
  headerActions,
}: SectionCardProps) {
  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg sm:text-xl">{title}</CardTitle>
            {description && (
              <CardDescription className="text-sm mt-1">
                {description}
              </CardDescription>
            )}
          </div>
          {headerActions && <div>{headerActions}</div>}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

