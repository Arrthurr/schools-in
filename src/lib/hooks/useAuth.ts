import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../../../firebase.config";
import { getDocument } from "@/lib/firebase/firestore";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { isAuthBypassEnabled, createMockAuthState } from "@/lib/firebase/authBypass";

interface AuthUser extends User {
  role?: "provider" | "admin";
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if authentication bypass is enabled for testing
    if (isAuthBypassEnabled()) {
      // Use mock authentication state
      const mockState = createMockAuthState("admin"); // Default to admin for testing
      setUser(mockState.user as AuthUser);
      setLoading(false);
      return;
    }

    // Normal Firebase authentication
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDocument<{ role: "provider" | "admin" }>(
          COLLECTIONS.USERS,
          user.uid,
        );
        setUser({ ...user, role: userDoc?.role });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, loading };
}
