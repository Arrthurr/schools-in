"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { SessionHistoryPage } from "@/components/provider/SessionHistoryPage";

export default function SessionHistoryRoute() {
  return (
    <ProtectedRoute roles={["provider", "admin"]}>
      <SessionHistoryPage />
    </ProtectedRoute>
  );
}
