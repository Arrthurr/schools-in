"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ProviderNavigation } from "@/components/provider/ProviderNavigation";
import { SessionNotesList } from "@/components/provider/SessionNotesList";

export default function SessionNotesPage() {
  return (
    <ProtectedRoute roles={["provider", "admin"]}>
      <ProviderNavigation>
        <div className="mx-auto max-w-4xl">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold mb-2">Session Notes</h1>
            <p className="text-muted-foreground">
              Add notes to your sessions to communicate schedule changes or
              provide context for admins.
            </p>
          </div>

          <SessionNotesList />
        </div>
      </ProviderNavigation>
    </ProtectedRoute>
  );
}
