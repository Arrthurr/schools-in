"use client";

import { useState, useCallback } from "react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription } from "../ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  MapPin,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  Navigation,
} from "lucide-react";
import { useAuth } from "../../lib/hooks/useAuth";
import { useSession } from "../../lib/hooks/useSession";
import {
  locationService,
  isWithinRadius,
  calculateDistance,
  Coordinates,
} from "../../lib/utils/location";

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
  const { checkIn, checkOut, loading: sessionLoading } = useSession();

  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isWithinRange, setIsWithinRange] = useState<boolean | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [locationAttempts, setLocationAttempts] = useState(0);
  const [isVerifyingLocation, setIsVerifyingLocation] = useState(false);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);

  // Enhanced location validation with accuracy checks
  const validateLocation = useCallback(
    (userLoc: Coordinates, schoolLoc: Coordinates, accuracy?: number) => {
      // Use the utility functions for consistency
      const calculatedDistance = Math.round(
        calculateDistance(userLoc, schoolLoc),
      );
      const withinRange = isWithinRadius(userLoc, schoolLoc, school.radius);

      setDistance(calculatedDistance);
      setIsWithinRange(withinRange);
      setLocationAccuracy(accuracy || null);

      // Enhanced validation logic
      const isHighAccuracy = !accuracy || accuracy <= 20; // 20 meters or better
      const isReasonableDistance = calculatedDistance <= school.radius * 1.5; // Allow some buffer

      return {
        distance: calculatedDistance,
        withinRange,
        accuracy: accuracy || null,
        isHighAccuracy,
        isReasonableDistance,
        isValidForCheckIn: withinRange && isHighAccuracy,
      };
    },
    [school.radius],
  );

  // Enhanced location acquisition with retry logic
  const getCurrentLocation = useCallback(
    async (retryAttempt = 0) => {
      setIsGettingLocation(true);
      setLocationError(null);
      setLocationAttempts(retryAttempt + 1);

      try {
        // Enhanced location options for better accuracy
        const locationOptions = {
          enableHighAccuracy: true,
          timeout: retryAttempt > 0 ? 15000 : 10000, // Longer timeout on retries
          maximumAge: retryAttempt > 0 ? 30000 : 60000, // Allow cached location on retries
        };

        const location =
          await locationService.getCurrentLocation(locationOptions);
        setUserLocation(location);

        // Validate location against school coordinates
        const schoolCoords = {
          latitude: school.gpsCoordinates.latitude,
          longitude: school.gpsCoordinates.longitude,
        };

        const validation = validateLocation(
          location,
          schoolCoords,
          location.accuracy,
        );

        // If location is not accurate enough and we haven't retried much, try again
        if (!validation.isHighAccuracy && retryAttempt < 2) {
          setLocationError(
            "Location accuracy is low. Trying to get a more accurate position...",
          );
          await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
          return getCurrentLocation(retryAttempt + 1);
        }

        if (onLocationUpdate) {
          onLocationUpdate(location);
        }

        return location;
      } catch (error: any) {
        // Enhanced error handling with retry logic
        if (
          (error.code === 3 || error.message?.includes("timeout")) &&
          retryAttempt < 2
        ) {
          setLocationError(
            "Location timeout. Retrying with adjusted settings...",
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return getCurrentLocation(retryAttempt + 1);
        }

        let errorMessage = "Failed to get your location";
        if (error.code === 1) {
          errorMessage =
            "Location access denied. Please enable location permissions and try again.";
        } else if (error.code === 2) {
          errorMessage =
            "Location unavailable. Please check your device's location settings.";
        } else if (error.code === 3) {
          errorMessage =
            "Location timeout. Please ensure you have a clear view of the sky if outdoors.";
        }

        setLocationError(errorMessage);
        setUserLocation(null);
        setIsWithinRange(null);
        setDistance(null);
        setLocationAccuracy(null);
        throw error;
      } finally {
        setIsGettingLocation(false);
      }
    },
    [school.gpsCoordinates, validateLocation, onLocationUpdate],
  );

  // Enhanced check-in process with location verification
  const handleCheckIn = useCallback(async () => {
    if (!user) {
      setLocationError("You must be logged in to check in");
      return;
    }

    setIsVerifyingLocation(true);
    setLocationAttempts(0);

    try {
      // Get location with enhanced validation
      const location = await getCurrentLocation();

      // Additional validation before showing dialog
      const schoolCoords = {
        latitude: school.gpsCoordinates.latitude,
        longitude: school.gpsCoordinates.longitude,
      };

      const validation = validateLocation(
        location,
        schoolCoords,
        location.accuracy,
      );

      if (!validation.isReasonableDistance) {
        setLocationError(
          `You appear to be ${validation.distance}m from ${school.name}. ` +
            "Please ensure you are at the correct school location.",
        );
        return;
      }

      // Show confirmation dialog with all validation info
      setShowConfirmDialog(true);
    } catch (error) {
      // Location error already set in getCurrentLocation
    } finally {
      setIsVerifyingLocation(false);
    }
  }, [
    user,
    getCurrentLocation,
    school.gpsCoordinates,
    school.name,
    validateLocation,
  ]);

  // Enhanced check-in confirmation with final validation
  const confirmCheckIn = useCallback(async () => {
    if (!user || !userLocation) return;

    try {
      // Final location validation before check-in
      const schoolCoords = {
        latitude: school.gpsCoordinates.latitude,
        longitude: school.gpsCoordinates.longitude,
      };

      const finalValidation = validateLocation(
        userLocation,
        schoolCoords,
        userLocation.accuracy,
      );

      if (!finalValidation.withinRange) {
        setLocationError(
          "Location verification failed. You must be within the school's check-in radius.",
        );
        return;
      }

      // Enhanced session data with validation info
      const sessionData = {
        schoolId: school.id,
        location: userLocation,
        accuracy: locationAccuracy,
        distance: distance,
        attempts: locationAttempts,
        userId: user.uid,
      };

      await checkIn(sessionData.schoolId, sessionData.location);

      // Reset all state after successful check-in
      setShowConfirmDialog(false);
      setUserLocation(null);
      setIsWithinRange(null);
      setDistance(null);
      setLocationAccuracy(null);
      setLocationAttempts(0);
      setLocationError(null);
    } catch (error: any) {
      setLocationError(error.message || "Failed to check in");
    }
  }, [
    user,
    userLocation,
    school.id,
    school.gpsCoordinates,
    checkIn,
    locationAccuracy,
    distance,
    locationAttempts,
    validateLocation,
  ]);

  // Enhanced check-out process with location verification
  const handleCheckOut = useCallback(async () => {
    if (!user || !currentSessionId) {
      setLocationError("Invalid session for check out");
      return;
    }

    setIsVerifyingLocation(true);

    try {
      const location = await getCurrentLocation();

      // Validate check-out location (less strict than check-in)
      const schoolCoords = {
        latitude: school.gpsCoordinates.latitude,
        longitude: school.gpsCoordinates.longitude,
      };

      const validation = validateLocation(
        location,
        schoolCoords,
        location.accuracy,
      );

      // Allow check-out even if slightly outside radius (within 2x radius)
      const checkOutRadius = school.radius * 2;
      const isValidForCheckOut = validation.distance <= checkOutRadius;

      if (!isValidForCheckOut) {
        const confirmCheckOut = window.confirm(
          `You are ${validation.distance}m from ${school.name}, which is outside the usual check-out area. ` +
            "Do you want to proceed with check-out anyway?",
        );

        if (!confirmCheckOut) {
          return;
        }
      }

      await checkOut(currentSessionId, location);

      // Reset state after successful check-out
      setUserLocation(null);
      setIsWithinRange(null);
      setDistance(null);
      setLocationAccuracy(null);
      setLocationAttempts(0);
      setLocationError(null);
    } catch (error: any) {
      setLocationError(error.message || "Failed to check out");
    } finally {
      setIsVerifyingLocation(false);
    }
  }, [
    user,
    currentSessionId,
    getCurrentLocation,
    checkOut,
    school.gpsCoordinates,
    school.name,
    school.radius,
    validateLocation,
  ]);

  // Format distance for display
  const formatDistance = (distanceInMeters: number): string => {
    if (distanceInMeters < 1000) {
      return `${distanceInMeters}m away`;
    }
    return `${(distanceInMeters / 1000).toFixed(1)}km away`;
  };

  // Get location status color and text
  const getLocationStatus = () => {
    if (isWithinRange === null) return null;

    if (isWithinRange) {
      return {
        color: "bg-green-100 text-green-800 border-green-200",
        icon: CheckCircle,
        text: "Within range",
      };
    } else {
      return {
        color: "bg-red-100 text-red-800 border-red-200",
        icon: AlertCircle,
        text: "Outside range",
      };
    }
  };

  const locationStatus = getLocationStatus();
  const isLoading = isGettingLocation || sessionLoading || isVerifyingLocation;

  return (
    <>
      <div className={`space-y-3 ${className}`}>
        {/* Location Error Alert */}
        {locationError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{locationError}</AlertDescription>
          </Alert>
        )}

        {/* Check In/Out Button */}
        <Button
          onClick={isCheckedIn ? handleCheckOut : handleCheckIn}
          disabled={isLoading}
          size="lg"
          className={`w-full h-12 font-semibold ${
            isCheckedIn
              ? "bg-red-600 hover:bg-red-700"
              : "bg-[#154690] hover:bg-[#0f3a7a]"
          }`}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          ) : isCheckedIn ? (
            <Clock className="h-5 w-5 mr-2" />
          ) : (
            <MapPin className="h-5 w-5 mr-2" />
          )}

          {isGettingLocation
            ? `Getting location... (${locationAttempts}/3)`
            : isVerifyingLocation
              ? "Verifying location..."
              : sessionLoading
                ? isCheckedIn
                  ? "Checking out..."
                  : "Checking in..."
                : isCheckedIn
                  ? "Check Out"
                  : "Check In"}
        </Button>

        {/* Enhanced Location Status Display */}
        {userLocation && locationStatus && (
          <div className="space-y-2">
            <Badge
              variant="outline"
              className={`w-full justify-center py-2 ${locationStatus.color}`}
            >
              <locationStatus.icon className="h-4 w-4 mr-1" />
              {locationStatus.text}
              {distance !== null && ` • ${formatDistance(distance)}`}
            </Badge>

            {/* Location accuracy indicator */}
            {locationAccuracy && (
              <div className="text-xs text-center">
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full ${
                    locationAccuracy <= 10
                      ? "bg-green-100 text-green-800"
                      : locationAccuracy <= 20
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                  }`}
                >
                  GPS Accuracy: ±{Math.round(locationAccuracy)}m
                </span>
              </div>
            )}

            <div className="text-xs text-gray-600 text-center">
              Required within {school.radius}m of {school.name}
            </div>
          </div>
        )}

        {/* Enhanced GPS Info */}
        <div className="flex items-center justify-center text-xs text-gray-500 gap-1">
          <Navigation className="h-3 w-3" />
          <span>
            Uses GPS for location verification
            {locationAttempts > 0 && ` (Attempt ${locationAttempts}/3)`}
          </span>
        </div>
      </div>

      {/* Check-in Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-[#154690]" />
              Confirm Check-In
            </DialogTitle>
            <DialogDescription>
              Please confirm your check-in at {school.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* School Information */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="font-medium text-gray-900">{school.name}</div>
              <div className="text-sm text-gray-600 mt-1">{school.address}</div>
            </div>

            {/* Location Status */}
            {locationStatus && userLocation && (
              <div className="space-y-3">
                <Badge
                  variant="outline"
                  className={`w-full justify-center py-2 ${locationStatus.color}`}
                >
                  <locationStatus.icon className="h-4 w-4 mr-1" />
                  {locationStatus.text}
                  {distance !== null && ` • ${formatDistance(distance)}`}
                </Badge>

                {/* Enhanced validation alerts */}
                {!isWithinRange && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      You are currently {distance}m from {school.name}, which is
                      outside the allowed check-in radius of {school.radius}m.
                      Please move closer to the school location to check in.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Low accuracy warning */}
                {isWithinRange && locationAccuracy && locationAccuracy > 20 && (
                  <Alert className="border-yellow-200 bg-yellow-50">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800">
                      GPS accuracy is low (±{Math.round(locationAccuracy)}m).
                      For best results, ensure you have a clear view of the sky
                      and try moving to an open area.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Success for within range with good accuracy */}
                {isWithinRange &&
                  (!locationAccuracy || locationAccuracy <= 20) && (
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        Location verified! You are within the allowed check-in
                        radius with good GPS accuracy. Ready to check in!
                      </AlertDescription>
                    </Alert>
                  )}

                {/* Moderate accuracy but within range */}
                {isWithinRange &&
                  locationAccuracy &&
                  locationAccuracy > 20 &&
                  locationAccuracy <= 50 && (
                    <Alert className="border-blue-200 bg-blue-50">
                      <CheckCircle className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800">
                        You are within the check-in radius, but GPS accuracy
                        could be better. Check-in is allowed but location
                        precision is ±{Math.round(locationAccuracy)}m.
                      </AlertDescription>
                    </Alert>
                  )}
              </div>
            )}

            {/* Current coordinates display */}
            {userLocation && (
              <div className="text-xs text-gray-500 text-center">
                Your location: {userLocation.latitude.toFixed(6)},{" "}
                {userLocation.longitude.toFixed(6)}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmCheckIn}
              disabled={
                !isWithinRange ||
                sessionLoading ||
                (locationAccuracy && locationAccuracy > 100)
              }
              className="bg-[#154690] hover:bg-[#0f3a7a]"
            >
              {sessionLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              {sessionLoading ? "Checking In..." : "Confirm Check-In"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CheckInButton;
