"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
} from "lucide-react";
import { useCachedAuth } from "@/lib/hooks/useCachedAuth";
import { useCachedSession } from "@/lib/hooks/useCachedSession";
import { CachedSchoolService } from "@/lib/services/cachedSchoolService";
import { CachedSessionService } from "@/lib/services/cachedSessionService";
import { locationService, type Coordinates } from "@/lib/utils/location";
import { validateGeofence } from "@/lib/utils/geo";
import { getDayKey } from "@/lib/utils/time";
import { Timestamp } from "firebase/firestore";
import type { Location } from "@/lib/firebase/types";
import { useToast } from "@/components/ui/use-toast";

interface AdminManualCheckInOutProps {
  className?: string;
}

export function AdminManualCheckInOut({
  className = "",
}: AdminManualCheckInOutProps) {
  const { toast } = useToast();
  const { user } = useCachedAuth();
  const { activeSession, refreshSessions } = useCachedSession(user?.uid);

  // School selection and data
  const [schools, setSchools] = useState<Location[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("");
  const [loadingSchools, setLoadingSchools] = useState(true);

  // Location state
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Action state
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Load all schools
  useEffect(() => {
    async function loadSchools() {
      try {
        setLoadingSchools(true);
        const allSchools = await CachedSchoolService.getAllSchools(
          { status: "active" },
          { orderBy: { field: "name", direction: "asc" } }
        );
        setSchools(allSchools);
      } catch (err) {
        console.error("Failed to load schools:", err);
      } finally {
        setLoadingSchools(false);
      }
    }
    loadSchools();
  }, []);

  // Get selected school details
  const selectedSchool = useMemo(() => {
    return schools.find((s) => s.id === selectedSchoolId) || null;
  }, [schools, selectedSchoolId]);

  // Calculate distance and range status
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

  // Get current LOCATION
  const getLocation = useCallback(async () => {
    setLocationLoading(true);
    setLocationError(null);

    try {
      const coords = await locationService.getCurrentLocation();
      setUserLocation(coords);
    } catch (err: any) {
      console.error("Location error:", err);
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

  // Format distance for display
  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  // Handle check-in
  const handleCheckIn = async () => {
    if (!user || !selectedSchool || !userLocation || !rangeStatus.isInRange) {
      return;
    }

    setActionLoading(true);
    setActionError(null);

    try {
      const startTime = new Date();
      await CachedSessionService.startSession({
        locationId: selectedSchool.id,
        startTime,
        checkInMethod: "manual",
        distanceFromCenterAtCheckIn: rangeStatus.distance || 0,
        dayKey: getDayKey(Timestamp.fromDate(startTime)),
        notes: `Admin manual check-in by ${user.displayName || user.email}`,
        checkInLocation: {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          accuracy: userLocation.accuracy,
        },
      });

      toast({
        title: "Checked In",
        description: `Successfully checked in at ${selectedSchool.name}`,
        variant: "default",
      });
      await refreshSessions();
    } catch (err: any) {
      console.error("Check-in error:", err);
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

  // Handle check-out
  const handleCheckOut = async () => {
    if (!activeSession) {
      return;
    }

    setActionLoading(true);
    setActionError(null);

    try {
      await CachedSessionService.endSession(activeSession.id, {
        endTime: new Date(),
        notes: `Admin manual check-out by ${user?.displayName || user?.email}`,
      });

      const schoolName =
        schools.find((s) => s.id === activeSession.locationId)?.name ||
        "school";
      toast({
        title: "Checked Out",
        description: `Successfully checked out from ${schoolName}`,
        variant: "default",
      });
      await refreshSessions();
    } catch (err: any) {
      console.error("Check-out error:", err);
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

  // Get active session school name
  const activeSessionSchoolName = useMemo(() => {
    if (!activeSession) return null;
    const school = schools.find((s) => s.id === activeSession.locationId);
    return school?.name || "Unknown Location";
  }, [activeSession, schools]);

  // Calculate session duration
  const sessionDuration = useMemo(() => {
    if (!activeSession?.startTime) return null;

    let startMs: number;
    const st = activeSession.startTime;
    if (st instanceof Date) {
      startMs = st.getTime();
    } else if (typeof st.toMillis === "function") {
      startMs = st.toMillis();
    } else if (typeof st.seconds === "number") {
      // Plain object from Firestore cache
      startMs = st.seconds * 1000 + (st.nanoseconds || 0) / 1000000;
    } else {
      return null;
    }

    const durationMs = Date.now() - startMs;
    const minutes = Math.floor(durationMs / 60000);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
  }, [activeSession]);

  // School options for select
  const schoolOptions = useMemo(() => {
    return schools.map((school) => ({
      value: school.id,
      label: school.name,
    }));
  }, [schools]);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-brand-primary" />
          Manual Check-In/Out
        </CardTitle>
        <CardDescription>
          As an admin, you can manually check in and out at any school for site
          visits.
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
                  End Visit
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Check-in Form (only show when no active session) */}
        {!activeSession && (
          <>
            {/* School Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Select School</label>
              {loadingSchools ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading schools...
                </div>
              ) : (
                <SimpleSelect
                  value={selectedSchoolId}
                  onValueChange={setSelectedSchoolId}
                  placeholder="Choose a school to visit..."
                  options={schoolOptions}
                />
              )}
            </div>

            {/* Location Status */}
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
                    <div className="flex items-center gap-2">
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
                    {userLocation.accuracy && (
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

            {/* Check-in Button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleCheckIn}
              disabled={
                actionLoading ||
                !selectedSchool ||
                !userLocation ||
                !rangeStatus.isInRange
              }
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4 mr-2" />
              )}
              Start Visit (Check In)
            </Button>

            {!rangeStatus.isInRange && selectedSchool && userLocation && (
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

export default AdminManualCheckInOut;
