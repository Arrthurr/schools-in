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
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../../../firebase.config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, FileText, ChevronDown, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface SessionNote {
  id: string;
  userId: string;
  locationId: string;
  startTime: any;
  endTime?: any;
  status: string;
  notes: string;
  notesUpdatedAt?: any;
  updatedAt?: any;
}

const PAGE_SIZE = 25;

export function AdminSessionNotes() {
  const [sessions, setSessions] = useState<SessionNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [locationNames, setLocationNames] = useState<Record<string, string>>(
    {}
  );
  const [selectedNote, setSelectedNote] = useState<SessionNote | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadUserName = useCallback(
    async (userId: string) => {
      if (userNames[userId]) return;
      try {
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserNames((prev) => ({
            ...prev,
            [userId]: data.displayName || data.email || "Unknown",
          }));
        }
      } catch {
        // ignore
      }
    },
    [userNames]
  );

  const loadLocationName = useCallback(
    async (locationId: string) => {
      if (locationNames[locationId]) return;
      try {
        const locDoc = await getDoc(doc(db, COLLECTIONS.LOCATIONS, locationId));
        if (locDoc.exists()) {
          setLocationNames((prev) => ({
            ...prev,
            [locationId]: locDoc.data().name || "Unknown",
          }));
        }
      } catch {
        // ignore
      }
    },
    [locationNames]
  );

  const loadSessions = useCallback(
    async (afterDoc?: DocumentSnapshot) => {
      const isLoadMore = !!afterDoc;
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        let q = query(
          collection(db, COLLECTIONS.SESSIONS),
          where("notes", "!=", ""),
          orderBy("notes"),
          orderBy("updatedAt", "desc"),
          limit(PAGE_SIZE + 1)
        );

        if (afterDoc) {
          q = query(
            collection(db, COLLECTIONS.SESSIONS),
            where("notes", "!=", ""),
            orderBy("notes"),
            orderBy("updatedAt", "desc"),
            startAfter(afterDoc),
            limit(PAGE_SIZE + 1)
          );
        }

        const snapshot = await getDocs(q);
        const docs = snapshot.docs;
        const hasMoreResults = docs.length > PAGE_SIZE;
        const pageDocs = hasMoreResults ? docs.slice(0, PAGE_SIZE) : docs;

        const newSessions = pageDocs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as SessionNote[];

        // Load names for new entries
        const newUserIds = [
          ...new Set(newSessions.map((s) => s.userId).filter(Boolean)),
        ];
        const newLocationIds = [
          ...new Set(newSessions.map((s) => s.locationId).filter(Boolean)),
        ];

        await Promise.all([
          ...newUserIds.map(loadUserName),
          ...newLocationIds.map(loadLocationName),
        ]);

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
    [loadUserName, loadLocationName]
  );

  useEffect(() => {
    loadSessions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "—";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTimeAgo = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return formatDistanceToNow(date, { addSuffix: true });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Session Notes</h1>
        <Button
          onClick={() => loadSessions()}
          variant="outline"
          size="sm"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Provider Notes ({sessions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>School</TableHead>
                <TableHead>Session Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No session notes found.
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((session) => (
                  <TableRow
                    key={session.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setSelectedNote(session);
                      setDialogOpen(true);
                    }}
                  >
                    <TableCell className="font-medium">
                      {userNames[session.userId] || "Loading..."}
                    </TableCell>
                    <TableCell>
                      {locationNames[session.locationId] || "Loading..."}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(session.startTime)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          session.status === "active"
                            ? "default"
                            : session.status === "completed"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {session.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {session.notes}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTimeAgo(
                        session.notesUpdatedAt || session.updatedAt
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {hasMore && (
            <div className="text-center pt-4">
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
        </CardContent>
      </Card>

      {/* Note Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Session Note</DialogTitle>
          </DialogHeader>
          {selectedNote && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Provider</span>
                  <p className="font-medium">
                    {userNames[selectedNote.userId] || "Unknown"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">School</span>
                  <p className="font-medium">
                    {locationNames[selectedNote.locationId] || "Unknown"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Session Date</span>
                  <p className="font-medium">
                    {formatDate(selectedNote.startTime)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <p>
                    <Badge variant="outline">{selectedNote.status}</Badge>
                  </p>
                </div>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Note</span>
                <p className="mt-1 text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3">
                  {selectedNote.notes}
                </p>
              </div>
              {selectedNote.notesUpdatedAt && (
                <p className="text-xs text-muted-foreground">
                  Note updated {formatTimeAgo(selectedNote.notesUpdatedAt)}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
