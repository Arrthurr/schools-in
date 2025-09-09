"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Search,
  Filter,
  UserPlus,
  Edit,
  Trash2,
  Shield,
  UserCheck,
  UserX,
  MoreVertical,
  Download,
  CheckSquare,
  Square,
  Mail,
  Calendar,
  Settings,
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
import { UserForm } from "@/components/admin/UserForm";
import {
  getAllUsers,
  getUserStats,
  updateUserRole,
  toggleUserStatus,
  bulkUpdateUserStatus,
  bulkDeleteUsers,
  searchUsers,
  UserRecord,
  UserStats,
} from "@/lib/services/userService";

function UserManagementContent() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserRecord[]>([]);
  const [stats, setStats] = useState<UserStats>({
    totalUsers: 0,
    totalProviders: 0,
    totalAdmins: 0,
    activeUsers: 0,
    inactiveUsers: 0,
  });
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [roleFilter, setRoleFilter] = useState<"all" | "provider" | "admin">(
    "all"
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, statusFilter, roleFilter]);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [usersData, statsData] = await Promise.all([
        getAllUsers(),
        getUserStats(),
      ]);

      setUsers(usersData);
      setStats(statsData);
    } catch (error) {
      console.error("Error loading users:", error);
      setError("Failed to load users. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.email?.toLowerCase().includes(searchLower) ||
          user.displayName?.toLowerCase().includes(searchLower)
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((user) =>
        statusFilter === "active" ? user.isActive : !user.isActive
      );
    }

    // Apply role filter
    if (roleFilter !== "all") {
      filtered = filtered.filter((user) => user.role === roleFilter);
    }

    setFilteredUsers(filtered);
  };

  const handleSearch = async (term: string) => {
    setSearchTerm(term);
    if (term.trim()) {
      try {
        const searchResults = await searchUsers(term);
        setFilteredUsers(searchResults);
      } catch (error) {
        console.error("Error searching users:", error);
      }
    }
  };

  const handleUserRoleChange = async (
    userId: string,
    newRole: "provider" | "admin"
  ) => {
    try {
      await updateUserRole(userId, newRole);
      await loadUsers(); // Reload to get fresh data
    } catch (error) {
      console.error("Error updating user role:", error);
      setError("Failed to update user role");
    }
  };

  const handleUserStatusToggle = async (
    userId: string,
    currentStatus: boolean
  ) => {
    try {
      await toggleUserStatus(userId, !currentStatus);
      await loadUsers(); // Reload to get fresh data
    } catch (error) {
      console.error("Error updating user status:", error);
      setError("Failed to update user status");
    }
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    setFormMode("create");
    setShowUserForm(true);
  };

  const handleEditUser = (user: UserRecord) => {
    setEditingUser(user);
    setFormMode("edit");
    setShowUserForm(true);
  };

  const handleCloseForm = () => {
    setShowUserForm(false);
    setEditingUser(null);
  };

  const handleSaveUser = async () => {
    await loadUsers(); // Reload users after saving
  };

  const handleUserSelection = (userId: string, checked: boolean) => {
    const newSelected = new Set(selectedUsers);
    if (checked) {
      newSelected.add(userId);
    } else {
      newSelected.delete(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map((user) => user.id)));
    }
  };

  const handleBulkStatusToggle = async (isActive: boolean) => {
    try {
      await bulkUpdateUserStatus(Array.from(selectedUsers), isActive);
      setSelectedUsers(new Set());
      await loadUsers();
    } catch (error) {
      console.error("Error bulk updating user status:", error);
      setError("Failed to update users");
    }
  };

  const handleBulkDelete = async () => {
    if (
      confirm(
        `Are you sure you want to delete ${selectedUsers.size} users? This action cannot be undone.`
      )
    ) {
      try {
        await bulkDeleteUsers(Array.from(selectedUsers));
        setSelectedUsers(new Set());
        await loadUsers();
      } catch (error) {
        console.error("Error bulk deleting users:", error);
        setError("Failed to delete users");
      }
    }
  };

  const exportToCSV = () => {
    const csvContent = [
      [
        "Email",
        "Display Name",
        "Role",
        "Status",
        "Assigned Schools",
        "Created At",
        "Last Sign In",
      ].join(","),
      ...filteredUsers.map((user) =>
        [
          user.email || "",
          user.displayName || "",
          user.role,
          user.isActive ? "Active" : "Inactive",
          user.assignedSchools?.length || 0,
          user.createdAt?.toDate?.()?.toLocaleDateString() || "",
          user.lastSignIn?.toDate?.()?.toLocaleDateString() || "Never",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getRoleBadgeVariant = (role: string) => {
    return role === "admin" ? "destructive" : "secondary";
  };

  const getStatusBadgeVariant = (isActive: boolean) => {
    return isActive ? "default" : "secondary";
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">User Management</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
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
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            Manage user accounts and role assignments
          </p>
        </div>
        <Button onClick={handleCreateUser}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-gray-900">
            {stats.totalUsers}
          </div>
          <div className="text-sm text-gray-600">Total Users</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-brand-primary">
            {stats.totalProviders}
          </div>
          <div className="text-sm text-gray-600">Providers</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-purple-600">
            {stats.totalAdmins}
          </div>
          <div className="text-sm text-gray-600">Admins</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-green-600">
            {stats.activeUsers}
          </div>
          <div className="text-sm text-gray-600">Active</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-red-600">
            {stats.inactiveUsers}
          </div>
          <div className="text-sm text-gray-600">Inactive</div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center space-x-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search users by name or email..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Roles</option>
            <option value="provider">Providers</option>
            <option value="admin">Admins</option>
          </select>

          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedUsers.size > 0 && (
        <div className="flex items-center justify-between p-4 status-brand border rounded-lg">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-brand-primary">
              {selectedUsers.size} users selected
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkStatusToggle(true)}
              disabled={isLoading}
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Activate
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkStatusToggle(false)}
              disabled={isLoading}
            >
              <UserX className="h-4 w-4 mr-2" />
              Deactivate
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkDelete}
              disabled={isLoading}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedUsers(new Set())}
          >
            Clear Selection
          </Button>
        </div>
      )}

      {/* Users List */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Users ({filteredUsers.length})
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="flex items-center"
            >
              {selectedUsers.size === filteredUsers.length ? (
                <CheckSquare className="h-4 w-4 mr-2" />
              ) : (
                <Square className="h-4 w-4 mr-2" />
              )}
              Select All
            </Button>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {filteredUsers.map((user) => (
            <div key={user.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <input
                    type="checkbox"
                    checked={selectedUsers.has(user.id)}
                    onChange={(e) =>
                      handleUserSelection(user.id, e.target.checked)
                    }
                    className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                  />

                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={user.displayName || "User"}
                          className="h-10 w-10 rounded-full"
                        />
                      ) : (
                        <Users className="h-5 w-5 text-gray-600" />
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {user.displayName || "No name"}
                      </p>
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {user.role}
                      </Badge>
                      <Badge variant={getStatusBadgeVariant(user.isActive)}>
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-4 mt-1">
                      <p className="text-sm text-gray-500 flex items-center">
                        <Mail className="h-3 w-3 mr-1" />
                        {user.email}
                      </p>
                      {user.assignedSchools &&
                        user.assignedSchools.length > 0 && (
                          <p className="text-sm text-gray-500">
                            {user.assignedSchools.length} schools assigned
                          </p>
                        )}
                      <p className="text-sm text-gray-500 flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        Joined{" "}
                        {user.createdAt?.toDate?.()?.toLocaleDateString() ||
                          "Unknown"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <select
                    value={user.role}
                    onChange={(e) =>
                      handleUserRoleChange(user.id, e.target.value as any)
                    }
                    className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="provider">Provider</option>
                    <option value="admin">Admin</option>
                  </select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleUserStatusToggle(user.id, user.isActive)
                    }
                    className={
                      user.isActive ? "text-red-600" : "text-green-600"
                    }
                  >
                    {user.isActive ? (
                      <UserX className="h-4 w-4 mr-1" />
                    ) : (
                      <UserCheck className="h-4 w-4 mr-1" />
                    )}
                    {user.isActive ? "Deactivate" : "Activate"}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditUser(user)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {filteredUsers.length === 0 && (
            <div className="p-8 text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                No users found matching your criteria
              </p>
            </div>
          )}
        </div>
      </div>

      {/* User Form Modal */}
      <UserForm
        user={editingUser}
        isOpen={showUserForm}
        onClose={handleCloseForm}
        onSave={handleSaveUser}
        mode={formMode}
      />
    </div>
  );
}

export default function UserManagementPage() {
  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminNavigation>
        <UserManagementContent />
      </AdminNavigation>
    </ProtectedRoute>
  );
}
