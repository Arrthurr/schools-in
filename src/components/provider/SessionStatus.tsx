"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { StatusBadge } from "../ui/status-badge";
import { Clock, MapPin, Timer, CheckCircle, School as SchoolIcon } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { Session as NormalizedSession, Location } from "@/lib/firebase/types";
import { getCachedDocument } from "@/lib/firebase/cachedFirestore";
import { COLLECTIONS } from "@/lib/firebase/firestore";

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

export const SessionStatus: React.FC<SessionStatusProps> = ({ currentSession, onEndSession, className = "" }) => {
  const [elapsedMinutes, setElapsedMinutes] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [locationInfo, setLocationInfo] = useState<{ name?: string; latitude?: number; longitude?: number } | null>(
    null
  );

  const status = (currentSession as any)?.status as string | undefined;

  const startDate: Date | null = useMemo(() => {
    if (!currentSession) return null;
    const st: any = (currentSession as any).startTime;
    if (!st) return null;
    if (st instanceof Date) return st;
    if (st instanceof Timestamp) return st.toDate();
    if (typeof st?.toDate === "function") return st.toDate();
    return new Date(st);
  }, [currentSession]);

  const computedDuration = useMemo(() => {
    if (!currentSession) return 0;
    const s: any = currentSession as any;
    
    console.log("Computing duration for session:", {
      durationMinutes: s.durationMinutes,
      duration: s.duration,
      endTime: s.endTime,
      checkOutTime: s.checkOutTime,
      startDate,
      distanceFromCenterAtCheckIn: s.distanceFromCenterAtCheckIn
    });
    
    if (typeof s.durationMinutes === "number") {
      console.log("Using durationMinutes:", s.durationMinutes);
      return s.durationMinutes;
    }
    if (typeof s.duration === "number") {
      console.log("Using duration:", s.duration);
      return s.duration;
    }
    const endVal = s.endTime || s.checkOutTime;
    if (startDate && endVal) {
      const endDate = endVal instanceof Timestamp ? endVal.toDate() : typeof endVal?.toDate === "function" ? endVal.toDate() : new Date(endVal);
      const diffMs = endDate.getTime() - startDate.getTime();
      const minutes = Math.max(0, Math.round(diffMs / 60000));
      console.log("Calculated duration from timestamps:", { diffMs, minutes });
      return minutes;
    }
    console.log("No duration data available, returning 0");
    return 0;
  }, [currentSession, startDate]);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (currentSession && status === "active" && startDate) {
      setIsRunning(true);
      const tick = () => {
        const now = Date.now();
        setElapsedMinutes(Math.max(0, Math.floor((now - startDate.getTime()) / 60000)));
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
        if (!cancelled) setLocationInfo({ name: s.schoolName, latitude: s.location.latitude, longitude: s.location.longitude });
        return;
      }
      if (s.locationId) {
        try {
          const loc = (await getCachedDocument<Location>(COLLECTIONS.LOCATIONS, s.locationId)) as any;
          if (!cancelled) {
            const lat = loc?.geo?.latitude ?? loc?.gpsCoordinates?.latitude ?? loc?.latitude;
            const lng = loc?.geo?.longitude ?? loc?.gpsCoordinates?.longitude ?? loc?.longitude;
            setLocationInfo({ name: loc?.name || s.locationId, latitude: lat, longitude: lng });
          }
        } catch {
          if (!cancelled) setLocationInfo({ name: s.locationId });
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

  const formatTime = (date: Date): string => date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

  const handleEnd = () => {
    if (currentSession && onEndSession) onEndSession((currentSession as any).id);
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
            <Clock className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <p className="text-gray-600 mb-4">You're not currently checked in at any school</p>
            <p className="text-sm text-gray-500">Check in at a school to start tracking your session</p>
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
            <CardDescription>{startDate ? `Started at ${formatTime(startDate)}` : ""}</CardDescription>
          </div>
          {status && <StatusBadge status={status as any} />}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* School Information */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <SchoolIcon className="h-5 w-5 text-brand-primary" />
          <div>
            <p className="font-medium text-gray-900">
              {locationInfo?.name || (currentSession as any).schoolName || (currentSession as any).locationId}
            </p>
            <div className="flex items-center text-sm text-gray-600 mt-1">
              <MapPin className="h-3 w-3 mr-1" />
              <span>
                {typeof locationInfo?.latitude === "number" && typeof locationInfo?.longitude === "number"
                  ? `${locationInfo.latitude.toFixed(4)}, ${locationInfo.longitude.toFixed(4)}`
                  : "Coordinates unavailable"}
              </span>
            </div>
          </div>
        </div>

        {/* Session Timer */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-brand-primary rounded-full mb-4">
            <div className="text-center text-white">
              <div className="text-2xl font-bold">{formatDuration(elapsedMinutes)}</div>
              <div className="text-xs opacity-80">{isRunning ? "ACTIVE" : String(status || "").toUpperCase()}</div>
            </div>
          </div>
          <p className="text-sm text-gray-600">Session duration</p>
        </div>

        {/* Session Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-semibold text-gray-900">{startDate ? formatTime(startDate) : "—"}</div>
            <div className="text-sm text-gray-600">Start Time</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-semibold text-gray-900">{status === "completed" ? "Ended" : "Ongoing"}</div>
            <div className="text-sm text-gray-600">Status</div>
          </div>
        </div>

        {/* Action Button */}
        {status === "active" && (
          <div className="flex gap-3">
            <Button onClick={handleEnd} className="flex-1 bg-red-600 hover:bg-red-700">
              End Session
            </Button>
          </div>
        )}

        {/* Session completed info */}
        {status === "completed" && (
          <div className="flex items-start gap-3 p-3 bg-brand-primary/5 rounded-lg border border-brand-primary/20">
            <CheckCircle className="h-5 w-5 text-brand-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-brand-primary mb-1">Session Completed</p>
              <p className="text-brand-primary/80 text-sm">
                This session has been completed and the time has been recorded. Total duration: {formatDuration(
                  computedDuration
                )}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SessionStatus;
