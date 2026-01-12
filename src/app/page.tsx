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

  if (!loading && user) return null;

  return (
    <main className="flex flex-col items-center justify-center p-4 sm:p-6 lg:p-6">
      <div className="w-full max-w-sm sm:max-w-md space-y-2 sm:space-y-4">
        <BrandHeader title="Sign In" subtitle="Welcome back to CampusAccess" />

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
