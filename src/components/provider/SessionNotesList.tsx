"use client";

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  startAfter,
  DocumentSnapshot,
} from "firebase/firestore";
import { db } from "../../../firebase.config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useCachedAuth } from "@/lib/hooks/useCachedAuth";
import { useSession } from "@/lib/hooks/useSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ChevronDown, Loader2 } from "lucide-react";
import { SessionNoteEditor } from "./SessionNoteEditor";
import { cn } from "@/lib/utils";

interface SessionWithNote {
  id: string;
  locationId: string;
  startTime: any;
  endTime?: any;
  status: string;
  notes?: string;
  notesUpdatedAt?: any;
}

const PAGE_SIZE = 20;

export const SessionNotesList: React.FC = () => {
  const { user } = useCachedAuth();
  const { updateNote } = useSession();
  const [sessions, setSessions] = useState<SessionWithNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [locationNames, setLocationNames] = useState<Record<string, string>>({});

  const loadSessions = useCallback(
    async (afterDoc?: DocumentSnapshot) => {
      if (!user?.uid) return;

      const isLoadMore = !!afterDoc;
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        let q = query(
          collection(db, COLLECTIONS.SESSIONS),
          where("userId", "==", user.uid),
          orderBy("startTime", "desc"),
          limit(PAGE_SIZE + 1)
        );

        if (afterDoc) {
          q = query(
            collection(db, COLLECTIONS.SESSIONS),
            where("userId", "==", user.uid),
            orderBy("startTime", "desc"),
            startAfter(afterDoc),
            limit(PAGE_SIZE + 1)
          );
        }

        const snapshot = await getDocs(q);
        const docs = snapshot.docs;
        const hasMoreResults = docs.length > PAGE_SIZE;
        const pageDocs = hasMoreResults ? docs.slice(0, PAGE_SIZE) : docs;

        const newSessions = pageDocs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as SessionWithNote[];

        // Load location names for new sessions
        const newLocationIds = [
          ...new Set(
            newSessions
              .map((s) => s.locationId)
              .filter((id) => id && !locationNames[id])
          ),
        ];

        if (newLocationIds.length > 0) {
          const locationDocs = await Promise.all(
            newLocationIds.map((id) =>
              getDocs(
                query(
                  collection(db, COLLECTIONS.LOCATIONS),
                  where("__name__", "==", id)
                )
              )
            )
          );

          const newNames: Record<string, string> = {};
          locationDocs.forEach((snap) => {
            snap.docs.forEach((doc) => {
              newNames[doc.id] = doc.data().name || "Unknown";
            });
          });

          setLocationNames((prev) => ({ ...prev, ...newNames }));
        }

        if (isLoadMore) {
          setSessions((prev) => [...prev, ...newSessions]);
        } else {
          setSessions(newSessions);
        }

        setLastDoc(pageDocs[pageDocs.length - 1] || null);
        setHasMore(hasMoreResults);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user?.uid, locationNames]
  );

  useEffect(() => {
    loadSessions();
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveNote = async (sessionId: string, noteText: string): Promise<boolean> => {
    const success = await updateNote(sessionId, noteText);
    if (success) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, notes: noteText } : s
        )
      );
      setEditingId(null);
    }
    return success;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "—";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-8 w-8 mx-auto mb-3 opacity-50" />
        <p>No sessions yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((session) => (
        <Card key={session.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                {locationNames[session.locationId] || "Loading..."}
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {formatDate(session.startTime)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatTime(session.startTime)}
              {session.endTime && ` — ${formatTime(session.endTime)}`}
              {" · "}
              <span
                className={cn(
                  "capitalize",
                  session.status === "active" && "text-green-600",
                  session.status === "completed" && "text-slate-600"
                )}
              >
                {session.status}
              </span>
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            {editingId === session.id ? (
              <SessionNoteEditor
                initialValue={session.notes || ""}
                onSave={(noteText) => handleSaveNote(session.id, noteText)}
                onCancel={() => setEditingId(null)}
                compact
              />
            ) : (
              <div
                className="flex items-start justify-between gap-2 cursor-pointer hover:bg-muted/50 rounded-md p-2 -m-2 transition-colors"
                onClick={() => setEditingId(session.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setEditingId(session.id);
                  }
                }}
              >
                <p className="text-sm text-muted-foreground flex-1">
                  {session.notes || (
                    <span className="italic">Click to add a note...</span>
                  )}
                </p>
                <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {hasMore && (
        <div className="text-center pt-2">
          <Button
            variant="ghost"
            onClick={() => lastDoc && loadSessions(lastDoc)}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ChevronDown className="h-4 w-4 mr-2" />
            )}
            Load more
          </Button>
        </div>
      )}
    </div>
  );
};
