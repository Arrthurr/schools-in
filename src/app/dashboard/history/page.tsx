"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ProviderNavigation } from "@/components/provider/ProviderNavigation";
import { SessionHistoryPage } from "@/components/provider/SessionHistoryPage";

export default function SessionHistoryRoute() {
  return (
    <ProtectedRoute roles={["provider", "admin"]}>
      <ProviderNavigation>
        <SessionHistoryPage />
      </ProviderNavigation>
    </ProtectedRoute>
  );
}
