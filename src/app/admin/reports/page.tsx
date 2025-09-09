// Reports and export page

"use client";

import { useState } from "react";
import { Metadata } from "next";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminNavigation } from "@/components/admin/AdminNavigation";
import { SessionReports } from "@/components/admin/SessionReports";
import { AttendanceSummary } from "@/components/admin/AttendanceSummary";
import { SessionManagement } from "@/components/admin/SessionManagement";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, UserCheck, Edit } from "lucide-react";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<
    "sessions" | "attendance" | "management"
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
                  className="flex items-center gap-2"
                >
                  <UserCheck className="h-4 w-4" />
                  Attendance Summary
                </Button>
                <Button
                  variant={activeTab === "management" ? "default" : "outline"}
                  onClick={() => setActiveTab("management")}
                  className="flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Session Management
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tab Content */}
          {activeTab === "sessions" && <SessionReports />}
          {activeTab === "attendance" && <AttendanceSummary />}
          {activeTab === "management" && <SessionManagement />}
        </div>
      </AdminNavigation>
    </ProtectedRoute>
  );
}
