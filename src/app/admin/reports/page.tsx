// Reports and export page

import { Metadata } from "next";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminNavigation } from "@/components/admin/AdminNavigation";
import { SessionReports } from "@/components/admin/SessionReports";

export const metadata: Metadata = {
  title: "Reports & Export | Schools In Admin",
  description: "Generate reports and export session data",
};

export default function ReportsPage() {
  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminNavigation>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Reports & Export</h1>
          </div>

          <SessionReports />
        </div>
      </AdminNavigation>
    </ProtectedRoute>
  );
}
