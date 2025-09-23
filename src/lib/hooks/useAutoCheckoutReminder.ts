"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useCachedAuth } from "@/lib/hooks/useCachedAuth";
import { useCachedSession } from "@/lib/hooks/useCachedSession";

interface AutoCheckoutReminderOptions {
  reminderIntervalMinutes?: number; // Default: 120 (2 hours)
  warningIntervalMinutes?: number; // Default: 110 (1h 50m)
  enabled?: boolean; // Default: true
}

/**
 * Hook that provides automatic check-out reminders for active sessions
 * Shows notifications when providers have been checked in for too long
 */
export function useAutoCheckoutReminder(
  options: AutoCheckoutReminderOptions = {}
) {
  const {
    reminderIntervalMinutes = 120, // 2 hours
    warningIntervalMinutes = 110, // 1h 50m warning
    enabled = true,
  } = options;

  const { toast } = useToast();
  const { user } = useCachedAuth();
  const { activeSession } = useCachedSession(user?.uid);

  const [hasShownWarning, setHasShownWarning] = useState(false);
  const [hasShownReminder, setHasShownReminder] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const notificationPermissionRef = useRef<NotificationPermission>("default");

  // Request notification permission on mount
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    if ("Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().then((permission) => {
          notificationPermissionRef.current = permission;
        });
      } else {
        notificationPermissionRef.current = Notification.permission;
      }
    }
  }, [enabled]);

  // Show browser notification if permission granted
  const showBrowserNotification = (title: string, body: string) => {
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      notificationPermissionRef.current === "granted"
    ) {
      try {
        const notification = new Notification(title, {
          body,
          icon: "/favicon.ico",
          tag: "checkout-reminder", // Prevents duplicate notifications
          requireInteraction: true, // Keeps notification visible until user interacts
        });

        // Auto-close notification after 10 seconds
        setTimeout(() => notification.close(), 10000);

        // Handle notification click
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch (error) {
        console.warn("Failed to show browser notification:", error);
      }
    }
  };

  // Check if reminder should be shown
  const checkForReminder = () => {
    if (!activeSession || activeSession.status !== "active") {
      // Reset flags when no active session
      setHasShownWarning(false);
      setHasShownReminder(false);
      return;
    }

    const startTime =
      activeSession.startTime instanceof Date
        ? activeSession.startTime
        : activeSession.startTime.toDate();

    const now = new Date();
    const minutesElapsed = Math.floor(
      (now.getTime() - startTime.getTime()) / (1000 * 60)
    );

    // Show warning at 1h 50m
    if (minutesElapsed >= warningIntervalMinutes && !hasShownWarning) {
      setHasShownWarning(true);

      const remainingMinutes = reminderIntervalMinutes - minutesElapsed;

      toast({
        title: "Check-out Reminder",
        description: `You've been checked in for ${Math.floor(
          minutesElapsed / 60
        )}h ${
          minutesElapsed % 60
        }m. Consider checking out in ${remainingMinutes} minutes.`,
        variant: "default",
      });

      showBrowserNotification(
        "Check-out Reminder",
        `You've been checked in for ${Math.floor(minutesElapsed / 60)}h ${
          minutesElapsed % 60
        }m`
      );
    }

    // Show main reminder at 2 hours
    if (minutesElapsed >= reminderIntervalMinutes && !hasShownReminder) {
      setHasShownReminder(true);

      toast({
        title: "Auto Check-out Reminder",
        description: `You've been checked in for ${Math.floor(
          minutesElapsed / 60
        )}h ${minutesElapsed % 60}m. Please check out when you're finished.`,
        variant: "destructive",
      });

      showBrowserNotification(
        "Auto Check-out Reminder",
        `You've been checked in for ${Math.floor(minutesElapsed / 60)}h ${
          minutesElapsed % 60
        }m. Please check out.`
      );
    }
  };

  // Set up interval when there's an active session
  useEffect(() => {
    if (!enabled) return;

    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (activeSession?.status === "active") {
      // Check immediately
      checkForReminder();

      // Then check every 5 minutes
      intervalRef.current = setInterval(checkForReminder, 5 * 60 * 1000);
    } else {
      // Reset flags when session ends
      setHasShownWarning(false);
      setHasShownReminder(false);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [
    activeSession?.id,
    activeSession?.status,
    enabled,
    hasShownWarning,
    hasShownReminder,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Calculate time until next reminder
  const getTimeUntilReminder = () => {
    if (!activeSession || activeSession.status !== "active") return null;

    const startTime =
      activeSession.startTime instanceof Date
        ? activeSession.startTime
        : activeSession.startTime.toDate();

    const now = new Date();
    const minutesElapsed = Math.floor(
      (now.getTime() - startTime.getTime()) / (1000 * 60)
    );

    if (!hasShownWarning && minutesElapsed < warningIntervalMinutes) {
      return warningIntervalMinutes - minutesElapsed;
    }

    if (!hasShownReminder && minutesElapsed < reminderIntervalMinutes) {
      return reminderIntervalMinutes - minutesElapsed;
    }

    return null;
  };

  // Get current session duration
  const getCurrentSessionDuration = () => {
    if (!activeSession || activeSession.status !== "active") return null;

    const startTime =
      activeSession.startTime instanceof Date
        ? activeSession.startTime
        : activeSession.startTime.toDate();

    const now = new Date();
    return Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60));
  };

  return {
    hasShownWarning,
    hasShownReminder,
    timeUntilReminder: getTimeUntilReminder(),
    currentSessionDuration: getCurrentSessionDuration(),
    isReminderActive: enabled && activeSession?.status === "active",
    notificationPermission: notificationPermissionRef.current,
  };
}
