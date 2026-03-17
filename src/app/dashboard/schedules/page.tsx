"use client";

import { useState, useEffect, useMemo } from "react";
import { CalendarClock } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ProviderNavigation } from "@/components/provider/ProviderNavigation";
import { useCachedAuth } from "@/lib/hooks/useCachedAuth";
import { getSchedulesByProvider } from "@/lib/services/scheduleService";
import { getAssignedLocations } from "@/lib/services/locationService";
import { getAllServices } from "@/lib/services/serviceService";
import { appLogger } from "@/lib/logging/appLogger";
import { formatTime } from "@/lib/utils/time";
import { Schedule, Location, Service } from "@/lib/firebase/types";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function SchedulesSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3].map((j) => (
              <Skeleton key={j} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MySchedulesContent() {
  const { user } = useCachedAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;

    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [scheduleData, locationData, serviceData] = await Promise.all([
          getSchedulesByProvider(user.uid),
          getAssignedLocations(user.uid),
          getAllServices(true),
        ]);
        setSchedules(scheduleData);
        setLocations(locationData);
        setServices(serviceData);
      } catch (err) {
        appLogger.error("Failed to load schedules", { err });
        setError("Failed to load your schedules. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [user?.uid]);

  const locationNameById = useMemo(
    () =>
      locations.reduce<Record<string, string>>(
        (acc, loc) => ({ ...acc, [loc.id]: loc.name }),
        {}
      ),
    [locations]
  );

  const serviceNameById = useMemo(
    () =>
      services.reduce<Record<string, string>>(
        (acc, svc) => ({ ...acc, [svc.id]: svc.name }),
        {}
      ),
    [services]
  );

  // Group schedules by location, then by day of week
  const schedulesByLocation = useMemo(() => {
    const grouped: Record<string, Schedule[]> = {};
    for (const schedule of schedules) {
      if (!grouped[schedule.locationId]) {
        grouped[schedule.locationId] = [];
      }
      grouped[schedule.locationId].push(schedule);
    }
    // Sort each location's schedules by day then startTime
    for (const locationId in grouped) {
      grouped[locationId].sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
        return a.startTime.localeCompare(b.startTime);
      });
    }
    return grouped;
  }, [schedules]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Schedules</h1>
        <p className="text-muted-foreground mt-1">
          Your assigned schedule at each school.
        </p>
      </div>

      {isLoading ? (
        <SchedulesSkeleton />
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : schedules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <CalendarClock className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">No schedules assigned</p>
          <p className="text-sm mt-1">
            Your administrator will set up your school schedules.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(schedulesByLocation).map(([locationId, locationSchedules]) => (
            <Card key={locationId}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {locationNameById[locationId] || "Unknown School"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {locationSchedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="w-24 justify-center shrink-0">
                        {DAY_NAMES[schedule.dayOfWeek]}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {serviceNameById[schedule.serviceId] || "Service"}
                      </span>
                    </div>
                    <span className="text-sm font-medium tabular-nums">
                      {formatTime(schedule.startTime)} – {formatTime(schedule.endTime)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardSchedulesPage() {
  return (
    <ProtectedRoute roles={["provider"]}>
      <ProviderNavigation>
        <MySchedulesContent />
      </ProviderNavigation>
    </ProtectedRoute>
  );
}
