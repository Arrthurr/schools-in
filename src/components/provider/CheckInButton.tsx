"use client";

import { useState, useCallback, useEffect } from "react";
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
  Wifi,
  WifiOff,
  Target,
} from "lucide-react";
import { useAuth } from "../../lib/hooks/useAuth";
import { useSession } from "../../lib/hooks/useSession";
import {
  locationService,
  isWithinRadius,
  calculateDistance,
  Coordinates,
} from "../../lib/utils/location";
import { formatDuration } from "../../lib/utils/session";
import { SessionTimerDisplay } from "./SessionTimerDisplay";

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
    currentSession,
  } = useSession();

  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCheckOutDialog, setShowCheckOutDialog] = useState(false);
  const [isWithinRange, setIsWithinRange] = useState<boolean | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [locationAttempts, setLocationAttempts] = useState(0);
  const [isVerifyingLocation, setIsVerifyingLocation] = useState(false);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [sessionDuration, setSessionDuration] = useState<number | null>(null);

  // Enhanced loading states for GPS operations
  const [gpsOperationPhase, setGpsOperationPhase] = useState<
    | "idle"
    | "requesting-permission"
    | "getting-location"
    | "validating"
    | "complete"
  >("idle");
  const [gpsProgress, setGpsProgress] = useState(0);
  const [locationStatusMessage, setLocationStatusMessage] =
    useState<string>("");

  // Enhanced error handling with comprehensive failure scenarios
  const [locationErrorType, setLocationErrorType] = useState<
    | "permission-denied"
    | "unavailable"
    | "timeout"
    | "accuracy"
    | "network"
    | "hardware"
    | "unsupported"
    | "drift"
    | "spoofing"
    | null
  >(null);
  const [retryCount, setRetryCount] = useState(0);
  const [maxRetries] = useState(3);
  const [lastErrorTime, setLastErrorTime] = useState<number | null>(null);

  // Cleanup GPS states after operation completes
  useEffect(() => {
    if (gpsOperationPhase === "complete") {
      const timer = setTimeout(() => {
        setGpsOperationPhase("idle");
        setGpsProgress(0);
        setLocationStatusMessage("");
      }, 3000); // Clear status after 3 seconds

      return () => clearTimeout(timer);
    }
  }, [gpsOperationPhase]);

  // Enhanced error classification and recovery
  const classifyLocationError = useCallback(
    (
      error: GeolocationPositionError | { code?: number; message?: string },
      retryAttempt: number
    ) => {
      const now = Date.now();

      // Reset error type if it's been more than 30 seconds since last error
      if (lastErrorTime && now - lastErrorTime > 30000) {
        setLocationErrorType(null);
        setRetryCount(0);
      }

      setLastErrorTime(now);

      if (error.code === 1) {
        return {
          type: "permission-denied" as const,
          message:
            "Location access denied. Please enable location permissions in your browser settings and try again.",
          canRetry: false,
          showSettingsLink: true,
        };
      }

      if (error.code === 2) {
        // Check if this might be a hardware/network issue
        if (retryAttempt >= maxRetries - 1) {
          return {
            type: "hardware" as const,
            message:
              "GPS hardware appears unavailable. Please check your device's location settings and ensure GPS is enabled.",
            canRetry: false,
            showTroubleshooting: true,
          };
        }
        return {
          type: "unavailable" as const,
          message:
            "Location temporarily unavailable. This may be due to poor GPS signal or network issues.",
          canRetry: true,
          delay: 2000,
        };
      }

      if (error.code === 3 || error.message?.includes("timeout")) {
        if (retryAttempt >= maxRetries) {
          return {
            type: "timeout" as const,
            message:
              "Location request timed out after multiple attempts. You may be in an area with poor GPS coverage.",
            canRetry: false,
            allowManualOverride: true,
          };
        }
        return {
          type: "timeout" as const,
          message: `Location timeout (attempt ${retryAttempt + 1}/${
            maxRetries + 1
          }). Retrying with extended timeout...`,
          canRetry: true,
          delay: 1000 * (retryAttempt + 1), // Progressive delay
        };
      }

      // Handle network-related errors
      if (error.message?.includes("network") || !navigator.onLine) {
        return {
          type: "network" as const,
          message:
            "Network connection issue detected. Location services require internet connectivity.",
          canRetry: true,
          delay: 3000,
        };
      }

      // Handle unsupported browser
      if (!navigator.geolocation) {
        return {
          type: "unsupported" as const,
          message:
            "Geolocation is not supported by this browser. Please use a modern browser with location support.",
          canRetry: false,
          showBrowserInfo: true,
        };
      }

      return {
        type: "unavailable" as const,
        message: error.message || "An unexpected location error occurred.",
        canRetry: retryAttempt < maxRetries,
        delay: 1000,
      };
    },
    [lastErrorTime, maxRetries]
  );

  // Enhanced location validation with drift detection
  const detectLocationAnomalies = useCallback(
    (newLocation: Coordinates, previousLocation?: Coordinates) => {
      if (!previousLocation) return { isAnomalous: false };

      const distanceMoved = calculateDistance(newLocation, previousLocation);
      const timeDiff = lastErrorTime ? Date.now() - lastErrorTime : 1000;

      // Detect unrealistic movement speeds (> 100 m/s or sudden jumps)
      const speedMps = distanceMoved / (timeDiff / 1000);
      if (speedMps > 100) {
        return {
          isAnomalous: true,
          type: "drift" as const,
          reason: "Unrealistic movement speed detected",
        };
      }

      // Detect suspiciously perfect accuracy (potential spoofing)
      if (newLocation.accuracy && newLocation.accuracy < 1) {
        return {
          isAnomalous: true,
          type: "spoofing" as const,
          reason: "Unusually perfect GPS accuracy detected",
        };
      }

      return { isAnomalous: false };
    },
    [lastErrorTime]
  );

  // Enhanced location validation with accuracy checks
  const validateLocation = useCallback(
    (userLoc: Coordinates, schoolLoc: Coordinates, accuracy?: number) => {
      // Use the utility functions for consistency
      const calculatedDistance = Math.round(
        calculateDistance(userLoc, schoolLoc)
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
    [school.radius]
  );

  // Enhanced location acquisition with comprehensive error handling and recovery
  const getCurrentLocation = useCallback(
    async (retryAttempt = 0) => {
      setIsGettingLocation(true);
      setGpsOperationPhase("requesting-permission");
      setGpsProgress(10);
      setLocationStatusMessage("Requesting location permission...");
      setLocationErrorType(null);

      try {
        // Enhanced location options based on retry attempt and error history
        const locationOptions = {
          enableHighAccuracy: true,
          timeout:
            retryAttempt > 0
              ? Math.min(20000, 10000 + retryAttempt * 5000)
              : 10000,
          maximumAge:
            retryAttempt > 0
              ? Math.max(10000, 60000 - retryAttempt * 10000)
              : 60000,
        };

        setGpsOperationPhase("getting-location");
        setGpsProgress(30);
        setLocationStatusMessage("Getting your current location...");

        const location = await locationService.getCurrentLocation(
          locationOptions
        );

        // Detect location anomalies
        const anomalyCheck = detectLocationAnomalies(
          location,
          userLocation || undefined
        );
        if (anomalyCheck.isAnomalous && anomalyCheck.type) {
          setLocationErrorType(anomalyCheck.type);
          if (anomalyCheck.type === "drift") {
            setLocationError(
              "Location appears unstable. Please stay still and try again."
            );
          } else if (anomalyCheck.type === "spoofing") {
            setLocationError(
              "Location data appears suspicious. Please ensure GPS is enabled and not simulated."
            );
          }
          throw new Error("Location anomaly detected");
        }

        setGpsProgress(60);
        setLocationStatusMessage("Validating location accuracy...");
        setUserLocation(location);

        // Validate location against school coordinates
        const schoolCoords = {
          latitude: school.gpsCoordinates.latitude,
          longitude: school.gpsCoordinates.longitude,
        };

        setGpsOperationPhase("validating");
        setGpsProgress(80);

        const validation = validateLocation(
          location,
          schoolCoords,
          location.accuracy
        );

        setGpsProgress(100);
        setGpsOperationPhase("complete");
        setLocationStatusMessage("Location verified successfully!");

        // Reset error tracking on success
        setRetryCount(0);
        setLocationErrorType(null);

        // If location is not accurate enough and we haven't retried much, try again
        if (!validation.isHighAccuracy && retryAttempt < 2) {
          setLocationError(
            "Location accuracy is low. Trying to get a more accurate position..."
          );
          setGpsOperationPhase("getting-location");
          setGpsProgress(20);
          setLocationStatusMessage("Retrying for better accuracy...");
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return getCurrentLocation(retryAttempt + 1);
        }

        if (onLocationUpdate) {
          onLocationUpdate(location);
        }

        return location;
      } catch (error: unknown) {
        const err = error as GeolocationPositionError;
        const errorClassification = classifyLocationError(err, retryAttempt);

        setLocationErrorType(errorClassification.type);
        setRetryCount(retryAttempt + 1);

        // Enhanced error handling with recovery options
        if (errorClassification.canRetry && retryAttempt < maxRetries) {
          setLocationError(errorClassification.message);
          setGpsOperationPhase("getting-location");
          setGpsProgress(20);
          setLocationStatusMessage(
            `Retrying... (${retryAttempt + 1}/${maxRetries})`
          );

          if (errorClassification.delay) {
            await new Promise((resolve) =>
              setTimeout(resolve, errorClassification.delay)
            );
          }

          return getCurrentLocation(retryAttempt + 1);
        }

        // Final error after all retries exhausted
        let finalErrorMessage = errorClassification.message;

        if (errorClassification.allowManualOverride) {
          finalErrorMessage +=
            " Would you like to proceed with check-in anyway?";
        }

        if (errorClassification.showSettingsLink) {
          finalErrorMessage += " Check your browser's location settings.";
        }

        if (errorClassification.showTroubleshooting) {
          finalErrorMessage +=
            " Try restarting your device or checking for software updates.";
        }

        if (errorClassification.showBrowserInfo) {
          finalErrorMessage += " Consider using Chrome, Firefox, or Safari.";
        }

        setLocationError(finalErrorMessage);
        setUserLocation(null);
        setIsWithinRange(null);
        setDistance(null);
        setLocationAccuracy(null);
        setGpsOperationPhase("idle");
        setGpsProgress(0);
        setLocationStatusMessage("");
        throw error;
      } finally {
        setIsGettingLocation(false);
      }
    },
    [
      school.gpsCoordinates,
      validateLocation,
      onLocationUpdate,
      detectLocationAnomalies,
      userLocation,
      classifyLocationError,
      maxRetries,
    ]
  );

  // Enhanced check-in process with location verification
  const handleCheckIn = useCallback(async () => {
    if (!user) {
      setLocationError("You must be logged in to check in");
      setLocationErrorType("permission-denied"); // Use permission-denied for auth errors
      return;
    }

    setIsVerifyingLocation(true);
    setLocationAttempts(0);
    setLocationError(null);
    setGpsOperationPhase("idle");
    setGpsProgress(0);
    setLocationStatusMessage("");

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
        location.accuracy
      );

      if (!validation.isReasonableDistance) {
        setLocationError(
          `You appear to be ${validation.distance}m from ${school.name}. ` +
            "Please ensure you are at the correct school location."
        );
        return;
      }

      // Show confirmation dialog with all validation info
      setShowConfirmDialog(true);
    } catch {
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
        userLocation.accuracy
      );

      if (!finalValidation.withinRange) {
        setLocationError(
          "Location verification failed. You must be within the school's check-in radius."
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
      setGpsOperationPhase("idle");
      setGpsProgress(0);
      setLocationStatusMessage("");
    } catch (error: unknown) {
      setLocationError(
        error instanceof Error ? error.message : "Failed to check in"
      );
      setLocationErrorType("unavailable");
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

  // Enhanced check-out process with location verification and confirmation
  const handleCheckOut = useCallback(async () => {
    if (!user || !currentSessionId) {
      setLocationError("Invalid session for check out");
      setLocationErrorType("permission-denied"); // Use permission-denied for auth/session errors
      return;
    }

    setIsVerifyingLocation(true);
    setLocationAttempts(0);
    setLocationError(null);
    setGpsOperationPhase("idle");
    setGpsProgress(0);
    setLocationStatusMessage("");

    try {
      const location = await getCurrentLocation();

      // Validate check-out location (less strict than check-in)
      const schoolCoords = {
        latitude: school.gpsCoordinates.latitude,
        longitude: school.gpsCoordinates.longitude,
      };

      const _validation = validateLocation(
        location,
        schoolCoords,
        location.accuracy
      );

      // Calculate session duration if we have a current session
      if (currentSession?.checkInTime) {
        const now = new Date();
        const checkInMs = currentSession.checkInTime.toMillis();
        const duration = Math.round((now.getTime() - checkInMs) / (1000 * 60)); // in minutes
        setSessionDuration(duration);
      }

      // Show check-out confirmation dialog
      setShowCheckOutDialog(true);
    } catch {
      // Allow check-out even if location fails (user might be in a building)
      const confirmCheckOut = window.confirm(
        "Unable to verify your location. This might happen if you're indoors or GPS signal is poor. " +
          "Do you want to proceed with check-out anyway?"
      );

      if (confirmCheckOut) {
        setShowCheckOutDialog(true);
      }
    } finally {
      setIsVerifyingLocation(false);
    }
  }, [
    user,
    currentSessionId,
    getCurrentLocation,
    school.gpsCoordinates,
    school.name,
    school.radius,
    validateLocation,
  ]);

  // Confirm check-out with session completion
  const confirmCheckOut = useCallback(async () => {
    if (!user || !currentSessionId) return;

    try {
      // Use current location if available, or allow check-out without location
      const location = userLocation || {
        latitude: school.gpsCoordinates.latitude,
        longitude: school.gpsCoordinates.longitude,
        accuracy: undefined,
      };

      await checkOut(currentSessionId, location);

      // Reset all state after successful check-out
      setShowCheckOutDialog(false);
      setUserLocation(null);
      setIsWithinRange(null);
      setDistance(null);
      setLocationAccuracy(null);
      setLocationAttempts(0);
      setLocationError(null);
      setSessionDuration(null);
      setGpsOperationPhase("idle");
      setGpsProgress(0);
      setLocationStatusMessage("");
    } catch (error: unknown) {
      setLocationError(
        error instanceof Error ? error.message : "Failed to check out"
      );
      setLocationErrorType("unavailable");
    }
  }, [user, currentSessionId, userLocation, school.gpsCoordinates, checkOut]);

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

  // Error recovery component
  const ErrorRecoveryOptions = () => {
    if (!locationError || !locationErrorType) return null;

    const getRecoveryActions = () => {
      switch (locationErrorType) {
        case "permission-denied":
          return (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-muted-foreground">
                To enable location access:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Click the location icon in your browser's address bar</li>
                <li>Select "Allow" or "Always allow" for this site</li>
                <li>Refresh the page and try again</li>
              </ul>
            </div>
          );

        case "timeout":
          return (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-muted-foreground">
                Try these solutions:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Move to an open area with clear sky view</li>
                <li>Ensure GPS is enabled on your device</li>
                <li>Disable VPN if you're using one</li>
                <li>Try using a different device or browser</li>
              </ul>
              {retryCount >= maxRetries && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLocationError(null);
                    setLocationErrorType(null);
                    setRetryCount(0);
                    handleCheckIn();
                  }}
                  className="mt-2"
                >
                  Try Again
                </Button>
              )}
            </div>
          );

        case "hardware":
        case "unavailable":
          return (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-muted-foreground">
                Troubleshooting steps:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Enable location services in your device settings</li>
                <li>Ensure GPS is turned on</li>
                <li>Check if airplane mode is disabled</li>
                <li>Restart your device if the problem persists</li>
              </ul>
            </div>
          );

        case "network":
          return (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-muted-foreground">
                Network troubleshooting:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Check your internet connection</li>
                <li>Try switching between Wi-Fi and mobile data</li>
                <li>Disable VPN or proxy settings</li>
                <li>Contact your network administrator</li>
              </ul>
            </div>
          );

        case "drift":
          return (
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">
                GPS signal appears unstable. Please stay in one location and try
                again.
              </p>
            </div>
          );

        case "spoofing":
          return (
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">
                Location data appears suspicious. Please ensure you're using
                real GPS and not location simulation.
              </p>
            </div>
          );

        default:
          return (
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLocationError(null);
                  setLocationErrorType(null);
                  setRetryCount(0);
                  handleCheckIn();
                }}
              >
                Retry Location Check
              </Button>
            </div>
          );
      }
    };

    return (
      <div className="mt-4 p-4 bg-muted rounded-lg">
        <div className="flex items-start space-x-2">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-medium text-destructive">Location Error</h4>
            <p className="text-sm text-muted-foreground mt-1">
              {locationError}
            </p>
            {getRecoveryActions()}
          </div>
        </div>
      </div>
    );
  };

  const locationStatus = getLocationStatus();
  const isLoading = isGettingLocation || sessionLoading || isVerifyingLocation;

  // Session Timer Component
  const SessionTimer = () => {
    if (!isCheckedIn || !currentSession?.checkInTime) return null;

    return (
      <SessionTimerDisplay
        checkInTime={currentSession.checkInTime}
        isActive={true}
        className="w-full"
      />
    );
  };

  // GPS Status Indicator Component
  const GpsStatusIndicator = () => {
    if (gpsOperationPhase === "idle") return null;

    const getPhaseIcon = () => {
      switch (gpsOperationPhase) {
        case "requesting-permission":
          return <Wifi className="h-4 w-4 text-blue-500" />;
        case "getting-location":
          return <Navigation className="h-4 w-4 text-blue-500 animate-pulse" />;
        case "validating":
          return <Target className="h-4 w-4 text-yellow-500" />;
        case "complete":
          return <CheckCircle className="h-4 w-4 text-green-500" />;
        default:
          return <WifiOff className="h-4 w-4 text-gray-400" />;
      }
    };

    const getPhaseColor = () => {
      switch (gpsOperationPhase) {
        case "requesting-permission":
          return "bg-blue-100 border-blue-200";
        case "getting-location":
          return "bg-blue-100 border-blue-200";
        case "validating":
          return "bg-yellow-100 border-yellow-200";
        case "complete":
          return "bg-green-100 border-green-200";
        default:
          return "bg-gray-100 border-gray-200";
      }
    };

    return (
      <div className={`p-3 rounded-lg border ${getPhaseColor()}`}>
        <div className="flex items-center gap-2 mb-2">
          {getPhaseIcon()}
          <span className="font-medium text-sm">
            {locationStatusMessage || "GPS Operation in Progress"}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-in-out"
            style={{ width: `${gpsProgress}%` }}
          />
        </div>

        {/* Progress Text */}
        <div className="text-xs text-gray-600 text-center">
          {gpsProgress}% complete
        </div>
      </div>
    );
  };

  return (
    <>
      <div className={`space-y-3 ${className}`}>
        {/* Location Error Alert - Replaced with enhanced ErrorRecoveryOptions */}
        {/* <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{locationError}</AlertDescription>
        </Alert> */}

        {/* Enhanced Error Recovery Options */}
        <ErrorRecoveryOptions />

        {/* GPS Status Indicator */}
        <GpsStatusIndicator />

        {/* Live Session Timer */}
        <SessionTimer />

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
            ? `Check Out (${
                currentSession?.checkInTime
                  ? formatDuration(
                      Math.floor(
                        (Date.now() - currentSession.checkInTime.toMillis()) /
                          (1000 * 60)
                      )
                    )
                  : "0m"
              })`
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
            {gpsOperationPhase !== "idle"
              ? locationStatusMessage
              : "Uses GPS for location verification"}
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
                isWithinRange !== true ||
                sessionLoading ||
                (locationAccuracy !== null && locationAccuracy > 100)
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

      {/* Check-out Confirmation Dialog */}
      <Dialog open={showCheckOutDialog} onOpenChange={setShowCheckOutDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-red-600" />
              Confirm Check-Out
            </DialogTitle>
            <DialogDescription>
              Please confirm your check-out from {school.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* School Information */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="font-medium text-gray-900">{school.name}</div>
              <div className="text-sm text-gray-600 mt-1">{school.address}</div>
            </div>

            {/* Session Summary */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-900">
                  Session Summary
                </span>
              </div>
              <div className="text-sm text-blue-800">
                <div>You are about to end your session at {school.name}.</div>
                {sessionDuration ? (
                  <div className="mt-1">
                    Session duration: {formatDuration(sessionDuration)}
                  </div>
                ) : currentSession?.checkInTime ? (
                  <div className="mt-1">
                    Current session:{" "}
                    {formatDuration(
                      Math.floor(
                        (Date.now() - currentSession.checkInTime.toMillis()) /
                          (1000 * 60)
                      )
                    )}
                  </div>
                ) : null}
                {currentSession?.checkInTime && (
                  <div className="mt-1 text-xs">
                    Started:{" "}
                    {new Date(
                      currentSession.checkInTime.toMillis()
                    ).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>

            {/* Location Status for Check-out */}
            {userLocation && (
              <div className="space-y-2">
                {distance !== null && (
                  <div className="text-sm text-center text-gray-600">
                    Current distance from {school.name}:{" "}
                    {formatDistance(distance)}
                  </div>
                )}

                {/* Check-out location validation - more lenient */}
                {distance !== null && distance <= school.radius * 2 ? (
                  <div className="p-2 bg-green-50 rounded border border-green-200">
                    <div className="flex items-center gap-2 text-green-800">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm">Valid check-out location</span>
                    </div>
                  </div>
                ) : distance !== null && distance > school.radius * 2 ? (
                  <div className="p-2 bg-yellow-50 rounded border border-yellow-200">
                    <div className="flex items-center gap-2 text-yellow-800">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm">
                        You're outside the typical check-out area, but check-out
                        is still allowed
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* No location warning */}
            {!userLocation && (
              <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
                <div className="flex items-center gap-2 text-yellow-800">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">
                    Location verification failed, but you can still check out.
                    Your last known location will be used.
                  </span>
                </div>
              </div>
            )}

            {/* Current coordinates display if available */}
            {userLocation && (
              <div className="text-xs text-gray-500 text-center">
                Check-out location: {userLocation.latitude.toFixed(6)},{" "}
                {userLocation.longitude.toFixed(6)}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCheckOutDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmCheckOut}
              disabled={sessionLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {sessionLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              {sessionLoading ? "Checking Out..." : "Confirm Check-Out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CheckInButton;
