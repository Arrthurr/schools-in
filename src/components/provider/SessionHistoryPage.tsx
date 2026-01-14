"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useCachedAuth } from "@/lib/hooks/useCachedAuth";
import { useProviderLocations } from "@/lib/hooks/useProviderLocations";
import { CachedSessionService } from "@/lib/services/cachedSessionService";
import { Session } from "@/lib/firebase/types";
import {
  aggregateHoursByLocation,
  buildDurationHistogram,
  getDurationMinutes,
} from "@/lib/utils/sessionHistory";
import { formatDuration } from "@/lib/utils/session";
import { PageHeader, SectionCard } from "@/components/dashboard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { SimpleSelect, SelectOption } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { History, MapPin, Clock, Filter, RefreshCw } from "lucide-react";

type DateRange = {
  startDate: Date;
  endDate: Date;
};

const DEFAULT_LIMIT = 200;

const getDefaultRange = (): DateRange => {
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  startDate.setHours(0, 0, 0, 0);

  return { startDate, endDate };
};

const formatTimestamp = (value?: any) => {
  if (!value) return "—";
  const date =
    typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return date.toLocaleString();
};

const StatusPill = ({ status }: { status: Session["status"] }) => {
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          Completed
        </Badge>
      );
    case "active":
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-200">
          Active
        </Badge>
      );
    case "paused":
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
          Paused
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export function SessionHistoryPage() {
  const { user } = useCachedAuth();
  const { locations } = useProviderLocations(user?.uid);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [{ startDate, endDate }, setDateRange] = useState<DateRange>(
    getDefaultRange()
  );
  const [locationFilter, setLocationFilter] = useState<string>("all");

  const locationOptions: SelectOption[] = useMemo(() => {
    const base: SelectOption[] = [{ value: "all", label: "All locations" }];
    if (!locations) return base;
    return [
      ...base,
      ...locations.map((loc) => ({ value: loc.id, label: loc.name })),
    ];
  }, [locations]);

  const locationNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    (locations || []).forEach((loc) => {
      map[loc.id] = loc.name;
    });
    return map;
  }, [locations]);

  const fetchSessions = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError(null);

    try {
      const filters: any = {
        status: "completed" as const,
        startDate,
        endDate,
      };

      if (locationFilter !== "all") {
        filters.locationId = locationFilter;
      }

      const data = await CachedSessionService.getUserSessions(
        user.uid,
        filters,
        { limit: DEFAULT_LIMIT }
      );
      setSessions(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load sessions";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, startDate, endDate, locationFilter]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort(
        (a, b) => b.startTime.toMillis() - a.startTime.toMillis()
      ),
    [sessions]
  );

  const hoursByLocation = useMemo(
    () => aggregateHoursByLocation(sortedSessions, locationNameMap),
    [sortedSessions, locationNameMap]
  );

  const durationHistogram = useMemo(
    () => buildDurationHistogram(sortedSessions),
    [sortedSessions]
  );

  const resetFilters = () => {
    setDateRange(getDefaultRange());
    setLocationFilter("all");
  };

  const dateLabel = `Last 30 days`;

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <PageHeader
          title="Session History"
          description="Review your recent check-in and check-out activity."
          actions={
            <div className="text-right">
              <p className="text-sm text-muted-foreground">{dateLabel}</p>
              <p className="text-xs text-muted-foreground">
                {startDate.toLocaleDateString()} –{" "}
                {endDate.toLocaleDateString()}
              </p>
            </div>
          }
        />

        {/* Filters */}
        <SectionCard
          title="Filters"
          description="Adjust the range or filter by location."
          className="mb-6"
          headerActions={
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={resetFilters}
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchSessions}
                disabled={loading}
              >
                <Filter className="h-4 w-4 mr-2" />
                Apply
              </Button>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Start date</p>
              <DatePicker
                value={startDate}
                onChange={(date) => {
                  if (!date) return;
                  const next = new Date(date);
                  next.setHours(0, 0, 0, 0);
                  setDateRange((prev) => ({ ...prev, startDate: next }));
                }}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">End date</p>
              <DatePicker
                value={endDate}
                onChange={(date) => {
                  if (!date) return;
                  const next = new Date(date);
                  next.setHours(23, 59, 59, 999);
                  setDateRange((prev) => ({ ...prev, endDate: next }));
                }}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Location</p>
              <SimpleSelect
                options={locationOptions}
                value={locationFilter}
                onValueChange={setLocationFilter}
                id="history-location-select"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Showing completed sessions only. Limited to {DEFAULT_LIMIT} items
            for mobile performance.
          </p>
        </SectionCard>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">
                Hours by location
              </CardTitle>
              <CardDescription>
                Top locations from your history.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hoursByLocation.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No data yet. Complete a session to see insights.
                </p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hoursByLocation} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="locationName" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar
                        dataKey="hours"
                        radius={[6, 6, 0, 0]}
                        fill="hsl(var(--chart-1))"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">
                Session duration distribution
              </CardTitle>
              <CardDescription>
                How long your sessions typically last.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {durationHistogram.every((d) => d.sessionCount === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No duration data yet. Complete a session to see insights.
                </p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={durationHistogram} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="binLabel" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar
                        dataKey="sessionCount"
                        radius={[6, 6, 0, 0]}
                        fill="hsl(var(--chart-2))"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Session list */}
        <SectionCard
          title="History"
          description="Completed sessions in reverse chronological order."
        >
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-between p-4 border rounded-md bg-destructive/5">
              <div>
                <p className="text-sm font-medium text-destructive">{error}</p>
                <p className="text-xs text-muted-foreground">
                  Try refreshing the page or adjusting filters.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={fetchSessions}>
                Retry
              </Button>
            </div>
          ) : sortedSessions.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <History className="h-10 w-10 mx-auto mb-3 opacity-60" />
              <p className="text-sm">No completed sessions yet.</p>
              <p className="text-xs">
                Your history will appear after you check out from a school.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedSessions.map((session) => {
                const duration = formatDuration(getDurationMinutes(session));
                const locationName =
                  locationNameMap[session.locationId] || "Unknown location";

                return (
                  <div
                    key={session.id}
                    className="rounded-lg border p-4 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <p className="font-medium text-foreground">
                          {locationName}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatTimestamp(session.startTime)} →{" "}
                        {formatTimestamp(session.endTime)}
                      </p>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {duration}
                        </span>
                        {session.checkInMethod && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                            {session.checkInMethod}
                          </span>
                        )}
                      </div>
                    </div>
                    <StatusPill status={session.status} />
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
