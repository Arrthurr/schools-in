// Custom React hook for authentication state management

import { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../firebase.config';
import { getUserByEmail } from '../firebase/firestore';

interface AuthUser extends User {
  role?: 'provider' | 'admin';
  assignedSchools?: string[];
}

interface UseAuthReturn {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
}

export const useAuth = (): UseAuthReturn => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // Get additional user data from Firestore
          const userQuery = await getUserByEmail(firebaseUser.email || '');
          let userData = null;
          
          if (!userQuery.empty) {
            userData = userQuery.docs[0].data();
          }

          setUser({
            ...firebaseUser,
            role: userData?.role || 'provider',
            assignedSchools: userData?.assignedSchools || []
          });
        } else {
          setUser(null);
        }
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Authentication error');
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return { user, loading, error };
};
