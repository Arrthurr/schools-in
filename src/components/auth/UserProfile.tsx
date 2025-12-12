
"use client";

import { useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { updateProfile } from "firebase/auth";
import { auth } from "../../../firebase.config";
import { useAutoGeofencePreference } from "@/lib/hooks/useAutoGeofencePreference";

const formSchema = z.object({
  displayName: z.string().min(2, { message: "Display name must be at least 2 characters." }),
});

export function UserProfile() {
  const { user } = useAuth();
  const {
    enabled: autoGeofenceEnabled,
    loading: prefLoading,
    error: prefError,
    setEnabled: setAutoGeofenceEnabled,
  } = useAutoGeofencePreference();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      displayName: user?.displayName || "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) return;
    setLoading(true);
    setSuccess(false);
    try {
      await updateProfile(auth.currentUser!, { displayName: values.displayName });
      setSuccess(true);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>User Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Email</Label>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div>
          <Label>Role</Label>
          <p className="text-sm text-muted-foreground">{user.role}</p>
        </div>
        <div className="flex items-start justify-between rounded-lg border p-3">
          <div className="space-y-1">
            <Label htmlFor="auto-geofence">
              Auto Check-In/Out Mode (experimental)
            </Label>
            <p className="text-sm text-muted-foreground">
              When enabled, we’ll monitor location in the foreground and auto check you
              in/out after a short countdown when entering or leaving an assigned school.
            </p>
            {prefError && (
              <p className="text-sm text-destructive">{prefError}</p>
            )}
          </div>
          <Switch
            id="auto-geofence"
            checked={autoGeofenceEnabled}
            disabled={prefLoading}
            onCheckedChange={(value) => setAutoGeofenceEnabled(value)}
            aria-label="Toggle auto check-in/out mode"
          />
        </div>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input id="displayName" {...form.register("displayName")} />
            {form.formState.errors.displayName && (
              <p className="text-sm text-destructive">
                {form.formState.errors.displayName.message}
              </p>
            )}
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Updating..." : "Update Profile"}
          </Button>
          {success && (
            <p className="text-sm text-green-600">Profile updated successfully!</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
