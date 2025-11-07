
"use client";

import { useCachedAuth } from "@/lib/hooks/useCachedAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles: Array<'provider' | 'admin'>;
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { user, loading } = useCachedAuth();
  const router = useRouter();
  const [authCheckComplete, setAuthCheckComplete] = useState(false);

  useEffect(() => {
    // Double-check Firebase Auth state if hook says no user
    if (!user && !loading) {
      const checkFirebaseAuth = async () => {
        try {
          const { auth } = await import("../../../firebase.config");
          if (auth.currentUser) {
            console.log("⚠️ ProtectedRoute: Hook shows no user, but auth.currentUser exists. Waiting for hook to update...");
            // Don't redirect yet - give useCachedAuth hook time to update
            return;
          }
          console.log("⚠️ ProtectedRoute: User not authenticated (verified via Firebase Auth), redirecting to /");
          setAuthCheckComplete(true);
        } catch (err) {
          console.error("Error checking Firebase Auth:", err);
          setAuthCheckComplete(true);
        }
      };
      checkFirebaseAuth();
    } else {
      setAuthCheckComplete(true);
    }
  }, [user, loading]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!authCheckComplete) {
    return <div>Verifying authentication...</div>;
  }

  if (!user) {
    router.push("/");
    return null;
  }

  if (!user.role) {
    console.warn("⚠️ ProtectedRoute: User missing role information:", user.uid);
    // Instead of immediately redirecting, show loading state
    return <div>Loading user permissions...</div>;
  }

  if (!roles.includes(user.role)) {
    console.log(`⚠️ ProtectedRoute: User role '${user.role}' not in allowed roles:`, roles);
    router.push("/dashboard");
    return null;
  }

  return <>{children}</>;
}
