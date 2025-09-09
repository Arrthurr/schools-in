import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminNavigation } from "@/components/admin/AdminNavigation";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

// Admin dashboard page

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Dashboard | Schools In",
  description: "Admin dashboard for school and provider management",
};

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminNavigation>
        <AdminDashboard />
      </AdminNavigation>
    </ProtectedRoute>
  );
}
