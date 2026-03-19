"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SimpleSelect } from "@/components/ui/select";
import {
  Loader2,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
  Navigation,
  CalendarClock,
} from "lucide-react";
import { useCachedAuth } from "@/lib/hooks/useCachedAuth";
import { useCachedSession } from "@/lib/hooks/useCachedSession";
import { useProviderLocations } from "@/lib/hooks/useProviderLocations";
import { useScheduleGate } from "@/lib/hooks/useScheduleGate";
import { CachedSessionService } from "@/lib/services/cachedSessionService";
import { locationService, type Coordinates } from "@/lib/utils/location";
import { validateGeofence } from "@/lib/utils/geo";
import { getDayKey } from "@/lib/utils/time";
import { Timestamp } from "firebase/firestore";
import { useToast } from "@/components/ui/use-toast";

interface ProviderManualCheckInOutProps {
  className?: string;
}

export function ProviderManualCheckInOut({
  className = "",
}: ProviderManualCheckInOutProps) {
  const { toast } = useToast();
  const { user } = useCachedAuth();
  const { activeSession, refreshSessions } = useCachedSession(user?.uid);
  const { locations, loading: loadingLocations } = useProviderLocations(
    user?.uid
  );

  // School selection
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("");

  // Location state
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Action state
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const selectedSchool = useMemo(
    () => locations.find((l) => l.id === selectedSchoolId) ?? null,
    [locations, selectedSchoolId]
  );

  // Geofence validation
  const rangeStatus = useMemo(() => {
    if (!userLocation || !selectedSchool?.geo) {
      return { isInRange: false, distance: null };
    }

    const result = validateGeofence(
      userLocation.latitude,
      userLocation.longitude,
      selectedSchool.geo,
      selectedSchool.radiusMeters ?? 300
    );

    return {
      isInRange: result.isWithinGeofence,
      distance: result.distance,
    };
  }, [userLocation, selectedSchool]);

  // Schedule gate for the selected school
  const scheduleGate = useScheduleGate(user?.uid, selectedSchoolId || undefined);

  const getLocation = useCallback(async () => {
    setLocationLoading(true);
    setLocationError(null);

    try {
      const coords = await locationService.getCurrentLocation();
      setUserLocation(coords);
    } catch (err: any) {
      if (err?.code === 1) {
        setLocationError(
          "Location access denied. Please enable location permissions in your browser."
        );
      } else if (err?.code === 2) {
        setLocationError(
          "Location unavailable. Please check your GPS settings."
        );
      } else if (err?.code === 3) {
        setLocationError("Location request timed out. Please try again.");
      } else {
        setLocationError(err?.message || "Failed to get location.");
      }
    } finally {
      setLocationLoading(false);
    }
  }, []);

  const formatDistance = (meters: number): string => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const formatDuration = (startMs: number): string => {
    const minutes = Math.floor((Date.now() - startMs) / 60000);
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    if (hours > 0) return `${hours}h ${remaining}m`;
    return `${minutes}m`;
  };

  const getStartMs = (session: typeof activeSession): number | null => {
    if (!session?.startTime) return null;
    const st = session.startTime as any;
    if (st instanceof Date) return st.getTime();
    if (typeof st.toMillis === "function") return st.toMillis();
    if (typeof st.seconds === "number")
      return st.seconds * 1000 + (st.nanoseconds || 0) / 1000000;
    return null;
  };

  const sessionDuration = useMemo(() => {
    const startMs = getStartMs(activeSession);
    if (startMs === null) return null;
    return formatDuration(startMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession]);

  const activeSessionSchoolName = useMemo(() => {
    if (!activeSession) return null;
    return (
      locations.find((l) => l.id === activeSession.locationId)?.name ??
      "Unknown Location"
    );
  }, [activeSession, locations]);

  const handleCheckIn = async () => {
    if (!user || !selectedSchool || !userLocation || !rangeStatus.isInRange)
      return;

    setActionLoading(true);
    setActionError(null);

    try {
      const startTime = new Date();
      await CachedSessionService.startSession({
        locationId: selectedSchool.id,
        startTime,
        checkInMethod: "manual",
        distanceFromCenterAtCheckIn: rangeStatus.distance ?? 0,
        dayKey: getDayKey(Timestamp.fromDate(startTime)),
        checkInLocation: {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          accuracy: userLocation.accuracy,
        },
      });

      toast({
        title: "Checked In",
        description: `Successfully checked in at ${selectedSchool.name}`,
      });
      setSelectedSchoolId("");
      setUserLocation(null);
      await refreshSessions();
    } catch (err: any) {
      const msg = err?.message || "Failed to check in. Please try again.";
      setActionError(msg);
      toast({
        title: "Check-in Failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!activeSession) return;

    setActionLoading(true);
    setActionError(null);

    try {
      await CachedSessionService.endSession(activeSession.id, {
        endTime: new Date(),
      });

      toast({
        title: "Checked Out",
        description: `Successfully checked out from ${activeSessionSchoolName}`,
      });
      await refreshSessions();
    } catch (err: any) {
      const msg = err?.message || "Failed to check out. Please try again.";
      setActionError(msg);
      toast({
        title: "Check-out Failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const schoolOptions = useMemo(
    () =>
      locations.map((loc) => ({
        value: loc.id,
        label: loc.name,
      })),
    [locations]
  );

  const checkInDisabled =
    actionLoading ||
    !selectedSchool ||
    !userLocation ||
    !rangeStatus.isInRange ||
    !scheduleGate.canCheckIn;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-brand-primary" />
          Manual Check-In/Out
        </CardTitle>
        <CardDescription>
          Select a school and verify your location to check in.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Active Session Display */}
        {activeSession && (
          <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <span className="font-medium">
                    Currently at: {activeSessionSchoolName}
                  </span>
                  {sessionDuration && (
                    <span className="text-green-600 dark:text-green-400 ml-2">
                      ({sessionDuration})
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleCheckOut}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Clock className="h-4 w-4 mr-2" />
                  )}
                  Check Out
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Check-In Form (only when no active session) */}
        {!activeSession && (
          <>
            {/* School Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Select School</label>
              {loadingLocations ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading your schools…
                </div>
              ) : locations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  You have no assigned schools.
                </p>
              ) : (
                <SimpleSelect
                  value={selectedSchoolId}
                  onValueChange={(val) => {
                    setSelectedSchoolId(val);
                    setUserLocation(null);
                    setLocationError(null);
                    setActionError(null);
                  }}
                  placeholder="Choose a school…"
                  options={schoolOptions}
                />
              )}
            </div>

            {/* Schedule Gate Notice */}
            {!scheduleGate.loading && scheduleGate.message && (
              <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
                <CalendarClock className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
                  {scheduleGate.message}
                </AlertDescription>
              </Alert>
            )}

            {/* Location */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Your Location</label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={getLocation}
                  disabled={locationLoading}
                >
                  {locationLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Navigation className="h-4 w-4 mr-2" />
                  )}
                  {userLocation ? "Refresh" : "Get Location"}
                </Button>
              </div>

              {locationError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{locationError}</AlertDescription>
                </Alert>
              )}

              {userLocation && selectedSchool && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border">
                  <MapPin className="h-5 w-5 text-brand-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {rangeStatus.isInRange ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          In Range
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                        >
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Out of Range
                        </Badge>
                      )}
                      {rangeStatus.distance != null &&
                        Number.isFinite(rangeStatus.distance) && (
                        <span className="text-sm text-muted-foreground">
                          {formatDistance(rangeStatus.distance)} from{" "}
                          {selectedSchool.name}
                        </span>
                      )}
                    </div>
                    {userLocation.accuracy !== undefined && (
                      <p className="text-xs text-muted-foreground mt-1">
                        GPS accuracy: ±{Math.round(userLocation.accuracy)}m
                      </p>
                    )}
                  </div>
                </div>
              )}

              {userLocation && !selectedSchool && (
                <p className="text-sm text-muted-foreground">
                  Select a school to see distance information.
                </p>
              )}
            </div>

            {/* Check-In Button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleCheckIn}
              disabled={checkInDisabled}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4 mr-2" />
              )}
              Check In
            </Button>

            {selectedSchool && userLocation && !rangeStatus.isInRange && (
              <p className="text-sm text-muted-foreground text-center">
                You must be within {selectedSchool.radiusMeters ?? 300}m of the
                school to check in.
              </p>
            )}
          </>
        )}

        {/* Action Feedback */}
        {actionError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

export default ProviderManualCheckInOut;
