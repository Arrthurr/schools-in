"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { StatusBadge } from "../ui/status-badge";
import {
  Clock,
  MapPin,
  Timer,
  CheckCircle,
  School as SchoolIcon,
} from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { Session as NormalizedSession, Location } from "@/lib/firebase/types";
import { getCachedDocument } from "@/lib/firebase/cachedFirestore";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { normalizeLocationData } from "@/lib/services/locationNormalizer";

// Legacy UI shape used previously in the app
interface LegacySessionData {
  id: string;
  schoolId: string;
  schoolName: string;
  startTime: Date;
  status: "active" | "paused" | "completed";
  duration: number; // in minutes
  location: {
    latitude: number;
    longitude: number;
  };
}

interface SessionStatusProps {
  currentSession?: LegacySessionData | NormalizedSession | null;
  onEndSession?: (sessionId: string) => void;
  className?: string;
}

export const SessionStatus: React.FC<SessionStatusProps> = ({
  currentSession,
  onEndSession,
  className = "",
}) => {
  const [elapsedMinutes, setElapsedMinutes] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [locationInfo, setLocationInfo] = useState<{
    name?: string;
    latitude?: number;
    longitude?: number;
  } | null>(null);

  const status = (currentSession as any)?.status as string | undefined;

  const startDate: Date | null = useMemo(() => {
    if (!currentSession) return null;
    const st: any = (currentSession as any).startTime;
    if (!st) return null;
    if (st instanceof Date) return st;
    if (st instanceof Timestamp) return st.toDate();
    if (typeof st?.toDate === "function") return st.toDate();
    // Handle plain object from Firestore cache {seconds, nanoseconds}
    if (typeof st.seconds === "number") {
      return new Date(st.seconds * 1000 + (st.nanoseconds || 0) / 1000000);
    }
    return new Date(st);
  }, [currentSession]);

  const computedDuration = useMemo(() => {
    if (!currentSession) return 0;
    const s: any = currentSession as any;

    if (typeof s.durationMinutes === "number") {
      return s.durationMinutes;
    }
    if (typeof s.duration === "number") {
      return s.duration;
    }
    const endVal = s.endTime || s.checkOutTime;
    if (startDate && endVal) {
      let endDate: Date;
      if (endVal instanceof Timestamp) {
        endDate = endVal.toDate();
      } else if (typeof endVal?.toDate === "function") {
        endDate = endVal.toDate();
      } else if (typeof endVal.seconds === "number") {
        // Handle plain object from Firestore cache {seconds, nanoseconds}
        endDate = new Date(endVal.seconds * 1000 + (endVal.nanoseconds || 0) / 1000000);
      } else {
        endDate = new Date(endVal);
      }
      const diffMs = endDate.getTime() - startDate.getTime();
      return Math.max(0, Math.round(diffMs / 60000));
    }
    return 0;
  }, [currentSession, startDate]);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (currentSession && status === "active" && startDate) {
      setIsRunning(true);
      const tick = () => {
        const now = Date.now();
        setElapsedMinutes(
          Math.max(0, Math.floor((now - startDate.getTime()) / 60000))
        );
      };
      tick();
      timer = setInterval(tick, 60000);
    } else {
      setIsRunning(false);
      setElapsedMinutes(computedDuration);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [currentSession, status, startDate, computedDuration]);

  // Load location info
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!currentSession) {
        setLocationInfo(null);
        return;
      }
      const s: any = currentSession as any;
      if (s.location && typeof s.location.latitude === "number") {
        if (!cancelled)
          setLocationInfo({
            name: s.schoolName,
            latitude: s.location.latitude,
            longitude: s.location.longitude,
          });
        return;
      }
      if (s.locationId) {
        try {
          const loc = (await getCachedDocument<Location>(
            COLLECTIONS.LOCATIONS,
            s.locationId
          )) as Location | null;
          if (!cancelled && loc) {
            const normalized = normalizeLocationData(loc.id, {
              ...(loc as unknown as Record<string, unknown>),
            });
            if (normalized) {
              const lat = Number.isFinite(normalized.latitude)
                ? normalized.latitude
                : normalized.geo.latitude;
              const lng = Number.isFinite(normalized.longitude)
                ? normalized.longitude
                : normalized.geo.longitude;
              setLocationInfo({
                name: normalized.name || (s as any).name,
                latitude: lat,
                longitude: lng,
              });
            } else {
              setLocationInfo({
                name: loc.name || (s as any).name,
              });
            }
          }
        } catch {
          if (!cancelled) setLocationInfo({ name: (s as any).name });
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [currentSession]);

  const formatDuration = (minutes: number): string => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const formatTime = (date: Date): string =>
    date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

  const handleEnd = () => {
    if (currentSession && onEndSession)
      onEndSession((currentSession as any).id);
  };

  // Empty state
  if (!currentSession) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <Timer className="h-5 w-5 mr-2 text-brand-primary" />
            Current Session
          </CardTitle>
          <CardDescription>No active session</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">
              You're not currently checked in at any school
            </p>
            <p className="text-sm text-muted-foreground">
              Check in at a school to start tracking your session
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center text-lg">
              <Timer className="h-5 w-5 mr-2 text-brand-primary" />
              Current Session
            </CardTitle>
            <CardDescription>
              {startDate ? `Started at ${formatTime(startDate)}` : ""}
            </CardDescription>
          </div>
          {status && <StatusBadge status={status as any} />}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* School Information */}
        <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
          <SchoolIcon className="h-5 w-5 text-brand-primary" />
          <div>
            <p className="font-medium text-foreground">
              {locationInfo?.name ||
                (currentSession as any).schoolName ||
                (currentSession as any).name}
            </p>
            <div className="flex items-center text-sm text-muted-foreground mt-1">
              <MapPin className="h-3 w-3 mr-1" />
              <span>
                {typeof locationInfo?.latitude === "number" &&
                typeof locationInfo?.longitude === "number"
                  ? `${locationInfo.latitude.toFixed(
                      4
                    )}, ${locationInfo.longitude.toFixed(4)}`
                  : "Coordinates unavailable"}
              </span>
            </div>
          </div>
        </div>

        {/* Session Timer */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-brand-primary rounded-full mb-4">
            <div className="text-center text-white">
              <div className="text-2xl font-bold">
                {formatDuration(elapsedMinutes)}
              </div>
              <div className="text-xs opacity-80">
                {isRunning ? "ACTIVE" : String(status || "").toUpperCase()}
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Session duration</p>
        </div>

        {/* Session Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-muted/20 rounded-lg">
            <div className="text-lg font-semibold text-foreground">
              {startDate ? formatTime(startDate) : "—"}
            </div>
            <div className="text-sm text-muted-foreground">Start Time</div>
          </div>
          <div className="text-center p-3 bg-muted/20 rounded-lg">
            <div className="text-lg font-semibold text-foreground">
              {status === "completed" ? "Ended" : "Ongoing"}
            </div>
            <div className="text-sm text-muted-foreground">Status</div>
          </div>
        </div>

        {/* Action Button - Full width on mobile */}
        {status === "active" && onEndSession && (
          <div className="flex gap-3">
            <Button
              onClick={handleEnd}
              className="w-full sm:w-auto flex-1 bg-red-600 hover:bg-red-700 touch-target"
            >
              End Session
            </Button>
          </div>
        )}

        {/* Auto check-out info when auto mode is active */}
        {status === "active" && !onEndSession && (
          <div className="flex items-start gap-3 p-3 bg-muted/20 rounded-lg border">
            <MapPin className="h-5 w-5 text-brand-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground mb-1">
                Auto Check-Out Enabled
              </p>
              <p className="text-muted-foreground text-sm">
                You&apos;ll be automatically checked out when you leave this
                location.
              </p>
            </div>
          </div>
        )}

        {/* Session completed info */}
        {status === "completed" && (
          <div className="flex items-start gap-3 p-3 bg-brand-primary/5 rounded-lg border border-brand-primary/20">
            <CheckCircle className="h-5 w-5 text-brand-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-brand-primary mb-1">
                Session Completed
              </p>
              <p className="text-brand-primary/80 text-sm">
                This session has been completed and the time has been recorded.
                Total duration: {formatDuration(computedDuration)}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SessionStatus;
