"use client";

import { useEffect, useState } from "react";
import { useId } from "react";
import { signInWithMicrosoft } from "@/lib/firebase/auth";
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

    const startTime = performance.now();
    try {
      const result = await signInWithMicrosoft();
      const loginTime = performance.now() - startTime;
      const redirectTo = searchParams.get("redirectTo");
      
      // Redirect based on user role
      if (!redirectTo) {
        // Wait a bit for Firestore document to be available
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const { getDocument } = await import("@/lib/firebase/firestore");
        const userDoc = await getDocument<{ role: "provider" | "admin" }>(
          "users",
          result.user.uid
        );
        
        // Check if user document exists and has proper access
        if (!userDoc || !userDoc.role) {
          throw new Error("Your account is not authorized.");
        }
        
        console.log("User role:", userDoc?.role);
        const defaultRoute = userDoc?.role === "admin" ? "/admin" : "/dashboard";
        router.replace(defaultRoute as Route);
      } else {
        router.replace(redirectTo as Route);
      }

      // announce("Successfully signed in with Microsoft", "polite");
      } catch (error: any) {
      const loginTime = performance.now() - startTime;
      const errorMessage = error.message;

      setError(errorMessage);
      // announce(`Microsoft sign in failed: ${errorMessage}`, "assertive");
      } finally {
      setLoading(false);
    }
  };

  // Prefetch both dashboards for faster transition
  useEffect(() => {
    try {
      router.prefetch?.("/dashboard" as Route);
      router.prefetch?.("/admin" as Route);
    } catch {}
  }, [router]);

  return (
    <div className="w-full space-y-4 sm:space-y-6">
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
