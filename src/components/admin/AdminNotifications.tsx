"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BellRing, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNotifications } from "@/lib/hooks/useNotifications";
import {
  getNotificationActionHref,
  getNotificationActionLabel,
  getNotificationPreview,
  getNotificationTypeLabel,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils/time";

export function AdminNotifications() {
  const searchParams = useSearchParams();
  const highlightedNotificationId = searchParams.get("notification");
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } =
    useNotifications();

  const handleMarkAsRead = async (notificationId: string) => {
    await markAsRead(notificationId);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Notifications</h1>
          <p className="mt-1 text-muted-foreground">
            Review late-provider alerts and session notes in one place.
          </p>
        </div>

        {unreadCount > 0 && (
          <Button variant="outline" onClick={markAllAsRead}>
            Mark all as read
          </Button>
        )}
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading notifications...
          </CardContent>
        </Card>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <BellRing className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">No notifications yet</p>
              <p className="text-sm text-muted-foreground">
                Late providers and session notes will appear here.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => {
            const actionHref = getNotificationActionHref(notification);
            const isHighlighted = highlightedNotificationId === notification.id;

            return (
              <Card
                key={notification.id}
                className={cn(
                  "transition-colors",
                  !notification.read && "border-primary/30 bg-primary/5",
                  isHighlighted && "ring-2 ring-primary/25"
                )}
              >
                <CardHeader className="gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          notification.type === "late_provider"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {getNotificationTypeLabel(notification)}
                      </Badge>
                      {!notification.read && <Badge variant="outline">Unread</Badge>}
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {notification.providerName}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {notification.locationName}
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground sm:text-right">
                    {formatRelativeTime(notification.createdAt)}
                  </p>
                </CardHeader>

                <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <p className="text-sm text-foreground">
                    {getNotificationPreview(notification)}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {!notification.read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleMarkAsRead(notification.id)}
                      >
                        Mark as read
                      </Button>
                    )}
                    <Button asChild size="sm">
                      <Link
                        href={actionHref}
                        onClick={() => {
                          if (!notification.read) {
                            void handleMarkAsRead(notification.id);
                          }
                        }}
                      >
                        {getNotificationActionLabel(notification)}
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
