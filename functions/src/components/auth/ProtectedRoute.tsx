
"use client";

import { useAuth } from "@/lib/hooks/useAuth";
import { useRouter } from "next/navigation";

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles: Array<'provider' | 'admin'>;
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return <div>Loading...</div>; // Or a spinner component
  }

  if (!user) {
    router.push("/");
    return null;
  }

  if (user.role && !roles.includes(user.role)) {
    router.push("/dashboard"); // Or an unauthorized page
    return null;
  }

  return <>{children}</>;
}
