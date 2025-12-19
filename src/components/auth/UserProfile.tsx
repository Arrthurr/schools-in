"use client";

import { useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { updateProfile } from "firebase/auth";
import { auth } from "../../../firebase.config";
import { MapPin, Clock } from "lucide-react";

const formSchema = z.object({
  displayName: z.string().min(2, { message: "Display name must be at least 2 characters." }),
});

export function UserProfile() {
  const { user } = useAuth();
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
          <p className="text-sm text-muted-foreground capitalize">{user.role}</p>
        </div>

        {/* Check-in mode info - read-only based on role */}
        <div className="rounded-lg border p-3 bg-muted/20">
          <div className="flex items-center gap-2 mb-2">
            {user.role === "provider" ? (
              <>
                <MapPin className="h-4 w-4 text-brand-primary" />
                <span className="font-medium">Automatic Check-In/Out</span>
                <Badge variant="secondary" className="ml-auto">Active</Badge>
              </>
            ) : (
              <>
                <Clock className="h-4 w-4 text-brand-primary" />
                <span className="font-medium">Manual Check-In/Out</span>
                <Badge variant="outline" className="ml-auto">Admin</Badge>
              </>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {user.role === "provider"
              ? "Your check-ins and check-outs are handled automatically based on your GPS location when visiting assigned schools."
              : "As an administrator, you can manually check in and out at any school from the Admin Dashboard."}
          </p>
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
