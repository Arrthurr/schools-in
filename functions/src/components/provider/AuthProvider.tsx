
"use client";

import { useAuth } from "@/lib/hooks/useAuth";
import { createContext } from "react";

export const AuthContext = createContext<ReturnType<typeof useAuth>>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}
