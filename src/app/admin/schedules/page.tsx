"use client";

import { useState, useEffect } from "react";
import { CalendarClock, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminNavigation } from "@/components/admin/AdminNavigation";
import { ScheduleManager } from "@/components/schedules/ScheduleManager";
import { getAllUsers, UserRecord } from "@/lib/services/userService";
import { appLogger } from "@/lib/logging/appLogger";

function ScheduleManagementContent() {
  const [providers, setProviders] = useState<UserRecord[]>([]);
  const [filteredProviders, setFilteredProviders] = useState<UserRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scheduleProvider, setScheduleProvider] = useState<UserRecord | null>(null);

  const loadProviders = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getAllUsers({ role: "provider" });
      setProviders(data);
      setFilteredProviders(data);
    } catch (err) {
      appLogger.error("Failed to load providers", { err });
      setError("Failed to load providers. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProviders();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProviders(providers);
      return;
    }
    const query = searchQuery.toLowerCase();
    setFilteredProviders(
      providers.filter(
        (p) =>
          p.displayName?.toLowerCase().includes(query) ||
          p.email?.toLowerCase().includes(query)
      )
    );
  }, [searchQuery, providers]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Schedules</h1>
        <p className="text-muted-foreground mt-1">
          Manage provider schedules for assigned schools.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search providers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Provider List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          Loading providers...
        </div>
      ) : filteredProviders.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <CalendarClock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? "No providers match your search." : "No providers found."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredProviders.map((provider) => (
            <div
              key={provider.id}
              className="flex items-center justify-between px-4 py-3 bg-card border rounded-lg"
            >
              <div>
                <p className="font-medium text-foreground">
                  {provider.displayName || provider.email}
                </p>
                {provider.displayName && (
                  <p className="text-sm text-muted-foreground">{provider.email}</p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setScheduleProvider(provider)}
              >
                <CalendarClock className="h-4 w-4 mr-2" />
                Manage
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Schedule Manager Dialog */}
      {scheduleProvider && (
        <ScheduleManager
          providerId={scheduleProvider.id}
          providerName={
            scheduleProvider.displayName ||
            scheduleProvider.email ||
            "Provider"
          }
          isOpen={!!scheduleProvider}
          onClose={() => setScheduleProvider(null)}
        />
      )}
    </div>
  );
}

export default function ScheduleManagementPage() {
  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminNavigation>
        <ScheduleManagementContent />
      </AdminNavigation>
    </ProtectedRoute>
  );
}
