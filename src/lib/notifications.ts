import type { AppNotification } from "@/lib/firebase/types";

const scheduledTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

function formatScheduledTime(scheduledTime: string): string {
  const [hours, minutes] = scheduledTime.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return scheduledTime;
  }

  return scheduledTimeFormatter.format(new Date(2000, 0, 1, hours, minutes));
}

export function getNotificationCenterHref(notificationId?: string): string {
  if (!notificationId) {
    return "/admin/notifications";
  }

  return `/admin/notifications?notification=${encodeURIComponent(notificationId)}`;
}

export function getNotificationActionHref(
  notification: AppNotification
): "/admin/notes" | "/admin/schedules" {
  if (notification.type === "late_provider") {
    return "/admin/schedules";
  }

  return "/admin/notes";
}

export function getNotificationActionLabel(notification: AppNotification): string {
  if (notification.type === "late_provider") {
    return "Open schedules";
  }

  return "Open notes";
}

export function getNotificationTypeLabel(notification: AppNotification): string {
  if (notification.type === "late_provider") {
    return "Late provider";
  }

  return "Session note";
}

export function getNotificationPreview(notification: AppNotification): string {
  if (notification.type === "late_provider") {
    const minuteLabel = notification.minutesLate === 1 ? "minute" : "minutes";
    return `${notification.minutesLate} ${minuteLabel} late for ${formatScheduledTime(notification.scheduledTime)}`;
  }

  return notification.notePreview;
}
