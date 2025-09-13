"use client";

import { useState, useEffect } from "react";
import { Badge } from "../ui/badge";
import { Clock } from "lucide-react";
import { formatDuration } from "../../lib/utils/session";
import { Timestamp } from "firebase/firestore";

interface SessionTimerDisplayProps {
  checkInTime: Timestamp;
  isActive?: boolean;
  className?: string;
  showLabel?: boolean;
  compact?: boolean;
}

export const SessionTimerDisplay: React.FC<SessionTimerDisplayProps> = ({
  checkInTime,
  isActive = true,
  className = "",
  showLabel = true,
  compact = false,
}) => {
  const [currentDuration, setCurrentDuration] = useState<number>(0);

  // Update timer every minute for active sessions
  useEffect(() => {
    if (!isActive) {
      // Calculate final duration for completed sessions
      const now = Date.now();
      const checkInMs = checkInTime.toMillis();
      const durationMinutes = Math.floor((now - checkInMs) / (1000 * 60));
      setCurrentDuration(durationMinutes);
      return;
    }

    // Update live duration for active sessions
    const updateDuration = () => {
      const now = Date.now();
      const checkInMs = checkInTime.toMillis();
      const durationMinutes = Math.floor((now - checkInMs) / (1000 * 60));
      setCurrentDuration(durationMinutes);
    };

    updateDuration(); // Update immediately

    const interval = setInterval(updateDuration, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [checkInTime, isActive]);

  if (compact) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <Clock className="h-3 w-3" />
        <span className="text-xs font-medium">
          {formatDuration(currentDuration)}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg ${className}`}
    >
      <Clock className="h-4 w-4 text-green-600" />
      {showLabel && (
        <span className="text-sm font-medium text-green-800">
          Session {isActive ? "Active" : "Duration"}:
        </span>
      )}
      <span className="text-sm font-medium text-green-800">
        {formatDuration(currentDuration)}
      </span>
      {isActive && (
        <Badge
          variant="secondary"
          className="bg-green-100 text-green-700 text-xs"
        >
          Live
        </Badge>
      )}
    </div>
  );
};

export default SessionTimerDisplay;
