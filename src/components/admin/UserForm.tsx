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
import { UserRecord, updateUserProfile } from "@/lib/services/userService";

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
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    displayName: "",
    email: "",
    role: "provider" as "provider" | "admin",
    isActive: true,
  });

  useEffect(() => {
    if (user && mode === "edit") {
      setFormData({
        displayName: user.displayName || "",
        email: user.email || "",
        role: user.role,
        isActive: user.isActive,
      });
    } else if (mode === "create") {
      setFormData({
        displayName: "",
        email: "",
        role: "provider",
        isActive: true,
      });
    }
  }, [user, mode]);

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

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>School Assignments:</strong> To assign schools to this provider, use the <strong>Assignment Management</strong> page from the admin menu.
            </p>
          </div>

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
