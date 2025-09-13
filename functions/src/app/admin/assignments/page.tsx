"use client";

import { useState, useEffect } from "react";
import {
  Users,
  School,
  Search,
  Plus,
  Minus,
  UserPlus,
  UserMinus,
  Download,
  Filter,
  CheckSquare,
  Square,
  MoreVertical,
  MapPin,
  Calendar,
  AlertCircle,
  Check,
  X,
} from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminNavigation } from "@/components/admin/AdminNavigation";
import { AssignmentModal } from "@/components/admin/AssignmentModal";
import {
  getSchoolAssignments,
  getAssignmentStats,
  getAvailableProviders,
  getUnassignedProviders,
  assignProviderToSchool,
  removeProviderFromSchool,
  bulkAssignProvidersToSchool,
  bulkRemoveProvidersFromSchool,
  replaceSchoolAssignments,
  SchoolAssignment,
  AssignmentStats,
  ProviderAssignment,
} from "@/lib/services/assignmentService";
import { UserRecord } from "@/lib/services/userService";

function AssignmentManagementContent() {
  const [assignments, setAssignments] = useState<SchoolAssignment[]>([]);
  const [filteredAssignments, setFilteredAssignments] = useState<
    SchoolAssignment[]
  >([]);
  const [stats, setStats] = useState<AssignmentStats>({
    totalSchools: 0,
    schoolsWithProviders: 0,
    schoolsWithoutProviders: 0,
    totalAssignments: 0,
    activeProviders: 0,
  });
  const [availableProviders, setAvailableProviders] = useState<UserRecord[]>(
    []
  );
  const [unassignedProviders, setUnassignedProviders] = useState<UserRecord[]>(
    []
  );
  const [selectedSchools, setSelectedSchools] = useState<Set<string>>(
    new Set()
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState<
    "all" | "assigned" | "unassigned"
  >("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedSchoolForAssignment, setSelectedSchoolForAssignment] =
    useState<SchoolAssignment | null>(null);

  useEffect(() => {
    loadAssignments();
  }, []);

  useEffect(() => {
    filterAssignments();
  }, [assignments, searchTerm, assignmentFilter]);

  const loadAssignments = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [assignmentsData, statsData, providersData, unassignedData] =
        await Promise.all([
          getSchoolAssignments(),
          getAssignmentStats(),
          getAvailableProviders(),
          getUnassignedProviders(),
        ]);

      setAssignments(assignmentsData);
      setStats(statsData);
      setAvailableProviders(providersData);
      setUnassignedProviders(unassignedData);
    } catch (error) {
      console.error("Error loading assignments:", error);
      setError("Failed to load assignments. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const filterAssignments = () => {
    let filtered = [...assignments];

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (assignment) =>
          assignment.schoolName.toLowerCase().includes(searchLower) ||
          assignment.schoolAddress.toLowerCase().includes(searchLower) ||
          assignment.assignedProviders.some(
            (provider) =>
              provider.displayName.toLowerCase().includes(searchLower) ||
              provider.userEmail.toLowerCase().includes(searchLower)
          )
      );
    }

    // Apply assignment filter
    if (assignmentFilter !== "all") {
      filtered = filtered.filter((assignment) =>
        assignmentFilter === "assigned"
          ? assignment.totalProviders > 0
          : assignment.totalProviders === 0
      );
    }

    setFilteredAssignments(filtered);
  };

  const handleSchoolSelection = (schoolId: string, checked: boolean) => {
    const newSelected = new Set(selectedSchools);
    if (checked) {
      newSelected.add(schoolId);
    } else {
      newSelected.delete(schoolId);
    }
    setSelectedSchools(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedSchools.size === filteredAssignments.length) {
      setSelectedSchools(new Set());
    } else {
      setSelectedSchools(
        new Set(filteredAssignments.map((assignment) => assignment.schoolId))
      );
    }
  };

  const handleAssignProvider = async (schoolId: string, providerId: string) => {
    try {
      await assignProviderToSchool(providerId, schoolId);
      await loadAssignments(); // Reload data
    } catch (error) {
      console.error("Error assigning provider:", error);
      setError("Failed to assign provider");
    }
  };

  const handleRemoveProvider = async (schoolId: string, providerId: string) => {
    try {
      await removeProviderFromSchool(providerId, schoolId);
      await loadAssignments(); // Reload data
    } catch (error) {
      console.error("Error removing provider:", error);
      setError("Failed to remove provider");
    }
  };

  const handleOpenAssignmentModal = (assignment: SchoolAssignment) => {
    setSelectedSchoolForAssignment(assignment);
    setShowAssignmentModal(true);
  };

  const exportToCSV = () => {
    const csvContent = [
      [
        "School Name",
        "School Address",
        "Total Providers",
        "Assigned Providers",
        "Status",
      ].join(","),
      ...filteredAssignments.map((assignment) =>
        [
          assignment.schoolName,
          assignment.schoolAddress,
          assignment.totalProviders,
          assignment.assignedProviders.map((p) => p.displayName).join("; "),
          assignment.isActive ? "Active" : "Inactive",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `school-assignments-${
      new Date().toISOString().split("T")[0]
    }.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">School-Provider Assignments</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">School-Provider Assignments</h1>
          <p className="text-muted-foreground">
            Manage which providers are assigned to which schools
          </p>
        </div>
        <Button onClick={() => setShowAssignmentModal(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Bulk Assignment
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-gray-900">
            {stats.totalSchools}
          </div>
          <div className="text-sm text-gray-600">Total Schools</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-green-600">
            {stats.schoolsWithProviders}
          </div>
          <div className="text-sm text-gray-600">With Providers</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-red-600">
            {stats.schoolsWithoutProviders}
          </div>
          <div className="text-sm text-gray-600">No Providers</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-blue-600">
            {stats.totalAssignments}
          </div>
          <div className="text-sm text-gray-600">Total Assignments</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-purple-600">
            {stats.activeProviders}
          </div>
          <div className="text-sm text-gray-600">Active Providers</div>
        </div>
      </div>

      {/* Unassigned Providers Alert */}
      {unassignedProviders.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <span className="font-medium">
              {unassignedProviders.length} providers
            </span>{" "}
            are not assigned to any schools:
            <span className="ml-2">
              {unassignedProviders
                .slice(0, 3)
                .map((p) => p.displayName)
                .join(", ")}
              {unassignedProviders.length > 3 &&
                ` +${unassignedProviders.length - 3} more`}
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center space-x-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search schools or providers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <select
            value={assignmentFilter}
            onChange={(e) => setAssignmentFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Schools</option>
            <option value="assigned">With Providers</option>
            <option value="unassigned">No Providers</option>
          </select>

          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedSchools.size > 0 && (
        <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-blue-900">
              {selectedSchools.size} schools selected
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                /* TODO: Implement bulk assignment */
              }}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Bulk Assign
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedSchools(new Set())}
          >
            Clear Selection
          </Button>
        </div>
      )}

      {/* Assignments List */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              School Assignments ({filteredAssignments.length})
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="flex items-center"
            >
              {selectedSchools.size === filteredAssignments.length ? (
                <CheckSquare className="h-4 w-4 mr-2" />
              ) : (
                <Square className="h-4 w-4 mr-2" />
              )}
              Select All
            </Button>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {filteredAssignments.map((assignment) => (
            <div key={assignment.schoolId} className="p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4 flex-1">
                  <input
                    type="checkbox"
                    checked={selectedSchools.has(assignment.schoolId)}
                    onChange={(e) =>
                      handleSchoolSelection(
                        assignment.schoolId,
                        e.target.checked
                      )
                    }
                    className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-lg font-medium text-gray-900">
                        {assignment.schoolName}
                      </h3>
                      <Badge
                        variant={assignment.isActive ? "default" : "secondary"}
                      >
                        {assignment.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Badge
                        variant={
                          assignment.totalProviders > 0
                            ? "default"
                            : "destructive"
                        }
                      >
                        {assignment.totalProviders} providers
                      </Badge>
                    </div>

                    <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                      <span className="flex items-center">
                        <MapPin className="h-3 w-3 mr-1" />
                        {assignment.schoolAddress}
                      </span>
                      <span className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        Updated{" "}
                        {assignment.lastUpdated
                          ?.toDate?.()
                          ?.toLocaleDateString() || "Unknown"}
                      </span>
                    </div>

                    {/* Assigned Providers */}
                    {assignment.assignedProviders.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700">
                          Assigned Providers:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {assignment.assignedProviders.map((provider) => (
                            <div
                              key={provider.userId}
                              className="flex items-center space-x-1 bg-blue-50 px-2 py-1 rounded-lg"
                            >
                              <span className="text-sm font-medium text-blue-900">
                                {provider.displayName}
                              </span>
                              <Badge
                                variant={
                                  provider.isActive ? "default" : "secondary"
                                }
                                className="text-xs"
                              >
                                {provider.isActive ? "Active" : "Inactive"}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 text-red-600 hover:text-red-700"
                                onClick={() =>
                                  handleRemoveProvider(
                                    assignment.schoolId,
                                    provider.userId
                                  )
                                }
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 italic">
                        No providers assigned to this school
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenAssignmentModal(assignment)}
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Manage
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {filteredAssignments.length === 0 && (
            <div className="p-8 text-center">
              <School className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                No schools found matching your criteria
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Assignment Modal */}
      <AssignmentModal
        isOpen={showAssignmentModal}
        onClose={() => {
          setShowAssignmentModal(false);
          setSelectedSchoolForAssignment(null);
        }}
        onSave={loadAssignments}
        school={selectedSchoolForAssignment}
        availableProviders={availableProviders}
      />
    </div>
  );
}

export default function AssignmentManagementPage() {
  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminNavigation>
        <AssignmentManagementContent />
      </AdminNavigation>
    </ProtectedRoute>
  );
}
