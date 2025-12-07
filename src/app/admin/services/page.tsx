"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Edit,
  Loader2,
  Package,
  ToggleLeft,
  ToggleRight,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminNavigation } from "@/components/admin/AdminNavigation";
import { Service } from "@/lib/firebase/types";
import {
  getAllServices,
  createService,
  updateService,
} from "@/lib/services/serviceService";

interface ServiceFormData {
  name: string;
  code: string;
  description: string;
  isActive: boolean;
}

const defaultFormData: ServiceFormData = {
  name: "",
  code: "",
  description: "",
  isActive: true,
};

function ServiceManagementContent() {
  const [services, setServices] = useState<Service[]>([]);
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState<ServiceFormData>(defaultFormData);
  const [isSaving, setIsSaving] = useState(false);

  const loadServices = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getAllServices(false); // Include inactive
      setServices(data);
      setFilteredServices(data);
    } catch (err) {
      console.error("Failed to load services:", err);
      setError("Failed to load services. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredServices(services);
      return;
    }
    const query = searchQuery.toLowerCase();
    setFilteredServices(
      services.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.code.toLowerCase().includes(query) ||
          s.description?.toLowerCase().includes(query)
      )
    );
  }, [searchQuery, services]);

  const openCreateForm = () => {
    setEditingService(null);
    setFormData(defaultFormData);
    setIsFormOpen(true);
  };

  const openEditForm = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      code: service.code,
      description: service.description || "",
      isActive: service.isActive,
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingService(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim() || !formData.code.trim()) {
      setError("Name and code are required.");
      return;
    }

    try {
      setIsSaving(true);

      if (editingService) {
        await updateService(editingService.id, {
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          description: formData.description.trim() || undefined,
          isActive: formData.isActive,
        });
      } else {
        await createService({
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          description: formData.description.trim() || undefined,
          isActive: formData.isActive,
        });
      }

      await loadServices();
      closeForm();
    } catch (err) {
      console.error("Failed to save service:", err);
      setError("Failed to save service. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (service: Service) => {
    try {
      await updateService(service.id, { isActive: !service.isActive });
      await loadServices();
    } catch (err) {
      console.error("Failed to toggle service status:", err);
      setError("Failed to update service status.");
    }
  };

  const activeCount = services.filter((s) => s.isActive).length;
  const inactiveCount = services.length - activeCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Service Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage service types that providers can be scheduled for.
          </p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus className="h-4 w-4 mr-2" />
          Add Service
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card p-4 rounded-lg border">
          <div className="text-2xl font-bold text-foreground">
            {services.length}
          </div>
          <div className="text-sm text-muted-foreground">Total Services</div>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {activeCount}
          </div>
          <div className="text-sm text-muted-foreground">Active</div>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {inactiveCount}
          </div>
          <div className="text-sm text-muted-foreground">Inactive</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search services..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Services List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          Loading services...
        </div>
      ) : filteredServices.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {searchQuery ? "No services found" : "No services configured"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery
                ? "Try adjusting your search."
                : "Add your first service type to enable schedule creation."}
            </p>
            {!searchQuery && (
              <Button onClick={openCreateForm}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Service
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map((service) => (
            <Card
              key={service.id}
              className={`hover:shadow-md transition-shadow ${
                !service.isActive ? "opacity-60" : ""
              }`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{service.name}</CardTitle>
                    <CardDescription className="font-mono text-xs">
                      {service.code}
                    </CardDescription>
                  </div>
                  <Badge variant={service.isActive ? "default" : "secondary"}>
                    {service.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {service.description && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {service.description}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditForm(service)}
                    className="flex-1"
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleStatus(service)}
                    className={
                      service.isActive
                        ? "text-red-600 hover:text-red-700"
                        : "text-green-600 hover:text-green-700"
                    }
                  >
                    {service.isActive ? (
                      <>
                        <ToggleRight className="h-3 w-3 mr-1" />
                        Disable
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="h-3 w-3 mr-1" />
                        Enable
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Service Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingService ? "Edit Service" : "Create Service"}
            </DialogTitle>
            <DialogDescription>
              {editingService
                ? "Update the service details below."
                : "Add a new service type for provider scheduling."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Service Name *
              </label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g., Title I Reading"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Service Code *
              </label>
              <Input
                value={formData.code}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    code: e.target.value.toUpperCase(),
                  }))
                }
                placeholder="e.g., T1-READ"
                required
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Short unique identifier (auto-uppercased)
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Description
              </label>
              <Input
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Brief description of this service type"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    isActive: e.target.checked,
                  }))
                }
                className="rounded border-input text-brand-primary focus:ring-brand-primary"
              />
              <label
                htmlFor="isActive"
                className="text-sm font-medium text-foreground"
              >
                Active (available for scheduling)
              </label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeForm}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : editingService ? (
                  "Update Service"
                ) : (
                  "Create Service"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ServiceManagementPage() {
  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminNavigation>
        <ServiceManagementContent />
      </AdminNavigation>
    </ProtectedRoute>
  );
}
