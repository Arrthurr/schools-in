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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { CompactEmptyState } from "../ui/error-empty-states";
import { UserRecord, updateUserProfile } from "@/lib/services/userService";

interface School {
  id: string;
  name: string;
  address: string;
  isActive: boolean;
}

interface UserFormProps {
  user?: UserRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  mode: "create" | "edit";
}

export function UserForm({
  user,
  isOpen,
  onClose,
  onSave,
  mode,
}: UserFormProps) {
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    displayName: "",
    email: "",
    role: "provider" as "provider" | "admin",
    isActive: true,
    assignedSchools: [] as string[],
  });

  useEffect(() => {
    loadSchools();
  }, []);

  useEffect(() => {
    if (user && mode === "edit") {
      setFormData({
        displayName: user.displayName || "",
        email: user.email || "",
        role: user.role,
        isActive: user.isActive,
        assignedSchools: user.assignedSchools || [],
      });
    } else if (mode === "create") {
      setFormData({
        displayName: "",
        email: "",
        role: "provider",
        isActive: true,
        assignedSchools: [],
      });
    }
  }, [user, mode]);

  const loadSchools = async () => {
    try {
      // Mock school data for now - replace with actual service call
      const mockSchools = [
        {
          id: "1",
          name: "Walter Payton HS",
          address: "1034 N Wells St",
          isActive: true,
        },
        {
          id: "2",
          name: "Estrella Foothills HS",
          address: "18315 W Lower Buckeye Rd",
          isActive: true,
        },
        {
          id: "3",
          name: "Augustus Tolton",
          address: "1729 S Ashland Ave",
          isActive: true,
        },
        {
          id: "4",
          name: "Cambridge School",
          address: "1047 W 47th St",
          isActive: true,
        },
        {
          id: "5",
          name: "Chicago SDA Academy",
          address: "7347 S Emerald Ave",
          isActive: false,
        },
      ];
      setSchools(mockSchools);
    } catch (error) {
      console.error("Error loading schools:", error);
    }
  };

  const handleSchoolToggle = (schoolId: string) => {
    const updated = formData.assignedSchools.includes(schoolId)
      ? formData.assignedSchools.filter((id) => id !== schoolId)
      : [...formData.assignedSchools, schoolId];

    setFormData((prev) => ({ ...prev, assignedSchools: updated }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);

      if (mode === "edit" && user) {
        await updateUserProfile(user.id, formData);
      } else {
        // TODO: Implement user creation logic
        console.log("Creating user:", formData);
      }

      onSave();
      onClose();
    } catch (error) {
      console.error("Error saving user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSchoolName = (schoolId: string) => {
    const school = schools.find((s) => s.id === schoolId);
    return school?.name || schoolId;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "Create New User"
              : `Edit ${user?.displayName || "User"}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Add a new user to the system and assign their role."
              : "Update user information and role assignments."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Name
              </label>
              <Input
                placeholder="Enter full name"
                value={formData.displayName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    displayName: e.target.value,
                  }))
                }
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <Input
                type="email"
                placeholder="user@example.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                disabled={mode === "edit"}
                required
              />
              {mode === "edit" && (
                <p className="text-xs text-gray-500 mt-1">
                  Email cannot be changed after user creation
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    role: e.target.value as "provider" | "admin",
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="provider">Provider</option>
                <option value="admin">Admin</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {formData.role === "admin"
                  ? "Full system access and management capabilities"
                  : "Access to assigned schools and check-in/out functionality"}
              </p>
            </div>

            <div className="flex items-center space-x-3 p-4 border rounded-lg">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    isActive: e.target.checked,
                  }))
                }
                className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
              />
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Active User
                </label>
                <p className="text-xs text-gray-500">
                  Inactive users cannot sign in to the system
                </p>
              </div>
            </div>
          </div>

          {/* School Assignment - Only for Providers */}
          {formData.role === "provider" && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Assigned Schools
              </label>

              {/* Selected Schools */}
              {formData.assignedSchools.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    Selected schools ({formData.assignedSchools.length}):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {formData.assignedSchools.map((schoolId) => (
                      <Badge
                        key={schoolId}
                        variant="secondary"
                        className="pr-1"
                      >
                        {getSchoolName(schoolId)}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto p-1 ml-2"
                          onClick={() => handleSchoolToggle(schoolId)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* School Selection */}
              <div className="border rounded-lg p-4 max-h-40 overflow-y-auto">
                <p className="text-sm font-medium mb-3">Available Schools:</p>
                <div className="space-y-2">
                  {schools
                    .filter((school) => school.isActive)
                    .map((school) => (
                      <div
                        key={school.id}
                        className="flex items-center space-x-2"
                      >
                        <input
                          type="checkbox"
                          id={school.id}
                          checked={formData.assignedSchools.includes(school.id)}
                          onChange={() => handleSchoolToggle(school.id)}
                          className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                        />
                        <label
                          htmlFor={school.id}
                          className="text-sm font-medium leading-none cursor-pointer flex-1"
                        >
                          <div>
                            <p className="font-medium">{school.name}</p>
                            <p className="text-xs text-gray-500">
                              {school.address}
                            </p>
                          </div>
                        </label>
                      </div>
                    ))}
                </div>
                {schools.filter((school) => school.isActive).length === 0 && (
                  <CompactEmptyState message="No active schools available for assignment" />
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? "Saving..."
                : mode === "create"
                ? "Create User"
                : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
