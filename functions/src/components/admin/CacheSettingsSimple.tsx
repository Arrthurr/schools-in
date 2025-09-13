"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  Database,
  RefreshCw,
  HardDrive,
  Zap,
  Info,
} from "lucide-react";
import { CACHE_CONFIG } from "@/lib/offline/cacheStrategy";

interface CacheSettings {
  enableBackgroundSync: boolean;
  syncInterval: number; // minutes
  maxCacheSize: number; // MB
  autoCleanup: boolean;
  cleanupInterval: number; // hours
  compressionEnabled: boolean;
  debugMode: boolean;
}

export function CacheSettings() {
  const [settings, setSettings] = useState<CacheSettings>({
    enableBackgroundSync: true,
    syncInterval: 5,
    maxCacheSize: 50,
    autoCleanup: true,
    cleanupInterval: 1,
    compressionEnabled: false,
    debugMode: false,
  });

  const [hasChanges, setHasChanges] = useState(false);

  const updateSetting = <K extends keyof CacheSettings>(
    key: K,
    value: CacheSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    console.log("Saving cache settings:", settings);
    setHasChanges(false);
  };

  const handleReset = () => {
    setSettings({
      enableBackgroundSync: true,
      syncInterval: 5,
      maxCacheSize: 50,
      autoCleanup: true,
      cleanupInterval: 1,
      compressionEnabled: false,
      debugMode: false,
    });
    setHasChanges(false);
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0
      ? `${hours}h ${remainingMinutes}m`
      : `${hours}h`;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Cache Settings</h2>
          <p className="text-muted-foreground">
            Configure offline data caching and synchronization behavior
          </p>
        </div>
        {hasChanges && (
          <Badge
            variant="outline"
            className="bg-orange-50 text-orange-700 border-orange-300"
          >
            Unsaved Changes
          </Badge>
        )}
      </div>

      {/* Sync Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Synchronization
          </CardTitle>
          <CardDescription>
            Control how and when data syncs between device and server
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="background-sync">Background Sync</Label>
              <p className="text-sm text-muted-foreground">
                Automatically sync data in the background
              </p>
            </div>
            <Switch
              id="background-sync"
              checked={settings.enableBackgroundSync}
              onCheckedChange={(checked: boolean) =>
                updateSetting("enableBackgroundSync", checked)
              }
            />
          </div>

          {settings.enableBackgroundSync && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label>
                  Sync Interval: {formatDuration(settings.syncInterval)}
                </Label>
                <Slider
                  value={[settings.syncInterval]}
                  onValueChange={([value]: number[]) =>
                    updateSetting("syncInterval", value)
                  }
                  max={60}
                  min={1}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1m</span>
                  <span>60m</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Storage Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Storage Management
          </CardTitle>
          <CardDescription>
            Control cache size limits and cleanup behavior
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Max Cache Size: {settings.maxCacheSize} MB</Label>
            <Slider
              value={[settings.maxCacheSize]}
              onValueChange={([value]: number[]) =>
                updateSetting("maxCacheSize", value)
              }
              max={500}
              min={10}
              step={10}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>10 MB</span>
              <span>500 MB</span>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-cleanup">Auto Cleanup</Label>
              <p className="text-sm text-muted-foreground">
                Automatically remove expired cache entries
              </p>
            </div>
            <Switch
              id="auto-cleanup"
              checked={settings.autoCleanup}
              onCheckedChange={(checked: boolean) =>
                updateSetting("autoCleanup", checked)
              }
            />
          </div>

          {settings.autoCleanup && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label>Cleanup Interval: {settings.cleanupInterval}h</Label>
                <Slider
                  value={[settings.cleanupInterval]}
                  onValueChange={([value]: number[]) =>
                    updateSetting("cleanupInterval", value)
                  }
                  max={24}
                  min={1}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1h</span>
                  <span>24h</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Performance Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Performance
          </CardTitle>
          <CardDescription>
            Optimize cache performance and resource usage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="compression">Data Compression</Label>
              <p className="text-sm text-muted-foreground">
                Compress cached data to save storage space
              </p>
            </div>
            <Switch
              id="compression"
              checked={settings.compressionEnabled}
              onCheckedChange={(checked: boolean) =>
                updateSetting("compressionEnabled", checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Debug Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Advanced
          </CardTitle>
          <CardDescription>
            Advanced settings for debugging and development
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="debug-mode">Debug Mode</Label>
              <p className="text-sm text-muted-foreground">
                Enable detailed cache logging and diagnostics
              </p>
            </div>
            <Switch
              id="debug-mode"
              checked={settings.debugMode}
              onCheckedChange={(checked: boolean) =>
                updateSetting("debugMode", checked)
              }
            />
          </div>

          {settings.debugMode && (
            <>
              <Separator />
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-800">
                    Debug mode will log detailed cache operations to the browser
                    console. This may impact performance and should only be used
                    for troubleshooting.
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Cache Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Cache Information
          </CardTitle>
          <CardDescription>
            Current cache configuration and limits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="font-medium">Schools Cache</p>
              <p className="text-muted-foreground">
                {Math.floor(CACHE_CONFIG.EXPIRATION.SCHOOLS / (1000 * 60 * 60))}
                h expiry
              </p>
            </div>
            <div>
              <p className="font-medium">Sessions Cache</p>
              <p className="text-muted-foreground">
                {Math.floor(
                  CACHE_CONFIG.EXPIRATION.SESSIONS / (1000 * 60 * 60 * 24)
                )}
                d expiry
              </p>
            </div>
            <div>
              <p className="font-medium">Location Cache</p>
              <p className="text-muted-foreground">
                {Math.floor(
                  CACHE_CONFIG.EXPIRATION.LOCATION_DATA / (1000 * 60)
                )}
                m expiry
              </p>
            </div>
            <div>
              <p className="font-medium">User Data</p>
              <p className="text-muted-foreground">
                {Math.floor(
                  CACHE_CONFIG.EXPIRATION.USER_DATA / (1000 * 60 * 60 * 24)
                )}
                d expiry
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={!hasChanges}
          className="flex items-center gap-2"
        >
          <Settings className="h-4 w-4" />
          Save Settings
        </Button>

        <Button onClick={handleReset} variant="outline" disabled={!hasChanges}>
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}
