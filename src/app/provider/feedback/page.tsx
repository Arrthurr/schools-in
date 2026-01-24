"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ProviderNavigation } from "@/components/provider/ProviderNavigation";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";

export default function FeedbackPage() {
  return (
    <ProtectedRoute roles={["provider", "admin"]}>
      <ProviderNavigation>
        <div className="mx-auto max-w-4xl">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold mb-2">Help & Feedback</h1>
            <p className="text-muted-foreground">
              We value your input. Please let us know if you encounter any
              issues or have suggestions for improvement.
            </p>
          </div>

          <FeedbackForm />
        </div>
      </ProviderNavigation>
    </ProtectedRoute>
  );
}
