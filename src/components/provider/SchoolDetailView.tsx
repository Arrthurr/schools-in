"use client";

import { useState, useEffect } from "react";
import { useLocation } from "../../lib/hooks/useLocation";
import {
  calculateDistance,
  isWithinRadius as isWithinRadiusCheck,
} from "../../lib/services/locationService";
import { Location } from "@/lib/firebase/types";

type School = Location;
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  MapPin,
  Navigation,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Phone,
  Mail,
  Globe,
  Calendar,
  Ruler,
  Target,
  X,
} from "lucide-react";
import { NavigationButton } from "../maps/NavigationButton";

interface SchoolDetailViewProps {
  school: School;
  onBack: () => void;
  onClose?: () => void;
  onCheckIn?: (school: School) => void;
  showCheckInButton?: boolean;
  className?: string;
}

export const SchoolDetailView: React.FC<SchoolDetailViewProps> = ({
  school,
  onBack,
  onClose,
  onCheckIn,
  showCheckInButton = false,
  className = "",
}) => {
  const { location, loading: locationLoading, getLocation } = useLocation();
  const [withinRadius, setWithinRadius] = useState<boolean | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  const getSchoolCoordinates = () => {
    const lat = school?.geo?.latitude ?? (school as any)?.latitude;
    const lng = school?.geo?.longitude ?? (school as any)?.longitude;
    if (typeof lat === "number" && typeof lng === "number") {
      return { lat, lng };
    }
    return null;
  };

  // Calculate distance and radius status when location is available
  useEffect(() => {
    const coords = getSchoolCoordinates();

    if (location && school && coords) {
      const calculatedDistance = calculateDistance(
        location.latitude,
        location.longitude,
        coords.lat,
        coords.lng
      );
      setDistance(calculatedDistance);

      const schoolWithGeo = {
        ...school,
        geo: {
          latitude: coords.lat,
          longitude: coords.lng,
        },
      } as Location;

      const insideRadius = isWithinRadiusCheck(
        location.latitude,
        location.longitude,
        schoolWithGeo
      );
      setWithinRadius(insideRadius);
    } else {
      setDistance(null);
      setWithinRadius(null);
    }
  }, [location, school]);

  // Format distance for display
  const formatDistance = (distance: number): string => {
    if (distance < 1000) {
      return `${Math.round(distance)}m`;
    } else {
      return `${(distance / 1000).toFixed(1)}km`;
    }
  };

  // Get status badge based on location
  const getLocationStatusBadge = () => {
    if (!location || withinRadius === null) {
      return (
        <Badge variant="secondary" className="bg-muted text-muted-foreground">
          <MapPin className="w-3 h-3 mr-1" />
          Location Unknown
        </Badge>
      );
    }

    if (withinRadius) {
      return (
        <Badge
          variant="secondary"
          className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
        >
          <CheckCircle className="w-3 h-3 mr-1" />
          In Check-in Range
        </Badge>
      );
    } else {
      return (
        <Badge
          variant="secondary"
          className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800"
        >
          <AlertCircle className="w-3 h-3 mr-1" />
          Outside Check-in Range
        </Badge>
      );
    }
  };

  // Handle check-in action
  const handleCheckIn = () => {
    if (onCheckIn && withinRadius) {
      onCheckIn(school);
    }
  };

  return (
    <div className={`bg-background ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b bg-muted/20">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
          <div className="h-6 w-px bg-border" />
          <h1 className="text-xl font-semibold text-foreground">{school.name}</h1>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* Status and Quick Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {getLocationStatusBadge()}
            
          </div>

          <div className="flex items-center gap-3">
            {!location && (
              <Button
                onClick={getLocation}
                disabled={locationLoading}
                size="sm"
                variant="outline"
              >
                {locationLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2" />
                ) : (
                  <Navigation className="h-4 w-4 mr-2" />
                )}
                Get Location
              </Button>
            )}

            {showCheckInButton && (
              <Button
                onClick={handleCheckIn}
                disabled={!location || !withinRadius}
                className="bg-primary hover:bg-primary/90"
              >
                <Clock className="h-4 w-4 mr-2" />
                Check In
              </Button>
            )}
          </div>
        </div>

        {/* Location Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <MapPin className="h-5 w-5 mr-2 text-brand-primary" />
              Location Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Address */}
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
              <div>
                <p className="font-medium text-foreground">Address</p>
                <p className="text-muted-foreground">
                  {school.address || "Address not available"}
                </p>
              </div>
            </div>

            {/* Coordinates */}
            <div className="flex items-start gap-3">
              <Target className="h-4 w-4 text-muted-foreground mt-1" />
              <div>
                <p className="font-medium text-foreground">GPS Coordinates</p>
                <p className="text-muted-foreground font-mono text-sm">
                  {(school.geo?.latitude ?? school.latitude ?? 0).toFixed(6)}, {(school.geo?.longitude ?? school.longitude ?? 0).toFixed(6)}
                </p>
              </div>
            </div>

            {/* Distance */}
            {distance !== null && (
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Navigation className="h-4 w-4 text-muted-foreground mt-1" />
                  <div>
                    <p className="font-medium text-foreground">Distance from You</p>
                    <p className="text-muted-foreground">{formatDistance(distance)}</p>
                  </div>
                </div>
                
                <NavigationButton
                  destination={{
                    lat: school.geo?.latitude ?? school.latitude ?? 0,
                    lng: school.geo?.longitude ?? school.longitude ?? 0,
                    address: school.address,
                    name: school.name
                  }}
                />
              </div>
            )}

            {/* Check-in Radius */}
            <div className="flex items-start gap-3">
              <Ruler className="h-4 w-4 text-muted-foreground mt-1" />
              <div>
                <p className="font-medium text-foreground">Check-in Radius</p>
                <p className="text-muted-foreground">{school.radius || 100} meters</p>
                <p className="text-xs text-muted-foreground mt-1">
                  You must be within this range to check in
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Phone className="h-5 w-5 mr-2 text-brand-primary" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Phone */}
            <div className="flex items-start gap-3">
              <Phone className="h-4 w-4 text-muted-foreground mt-1" />
              <div>
                <p className="font-medium text-foreground">Phone</p>
                <p className="text-muted-foreground">Not available</p>
              </div>
            </div>

            {/* Email */}
            <div className="flex items-start gap-3">
              <Mail className="h-4 w-4 text-muted-foreground mt-1" />
              <div>
                <p className="font-medium text-foreground">Email</p>
                <p className="text-muted-foreground">Not available</p>
              </div>
            </div>

            {/* Website */}
            <div className="flex items-start gap-3">
              <Globe className="h-4 w-4 text-muted-foreground mt-1" />
              <div>
                <p className="font-medium text-foreground">Website</p>
                <p className="text-muted-foreground">Not available</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Session Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Calendar className="h-5 w-5 mr-2 text-brand-primary" />
              Session Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-muted/20 rounded-lg">
                <p className="font-medium text-foreground mb-1">Current Status</p>
                <p className="text-muted-foreground">Not checked in</p>
              </div>
              <div className="p-3 bg-muted/20 rounded-lg">
                <p className="font-medium text-foreground mb-1">Last Visit</p>
                <p className="text-muted-foreground">Never</p>
              </div>
              <div className="p-3 bg-muted/20 rounded-lg">
                <p className="font-medium text-foreground mb-1">Total Sessions</p>
                <p className="text-muted-foreground">0</p>
              </div>
              <div className="p-3 bg-muted/20 rounded-lg">
                <p className="font-medium text-foreground mb-1">Total Hours</p>
                <p className="text-muted-foreground">0.0 hours</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location Help */}
        {!location && (
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-100 mb-1">
                    Location Services Required
                  </p>
                  <p className="text-amber-800 dark:text-amber-200 text-sm mb-3">
                    Enable location services to see your distance from this
                    school and enable check-in functionality.
                  </p>
                  <Button
                    onClick={getLocation}
                    disabled={locationLoading}
                    size="sm"
                    variant="outline"
                    className="border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                  >
                    {locationLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-600 dark:border-amber-400 mr-2" />
                    ) : (
                      <Navigation className="h-4 w-4 mr-2" />
                    )}
                    Enable Location
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Check-in Instructions */}
        {location && !withinRadius && showCheckInButton && (
          <Card className="status-brand border">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-brand-primary mt-0.5" />
                <div>
                  <p className="font-medium text-brand-primary mb-1">
                    Move Closer to Check In
                  </p>
                  <p className="text-brand-primary/80 text-sm">
                    You need to be within {school.radius || 100} meters of the
                    school to check in. You're currently{" "}
                    {distance && formatDistance(distance)} away.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SchoolDetailView;
