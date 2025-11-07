
"use client";

import { useCachedAuth } from "@/lib/hooks/useCachedAuth";
import { useRouter } from "next/navigation";

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles: Array<'provider' | 'admin'>;
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { user, loading } = useCachedAuth();
  const router = useRouter();

  if (loading) {
    return <div>Loading...</div>; // Or a spinner component
  }

  if (!user) {
    console.log("⚠️ ProtectedRoute: User not authenticated, redirecting to /");
    router.push("/");
    return null;
  }

  if (!user.role) {
    console.warn("⚠️ ProtectedRoute: User missing role information:", user.uid);
    // Instead of immediately redirecting, let useCachedAuth retry fetching the role
    return <div>Loading user permissions...</div>;
  }

  if (!roles.includes(user.role)) {
    console.log(`⚠️ ProtectedRoute: User role '${user.role}' not in allowed roles:`, roles);
    router.push("/dashboard"); // Or an unauthorized page
    return null;
  }

  return <>{children}</>;
}
