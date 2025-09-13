"use client";

import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MapPin,
  Loader2,
  AlertCircle,
  CheckCircle,
  Navigation,
  AlertTriangle,
  Info,
} from "lucide-react";
import {
  validateLocation,
  validateCoordinates,
  validateAddress,
  geocodeAddress,
  reverseGeocode,
  validateCoordinateAddressMatch,
  type LocationValidationResult,
  type GeocodeResult,
} from "@/lib/services/locationValidationService";

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
  const [isValidatingLocation, setIsValidatingLocation] = useState(false);
  const [locationValidation, setLocationValidation] =
    useState<LocationValidationResult | null>(null);
  const [addressSuggestion, setAddressSuggestion] = useState<string>("");
  const [coordinateMatchValidation, setCoordinateMatchValidation] = useState<{
    isMatch: boolean;
    distance?: number;
    error?: string;
  } | null>(null);

  const [formData, setFormData] = useState<SchoolFormData>({
    name: school?.name || "",
    address: school?.address || "",
    latitude: school?.latitude || 0,
    longitude: school?.longitude || 0,
    radius: school?.radius || 100,
    description: school?.description || "",
  });

  const isEditing = !!school?.id;

  // Validate location whenever form data changes
  useEffect(() => {
    if (formData.address && formData.latitude && formData.longitude) {
      const validation = validateLocation(
        formData.address,
        formData.latitude,
        formData.longitude,
        formData.radius
      );
      setLocationValidation(validation);
    } else {
      setLocationValidation(null);
    }
  }, [
    formData.address,
    formData.latitude,
    formData.longitude,
    formData.radius,
  ]);

  // Validate coordinate-address match
  const validateAddressCoordinateMatch = async () => {
    if (!formData.address || !formData.latitude || !formData.longitude) return;

    setIsValidatingLocation(true);
    try {
      const result = await validateCoordinateAddressMatch(
        formData.address,
        formData.latitude,
        formData.longitude,
        1000 // 1km tolerance
      );
      setCoordinateMatchValidation(result);
    } catch (error) {
      setCoordinateMatchValidation({
        isMatch: false,
        error: "Failed to validate coordinate and address match",
      });
    } finally {
      setIsValidatingLocation(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Enhanced validation
    if (!formData.name.trim()) {
      setError("School name is required");
      return;
    }

    const addressValidation = validateAddress(formData.address);
    if (!addressValidation.isValid) {
      setError(
        "Address validation failed: " + addressValidation.errors.join(", ")
      );
      return;
    }

    const coordinateValidation = validateCoordinates(
      formData.latitude,
      formData.longitude
    );
    if (!coordinateValidation.isValid) {
      setError(
        "Coordinate validation failed: " +
          coordinateValidation.errors.join(", ")
      );
      return;
    }

    const locationValidation = validateLocation(
      formData.address,
      formData.latitude,
      formData.longitude,
      formData.radius
    );

    if (!locationValidation.isValid) {
      setError(
        "Location validation failed: " + locationValidation.errors.join(", ")
      );
      return;
    }

    // Warn about validation issues but allow submission
    if (locationValidation.warnings.length > 0) {
      console.warn(
        "Location validation warnings:",
        locationValidation.warnings
      );
    }

    try {
      setError(null);

      // Use normalized coordinates if available
      const finalData = {
        ...formData,
        latitude: coordinateValidation.normalizedLat || formData.latitude,
        longitude: coordinateValidation.normalizedLng || formData.longitude,
      };

      await onSubmit(finalData);
      onClose();
    } catch (error: any) {
      setError(error.message || "Failed to save school");
    }
  };

  const handleGeocodeAddress = async () => {
    if (!formData.address) {
      setError("Please enter an address first");
      return;
    }

    setIsGeocodingLoading(true);
    setError(null);

    try {
      const result: GeocodeResult = await geocodeAddress(formData.address);

      if (!result.success || !result.coordinates) {
        setError(result.error || "Failed to geocode address");
        return;
      }

      // Update form data with geocoded coordinates
      setFormData((prev) => ({
        ...prev,
        latitude: result.coordinates!.lat,
        longitude: result.coordinates!.lng,
      }));

      // Update address with standardized version if available
      if (
        result.standardizedAddress &&
        result.standardizedAddress !== formData.address
      ) {
        setAddressSuggestion(result.standardizedAddress);
      }

      // Validate the new coordinates
      setTimeout(() => {
        validateAddressCoordinateMatch();
      }, 100);
    } catch (error) {
      setError("Failed to geocode address. Please enter coordinates manually.");
    } finally {
      setIsGeocodingLoading(false);
    }
  };

  const handleReverseGeocode = async () => {
    if (!formData.latitude || !formData.longitude) {
      setError("Please enter coordinates first");
      return;
    }

    setIsGeocodingLoading(true);
    setError(null);

    try {
      const result = await reverseGeocode(
        formData.latitude,
        formData.longitude
      );

      if (!result.success || !result.address) {
        setError(result.error || "Failed to find address for coordinates");
        return;
      }

      // Update form data with reverse geocoded address
      setFormData((prev) => ({
        ...prev,
        address: result.address!,
      }));
    } catch (error) {
      setError(
        "Failed to reverse geocode coordinates. Please enter address manually."
      );
    } finally {
      setIsGeocodingLoading(false);
    }
  };

  const acceptAddressSuggestion = () => {
    if (addressSuggestion) {
      setFormData((prev) => ({
        ...prev,
        address: addressSuggestion,
      }));
      setAddressSuggestion("");
    }
  };

  const handleInputChange = (
    field: keyof SchoolFormData,
    value: string | number
  ) => {
    setFormData((prev) => ({
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
                onChange={(e) =>
                  handleInputChange("radius", Number(e.target.value))
                }
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  How close providers need to be to check in (10-1000m)
                </p>
                <Badge
                  variant={
                    formData.radius < 25
                      ? "destructive"
                      : formData.radius > 500
                      ? "secondary"
                      : "default"
                  }
                  className="text-xs"
                >
                  {formData.radius < 25
                    ? "Very Small"
                    : formData.radius > 500
                    ? "Very Large"
                    : "Good Size"}
                </Badge>
              </div>
              {(formData.radius < 25 || formData.radius > 500) && (
                <p className="text-xs text-orange-600">
                  {formData.radius < 25
                    ? "Small radius may cause check-in difficulties. Consider 25m or more."
                    : "Large radius may allow check-ins from far away. Consider 500m or less."}
                </p>
              )}
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
                onClick={handleGeocodeAddress}
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
              Enter the full address and click "Get Coords" to auto-fill
              coordinates
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
                onChange={(e) =>
                  handleInputChange("latitude", Number(e.target.value))
                }
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
                onChange={(e) =>
                  handleInputChange("longitude", Number(e.target.value))
                }
                required
              />
              <p className="text-xs text-muted-foreground">
                GPS longitude (-180 to 180)
              </p>
            </div>
          </div>

          {/* Address suggestion */}
          {addressSuggestion && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>
                    Suggested standardized address:{" "}
                    <strong>{addressSuggestion}</strong>
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={acceptAddressSuggestion}
                  >
                    Use This
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Location validation feedback */}
          {locationValidation && (
            <div className="space-y-2">
              {locationValidation.isValid && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Location validation passed successfully
                  </AlertDescription>
                </Alert>
              )}

              {locationValidation.warnings.length > 0 && (
                <Alert variant="default">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div>
                      <p className="font-medium mb-1">Validation Warnings:</p>
                      <ul className="text-sm space-y-1">
                        {locationValidation.warnings.map((warning, index) => (
                          <li key={index}>• {warning}</li>
                        ))}
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {locationValidation.suggestions &&
                locationValidation.suggestions.length > 0 && (
                  <Alert variant="default">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <div>
                        <p className="font-medium mb-1">Suggestions:</p>
                        <ul className="text-sm space-y-1">
                          {locationValidation.suggestions.map(
                            (suggestion, index) => (
                              <li key={index}>• {suggestion}</li>
                            )
                          )}
                        </ul>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
            </div>
          )}

          {/* Coordinate validation */}
          {formData.latitude !== 0 && formData.longitude !== 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center">
                  <Navigation className="h-4 w-4 mr-2" />
                  GPS Coordinate Validation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium">Coordinate Precision:</p>
                    <Badge
                      variant={
                        validateCoordinates(
                          formData.latitude,
                          formData.longitude
                        ).precision === "high"
                          ? "default"
                          : validateCoordinates(
                              formData.latitude,
                              formData.longitude
                            ).precision === "medium"
                          ? "secondary"
                          : "destructive"
                      }
                    >
                      {
                        validateCoordinates(
                          formData.latitude,
                          formData.longitude
                        ).precision
                      }{" "}
                      precision
                    </Badge>
                  </div>
                  <div>
                    <p className="font-medium">Coordinates:</p>
                    <p className="text-muted-foreground">
                      {formData.latitude.toFixed(6)},{" "}
                      {formData.longitude.toFixed(6)}
                    </p>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleReverseGeocode}
                    disabled={isGeocodingLoading}
                  >
                    {isGeocodingLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Navigation className="h-4 w-4 mr-2" />
                    )}
                    Get Address from Coords
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={validateAddressCoordinateMatch}
                    disabled={isValidatingLocation || !formData.address}
                  >
                    {isValidatingLocation ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <MapPin className="h-4 w-4 mr-2" />
                    )}
                    Validate Match
                  </Button>
                </div>

                {coordinateMatchValidation && (
                  <Alert
                    variant={
                      coordinateMatchValidation.isMatch
                        ? "default"
                        : "destructive"
                    }
                  >
                    {coordinateMatchValidation.isMatch ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" />
                    )}
                    <AlertDescription>
                      {coordinateMatchValidation.isMatch ? (
                        <span>
                          Address and coordinates match well
                          {coordinateMatchValidation.distance && (
                            <span className="text-muted-foreground">
                              {" "}
                              (~{Math.round(coordinateMatchValidation.distance)}
                              m apart)
                            </span>
                          )}
                        </span>
                      ) : (
                        <span>
                          {coordinateMatchValidation.error ||
                            "Address and coordinates don't match well"}
                          {coordinateMatchValidation.distance && (
                            <span className="text-muted-foreground">
                              {" "}
                              (~{Math.round(coordinateMatchValidation.distance)}
                              m apart)
                            </span>
                          )}
                        </span>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Additional notes about this school location..."
              value={formData.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                handleInputChange("description", e.target.value)
              }
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
