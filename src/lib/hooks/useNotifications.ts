"use client";

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  type QueryConstraint,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
  getDocs,
} from "firebase/firestore";
import { db } from "../../../firebase.config";
import { useCachedAuth } from "./useCachedAuth";
import { appLogger } from "@/lib/logging/appLogger";
import { AppNotification } from "@/lib/firebase/types";

export type NotificationItem = AppNotification;

const DEFAULT_NOTIFICATION_LIMIT = 20;

interface UseNotificationsReturn {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export function useNotifications(maxItems?: number): UseNotificationsReturn {
  const { user } = useCachedAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const queryConstraints: QueryConstraint[] = [orderBy("createdAt", "desc")];
    const effectiveMaxItems = maxItems ?? null;

    if (effectiveMaxItems !== null) {
      queryConstraints.push(limit(effectiveMaxItems));
    }

    const q = query(
      collection(db, "users", user.uid, "notifications"),
      ...queryConstraints
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as NotificationItem[];
        setNotifications(items);
        setLoading(false);
      },
      (error) => {
        appLogger.error("Notifications listener error", { error });
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user?.uid, maxItems]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!user?.uid) return;

      const notifRef = doc(
        db,
        "users",
        user.uid,
        "notifications",
        notificationId
      );
      await updateDoc(notifRef, { read: true });
    },
    [user?.uid]
  );

  const markAllAsRead = useCallback(async () => {
    if (!user?.uid) return;

    const unreadQuery = query(
      collection(db, "users", user.uid, "notifications"),
      where("read", "==", false)
    );

    const snapshot = await getDocs(unreadQuery);
    if (snapshot.empty) return;

    const BATCH_LIMIT = 500;
    for (let i = 0; i < snapshot.docs.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      snapshot.docs.slice(i, i + BATCH_LIMIT).forEach((d) => {
        batch.update(d.ref, { read: true });
      });
      await batch.commit();
    }
  }, [user?.uid]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
  };
}

export { DEFAULT_NOTIFICATION_LIMIT };
