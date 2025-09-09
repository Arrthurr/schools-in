"use client";

import { useState, useEffect } from "react";
import { useLocation } from "../../lib/hooks/useLocation";
import { SchoolService, School } from "../../lib/services/schoolService";
import {
  Card,
  CardContent,
  CardDescription,
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
  Users,
  Ruler,
  Target,
  X,
} from "lucide-react";

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
  const [isWithinRadius, setIsWithinRadius] = useState<boolean | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  // Calculate distance and radius status when location is available
  useEffect(() => {
    if (location && school) {
      const calculatedDistance = SchoolService.calculateDistance(
        location.latitude,
        location.longitude,
        school.latitude,
        school.longitude
      );
      setDistance(calculatedDistance);

      const withinRadius = SchoolService.isWithinRadius(
        location.latitude,
        location.longitude,
        school
      );
      setIsWithinRadius(withinRadius);
    } else {
      setDistance(null);
      setIsWithinRadius(null);
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
    if (!location || isWithinRadius === null) {
      return (
        <Badge variant="secondary" className="bg-gray-100 text-gray-700">
          <MapPin className="w-3 h-3 mr-1" />
          Location Unknown
        </Badge>
      );
    }

    if (isWithinRadius) {
      return (
        <Badge
          variant="secondary"
          className="bg-green-100 text-green-700 border-green-200"
        >
          <CheckCircle className="w-3 h-3 mr-1" />
          In Check-in Range
        </Badge>
      );
    } else {
      return (
        <Badge
          variant="secondary"
          className="bg-yellow-100 text-yellow-700 border-yellow-200"
        >
          <AlertCircle className="w-3 h-3 mr-1" />
          Outside Check-in Range
        </Badge>
      );
    }
  };

  // Handle check-in action
  const handleCheckIn = () => {
    if (onCheckIn && isWithinRadius) {
      onCheckIn(school);
    }
  };

  return (
    <div className={`bg-white ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="hover:bg-gray-200"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
          <div className="h-6 w-px bg-gray-300" />
          <h1 className="text-xl font-semibold text-gray-900">{school.name}</h1>
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
            {school.isAssigned && (
              <Badge variant="default" className="bg-primary">
                <Users className="w-3 h-3 mr-1" />
                Assigned
              </Badge>
            )}
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
                disabled={!location || !isWithinRadius}
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
              <MapPin className="h-4 w-4 text-gray-500 mt-1" />
              <div>
                <p className="font-medium text-gray-900">Address</p>
                <p className="text-gray-600">
                  {school.address || "Address not available"}
                </p>
              </div>
            </div>

            {/* Coordinates */}
            <div className="flex items-start gap-3">
              <Target className="h-4 w-4 text-gray-500 mt-1" />
              <div>
                <p className="font-medium text-gray-900">GPS Coordinates</p>
                <p className="text-gray-600 font-mono text-sm">
                  {school.latitude.toFixed(6)}, {school.longitude.toFixed(6)}
                </p>
              </div>
            </div>

            {/* Distance */}
            {distance !== null && (
              <div className="flex items-start gap-3">
                <Navigation className="h-4 w-4 text-gray-500 mt-1" />
                <div>
                  <p className="font-medium text-gray-900">Distance from You</p>
                  <p className="text-gray-600">{formatDistance(distance)}</p>
                </div>
              </div>
            )}

            {/* Check-in Radius */}
            <div className="flex items-start gap-3">
              <Ruler className="h-4 w-4 text-gray-500 mt-1" />
              <div>
                <p className="font-medium text-gray-900">Check-in Radius</p>
                <p className="text-gray-600">{school.radius || 100} meters</p>
                <p className="text-xs text-gray-500 mt-1">
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
              <Phone className="h-4 w-4 text-gray-500 mt-1" />
              <div>
                <p className="font-medium text-gray-900">Phone</p>
                <p className="text-gray-600">Not available</p>
              </div>
            </div>

            {/* Email */}
            <div className="flex items-start gap-3">
              <Mail className="h-4 w-4 text-gray-500 mt-1" />
              <div>
                <p className="font-medium text-gray-900">Email</p>
                <p className="text-gray-600">Not available</p>
              </div>
            </div>

            {/* Website */}
            <div className="flex items-start gap-3">
              <Globe className="h-4 w-4 text-gray-500 mt-1" />
              <div>
                <p className="font-medium text-gray-900">Website</p>
                <p className="text-gray-600">Not available</p>
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
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium text-gray-900 mb-1">Current Status</p>
                <p className="text-gray-600">Not checked in</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium text-gray-900 mb-1">Last Visit</p>
                <p className="text-gray-600">Never</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium text-gray-900 mb-1">Total Sessions</p>
                <p className="text-gray-600">0</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium text-gray-900 mb-1">Total Hours</p>
                <p className="text-gray-600">0.0 hours</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location Help */}
        {!location && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900 mb-1">
                    Location Services Required
                  </p>
                  <p className="text-amber-800 text-sm mb-3">
                    Enable location services to see your distance from this
                    school and enable check-in functionality.
                  </p>
                  <Button
                    onClick={getLocation}
                    disabled={locationLoading}
                    size="sm"
                    variant="outline"
                    className="border-amber-300 text-amber-900 hover:bg-amber-100"
                  >
                    {locationLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-600 mr-2" />
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
        {location && !isWithinRadius && showCheckInButton && (
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
