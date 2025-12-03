"use client";

import { useState, useEffect } from "react";
import { Plus, Search, MapPin, Edit, Trash2, Users, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminNavigation } from "@/components/admin/AdminNavigation";
import { SchoolForm } from "@/components/admin/SchoolForm";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CachedSchoolService } from "@/lib/services/cachedSchoolService";

type SchoolRecord = Awaited<
  ReturnType<typeof CachedSchoolService.getAllSchools>
>[number];

interface School extends Omit<SchoolRecord, "createdAt" | "updatedAt"> {
  createdAt?: Date;
  updatedAt?: Date;
  description?: string;
  totalSessions?: number;
  activeProviders?: number;
}

interface SchoolFormData {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius: number;
  description: string;
}

interface GeoPoint {
  latitude: number;
  longitude: number;
}

function mapSchool(raw: School): School {
  const geoPoint = raw.geo as GeoPoint | undefined;

  const latitude =
    raw.latitude ?? (geoPoint ? geoPoint.latitude : undefined);
  const longitude =
    raw.longitude ?? (geoPoint ? geoPoint.longitude : undefined);

  return {
    ...raw,
    radius: raw.radius ?? raw.radiusMeters ?? 100,
    latitude,
    longitude,
    description:
      raw.description || (raw as any)?.metadata?.description || "",
    activeProviders:
      raw.assignedProviders?.length ?? 0,
  };
}

function SchoolManagementContent() {
  const [schools, setSchools] = useState<School[]>([]);
  const [filteredSchools, setFilteredSchools] = useState<School[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSchools = async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      const data = await CachedSchoolService.getAllSchools(
        {},
        { 
          orderBy: { field: "name", direction: "asc" }, 
          limit: 200,
          forceRefresh 
        }
      );

      const normalized = (data as School[]).map(mapSchool);
      setSchools(normalized);
      setFilteredSchools(normalized);
      setError(null);
    } catch (err) {
      console.error("Failed to load schools", err);
      setError("Failed to load schools");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadInitialData = async () => {
      if (!cancelled) {
        await loadSchools();
      }
    };

    loadInitialData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Filter schools based on search query
    if (!searchQuery.trim()) {
      setFilteredSchools(schools);
      return;
    }

    const filtered = schools.filter(
      (school) =>
        school.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        school.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        school.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredSchools(filtered);
  }, [searchQuery, schools]);

  const handleCreateSchool = async (data: SchoolFormData) => {
    try {
      setIsLoading(true);

      const payload = {
        name: data.name,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        radiusMeters: data.radius,
        metadata: { description: data.description },
      } as const;

      const newId = await CachedSchoolService.createSchool(payload);
      const created = await CachedSchoolService.getSchoolById(newId, {
        forceRefresh: true,
      });

      if (created) {
        setSchools((prev) => [...prev, mapSchool(created as School)]);
        setFilteredSchools((prev) => [...prev, mapSchool(created as School)]);
      }

      setError(null);
    } catch (error) {
      console.error("Failed to create school", error);
      throw new Error("Failed to create school");
    } finally {
      setIsLoading(false);
      setIsFormOpen(false);
    }
  };

  const handleUpdateSchool = async (data: SchoolFormData) => {
    if (!editingSchool) return;

    try {
      setIsLoading(true);

      const payload = {
        name: data.name,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        radiusMeters: data.radius,
        metadata: { description: data.description },
      } as const;

      await CachedSchoolService.updateSchool(editingSchool.id, payload);

      const refreshed = await CachedSchoolService.getSchoolById(
        editingSchool.id,
        { forceRefresh: true }
      );

      if (refreshed) {
        const mapped = mapSchool(refreshed as School);
        setSchools((prev) =>
          prev.map((school) => (school.id === editingSchool.id ? mapped : school))
        );
        setFilteredSchools((prev) =>
          prev.map((school) => (school.id === editingSchool.id ? mapped : school))
        );
      }

      setEditingSchool(null);
      setError(null);
    } catch (error) {
      console.error("Failed to update school", error);
      throw new Error("Failed to update school");
    } finally {
      setIsLoading(false);
      setIsFormOpen(false);
    }
  };

  const handleDeleteSchool = async (schoolId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this school? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      setIsLoading(true);

      await CachedSchoolService.deleteSchool(schoolId);

      setSchools((prev) => prev.filter((school) => school.id !== schoolId));
      setFilteredSchools((prev) =>
        prev.filter((school) => school.id !== schoolId)
      );
      setError(null);
    } catch (error) {
      console.error("Failed to delete school", error);
      setError("Failed to delete school");
    } finally {
      setIsLoading(false);
    }
  };

  const openEditForm = (school: School) => {
    setEditingSchool(school);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingSchool(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            School Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage school locations and their check-in settings for Title I
            providers.
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => loadSchools(true)}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add School
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search schools by name, address, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Schools Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredSchools.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {searchQuery ? "No schools found" : "No schools configured"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery
                ? "Try adjusting your search criteria."
                : "Add your first school location to get started."}
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsFormOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First School
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSchools.map((school) => {
            const radiusMeters = school.radius ?? 100;
            const providerCount = school.activeProviders ?? 0;

            return (
              <Card key={school.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg font-semibold truncate">
                      {school.name}
                    </CardTitle>
                    <CardDescription className="flex items-center mt-1">
                      <MapPin className="h-3 w-3 mr-1 shrink-0" />
                      <span className="truncate">{school.address}</span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-3">
                  {/* Stats */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-1" />
                      <span>{providerCount} providers</span>
                    </div>
                    <div>
                      <span>{school.totalSessions || 0} sessions</span>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Check-in radius:</span>
                      <Badge variant="outline">{radiusMeters}m</Badge>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Coordinates:</span>
                        <span className="text-muted-foreground font-mono text-xs">
                        {typeof school.latitude === "number"
                          ? school.latitude.toFixed(4)
                          : "--"}
                        ,
                        {typeof school.longitude === "number"
                          ? school.longitude.toFixed(4)
                          : "--"}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  {school.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                      {school.description}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditForm(school)}
                      className="flex-1"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteSchool(school.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  aria-label={`Delete ${school.name}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      {/* School Form Modal */}
      <SchoolForm
        school={editingSchool || undefined}
        isOpen={isFormOpen}
        onClose={closeForm}
        onSubmit={editingSchool ? handleUpdateSchool : handleCreateSchool}
        isLoading={isLoading}
      />
    </div>
  );
}

export default function SchoolManagementPage() {
  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminNavigation>
        <SchoolManagementContent />
      </AdminNavigation>
    </ProtectedRoute>
  );
}
