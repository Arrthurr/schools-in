"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DashboardShellProps {
  children: ReactNode;
  className?: string;
  sidebar?: ReactNode;
  header?: ReactNode;
  mobileNavOpen?: boolean;
  onMobileNavToggle?: () => void;
}

/**
 * DashboardShell - Shared layout wrapper for dashboard pages
 * Provides consistent structure for Admin and Provider dashboards
 */
export function DashboardShell({
  children,
  className,
  sidebar,
  header,
  mobileNavOpen = false,
  onMobileNavToggle,
}: DashboardShellProps) {
  return (
    <div className={cn("min-h-screen bg-background", className)}>
      {/* Mobile overlay */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={onMobileNavToggle}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      {sidebar && (
        <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-card border-r shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0">
          {sidebar}
        </aside>
      )}

      {/* Main content */}
      <div className={cn(sidebar && "lg:ml-64")}>
        {/* Header */}
        {header && (
          <header className="sticky top-0 z-40 bg-card shadow-sm border-b">
            {header}
          </header>
        )}

        {/* Page content */}
        <main className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

