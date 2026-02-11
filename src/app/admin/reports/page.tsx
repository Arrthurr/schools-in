// Reports and export page

"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminNavigation } from "@/components/admin/AdminNavigation";
import { SessionReports } from "@/components/admin/SessionReports";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, UserCheck, Edit, TrendingUp, Calendar } from "lucide-react";

const preloadAttendanceSummary = () => import("@/components/admin/AttendanceSummary");
const preloadSessionManagement = () => import("@/components/admin/SessionManagement");
const preloadSessionAnalytics = () => import("@/components/admin/SessionAnalytics");
const preloadReportScheduler = () => import("@/components/admin/ReportScheduler");

const AttendanceSummary = dynamic(
  () => preloadAttendanceSummary().then((m) => m.AttendanceSummary),
  {
    ssr: false,
    loading: () => <div className="p-6 text-sm text-muted-foreground">Loading…</div>,
  }
);

const SessionManagement = dynamic(
  () => preloadSessionManagement().then((m) => m.SessionManagement),
  {
    ssr: false,
    loading: () => <div className="p-6 text-sm text-muted-foreground">Loading…</div>,
  }
);

// Note: this tab pulls in recharts; keep it code-split so it only loads on demand.
const SessionAnalytics = dynamic(
  () => preloadSessionAnalytics().then((m) => m.SessionAnalytics),
  {
    ssr: false,
    loading: () => <div className="p-6 text-sm text-muted-foreground">Loading…</div>,
  }
);

const ReportScheduler = dynamic(
  () => preloadReportScheduler().then((m) => m.ReportScheduler),
  {
    ssr: false,
    loading: () => <div className="p-6 text-sm text-muted-foreground">Loading…</div>,
  }
);

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<
    "sessions" | "attendance" | "management" | "analytics" | "scheduler"
  >("sessions");

  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminNavigation>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Reports & Management</h1>
          </div>

          {/* Tab Navigation */}
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-2">
                <Button
                  variant={activeTab === "sessions" ? "default" : "outline"}
                  onClick={() => setActiveTab("sessions")}
                  className="flex items-center gap-2"
                >
                  <BarChart3 className="h-4 w-4" />
                  Session Reports
                </Button>
                <Button
                  variant={activeTab === "attendance" ? "default" : "outline"}
                  onClick={() => setActiveTab("attendance")}
                  onMouseEnter={preloadAttendanceSummary}
                  onFocus={preloadAttendanceSummary}
                  className="flex items-center gap-2"
                >
                  <UserCheck className="h-4 w-4" />
                  Attendance Summary
                </Button>
                <Button
                  variant={activeTab === "management" ? "default" : "outline"}
                  onClick={() => setActiveTab("management")}
                  onMouseEnter={preloadSessionManagement}
                  onFocus={preloadSessionManagement}
                  className="flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Session Management
                </Button>
                <Button
                  variant={activeTab === "analytics" ? "default" : "outline"}
                  onClick={() => setActiveTab("analytics")}
                  onMouseEnter={preloadSessionAnalytics}
                  onFocus={preloadSessionAnalytics}
                  className="flex items-center gap-2"
                >
                  <TrendingUp className="h-4 w-4" />
                  Analytics
                </Button>
                <Button
                  variant={activeTab === "scheduler" ? "default" : "outline"}
                  onClick={() => setActiveTab("scheduler")}
                  onMouseEnter={preloadReportScheduler}
                  onFocus={preloadReportScheduler}
                  className="flex items-center gap-2"
                >
                  <Calendar className="h-4 w-4" />
                  Scheduling
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tab Content */}
          {activeTab === "sessions" && <SessionReports />}
          {activeTab === "attendance" && <AttendanceSummary />}
          {activeTab === "management" && <SessionManagement />}
          {activeTab === "analytics" && <SessionAnalytics />}
          {activeTab === "scheduler" && <ReportScheduler />}
        </div>
      </AdminNavigation>
    </ProtectedRoute>
  );
}
