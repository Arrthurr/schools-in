"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminNavigation } from "@/components/admin/AdminNavigation";
import { AdminNotifications } from "@/components/admin/AdminNotifications";

export default function AdminNotificationsPage() {
  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminNavigation>
        <AdminNotifications />
      </AdminNavigation>
    </ProtectedRoute>
  );
}
