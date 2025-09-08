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

  // Load assigned schools
  useEffect(() => {
    const loadSchools = async () => {
      if (!user?.uid) return;

      setLoading(true);
      setError(null);

      try {
        const assignedSchools = await SchoolService.getAssignedSchools(
          user.uid,
        );
        setSchools(assignedSchools);
        setFilteredSchools(assignedSchools);
      } catch (err) {
        console.error("Error loading schools:", err);
        setError("Failed to load schools. Please try again.");
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
          user.uid,
        );
        setSchools(schoolsWithDistance);

        // Re-apply search filter if active
        if (searchQuery.trim()) {
          const filtered = await SchoolService.searchSchools(
            searchQuery,
            user.uid,
          );
          const filteredWithDistance = filtered.map((school) => {
            const schoolWithDistance = schoolsWithDistance.find(
              (s) => s.id === school.id,
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
          user.uid,
        );
        setFilteredSchools(filtered);
      } catch (err) {
        console.error("Error filtering schools:", err);
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
      school,
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
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-[#154690]" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center text-red-600">
            <AlertCircle className="mr-2 h-5 w-5" />
            Error
          </CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="w-full"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (schools.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <SchoolIcon className="mr-2 h-5 w-5" />
            Assigned Schools
          </CardTitle>
          <CardDescription>Your current school assignments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <SchoolIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-600">
              No schools assigned yet. Contact your administrator to get
              started.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <SchoolIcon className="mr-2 h-5 w-5" />
              Assigned Schools
            </CardTitle>
            <CardDescription>
              {schools.length} school{schools.length !== 1 ? "s" : ""} assigned
              {location && " • Location services active"}
            </CardDescription>
          </div>
          {!location && (
            <Button
              onClick={getLocation}
              disabled={locationLoading}
              size="sm"
              variant="outline"
            >
              {locationLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Navigation className="h-4 w-4 mr-2" />
              )}
              Get Location
            </Button>
          )}
        </div>

        {/* Search bar */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search schools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {filteredSchools.length === 0 && searchQuery ? (
            <div className="text-center py-4">
              <Search className="mx-auto h-8 w-8 text-gray-400 mb-2" />
              <p className="text-gray-600">
                No schools found matching "{searchQuery}"
              </p>
            </div>
          ) : (
            filteredSchools.map((school) => (
              <div
                key={school.id}
                className={`p-4 border rounded-lg transition-colors ${
                  onSchoolSelect
                    ? "cursor-pointer hover:bg-gray-50 hover:border-[#154690]"
                    : ""
                }`}
                onClick={() => handleSchoolClick(school)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-gray-900">
                        {school.name}
                      </h4>
                      {getSchoolStatusBadge(school)}
                    </div>

                    <div className="flex items-center text-sm text-gray-600 mb-2">
                      <MapPin className="h-4 w-4 mr-1" />
                      <span>{school.address || "Address not available"}</span>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      {typeof school.distance === "number" && (
                        <div className="flex items-center">
                          <Navigation className="h-4 w-4 mr-1" />
                          <span>{formatDistance(school.distance)} away</span>
                        </div>
                      )}
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 mr-1" />
                        <span>{school.radius || 100}m radius</span>
                      </div>
                    </div>
                  </div>

                  <div className="ml-4 flex gap-2">
                    {showDetailButtons && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => handleSchoolDetail(school, e)}
                      >
                        View Details
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
                              school,
                            ))
                        }
                        className="bg-[#154690] hover:bg-[#0f3a7a]"
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
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>
                Showing {filteredSchools.length} of {schools.length} schools
              </span>
              {location && (
                <span className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
                  Location active
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
