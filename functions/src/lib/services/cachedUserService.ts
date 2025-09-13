/**
 * Cached User Service - High-performance user operations with intelligent caching
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../../../firebase.config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { User } from "@/lib/firebase/types";
import { FirebaseCache, CacheTracker } from "@/lib/cache/FirebaseCache";

export interface UserFilters {
  role?: 'provider' | 'admin';
  status?: 'active' | 'inactive';
  search?: string;
  assignmentStatus?: 'assigned' | 'unassigned' | 'all';
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  providerCount: number;
  adminCount: number;
  assignedProviders: number;
  unassignedProviders: number;
  lastUpdated: Date;
}

export class CachedUserService {
  // Get all users with caching and filtering
  static async getAllUsers(
    filters: UserFilters = {},
    options: { forceRefresh?: boolean; limit?: number } = {}
  ): Promise<User[]> {
    const { role, status, assignmentStatus } = filters;
    const { forceRefresh = false, limit: limitCount } = options;
    
    const cacheKey = FirebaseCache.generateQueryKey(
      'users_filtered',
      { role, status, assignmentStatus },
      'createdAt',
      limitCount
    );

    return FirebaseCache.cacheUserData(
      cacheKey,
      async () => {
        const q = collection(db, COLLECTIONS.USERS);
        let queryRef: any = q;

        // Apply role filter
        if (role) {
          queryRef = query(queryRef, where('role', '==', role));
        }

        // Apply status filter
        if (status) {
          queryRef = query(queryRef, where('isActive', '==', status === 'active'));
        }

        // Apply assignment filter for providers
        if (assignmentStatus && assignmentStatus !== 'all') {
          if (assignmentStatus === 'assigned') {
            queryRef = query(queryRef, where('hasAssignments', '==', true));
          } else {
            queryRef = query(queryRef, where('hasAssignments', '==', false));
          }
        }

        // Apply ordering and limit
        queryRef = query(queryRef, orderBy('createdAt', 'desc'));
        
        if (limitCount) {
          queryRef = query(queryRef, limit(limitCount));
        }

        const snapshot = await getDocs(queryRef);
        let users = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as User));

        // Apply search filter (client-side for now - consider Algolia for production)
        if (filters.search) {
          const searchTerm = filters.search.toLowerCase();
          users = users.filter(user => 
            (user.displayName || '').toLowerCase().includes(searchTerm) ||
            (user.email || '').toLowerCase().includes(searchTerm) ||
            (user.phoneNumber || '').toLowerCase().includes(searchTerm)
          );
        }

        return users;
      },
      {
        forceRefresh,
        onCacheHit: () => CacheTracker.recordHit(),
        onCacheMiss: () => CacheTracker.recordMiss(),
      }
    );
  }

  // Get user by ID with caching
  static async getUserById(
    userId: string,
    options: { forceRefresh?: boolean } = {}
  ): Promise<User | null> {
    const { forceRefresh = false } = options;
    
    return FirebaseCache.cacheUserData(
      `user_${userId}`,
      async () => {
        const userDoc = await getDocs(
          query(collection(db, COLLECTIONS.USERS), where('__name__', '==', userId))
        );
        
        if (userDoc.empty) return null;
        
        const doc = userDoc.docs[0];
        return {
          id: doc.id,
          ...doc.data(),
        } as User;
      },
      {
        forceRefresh,
        onCacheHit: () => CacheTracker.recordHit(),
        onCacheMiss: () => CacheTracker.recordMiss(),
      }
    );
  }

  // Get providers with their school assignments
  static async getProvidersWithSchools(
    options: { forceRefresh?: boolean } = {}
  ): Promise<Array<User & { assignedSchools: any[] }>> {
    const { forceRefresh = false } = options;
    
    return FirebaseCache.cacheAssignmentData(
      'providers_with_schools',
      async () => {
        // Get all providers
        const providersQuery = query(
          collection(db, COLLECTIONS.USERS),
          where('role', '==', 'provider'),
          orderBy('displayName', 'asc')
        );
        
        const providersSnapshot = await getDocs(providersQuery);
        const providers = providersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as User));

        // Get school assignments for each provider
        const providersWithSchools = await Promise.all(
          providers.map(async (provider) => {
            const schoolsQuery = query(
              collection(db, COLLECTIONS.LOCATIONS),
              where('assignedProviders', 'array-contains', provider.id)
            );
            
            const schoolsSnapshot = await getDocs(schoolsQuery);
            const assignedSchools = schoolsSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
            }));

            return {
              ...provider,
              assignedSchools,
            };
          })
        );

        return providersWithSchools;
      },
      {
        forceRefresh,
        onCacheHit: () => CacheTracker.recordHit(),
        onCacheMiss: () => CacheTracker.recordMiss(),
      }
    );
  }

  // Search users with caching
  static async searchUsers(
    searchTerm: string,
    filters: Omit<UserFilters, 'search'> = {},
    options: { forceRefresh?: boolean } = {}
  ): Promise<User[]> {
    if (!searchTerm.trim()) {
      return this.getAllUsers(filters, options);
    }

    const { forceRefresh = false } = options;
    const searchKey = `${searchTerm.toLowerCase()}_${JSON.stringify(filters)}`;

    return FirebaseCache.cacheSearchResults(
      searchKey,
      async () => {
        // Get all users matching filters first
        const users = await this.getAllUsers(filters, { forceRefresh: true });
        
        // Perform client-side search
        const searchTermLower = searchTerm.toLowerCase();
        return users.filter(user => {
          const matchesName = (user.displayName || '').toLowerCase().includes(searchTermLower);
          const matchesEmail = (user.email || '').toLowerCase().includes(searchTermLower);
          const matchesPhone = (user.phoneNumber || '').toLowerCase().includes(searchTermLower);
          
          return matchesName || matchesEmail || matchesPhone;
        });
      },
      {
        forceRefresh,
        onCacheHit: () => CacheTracker.recordHit(),
        onCacheMiss: () => CacheTracker.recordMiss(),
      }
    );
  }

  // Get user statistics with caching
  static async getUserStats(
    options: { forceRefresh?: boolean } = {}
  ): Promise<UserStats> {
    const { forceRefresh = false } = options;
    
    return FirebaseCache.cacheStats(
      'user_stats',
      async () => {
        // Get all users
        const allUsers = await this.getAllUsers({}, { forceRefresh: true });
        
        // Calculate statistics
        const totalUsers = allUsers.length;
        const activeUsers = allUsers.filter(user => user.isActive !== false).length;
        const inactiveUsers = totalUsers - activeUsers;
        const providerCount = allUsers.filter(user => user.role === 'provider').length;
        const adminCount = allUsers.filter(user => user.role === 'admin').length;
        
        // Get assignment statistics
        const providersWithSchools = await this.getProvidersWithSchools({ forceRefresh: true });
        const assignedProviders = providersWithSchools.filter(p => p.assignedSchools.length > 0).length;
        const unassignedProviders = providerCount - assignedProviders;

        return {
          totalUsers,
          activeUsers,
          inactiveUsers,
          providerCount,
          adminCount,
          assignedProviders,
          unassignedProviders,
          lastUpdated: new Date(),
        };
      },
      {
        forceRefresh,
        onCacheHit: () => CacheTracker.recordHit(),
        onCacheMiss: () => CacheTracker.recordMiss(),
      }
    );
  }

  // Update user with cache invalidation
  static async updateUser(
    userId: string,
    updates: Partial<User>
  ): Promise<void> {
    // Update in Firestore
    await updateDoc(doc(db, COLLECTIONS.USERS, userId), updates);
    
    // Invalidate related cache entries
    await FirebaseCache.invalidateCache([
      `user_${userId}`,
      'users_filtered',
      'providers_with_schools',
      'user_stats',
      'search_',
    ]);
  }

  // Delete user with cache invalidation
  static async deleteUser(userId: string): Promise<void> {
    // Delete from Firestore
    await deleteDoc(doc(db, COLLECTIONS.USERS, userId));
    
    // Invalidate related cache entries
    await FirebaseCache.invalidateCache([
      `user_${userId}`,
      'users_filtered',
      'providers_with_schools',
      'user_stats',
      'search_',
    ]);
  }

  // Batch update users with cache invalidation
  static async batchUpdateUsers(
    updates: Array<{ userId: string; updates: Partial<User> }>
  ): Promise<void> {
    // Execute all updates
    await Promise.all(
      updates.map(({ userId, updates: userUpdates }) =>
        updateDoc(doc(db, COLLECTIONS.USERS, userId), userUpdates)
      )
    );

    // Invalidate cache for all affected users
    const userIds = updates.map(u => `user_${u.userId}`);
    await FirebaseCache.invalidateCache([
      ...userIds,
      'users_filtered',
      'providers_with_schools',
      'user_stats',
      'search_',
    ]);
  }

  // Get recently active users
  static async getRecentlyActiveUsers(
    options: { 
      limit?: number; 
      forceRefresh?: boolean;
      daysBack?: number;
    } = {}
  ): Promise<User[]> {
    const { limit: limitCount = 20, forceRefresh = false, daysBack = 7 } = options;
    
    const cacheKey = `recently_active_users_${daysBack}d_${limitCount}`;
    
    return FirebaseCache.cacheUserData(
      cacheKey,
      async () => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBack);
        
        const q = query(
          collection(db, COLLECTIONS.USERS),
          where('lastLoginAt', '>=', cutoffDate),
          orderBy('lastLoginAt', 'desc'),
          limit(limitCount)
        );
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as User));
      },
      {
        forceRefresh,
        onCacheHit: () => CacheTracker.recordHit(),
        onCacheMiss: () => CacheTracker.recordMiss(),
      }
    );
  }

  // Clear user-related cache
  static async clearUserCache(): Promise<void> {
    await FirebaseCache.clearByType('users');
  }

  // Pre-warm user cache with common queries
  static async preWarmUserCache(): Promise<void> {
    try {
      // Pre-load common user queries in background
      await Promise.all([
        this.getAllUsers({ role: 'provider' }, { limit: 50 }),
        this.getAllUsers({ role: 'admin' }, { limit: 20 }),
        this.getProvidersWithSchools(),
        this.getUserStats(),
        this.getRecentlyActiveUsers(),
      ]);
    } catch (error) {
      console.warn('Failed to pre-warm user cache:', error);
    }
  }
}

// Export for backward compatibility
export {
  getUserById,
  getAllUsers,
  getProvidersWithSchools,
  searchUsers,
  getUserStats,
} from '../services/userService';
