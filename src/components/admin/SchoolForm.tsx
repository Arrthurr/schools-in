"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MapPin, Loader2, AlertCircle, CheckCircle } from "lucide-react";

interface School {
  id?: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius?: number;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface SchoolFormData {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius: number;
  description: string;
}

interface SchoolFormProps {
  school?: School;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SchoolFormData) => Promise<void>;
  isLoading?: boolean;
}

export function SchoolForm({
  school,
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: SchoolFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isGeocodingLoading, setIsGeocodingLoading] = useState(false);
  const [formData, setFormData] = useState<SchoolFormData>({
    name: school?.name || "",
    address: school?.address || "",
    latitude: school?.latitude || 0,
    longitude: school?.longitude || 0,
    radius: school?.radius || 100,
    description: school?.description || "",
  });

  const isEditing = !!school?.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.name.trim()) {
      setError("School name is required");
      return;
    }
    if (!formData.address.trim()) {
      setError("Address is required");
      return;
    }
    if (formData.latitude === 0 || formData.longitude === 0) {
      setError("Valid coordinates are required");
      return;
    }

    try {
      setError(null);
      await onSubmit(formData);
      onClose();
    } catch (error: any) {
      setError(error.message || "Failed to save school");
    }
  };

  const geocodeAddress = async () => {
    if (!formData.address) {
      setError("Please enter an address first");
      return;
    }

    setIsGeocodingLoading(true);
    setError(null);

    try {
      // Using a mock geocoding service for now
      // In a real app, you'd use Google Maps Geocoding API or similar
      const mockGeocoding = async (addr: string): Promise<{ lat: number; lng: number }> => {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Return mock coordinates for demonstration
        return {
          lat: 41.8781 + (Math.random() - 0.5) * 0.1,
          lng: -87.6298 + (Math.random() - 0.5) * 0.1,
        };
      };

      const result = await mockGeocoding(formData.address);
      
      setFormData(prev => ({
        ...prev,
        latitude: result.lat,
        longitude: result.lng,
      }));
      
    } catch (error) {
      setError("Failed to geocode address. Please enter coordinates manually.");
    } finally {
      setIsGeocodingLoading(false);
    }
  };

  const handleInputChange = (field: keyof SchoolFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit School" : "Add New School"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the school information below."
              : "Enter the details for the new school location."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">School Name</Label>
              <Input
                id="name"
                placeholder="e.g., Walter Payton HS"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="radius">Check-in Radius (meters)</Label>
              <Input
                id="radius"
                type="number"
                placeholder="100"
                min="10"
                max="1000"
                value={formData.radius}
                onChange={(e) => handleInputChange("radius", Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                How close providers need to be to check in (10-1000m)
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <div className="flex space-x-2">
              <Input
                id="address"
                placeholder="e.g., 1034 N Wells St, Chicago, IL 60610"
                value={formData.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
                className="flex-1"
                required
              />
              <Button
                type="button"
                variant="outline"
                onClick={geocodeAddress}
                disabled={isGeocodingLoading || !formData.address}
              >
                {isGeocodingLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
                {isGeocodingLoading ? "Finding..." : "Get Coords"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter the full address and click "Get Coords" to auto-fill coordinates
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                placeholder="41.8781"
                value={formData.latitude}
                onChange={(e) => handleInputChange("latitude", Number(e.target.value))}
                required
              />
              <p className="text-xs text-muted-foreground">
                GPS latitude (-90 to 90)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                placeholder="-87.6298"
                value={formData.longitude}
                onChange={(e) => handleInputChange("longitude", Number(e.target.value))}
                required
              />
              <p className="text-xs text-muted-foreground">
                GPS longitude (-180 to 180)
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Additional notes about this school location..."
              value={formData.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleInputChange("description", e.target.value)}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {isEditing ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {isEditing ? "Update School" : "Create School"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
