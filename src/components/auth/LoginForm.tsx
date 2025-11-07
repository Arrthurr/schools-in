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
        // Wait for Firestore document to be available with exponential backoff retry
        const userDoc = await waitForUserDocument(result.user.uid);
        
        // Check if user document exists and has proper access
        if (!userDoc || !userDoc.role) {
          console.error("User document missing role:", userDoc);
          throw new Error("Your account is not authorized.");
        }
        
        // Wait for Firebase Auth state to propagate before redirecting
        // This ensures onAuthStateChanged listeners fire on the destination page
        await waitForAuthStatePropagation();
        
        console.log("✅ Sign-in successful. User role:", userDoc.role);
        const defaultRoute = userDoc.role === "admin" ? "/admin" : "/dashboard";
        router.replace(defaultRoute as Route);
      } else {
        // Also wait for auth propagation for redirect URLs
        await waitForAuthStatePropagation();
        router.replace(redirectTo as Route);
      }

      // announce("Successfully signed in with Microsoft", "polite");
      } catch (error: any) {
      const loginTime = performance.now() - startTime;
      const errorMessage = error.message || "Sign-in failed";

      console.error("Sign-in error:", errorMessage);
      setError(errorMessage);
      // announce(`Microsoft sign in failed: ${errorMessage}`, "assertive");
      } finally {
      setLoading(false);
    }
  };

  /**
   * Wait for user document to be created in Firestore with exponential backoff retry
   * Retries up to 5 times with increasing delays: 100ms, 200ms, 400ms, 800ms, 1600ms
   */
  async function waitForUserDocument(
    userId: string,
    maxRetries: number = 5
  ): Promise<{ role: "provider" | "admin" } | null> {
    const { getDocument } = await import("@/lib/firebase/firestore");
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const userDoc = await getDocument<{ role: "provider" | "admin" }>(
          "users",
          userId
        );
        
        if (userDoc) {
          console.log(`✅ User document found on attempt ${attempt + 1}:`, userDoc);
          return userDoc;
        }
        
        // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms
        const delayMs = 100 * Math.pow(2, attempt);
        console.log(`⏳ User document not found. Retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } catch (err) {
        console.warn(`⚠️ Attempt ${attempt + 1} failed:`, err);
        if (attempt < maxRetries - 1) {
          const delayMs = 100 * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    
    console.error("❌ Failed to retrieve user document after", maxRetries, "attempts");
    return null;
  }

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
