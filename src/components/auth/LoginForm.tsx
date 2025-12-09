"use client";

import { useEffect, useState } from "react";
import { useId } from "react";
import {
  signInWithMicrosoft,
  syncUserFromM365,
  waitForUserDocument,
} from "@/lib/firebase/auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LoadingButton } from "@/components/ui/loading";

import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Accessibility hooks - TODO: reimplement
  const errorId = useId();
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleMicrosoftSignIn = async () => {
    setLoading(true);
    setError(null);

    try {
      const credential = await signInWithMicrosoft();
      const redirectTo = searchParams.get("redirectTo");
      
      // Sync user role and school assignments from Microsoft 365 groups
      // This updates the user's role (admin/provider) and assigns them to schools
      // based on their M365 group memberships
      console.log("🔄 Syncing user from Microsoft 365 groups...");
      const syncResult = await syncUserFromM365();
      console.log("✅ M365 sync complete. Role:", syncResult.role);

      // Ensure user document has been written with the latest role and metadata
      await waitForUserDocument(credential.user.uid);
      
      // Wait for Firebase Auth state to propagate before redirecting
      // This ensures onAuthStateChanged listeners fire on the destination page
      await waitForAuthStatePropagation();
      
      // Redirect based on user role (use syncResult.role which is authoritative from M365)
      if (!redirectTo) {
        console.log("✅ Sign-in successful. User role:", syncResult.role);
        const defaultRoute = syncResult.role === "admin" ? "/admin" : "/dashboard";
        router.replace(defaultRoute as Route);
      } else {
        router.replace(redirectTo as Route);
      }

      // announce("Successfully signed in with Microsoft", "polite");
    } catch (error: any) {
      const errorMessage = error?.message || "Sign-in failed";

      console.error("Sign-in error:", errorMessage);
      setError(errorMessage);
      // announce(`Microsoft sign in failed: ${errorMessage}`, "assertive");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Wait for Firebase Auth state to propagate before redirecting
   * Ensures onAuthStateChanged listeners have fired on the destination page
   */
  async function waitForAuthStatePropagation(): Promise<void> {
    const { auth } = await import("../../../firebase.config");
    
    // Wait for currentUser to be set (synchronous indicator of auth state)
    for (let i = 0; i < 10; i++) {
      if (auth.currentUser) {
        console.log("✅ Auth state propagated, currentUser available");
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.warn("⚠️ Auth state not propagated after 500ms, proceeding anyway");
  }

  // Prefetch both dashboards for faster transition
  useEffect(() => {
    try {
      router.prefetch?.("/dashboard" as Route);
      router.prefetch?.("/admin" as Route);
    } catch {}
  }, [router]);

  return (
    <div className="w-full space-y-2 sm:space-y-4">
      {error && (
        <Alert
          variant="destructive"
          className="text-sm"
          role="alert"
          id={errorId}
        >
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="break-words">
            {error}
          </AlertDescription>
        </Alert>
      )}

      <LoadingButton
        variant="outline"
        className="w-full touch-target text-base sm:text-sm micro-scale"
        onClick={handleMicrosoftSignIn}
        isLoading={loading}
        loadingText="Connecting..."
        aria-label="Sign in with Microsoft OAuth"
      >
        Sign in with Microsoft
      </LoadingButton>
    </div>
  );
}
