"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface ActivityItem {
  id: string;
  icon?: LucideIcon;
  title: string;
  timestamp: string;
  metadata?: ReactNode;
}

interface ActivityListProps {
  items: ActivityItem[];
  emptyMessage?: string;
  className?: string;
}

/**
 * ActivityList - Timeline-style activity feed component
 * Used for Recent Activity sections on dashboards
 */
export function ActivityList({
  items,
  emptyMessage = "No recent activity",
  className,
}: ActivityListProps) {
  if (items.length === 0) {
    return (
      <div className={cn("text-center py-8", className)}>
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3 sm:space-y-4", className)}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            className="flex items-start space-x-3 sm:space-x-4"
            data-testid={`activity-item-${item.id}`}
          >
            {Icon && (
              <div className="flex-shrink-0 mt-1">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 space-y-1 min-w-0">
              <p className="text-sm font-medium leading-none break-words text-foreground">
                {item.title}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">{item.timestamp}</p>
                {item.metadata && <div>{item.metadata}</div>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

