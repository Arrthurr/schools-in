"use client";

import { useState } from "react";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Users,
  MapPin,
  Calendar,
  ToggleLeft,
  ToggleRight,
  Download,
  Archive,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ErrorState,
  EmptyState,
  CompactErrorState,
  NetworkStatus,
} from "../ui/error-empty-states";

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
  isActive: boolean;
  activeProviders?: number;
  totalSessions?: number;
  lastSessionDate?: Date;
  assignedProviders?: string[];
}

interface SchoolListTableProps {
  schools: School[];
  onEdit: (school: School) => void;
  onDelete: (schoolId: string) => void;
  onToggleActive: (schoolId: string, isActive: boolean) => void;
  onAssignProviders: (schoolId: string) => void;
  isLoading?: boolean;
}

export function SchoolListTable({
  schools,
  onEdit,
  onDelete,
  onToggleActive,
  onAssignProviders,
  isLoading = false,
}: SchoolListTableProps) {
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const handleViewDetails = (school: School) => {
    setSelectedSchool(school);
    setIsDetailModalOpen(true);
  };

  const handleToggleActive = (school: School) => {
    onToggleActive(school.id, !school.isActive);
  };

  const getStatusBadge = (school: School) => {
    if (!school.isActive) {
      return <Badge variant="secondary">Inactive</Badge>;
    }

    const providerCount = school.assignedProviders?.length || 0;
    if (providerCount === 0) {
      return <Badge variant="outline">No Providers</Badge>;
    }

    return <Badge variant="default">Active</Badge>;
  };

  const formatDate = (date?: Date) => {
    if (!date) return "Never";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  const exportToCSV = () => {
    const headers = [
      "Name",
      "Address",
      "Latitude",
      "Longitude",
      "Radius (m)",
      "Status",
      "Assigned Providers",
      "Total Sessions",
      "Last Session",
      "Created Date",
    ];

    const csvData = schools.map((school) => [
      school.name,
      school.address,
      school.latitude,
      school.longitude,
      school.radius,
      school.isActive ? "Active" : "Inactive",
      school.assignedProviders?.length || 0,
      school.totalSessions || 0,
      school.lastSessionDate ? formatDate(school.lastSessionDate) : "Never",
      formatDate(school.createdAt),
    ]);

    const csvContent = [headers, ...csvData]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `schools-export-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>School</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Providers</TableHead>
              <TableHead>Sessions</TableHead>
              <TableHead>Last Activity</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (schools.length === 0) {
    return (
      <EmptyState
        type="schools"
        title="No schools found"
        message="No schools match your current filters. Try adjusting your search criteria or add new schools to get started."
        actionLabel="Clear Filters"
        onAction={() => {
          // This would be passed from parent component to clear filters
          console.log("Clear filters action - implement in parent component");
        }}
      />
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Export Controls */}
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-600">
            Showing {schools.length} schools
          </p>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Schools Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Providers</TableHead>
                <TableHead>Sessions</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schools.map((school) => (
                <TableRow key={school.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{school.name}</div>
                      <div className="text-sm text-gray-600 truncate max-w-[200px]">
                        {school.description || "No description"}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="truncate max-w-[200px]">
                        {school.address}
                      </div>
                      <div className="text-gray-500 font-mono text-xs">
                        {school.latitude.toFixed(4)},{" "}
                        {school.longitude.toFixed(4)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(school)}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span>{school.assignedProviders?.length || 0}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span>{school.totalSessions || 0}</span>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {formatDate(school.lastSessionDate)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>

                        <DropdownMenuItem
                          onClick={() => handleViewDetails(school)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>

                        <DropdownMenuItem onClick={() => onEdit(school)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit School
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => onAssignProviders(school.id)}
                        >
                          <Users className="h-4 w-4 mr-2" />
                          Assign Providers
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                          onClick={() => handleToggleActive(school)}
                        >
                          {school.isActive ? (
                            <>
                              <Archive className="h-4 w-4 mr-2" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <Undo2 className="h-4 w-4 mr-2" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                          onClick={() => onDelete(school.id)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* School Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>School Details</DialogTitle>
            <DialogDescription>
              Detailed information about this school location
            </DialogDescription>
          </DialogHeader>

          {selectedSchool && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Basic Information</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Name:</span>
                      <span className="ml-2 font-medium">
                        {selectedSchool.name}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Status:</span>
                      <span className="ml-2">
                        {getStatusBadge(selectedSchool)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Check-in Radius:</span>
                      <span className="ml-2">{selectedSchool.radius}m</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Activity Statistics</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Assigned Providers:</span>
                      <span className="ml-2">
                        {selectedSchool.assignedProviders?.length || 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Sessions:</span>
                      <span className="ml-2">
                        {selectedSchool.totalSessions || 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Last Session:</span>
                      <span className="ml-2">
                        {formatDate(selectedSchool.lastSessionDate)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Location Information */}
              <div>
                <h4 className="font-medium mb-2">Location Information</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">Address:</span>
                    <span className="ml-2">{selectedSchool.address}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Coordinates:</span>
                    <span className="ml-2 font-mono">
                      {selectedSchool.latitude.toFixed(6)},{" "}
                      {selectedSchool.longitude.toFixed(6)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              {selectedSchool.description && (
                <div>
                  <h4 className="font-medium mb-2">Description</h4>
                  <p className="text-sm text-gray-600">
                    {selectedSchool.description}
                  </p>
                </div>
              )}

              {/* Timestamps */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <span className="text-gray-600 text-sm">Created:</span>
                  <span className="ml-2 text-sm">
                    {formatDate(selectedSchool.createdAt)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 text-sm">Last Updated:</span>
                  <span className="ml-2 text-sm">
                    {formatDate(selectedSchool.updatedAt)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
