"use client";

import { useState, useEffect } from "react";
import { Metadata } from "next";
import { Plus, Search, MapPin, Edit, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminNavigation } from "@/components/admin/AdminNavigation";
import { SchoolForm } from "@/components/admin/SchoolForm";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface School {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  activeProviders?: number;
  totalSessions?: number;
}

interface SchoolFormData {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius: number;
  description: string;
}

function SchoolManagementContent() {
  const [schools, setSchools] = useState<School[]>([]);
  const [filteredSchools, setFilteredSchools] = useState<School[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock data based on schools.json structure
  const mockSchools: School[] = [
    {
      id: "1",
      name: "Walter Payton College Preparatory High School",
      address: "1034 N Wells St, Chicago, IL 60610",
      latitude: 41.899441,
      longitude: -87.633997,
      radius: 100,
      description: "High-performing selective enrollment high school",
      createdAt: new Date("2024-01-15"),
      updatedAt: new Date("2024-01-15"),
      activeProviders: 3,
      totalSessions: 45,
    },
    {
      id: "2", 
      name: "Jones College Prep High School",
      address: "700 S State St, Chicago, IL 60605",
      latitude: 41.871431,
      longitude: -87.627683,
      radius: 150,
      description: "Selective enrollment high school in the South Loop",
      createdAt: new Date("2024-01-20"),
      updatedAt: new Date("2024-01-20"),
      activeProviders: 2,
      totalSessions: 32,
    },
    {
      id: "3",
      name: "Lane Tech College Prep High School", 
      address: "2501 W Addison St, Chicago, IL 60618",
      latitude: 41.947068,
      longitude: -87.693497,
      radius: 120,
      description: "Large selective enrollment high school",
      createdAt: new Date("2024-01-25"),
      updatedAt: new Date("2024-01-25"),
      activeProviders: 5,
      totalSessions: 78,
    },
  ];

  useEffect(() => {
    // Simulate loading schools from API
    const loadSchools = async () => {
      setIsLoading(true);
      try {
        // In a real app, this would be an API call
        await new Promise(resolve => setTimeout(resolve, 500));
        setSchools(mockSchools);
        setFilteredSchools(mockSchools);
      } catch (error) {
        setError("Failed to load schools");
      } finally {
        setIsLoading(false);
      }
    };

    loadSchools();
  }, []);

  useEffect(() => {
    // Filter schools based on search query
    if (!searchQuery.trim()) {
      setFilteredSchools(schools);
      return;
    }

    const filtered = schools.filter(school =>
      school.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      school.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      school.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredSchools(filtered);
  }, [searchQuery, schools]);

  const handleCreateSchool = async (data: SchoolFormData) => {
    try {
      setIsLoading(true);
      
      // In a real app, this would be an API call to create the school
      const newSchool: School = {
        id: Date.now().toString(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        activeProviders: 0,
        totalSessions: 0,
      };

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      setSchools(prev => [...prev, newSchool]);
      setError(null);
    } catch (error) {
      throw new Error("Failed to create school");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateSchool = async (data: SchoolFormData) => {
    if (!editingSchool) return;

    try {
      setIsLoading(true);

      const updatedSchool: School = {
        ...editingSchool,
        ...data,
        updatedAt: new Date(),
      };

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      setSchools(prev =>
        prev.map(school =>
          school.id === editingSchool.id ? updatedSchool : school
        )
      );
      setEditingSchool(null);
      setError(null);
    } catch (error) {
      throw new Error("Failed to update school");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSchool = async (schoolId: string) => {
    if (!confirm("Are you sure you want to delete this school? This action cannot be undone.")) {
      return;
    }

    try {
      setIsLoading(true);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));

      setSchools(prev => prev.filter(school => school.id !== schoolId));
      setError(null);
    } catch (error) {
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
          <h1 className="text-3xl font-bold text-gray-900">School Management</h1>
          <p className="text-gray-600 mt-1">
            Manage school locations and their check-in settings for Title I providers.
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add School
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
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
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredSchools.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery ? "No schools found" : "No schools configured"}
            </h3>
            <p className="text-gray-600 mb-4">
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
          {filteredSchools.map((school) => (
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
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-1" />
                      <span>{school.activeProviders || 0} providers</span>
                    </div>
                    <div>
                      <span>{school.totalSessions || 0} sessions</span>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Check-in radius:</span>
                      <Badge variant="outline">{school.radius}m</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Coordinates:</span>
                      <span className="text-gray-900 font-mono text-xs">
                        {school.latitude.toFixed(4)}, {school.longitude.toFixed(4)}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  {school.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">
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
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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
