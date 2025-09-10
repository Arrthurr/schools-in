'use client';

/**
 * Cached authentication hook with intelligent user data caching
 */

import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../../../firebase.config";
import { getCachedDocument } from "@/lib/firebase/cachedFirestore";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { FirebaseCache, FIREBASE_CACHE_CONFIGS } from "@/lib/cache/FirebaseCache";
import { cacheManager } from "@/lib/cache/CacheManager";

interface AuthUser extends User {
  role?: "provider" | "admin";
  profile?: {
    displayName?: string;
    photoURL?: string;
    phoneNumber?: string;
    lastLoginAt?: Date;
    createdAt?: Date;
    isActive?: boolean;
  };
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
}

export function useCachedAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!isMounted) return;

      try {
        if (firebaseUser) {
          // Try to get user data from cache first
          const cacheKey = `auth_user_${firebaseUser.uid}`;
          
          let userData = await cacheManager.getMultiLayer<{ 
            role: "provider" | "admin"; 
            profile?: any;
          }>(cacheKey, [
            FIREBASE_CACHE_CONFIGS.AUTH.memory,
            FIREBASE_CACHE_CONFIGS.AUTH.session,
          ]);

          // If not in cache, fetch from Firestore
          if (!userData) {
            userData = await getCachedDocument<{ 
              role: "provider" | "admin"; 
              profile?: any;
            }>(COLLECTIONS.USERS, firebaseUser.uid);

            // Cache the user data
            if (userData) {
              await cacheManager.setMultiLayer(cacheKey, userData, [
                FIREBASE_CACHE_CONFIGS.AUTH.memory,
                FIREBASE_CACHE_CONFIGS.AUTH.session,
              ]);
            }
          }

          // Construct authenticated user object
          const authUser: AuthUser = {
            ...firebaseUser,
            role: userData?.role,
            profile: userData?.profile || {
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              phoneNumber: firebaseUser.phoneNumber,
            },
          };

          setState({
            user: authUser,
            loading: false,
            error: null,
          });

          // Pre-warm cache for user-specific data
          if (userData?.role === 'provider') {
            // Pre-load provider-specific data in background
            preWarmProviderCache(firebaseUser.uid);
          } else if (userData?.role === 'admin') {
            // Pre-load admin-specific data in background
            preWarmAdminCache();
          }
        } else {
          // User signed out - clear auth cache
          await clearAuthCache();
          
          setState({
            user: null,
            loading: false,
            error: null,
          });
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        setState({
          user: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Authentication error',
        });
      }
    });

    // Try to restore auth state from cache immediately
    restoreAuthStateFromCache().then((cachedState) => {
      if (isMounted && cachedState) {
        setState(cachedState);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Force refresh user data (bypass cache)
  const refreshUser = async (): Promise<void> => {
    if (!state.user) return;

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Force refresh user data from Firestore
      const userData = await getCachedDocument<{ 
        role: "provider" | "admin"; 
        profile?: any;
      }>(COLLECTIONS.USERS, state.user.uid, { forceRefresh: true });

      if (userData) {
        const authUser: AuthUser = {
          ...state.user,
          role: userData.role,
          profile: userData.profile || state.user.profile,
        };

        // Update cache
        const cacheKey = `auth_user_${state.user.uid}`;
        await cacheManager.setMultiLayer(cacheKey, userData, [
          FIREBASE_CACHE_CONFIGS.AUTH.memory,
          FIREBASE_CACHE_CONFIGS.AUTH.session,
        ]);

        setState({
          user: authUser,
          loading: false,
          error: null,
        });
      }
    } catch (error) {
      console.error('Refresh user error:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to refresh user data',
      }));
    }
  };

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    refreshUser,
    isAuthenticated: !!state.user,
    isProvider: state.user?.role === 'provider',
    isAdmin: state.user?.role === 'admin',
  };
}

// Helper function to restore auth state from cache
async function restoreAuthStateFromCache(): Promise<AuthState | null> {
  try {
    // This is a simplified implementation - in practice, you'd need to
    // verify that the cached auth state is still valid
    const cachedAuthState = await cacheManager.get<AuthState>(
      'auth_state',
      FIREBASE_CACHE_CONFIGS.AUTH.memory
    );

    if (cachedAuthState && cachedAuthState.user) {
      return {
        ...cachedAuthState,
        loading: true, // Keep loading true until Firebase Auth confirms
      };
    }
  } catch (error) {
    console.warn('Failed to restore auth state from cache:', error);
  }

  return null;
}

// Clear all authentication-related cache
async function clearAuthCache(): Promise<void> {
  try {
    await Promise.all([
      cacheManager.clear(FIREBASE_CACHE_CONFIGS.AUTH.memory),
      cacheManager.clear(FIREBASE_CACHE_CONFIGS.AUTH.session),
    ]);
  } catch (error) {
    console.warn('Failed to clear auth cache:', error);
  }
}

// Pre-warm cache for provider-specific data
async function preWarmProviderCache(userId: string): Promise<void> {
  try {
    // Import the cached Firestore functions dynamically to avoid circular imports
    const { getCachedLocationsByProvider, getCachedUserSessions } = await import(
      '@/lib/firebase/cachedFirestore'
    );

    // Pre-load in background without blocking
    Promise.all([
      getCachedLocationsByProvider(userId),
      getCachedUserSessions(userId, { limit: 20 }),
    ]).catch(error => {
      console.warn('Failed to pre-warm provider cache:', error);
    });
  } catch (error) {
    console.warn('Failed to pre-warm provider cache:', error);
  }
}

// Pre-warm cache for admin-specific data
async function preWarmAdminCache(): Promise<void> {
  try {
    const { getCachedActiveSessions, getCachedCollection } = await import(
      '@/lib/firebase/cachedFirestore'
    );

    // Pre-load admin dashboard data in background
    Promise.all([
      getCachedActiveSessions(),
      getCachedCollection('users', { limitCount: 100 }),
      getCachedCollection('locations', { limitCount: 100 }),
    ]).catch(error => {
      console.warn('Failed to pre-warm admin cache:', error);
    });
  } catch (error) {
    console.warn('Failed to pre-warm admin cache:', error);
  }
}

// Hook for managing user preferences and settings cache
export function useUserPreferences() {
  const { user } = useCachedAuth();
  const [preferences, setPreferences] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setPreferences(null);
      setLoading(false);
      return;
    }

    loadUserPreferences(user.uid).then(prefs => {
      setPreferences(prefs);
      setLoading(false);
    });
  }, [user?.uid]);

  const updatePreferences = async (newPreferences: Partial<any>): Promise<void> => {
    if (!user?.uid) return;

    const updated = { ...preferences, ...newPreferences };
    
    // Optimistically update state
    setPreferences(updated);

    // Update cache and backend
    try {
      const cacheKey = `user_prefs_${user.uid}`;
      await cacheManager.set(cacheKey, updated, FIREBASE_CACHE_CONFIGS.USER.memory);
      
      // Update in Firestore (using the original firestore service)
      const { updateDocument } = await import('@/lib/firebase/firestore');
      await updateDocument(COLLECTIONS.USERS, user.uid, { preferences: updated });
    } catch (error) {
      console.error('Failed to update preferences:', error);
      // Revert optimistic update on error
      setPreferences(preferences);
      throw error;
    }
  };

  return {
    preferences,
    loading,
    updatePreferences,
  };
}

// Helper function to load user preferences
async function loadUserPreferences(userId: string): Promise<any> {
  try {
    const cacheKey = `user_prefs_${userId}`;
    
    // Try cache first
    let preferences = await cacheManager.get(
      cacheKey,
      FIREBASE_CACHE_CONFIGS.USER.memory
    );

    if (!preferences) {
      // Load from Firestore
      const userData = await getCachedDocument(COLLECTIONS.USERS, userId);
      preferences = userData?.preferences || {};
      
      // Cache the preferences
      await cacheManager.set(cacheKey, preferences, FIREBASE_CACHE_CONFIGS.USER.memory);
    }

    return preferences;
  } catch (error) {
    console.warn('Failed to load user preferences:', error);
    return {};
  }
}

// Export the original hook as well for backward compatibility
export { useAuth } from './useAuth';
