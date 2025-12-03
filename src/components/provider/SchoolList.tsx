"use client";

import { useState, useEffect, useId, useMemo, useCallback } from "react";
import { useAuth } from "../../lib/hooks/useAuth";
import { useLocation } from "../../lib/hooks/useLocation";
import { useSession } from "../../lib/hooks/useSession";

import { 
  getAssignedLocations, 
  calculateDistance as calcDistance,
  addDistances,
  sortByDistance 
} from "../../lib/services/locationService";
import { Location } from "@/lib/firebase/types";
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
// import {
//   useAnnouncement,
//   ScreenReaderOnly,
//   ARIA,
// } from "../../lib/accessibility";

type School = Location;

interface SchoolListProps {
  onSchoolSelect?: (school: School) => void;
  onSchoolDetail?: (school: School) => void;
  showCheckInButtons?: boolean;
  showDetailButtons?: boolean;
  className?: string;
  currentSessionLocationId?: string;
}

export const SchoolList: React.FC<SchoolListProps> = ({
  onSchoolSelect,
  onSchoolDetail,
  showCheckInButtons = false,
  showDetailButtons = true,
  className = "",
  currentSessionLocationId,
}) => {
  const { user } = useAuth();
  const { location, loading: locationLoading, getLocation } = useLocation();
  const { checkIn, currentSession, loading: sessionLoading } = useSession();

  const [schools, setSchools] = useState<School[]>([]);
  const [filteredSchools, setFilteredSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkingInSchoolId, setCheckingInSchoolId] = useState<string | null>(null);

  // Accessibility hooks
  // const { announce } = useAnnouncement();
  const announce = useCallback(() => {}, []);
  const ScreenReaderOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <span className="sr-only">{children}</span>
  );
  const searchInputId = useId();

  // Load assigned schools
  useEffect(() => {
    let isCancelled = false;
    
    const loadSchools = async () => {
      if (!user?.uid || isCancelled) return;
      
      // Only load once when we have a user and no schools yet
      if (schools.length > 0) {
        return;
      }

      const startTime = performance.now();
      setLoading(true);
      setError(null);

      try {
        const assignedLocations = await getAssignedLocations(user.uid);
        const loadTime = performance.now() - startTime;

        // Check if component is still mounted before updating state
        if (isCancelled) return;
        
        setSchools(assignedLocations);
        setFilteredSchools(assignedLocations);

        // Announce results to screen readers
        announce(`${assignedLocations.length} assigned schools loaded`, "polite");
      } catch (err) {
        const loadTime = performance.now() - startTime;
        console.error("Error loading schools:", err);
        const errorMessage = "Failed to load schools. Please try again.";

        // Check if component is still mounted before updating state
        if (isCancelled) return;
        
        setError(errorMessage);
        announce(`Error: ${errorMessage}`, "assertive");
      } finally {
        // Check if component is still mounted before updating state
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadSchools();

    // Cleanup function to mark component as cancelled
    return () => {
      isCancelled = true;
    };
  }, [user?.uid, announce, schools.length]);

  const displayedSchools = useMemo(() => {
    if (filteredSchools.length === 0) return [] as Array<School & { distance?: number }>;

    // Add distances if user location is available
    if (location) {
      const withDistances = addDistances(filteredSchools, location.latitude, location.longitude);
      return sortByDistance(withDistances);
    }

    return filteredSchools.map(school => ({ ...school, distance: undefined }));
  }, [filteredSchools, location]);

  // Handle search (client-side filtering)
  useEffect(() => {
    const filterSchools = () => {
      if (!searchQuery.trim()) {
        setFilteredSchools(schools);
        return;
      }

      const query = searchQuery.toLowerCase();
      const filtered = schools.filter(school => 
        school.name.toLowerCase().includes(query) ||
        school.address?.toLowerCase().includes(query)
      );

      setFilteredSchools(filtered);

      // Announce search results to screen readers
      announce(
        `${filtered.length} schools found for "${searchQuery}"`,
        "polite"
      );
    };

    const timeoutId = setTimeout(filterSchools, 300); // Debounce search
    return () => clearTimeout(timeoutId);
  }, [searchQuery, schools, announce]);

  const isWithinRadius = (school: School) => {
    if (!location || typeof school.distance !== "number") {
      return false;
    }
    const radius = school.radiusMeters ?? 100;
    return school.distance <= radius;
  };

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

    if (isWithinRadius(school)) {
      return (
        <Badge
          variant="secondary"
          className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
        >
          <CheckCircle className="w-3 h-3 mr-1" />
          In Range
        </Badge>
      );
    } else {
      return (
        <Badge
          variant="secondary"
          className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800"
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 lg:gap-6">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center text-lg sm:text-xl">
              <SchoolIcon className="mr-2 h-5 w-5 flex-shrink-0" />
              <span className="truncate md:whitespace-normal md:overflow-visible md:text-clip break-words">
                Assigned Schools
              </span>
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
            className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"
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
          {displayedSchools.length === 0 && searchQuery ? (
            <EmptyState
              type="search"
              title="No schools found"
              message={`No schools match "${searchQuery}". Try adjusting your search terms.`}
              actionLabel="Clear Search"
              onAction={() => setSearchQuery("")}
              showAction={true}
            />
          ) : (
            displayedSchools.map((school, index) => (
              <div
                key={school.id}
                className={`p-4 sm:p-5 border rounded-lg transition-colors ${
                  onSchoolSelect
                    ? "cursor-pointer hover:bg-accent/50 hover:border-brand-primary active:bg-accent"
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
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 lg:gap-8">
                  <div className="flex-1 min-w-0 md:pr-4 lg:pr-8">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 md:gap-3 mb-2">
                      <h4 className="font-medium text-foreground text-base sm:text-lg truncate md:whitespace-normal md:overflow-visible md:text-clip break-words">
                        {school.name}
                      </h4>
                      {getSchoolStatusBadge(school)}
                    </div>

                    <div className="flex items-start text-sm text-muted-foreground mb-3">
                      <MapPin
                        className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0"
                        aria-hidden="true"
                      />
                      <span className="break-words">
                        {school.address || "Address not available"}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
                      {typeof school.distance === "number" && (
                        <div className="flex items-center">
                          <Navigation className="h-4 w-4 mr-1 flex-shrink-0" />
                          <span>{formatDistance(school.distance)} away</span>
                        </div>
                      )}
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
                        <span>{school.radiusMeters ?? 100}m radius</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 sm:ml-4 lg:ml-6 w-full sm:w-auto flex-shrink-0">
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
                      (currentSession?.locationId === school.id || currentSessionLocationId === school.id) ? (
                        <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Checked In
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          disabled={!location || !isWithinRadius(school) || checkingInSchoolId === school.id || !!currentSession}
                          onClick={async () => {
                            if (!location) {
                              announce("Please enable location services to check in", "assertive");
                              return;
                            }
                            setCheckingInSchoolId(school.id);
                            try {
                              await checkIn(school.id, location);
                              announce(`Successfully checked in to ${school.name}`, "polite");
                            } catch (err: any) {
                              console.error("Check-in error:", err);
                              const errorMsg = err?.message || "Failed to check in. Please try again.";
                              announce(errorMsg, "assertive");
                              alert(`Check-in failed: ${errorMsg}`);
                            } finally {
                              setCheckingInSchoolId(null);
                            }
                          }}
                          className="btn-brand-primary touch-target w-full sm:w-auto"
                        >
                          {checkingInSchoolId === school.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Clock className="h-4 w-4 mr-2" />
                          )}
                          Check In
                        </Button>
                      )
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {displayedSchools.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm text-muted-foreground">
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
