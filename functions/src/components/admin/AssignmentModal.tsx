"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Search,
  Users,
  UserPlus,
  UserMinus,
  Check,
  X,
  AlertCircle,
  Mail,
  Calendar,
} from "lucide-react";
import { LoadingButton, LoadingOverlay } from "@/components/ui/loading";
import { SkeletonList } from "@/components/ui/skeleton";
import {
  ErrorState,
  EmptyState,
  CompactEmptyState,
} from "@/components/ui/error-empty-states";
import {
  SchoolAssignment,
  replaceSchoolAssignments,
  assignProviderToSchool,
  removeProviderFromSchool,
} from "@/lib/services/assignmentService";
import { UserRecord } from "@/lib/services/userService";

interface AssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  school: SchoolAssignment | null;
  availableProviders: UserRecord[];
}

export function AssignmentModal({
  isOpen,
  onClose,
  onSave,
  school,
  availableProviders,
}: AssignmentModalProps) {
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(
    new Set()
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredProviders, setFilteredProviders] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"replace" | "add" | "remove">("replace");

  useEffect(() => {
    if (school && isOpen) {
      // Initialize with currently assigned providers
      const currentlyAssigned = new Set(
        school.assignedProviders.map((p) => p.userId)
      );
      setSelectedProviders(currentlyAssigned);
    }
  }, [school, isOpen]);

  useEffect(() => {
    filterProviders();
  }, [availableProviders, searchTerm]);

  const filterProviders = () => {
    let filtered = [...availableProviders];

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (provider) =>
          provider.displayName?.toLowerCase().includes(searchLower) ||
          provider.email?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredProviders(filtered);
  };

  const handleProviderToggle = (providerId: string) => {
    const newSelected = new Set(selectedProviders);
    if (newSelected.has(providerId)) {
      newSelected.delete(providerId);
    } else {
      newSelected.add(providerId);
    }
    setSelectedProviders(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedProviders.size === filteredProviders.length) {
      setSelectedProviders(new Set());
    } else {
      setSelectedProviders(new Set(filteredProviders.map((p) => p.id)));
    }
  };

  const handleSave = async () => {
    if (!school) return;

    try {
      setIsLoading(true);
      setError(null);

      if (mode === "replace") {
        // Replace all assignments for this school
        await replaceSchoolAssignments(
          school.schoolId,
          Array.from(selectedProviders)
        );
      } else {
        // Handle individual additions/removals
        const currentlyAssigned = new Set(
          school.assignedProviders.map((p) => p.userId)
        );

        if (mode === "add") {
          // Add new providers
          for (const providerId of Array.from(selectedProviders)) {
            if (!currentlyAssigned.has(providerId)) {
              await assignProviderToSchool(providerId, school.schoolId);
            }
          }
        } else if (mode === "remove") {
          // Remove providers
          for (const providerId of Array.from(selectedProviders)) {
            if (currentlyAssigned.has(providerId)) {
              await removeProviderFromSchool(providerId, school.schoolId);
            }
          }
        }
      }

      onSave();
      onClose();
    } catch (error) {
      console.error("Error saving assignments:", error);
      setError("Failed to save assignments. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const getProviderName = (providerId: string) => {
    const provider = availableProviders.find((p) => p.id === providerId);
    return provider?.displayName || "Unknown Provider";
  };

  const getProviderEmail = (providerId: string) => {
    const provider = availableProviders.find((p) => p.id === providerId);
    return provider?.email || "";
  };

  const isProviderCurrentlyAssigned = (providerId: string) => {
    return (
      school?.assignedProviders.some((p) => p.userId === providerId) || false
    );
  };

  const getAssignmentCount = () => {
    if (mode === "replace") {
      return selectedProviders.size;
    } else if (mode === "add") {
      const currentlyAssigned = new Set(
        school?.assignedProviders.map((p) => p.userId) || []
      );
      const newAssignments = Array.from(selectedProviders).filter(
        (id) => !currentlyAssigned.has(id)
      );
      return (school?.assignedProviders.length || 0) + newAssignments.length;
    } else if (mode === "remove") {
      const currentlyAssigned = new Set(
        school?.assignedProviders.map((p) => p.userId) || []
      );
      const toRemove = Array.from(selectedProviders).filter((id) =>
        currentlyAssigned.has(id)
      );
      return Math.max(
        0,
        (school?.assignedProviders.length || 0) - toRemove.length
      );
    }
    return school?.assignedProviders.length || 0;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Manage Providers for {school?.schoolName || "School"}
          </DialogTitle>
          <DialogDescription>
            Assign or remove providers from this school. Currently has{" "}
            {school?.totalProviders || 0} providers assigned.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Mode Selection */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assignment Mode
            </label>
            <div className="flex space-x-2">
              <Button
                variant={mode === "replace" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("replace")}
              >
                Replace All
              </Button>
              <Button
                variant={mode === "add" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("add")}
              >
                Add Providers
              </Button>
              <Button
                variant={mode === "remove" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("remove")}
              >
                Remove Providers
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {mode === "replace" &&
                "Replace all current assignments with selected providers"}
              {mode === "add" &&
                "Add selected providers to existing assignments"}
              {mode === "remove" &&
                "Remove selected providers from current assignments"}
            </p>
          </div>

          {/* Assignment Preview */}
          <div className="status-brand p-3 rounded-lg">
            <p className="text-sm font-medium text-brand-primary">
              Assignment Preview: {getAssignmentCount()} total providers will be
              assigned
            </p>
            {selectedProviders.size > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {Array.from(selectedProviders)
                  .slice(0, 5)
                  .map((providerId) => (
                    <Badge
                      key={providerId}
                      variant="secondary"
                      className="text-xs"
                    >
                      {getProviderName(providerId)}
                    </Badge>
                  ))}
                {selectedProviders.size > 5 && (
                  <Badge variant="secondary" className="text-xs">
                    +{selectedProviders.size - 5} more
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Search and Select All */}
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search providers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="whitespace-nowrap"
            >
              {selectedProviders.size === filteredProviders.length
                ? "Deselect All"
                : "Select All"}
            </Button>
          </div>
        </div>

        {/* Provider List */}
        <div className="border rounded-lg max-h-96 overflow-y-auto">
          <div className="p-3 border-b bg-gray-50">
            <p className="text-sm font-medium text-gray-700">
              Available Providers ({filteredProviders.length})
            </p>
          </div>

          <div className="divide-y divide-gray-200">
            {filteredProviders.map((provider) => {
              const isSelected = selectedProviders.has(provider.id);
              const isCurrentlyAssigned = isProviderCurrentlyAssigned(
                provider.id
              );

              return (
                <div key={provider.id} className="p-3 hover:bg-gray-50">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleProviderToggle(provider.id)}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-gray-900">
                          {provider.displayName || "No name"}
                        </p>
                        {isCurrentlyAssigned && (
                          <Badge variant="default" className="text-xs">
                            Currently Assigned
                          </Badge>
                        )}
                        <Badge
                          variant={provider.isActive ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {provider.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>

                      <div className="flex items-center space-x-4 mt-1">
                        <p className="text-xs text-gray-500 flex items-center">
                          <Mail className="h-3 w-3 mr-1" />
                          {provider.email}
                        </p>
                        <p className="text-xs text-gray-500">
                          {provider.assignedSchools?.length || 0} schools
                          assigned
                        </p>
                        <p className="text-xs text-gray-500 flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          Joined{" "}
                          {provider.createdAt
                            ?.toDate?.()
                            ?.toLocaleDateString() || "Unknown"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredProviders.length === 0 && (
              <CompactEmptyState
                message={
                  searchTerm
                    ? `No providers found matching "${searchTerm}"`
                    : "No providers available for assignment"
                }
                className="py-8"
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton
            onClick={handleSave}
            isLoading={isLoading}
            loadingText="Saving..."
            className={`micro-scale ${
              mode === "remove" ? "bg-red-600 hover:bg-red-700" : ""
            }`}
          >
            {mode === "replace"
              ? "Replace Assignments"
              : mode === "add"
              ? "Add Providers"
              : "Remove Providers"}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
