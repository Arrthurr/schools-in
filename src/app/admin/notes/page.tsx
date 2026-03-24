"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminNavigation } from "@/components/admin/AdminNavigation";
import { AdminSessionNotes } from "@/components/admin/AdminSessionNotes";

export default function AdminNotesPage() {
  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminNavigation>
        <AdminSessionNotes />
      </AdminNavigation>
    </ProtectedRoute>
  );
}
