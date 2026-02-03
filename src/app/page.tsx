"use client";

import { LoginForm } from "@/components/auth/LoginForm";
import { BrandHeader } from "@/components/ui/logo";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import type { Route } from "next";

// (Removed force-dynamic to enable static export if possible.)

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      const defaultRoute = user.role === "admin" ? "/admin" : "/dashboard";
      router.replace(defaultRoute as Route);
    }
  }, [loading, user, router]);

  if (!loading && user) {
    return (
      <div className="flex flex-col items-center justify-center p-4 sm:p-6 lg:p-6">
        <div className="w-full max-w-sm sm:max-w-md space-y-2 sm:space-y-4 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Redirecting...
          </h1>
          <p className="text-sm text-muted-foreground">
            Taking you to your dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-4 sm:p-6 lg:p-6">
      <div className="w-full max-w-sm sm:max-w-md space-y-2 sm:space-y-4">
        <BrandHeader title="Sign In" subtitle="Welcome back to CampusAccess" />

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
