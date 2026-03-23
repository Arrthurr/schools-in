"use client";

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
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

export interface NotificationItem {
  id: string;
  type: "session_note";
  sessionId: string;
  providerId: string;
  providerName: string;
  locationName: string;
  notePreview: string;
  read: boolean;
  createdAt: any;
}

interface UseNotificationsReturn {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export function useNotifications(maxItems = 20): UseNotificationsReturn {
  const { user } = useCachedAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "users", user.uid, "notifications"),
      orderBy("createdAt", "desc"),
      limit(maxItems)
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
        console.error("Notifications listener error:", error);
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

    const batch = writeBatch(db);
    snapshot.docs.forEach((d) => {
      batch.update(d.ref, { read: true });
    });
    await batch.commit();
  }, [user?.uid]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
  };
}
