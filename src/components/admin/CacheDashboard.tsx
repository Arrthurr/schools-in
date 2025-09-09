"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Database,
  RefreshCw,
  Trash2,
  HardDrive,
  Clock,
  TrendingUp,
  Download,
  AlertTriangle,
} from "lucide-react";
import { useCache } from "@/lib/hooks/useCache";
import { useOffline } from "@/lib/hooks/useOffline";

interface CacheStoreInfo {
  name: string;
  itemCount: number;
  lastAccessed: number;
  accessCount: number;
  isStale: boolean;
  icon: React.ReactNode;
  description: string;
}

export function CacheDashboard({ userId }: { userId?: string }) {
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    cachedSchools,
    cachedSessions,
    schoolsStale,
    sessionsStale,
    isLoading,
    cacheSize,
    lastUpdate,
    getCacheStats,
    clearCache,
    refreshSchools,
    refreshSessions,
    preloadData,
  } = useCache(userId);

  const { isOnline, syncInProgress } = useOffline();

  useEffect(() => {
    loadCacheStats();
  }, []);

  const loadCacheStats = async () => {
    const stats = await getCacheStats();
    setCacheStats(stats);
  };

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refreshSchools(), refreshSessions()]);
      await loadCacheStats();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleClearCache = async () => {
    await clearCache();
    await loadCacheStats();
  };

  const handlePreloadData = async () => {
    if (!userId) return;
    await preloadData(userId);
    await loadCacheStats();
  };

  const formatBytes = (bytes: number) => {
    const sizes = ["B", "KB", "MB", "GB"];
    if (bytes === 0) return "0 B";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
  };

  const formatTimeAgo = (timestamp: number) => {
    if (!timestamp) return "Never";
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "Just now";
  };

  const cacheStores: CacheStoreInfo[] = [
    {
      name: "Schools",
      itemCount: cachedSchools.length,
      lastAccessed: lastUpdate?.getTime() || 0,
      accessCount: cacheStats?.stores?.schools_cache?.accessCount || 0,
      isStale: schoolsStale,
      icon: <Database className="h-4 w-4" />,
      description: "Assigned schools and their details",
    },
    {
      name: "Sessions",
      itemCount: cachedSessions.length,
      lastAccessed: lastUpdate?.getTime() || 0,
      accessCount: cacheStats?.stores?.sessions_cache?.accessCount || 0,
      isStale: sessionsStale,
      icon: <Clock className="h-4 w-4" />,
      description: "Check-in/out session history",
    },
  ];

  const totalAccessCount = cacheStores.reduce(
    (sum, store) => sum + store.accessCount,
    0
  );
  const staleStoreCount = cacheStores.filter((store) => store.isStale).length;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Size</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cacheSize}</div>
            <p className="text-xs text-muted-foreground">
              items cached locally
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Update</CardTitle>
            <RefreshCw
              className={`h-4 w-4 text-muted-foreground ${
                isRefreshing ? "animate-spin" : ""
              }`}
            />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lastUpdate ? formatTimeAgo(lastUpdate.getTime()) : "Never"}
            </div>
            <p className="text-xs text-muted-foreground">cache refreshed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Access Count</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAccessCount}</div>
            <p className="text-xs text-muted-foreground">cache hits today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Health</CardTitle>
            <AlertTriangle
              className={`h-4 w-4 ${
                staleStoreCount > 0 ? "text-orange-500" : "text-green-500"
              }`}
            />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {staleStoreCount === 0 ? "✓" : `${staleStoreCount} stale`}
            </div>
            <p className="text-xs text-muted-foreground">
              {staleStoreCount === 0 ? "All fresh" : "needs refresh"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cache Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Cache Management
          </CardTitle>
          <CardDescription>
            Manage offline data caching and synchronization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleRefreshAll}
              disabled={!isOnline || isRefreshing || syncInProgress}
              className="flex items-center gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh All
            </Button>

            <Button
              onClick={handlePreloadData}
              disabled={!isOnline || !userId || isLoading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Preload Data
            </Button>

            <Button
              onClick={handleClearCache}
              disabled={isLoading}
              variant="outline"
              className="flex items-center gap-2 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Clear Cache
            </Button>
          </div>

          {!isOnline && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-800">
                Offline mode: Cache refresh is disabled until connection is
                restored
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cache Store Details */}
      <Card>
        <CardHeader>
          <CardTitle>Cache Store Details</CardTitle>
          <CardDescription>
            Detailed information about each cache store
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {cacheStores.map((store, index) => (
              <div key={store.name}>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-muted rounded-md">{store.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{store.name}</h4>
                        {store.isStale && (
                          <Badge
                            variant="outline"
                            className="text-orange-600 border-orange-300"
                          >
                            Stale
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {store.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{store.itemCount} items</span>
                        <span>{store.accessCount} accesses</span>
                        <span>Last: {formatTimeAgo(store.lastAccessed)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={
                        store.isStale
                          ? 100
                          : Math.min(store.accessCount * 10, 100)
                      }
                      className="w-20"
                    />
                  </div>
                </div>
                {index < cacheStores.length - 1 && (
                  <Separator className="my-2" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {cacheStats?.recommendations && cacheStats.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Cache Recommendations
            </CardTitle>
            <CardDescription>
              Suggestions to optimize cache performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {cacheStats.recommendations.map(
                (recommendation: string, index: number) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 p-2 bg-orange-50 border border-orange-200 rounded"
                  >
                    <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-orange-800">{recommendation}</p>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
