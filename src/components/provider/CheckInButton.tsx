"use client";

import { useState, useCallback } from "react";
import { Button } from "../ui/button";
import { Alert, AlertDescription } from "../ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { MapPin, Loader2, AlertCircle, Clock, Navigation } from "lucide-react";
import { useAuth } from "../../lib/hooks/useAuth";
import { useSession } from "../../lib/hooks/useSession";
import { useAnalytics } from "../../lib/hooks/useAnalytics";
import {
  locationService,
  isWithinRadius,
  calculateDistance,
  Coordinates,
  LocationError as CustomLocationError,
} from "../../lib/utils/location";
import { formatDuration } from "../../lib/utils/session";
import { AnnouncementRegion, useAnnouncement } from "@/lib/accessibility";
import { ErrorDisplay } from "../common/ErrorDisplay";

interface School {
  id: string;
  name: string;
  address: string;
  gpsCoordinates: {
    latitude: number;
    longitude: number;
  };
  radius: number; // in meters
}

interface CheckInButtonProps {
  school: School;
  isCheckedIn?: boolean;
  currentSessionId?: string;
  onLocationUpdate?: (location: Coordinates) => void;
  className?: string;
}

export const CheckInButton: React.FC<CheckInButtonProps> = ({
  school,
  isCheckedIn = false,
  currentSessionId,
  onLocationUpdate,
  className = "",
}) => {
  const { user } = useAuth();
  const {
    checkIn,
    checkOut,
    loading: sessionLoading,
    error: sessionError,
    currentSession,
  } = useSession();
  const {
    trackCheckIn,
    trackCheckOut,
    trackCheckInDuration,
    trackLocationEvent,
    trackError,
    trackPerformance,
  } = useAnalytics();

  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationError, setLocationError] = useState<{
    message: string;
    code?: number;
  } | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCheckOutDialog, setShowCheckOutDialog] = useState(false);
  const [isWithinRange, setIsWithinRange] = useState<boolean | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [sessionDuration, setSessionDuration] = useState<number | null>(null);
  const { announce } = useAnnouncement();

  const handleCheckInClick = useCallback(async () => {
    if (!user) {
      setLocationError({ message: "You must be logged in to check in." });
      return;
    }

    const startTime = performance.now();
    setIsGettingLocation(true);
    setLocationError(null);
    announce("Attempting to get your location...");

    try {
      const location = await locationService.getCurrentLocation({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });

      const locationTime = performance.now() - startTime;
      trackPerformance("gps_acquisition_time", locationTime, {
        accuracy: location.accuracy?.toString() || "unknown",
        school_id: school.id,
      });

      setUserLocation(location);
      onLocationUpdate?.(location);
      setLocationAccuracy(location.accuracy ?? null);
      announce(
        `Location acquired with accuracy of ${location.accuracy?.toFixed(
          0
        )} meters.`
      );

      const dist = calculateDistance(location, school.gpsCoordinates);
      const inRange = isWithinRadius(
        location,
        school.gpsCoordinates,
        school.radius
      );

      setDistance(dist);
      setIsWithinRange(inRange);

      // Track location view event
      trackLocationEvent("view", {
        locationId: school.id,
        locationName: school.name,
        accuracy: location.accuracy,
        distance: dist,
        gpsTime: locationTime,
      });

      if (inRange) {
        announce("You are within range for check-in.");
        setShowConfirmDialog(true);
      } else {
        const errorMessage = `You are too far from the school to check in. You are ${dist.toFixed(
          0
        )}m away.`;
        setLocationError({
          message: errorMessage,
        });
        announce(errorMessage);

        // Track failed check-in attempt
        trackError(
          new Error("Check-in failed: Out of range"),
          {
            school_id: school.id,
            distance: dist,
            required_radius: school.radius,
          },
          "low"
        );
      }
    } catch (error: any) {
      const err = error as CustomLocationError;
      const locationTime = performance.now() - startTime;

      // Track location acquisition failure
      trackError(
        new Error(`Location error: ${err.message}`),
        {
          school_id: school.id,
          gps_time: locationTime,
          error_code: err.code,
        },
        "medium"
      );

      setLocationError({ message: err.message, code: err.code });
      setIsWithinRange(false);
      setUserLocation(null);
      announce(`Error getting location: ${err.message}`, "assertive");
    } finally {
      setIsGettingLocation(false);
    }
  }, [
    user,
    onLocationUpdate,
    school.gpsCoordinates,
    school.radius,
    school.id,
    school.name,
    announce,
    trackPerformance,
    trackLocationEvent,
    trackError,
  ]);

  const handleConfirmCheckIn = async () => {
    if (!user || !userLocation) return;

    const startTime = performance.now();
    try {
      await checkIn(school.id, userLocation);
      const checkInDuration = performance.now() - startTime;

      // Track successful check-in
      trackCheckIn({
        locationId: school.id,
        locationName: school.name,
        accuracy: locationAccuracy,
        distance: distance,
        gpsTime: checkInDuration,
      });

      // Track check-in performance
      trackCheckInDuration(checkInDuration);

      setShowConfirmDialog(false);
      announce(`Successfully checked in to ${school.name}`);
    } catch (error) {
      const checkInDuration = performance.now() - startTime;

      // Track failed check-in
      trackError(
        new Error("Check-in failed"),
        {
          school_id: school.id,
          check_in_duration: checkInDuration,
          error_message:
            error instanceof Error ? error.message : "Unknown error",
        },
        "high"
      );

      setLocationError({ message: "Failed to check in. Please try again." });
      announce("Failed to check in. Please try again.", "assertive");
    }
  };

  const handleCheckOutClick = async () => {
    if (!user || !currentSessionId) {
      setLocationError({ message: "No active session to check out from." });
      return;
    }

    if (currentSession?.checkInTime) {
      const now = new Date();
      const checkInMs = currentSession.checkInTime.toMillis();
      const duration = Math.round((now.getTime() - checkInMs) / (1000 * 60)); // in minutes
      setSessionDuration(duration);
    }

    setShowCheckOutDialog(true);
  };

  const handleConfirmCheckOut = async () => {
    if (!user || !currentSessionId) return;

    const startTime = performance.now();
    try {
      const locationForCheckout = userLocation || {
        latitude: school.gpsCoordinates.latitude,
        longitude: school.gpsCoordinates.longitude,
        accuracy: 0,
      };

      await checkOut(currentSessionId, locationForCheckout);
      const checkOutDuration = performance.now() - startTime;

      // Track successful check-out
      trackCheckOut({
        locationId: school.id,
        locationName: school.name,
        sessionDuration: sessionDuration || 0,
        checkOutDuration: checkOutDuration,
      });

      setShowCheckOutDialog(false);
      announce(`Successfully checked out from ${school.name}`);
    } catch (error) {
      const checkOutDuration = performance.now() - startTime;

      // Track failed check-out
      trackError(
        new Error("Check-out failed"),
        {
          school_id: school.id,
          session_id: currentSessionId,
          check_out_duration: checkOutDuration,
          error_message:
            error instanceof Error ? error.message : "Unknown error",
        },
        "high"
      );

      setLocationError({ message: "Failed to check out. Please try again." });
      announce("Failed to check out. Please try again.", "assertive");
    }
  };

  const isLoading = isGettingLocation || sessionLoading;

  return (
    <>
      <AnnouncementRegion />
      <div className={`space-y-4 ${className}`}>
        <Button
          onClick={isCheckedIn ? handleCheckOutClick : handleCheckInClick}
          disabled={isLoading}
          className="w-full"
          size="lg"
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : isCheckedIn ? (
            <Clock className="mr-2 h-4 w-4" />
          ) : (
            <MapPin className="mr-2 h-4 w-4" />
          )}
          {isLoading ? "Processing..." : isCheckedIn ? "Check Out" : "Check In"}
        </Button>

        {userLocation && (
          <div className="text-center text-sm text-gray-500">
            <p>Distance: {distance?.toFixed(0)}m</p>
            <p>Accuracy: ±{locationAccuracy?.toFixed(0)}m</p>
            <p>Status: {isWithinRange ? "In Range" : "Out of Range"}</p>
          </div>
        )}

        {locationError && (
          <ErrorDisplay
            title="Location Error"
            message={locationError.message}
            onRetry={locationError.code === 1 ? handleCheckInClick : undefined}
            retryText="Retry Location Check"
            isLoading={isGettingLocation}
          />
        )}

        {sessionError && (
          <ErrorDisplay title="Session Error" message={sessionError} />
        )}
      </div>

      {/* Check-in Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Check-In</DialogTitle>
            <DialogDescription>
              You are checking in at {school.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p>School: {school.name}</p>
            <p>Distance: {distance?.toFixed(0)}m</p>
            <p>Status: {isWithinRange ? "In Range" : "Out of Range"}</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmCheckIn} disabled={sessionLoading}>
              {sessionLoading ? "Confirming..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Check-out Confirmation Dialog */}
      <Dialog open={showCheckOutDialog} onOpenChange={setShowCheckOutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Check-Out</DialogTitle>
            <DialogDescription>
              You are checking out from {school.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p>School: {school.name}</p>
            {sessionDuration !== null && (
              <p>Session Duration: {formatDuration(sessionDuration)}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowCheckOutDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmCheckOut}
              disabled={sessionLoading}
              variant="destructive"
            >
              {sessionLoading ? "Confirming..." : "Confirm Check-Out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CheckInButton;
