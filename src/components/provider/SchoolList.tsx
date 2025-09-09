"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../lib/hooks/useAuth";
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
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import {
  MapPin,
  School as SchoolIcon,
  Navigation,
  Search,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { SkeletonCard, SkeletonList } from "../ui/skeleton";
import { LoadingSpinner } from "../ui/loading";
import { ErrorState, EmptyState } from "../ui/error-empty-states";
import {
  useAnnouncement,
  ScreenReaderOnly,
  ARIA,
} from "../../lib/accessibility";

interface SchoolListProps {
  onSchoolSelect?: (school: School) => void;
  onSchoolDetail?: (school: School) => void;
  showCheckInButtons?: boolean;
  showDetailButtons?: boolean;
  className?: string;
}

export const SchoolList: React.FC<SchoolListProps> = ({
  onSchoolSelect,
  onSchoolDetail,
  showCheckInButtons = false,
  showDetailButtons = true,
  className = "",
}) => {
  const { user } = useAuth();
  const { location, loading: locationLoading, getLocation } = useLocation();
  const [schools, setSchools] = useState<School[]>([]);
  const [filteredSchools, setFilteredSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Accessibility hooks
  const { announce } = useAnnouncement();
  const searchInputId = ARIA.useId("school-search");

  // Load assigned schools
  useEffect(() => {
    const loadSchools = async () => {
      if (!user?.uid) return;

      setLoading(true);
      setError(null);

      try {
        const assignedSchools = await SchoolService.getAssignedSchools(
          user.uid
        );
        setSchools(assignedSchools);
        setFilteredSchools(assignedSchools);

        // Announce results to screen readers
        announce(`${assignedSchools.length} assigned schools loaded`, "polite");
      } catch (err) {
        console.error("Error loading schools:", err);
        const errorMessage = "Failed to load schools. Please try again.";
        setError(errorMessage);
        announce(`Error: ${errorMessage}`, "assertive");
      } finally {
        setLoading(false);
      }
    };

    loadSchools();
  }, [user?.uid]);

  // Update schools with distance when location is available
  useEffect(() => {
    const updateSchoolsWithDistance = async () => {
      if (!location || !user?.uid) return;

      try {
        const schoolsWithDistance = await SchoolService.getSchoolsWithDistance(
          location.latitude,
          location.longitude,
          user.uid
        );
        setSchools(schoolsWithDistance);

        // Re-apply search filter if active
        if (searchQuery.trim()) {
          const filtered = await SchoolService.searchSchools(
            searchQuery,
            user.uid
          );
          const filteredWithDistance = filtered.map((school) => {
            const schoolWithDistance = schoolsWithDistance.find(
              (s) => s.id === school.id
            );
            return schoolWithDistance || school;
          });
          setFilteredSchools(filteredWithDistance);
        } else {
          setFilteredSchools(schoolsWithDistance);
        }
      } catch (err) {
        console.error("Error updating schools with distance:", err);
      }
    };

    updateSchoolsWithDistance();
  }, [location, user?.uid, searchQuery]);

  // Handle search
  useEffect(() => {
    const filterSchools = async () => {
      if (!user?.uid) return;

      try {
        const filtered = await SchoolService.searchSchools(
          searchQuery,
          user.uid
        );
        setFilteredSchools(filtered);

        // Announce search results to screen readers
        if (searchQuery.trim()) {
          announce(
            `${filtered.length} schools found for "${searchQuery}"`,
            "polite"
          );
        }
      } catch (err) {
        console.error("Error filtering schools:", err);
        announce("Error filtering schools", "assertive");
      }
    };

    const timeoutId = setTimeout(filterSchools, 300); // Debounce search
    return () => clearTimeout(timeoutId);
  }, [searchQuery, user?.uid]);

  // Format distance for display
  const formatDistance = (distance?: number): string => {
    if (typeof distance !== "number") return "";

    if (distance < 1000) {
      return `${Math.round(distance)}m`;
    } else {
      return `${(distance / 1000).toFixed(1)}km`;
    }
  };

  // Get status badge for school based on distance
  const getSchoolStatusBadge = (school: School) => {
    if (!location || typeof school.distance !== "number") {
      return null;
    }

    const withinRadius = SchoolService.isWithinRadius(
      location.latitude,
      location.longitude,
      school
    );

    if (withinRadius) {
      return (
        <Badge
          variant="secondary"
          className="bg-green-100 text-green-700 border-green-200"
        >
          <CheckCircle className="w-3 h-3 mr-1" />
          In Range
        </Badge>
      );
    } else {
      return (
        <Badge
          variant="secondary"
          className="bg-yellow-100 text-yellow-700 border-yellow-200"
        >
          <AlertCircle className="w-3 h-3 mr-1" />
          Out of Range
        </Badge>
      );
    }
  };

  // Handle school selection
  const handleSchoolClick = (school: School) => {
    if (onSchoolSelect) {
      onSchoolSelect(school);
    }
  };

  // Handle school detail view
  const handleSchoolDetail = (school: School, event: React.MouseEvent) => {
    event.stopPropagation();
    if (onSchoolDetail) {
      onSchoolDetail(school);
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <SchoolIcon className="mr-2 h-5 w-5" />
            Assigned Schools
          </CardTitle>
          <CardDescription>Loading your school assignments...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SkeletonList items={3} showAvatar={false} />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <ErrorState
        type="generic"
        title="Failed to load schools"
        message={error}
        onAction={() => window.location.reload()}
        actionLabel="Reload"
        className={className}
      />
    );
  }

  if (schools.length === 0) {
    return (
      <EmptyState
        type="schools"
        title="No schools assigned"
        message="You don't have any schools assigned yet. Contact your administrator to get access to schools."
        actionLabel="Contact Support"
        onAction={() => window.open("mailto:support@example.com", "_blank")}
        className={className}
      />
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center text-lg sm:text-xl">
              <SchoolIcon className="mr-2 h-5 w-5 flex-shrink-0" />
              <span className="truncate">Assigned Schools</span>
            </CardTitle>
            <CardDescription className="mt-1">
              {schools.length} school{schools.length !== 1 ? "s" : ""} assigned
              {location && (
                <span className="inline-flex items-center ml-2">
                  <span className="hidden sm:inline">
                    {" "}
                    • Location services active
                  </span>
                  <CheckCircle className="h-4 w-4 ml-1 text-green-600 sm:hidden" />
                </span>
              )}
            </CardDescription>
          </div>
          {!location && (
            <Button
              onClick={getLocation}
              disabled={locationLoading}
              size="sm"
              variant="outline"
              className="touch-target flex-shrink-0 w-full sm:w-auto micro-scale"
              aria-label={
                locationLoading
                  ? "Getting your location..."
                  : "Enable location services to see distances to schools"
              }
            >
              {locationLoading ? (
                <LoadingSpinner size="sm" variant="secondary" />
              ) : (
                <Navigation className="h-4 w-4 mr-2" aria-hidden="true" />
              )}
              <span className="sm:hidden">
                {locationLoading ? "Getting Location..." : "Enable Location"}
              </span>
              <span className="hidden sm:inline">
                {locationLoading ? "Getting..." : "Get Location"}
              </span>
            </Button>
          )}
        </div>

        {/* Search bar with better mobile UX */}
        <div className="relative">
          <label htmlFor={searchInputId} className="sr-only">
            Search schools
          </label>
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400"
            aria-hidden="true"
          />
          <Input
            id={searchInputId}
            placeholder="Search schools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 touch-target text-base sm:text-sm"
            aria-label="Search schools by name or location"
            aria-describedby={
              filteredSchools.length > 0
                ? `${searchInputId}-results`
                : undefined
            }
          />
          <ScreenReaderOnly>
            <div id={`${searchInputId}-results`} aria-live="polite">
              {searchQuery && `${filteredSchools.length} schools found`}
            </div>
          </ScreenReaderOnly>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {filteredSchools.length === 0 && searchQuery ? (
            <EmptyState
              type="search"
              title="No schools found"
              message={`No schools match "${searchQuery}". Try adjusting your search terms.`}
              actionLabel="Clear Search"
              onAction={() => setSearchQuery("")}
              showAction={true}
            />
          ) : (
            filteredSchools.map((school, index) => (
              <div
                key={school.id}
                className={`p-4 sm:p-5 border rounded-lg transition-colors ${
                  onSchoolSelect
                    ? "cursor-pointer hover:bg-gray-50 hover:border-brand-primary active:bg-gray-100"
                    : ""
                }`}
                onClick={() => handleSchoolClick(school)}
                role={onSchoolSelect ? "button" : "article"}
                tabIndex={onSchoolSelect ? 0 : undefined}
                aria-label={
                  onSchoolSelect ? `Select ${school.name}` : undefined
                }
                onKeyDown={(e) => {
                  if (onSchoolSelect && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    handleSchoolClick(school);
                  }
                }}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                      <h4 className="font-medium text-gray-900 text-base sm:text-lg truncate">
                        {school.name}
                      </h4>
                      {getSchoolStatusBadge(school)}
                    </div>

                    <div className="flex items-start text-sm text-gray-600 mb-3">
                      <MapPin
                        className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0"
                        aria-hidden="true"
                      />
                      <span className="break-words">
                        {school.address || "Address not available"}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-500">
                      {typeof school.distance === "number" && (
                        <div className="flex items-center">
                          <Navigation className="h-4 w-4 mr-1 flex-shrink-0" />
                          <span>{formatDistance(school.distance)} away</span>
                        </div>
                      )}
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
                        <span>{school.radius || 100}m radius</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 sm:ml-4 w-full sm:w-auto">
                    {showDetailButtons && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => handleSchoolDetail(school, e)}
                        className="touch-target w-full sm:w-auto"
                      >
                        <span className="sm:hidden">Details</span>
                        <span className="hidden sm:inline">View Details</span>
                      </Button>
                    )}
                    {showCheckInButtons && (
                      <Button
                        size="sm"
                        disabled={
                          !location ||
                          (typeof school.distance === "number" &&
                            !SchoolService.isWithinRadius(
                              location?.latitude || 0,
                              location?.longitude || 0,
                              school
                            ))
                        }
                        className="btn-brand-primary touch-target w-full sm:w-auto"
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        Check In
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {filteredSchools.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm text-gray-500">
              <span>
                Showing {filteredSchools.length} of {schools.length} school
                {schools.length !== 1 ? "s" : ""}
              </span>
              {location && (
                <span className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
                  <span className="hidden sm:inline">Location active</span>
                  <span className="sm:hidden">GPS active</span>
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SchoolList;
