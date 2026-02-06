"use client";

import { useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { GoogleMap } from "@/components/maps/GoogleMap";
import { NavigationButton } from "@/components/maps/NavigationButton";
import {
  MapPin,
  Clock,
  Navigation,
  CheckCircle,
  AlertCircle,
  Circle,
} from "lucide-react";
import type { LocationWithDistance } from "@/lib/services/locationService";

interface SchoolDetailSheetProps {
  school: LocationWithDistance | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userLocation?: { latitude: number; longitude: number } | null;
}

export function SchoolDetailSheet({
  school,
  open,
  onOpenChange,
  userLocation,
}: SchoolDetailSheetProps) {
  const isWithinRadius = useMemo(() => {
    if (!school || typeof school.distance !== "number") return false;
    const radius = school.radiusMeters ?? 500;
    return school.distance <= radius;
  }, [school]);

  const formatDistance = (distance?: number): string => {
    if (typeof distance !== "number") return "Unknown";
    if (distance < 1000) {
      return `${Math.round(distance)}m`;
    }
    return `${(distance / 1000).toFixed(1)}km`;
  };

  const schoolCoords = useMemo(() => {
    if (!school) return null;
    
    // Handle both geo (GeoPoint) and legacy latitude/longitude fields
    if (school.geo) {
      return {
        lat: school.geo.latitude,
        lng: school.geo.longitude,
      };
    }
    if (school.latitude && school.longitude) {
      return {
        lat: school.latitude,
        lng: school.longitude,
      };
    }
    return null;
  }, [school]);

  const mapMarkers = useMemo(() => {
    if (!schoolCoords) return [];

    const markers = [
      {
        id: "school",
        position: schoolCoords,
        title: school?.name || "School",
        info: school?.address || "",
      },
    ];

    if (userLocation) {
      markers.push({
        id: "user",
        position: {
          lat: userLocation.latitude,
          lng: userLocation.longitude,
        },
        title: "Your Location",
        info: isWithinRadius ? "Within check-in range" : "Outside check-in range",
      });
    }

    return markers;
  }, [schoolCoords, userLocation, school, isWithinRadius]);

  if (!school) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] sm:h-[80vh] overflow-y-auto rounded-t-xl">
        <SheetHeader className="text-left pb-4">
          <SheetTitle className="text-xl flex items-center gap-2">
            {school.name}
          </SheetTitle>
          <SheetDescription className="flex items-start gap-2">
            <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{school.address || "Address not available"}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Map Section */}
          {schoolCoords && (
            <div className="relative rounded-lg overflow-hidden border">
              <GoogleMap
                center={schoolCoords}
                zoom={16}
                markers={mapMarkers}
                className="h-48 sm:h-64 w-full"
              />
              {/* Geofence radius indicator overlay */}
              <div className="absolute bottom-2 left-2 bg-background/90 backdrop-blur-sm rounded-md px-2 py-1 text-xs flex items-center gap-1">
                <Circle className="h-3 w-3 text-blue-500" />
                <span>{school.radiusMeters ?? 500}m check-in zone</span>
              </div>
            </div>
          )}

          {/* Status & Distance */}
          <div className="flex flex-wrap items-center gap-3">
            {typeof school.distance === "number" ? (
              <>
                {isWithinRadius ? (
                  <Badge
                    variant="secondary"
                    className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
                  >
                    <CheckCircle className="w-3 h-3 mr-1" />
                    In Range
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800"
                  >
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Out of Range
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Navigation className="h-4 w-4" />
                  {formatDistance(school.distance)} away
                </span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">
                Enable location services to see distance
              </span>
            )}
          </div>

          {/* School Details */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Check-in Radius
              </p>
              <p className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-500" />
                {school.radiusMeters ?? 500} meters
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Timezone
              </p>
              <p className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                {school.timezone || "America/Chicago"}
              </p>
            </div>
          </div>

          {/* Navigation Action */}
          {schoolCoords && (
            <div className="pt-2">
              <NavigationButton
                destination={{
                  lat: schoolCoords.lat,
                  lng: schoolCoords.lng,
                  address: school.address,
                  name: school.name,
                }}
                className="w-full"
                size="lg"
              />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default SchoolDetailSheet;
