"use client";

import { useEffect, useState } from "react";
import { feedbackService } from "@/lib/services/feedbackService";
import { Feedback } from "@/lib/firebase/types";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Loader2,
  Eye,
  ExternalLink,
  Mail,
  User,
  Monitor,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminNavigation } from "@/components/admin/AdminNavigation";

function FeedbackContent() {
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(
    null
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadFeedback();
  }, []);

  async function loadFeedback() {
    setLoading(true);
    try {
      const data = await feedbackService.getAllFeedback();
      setFeedbackList(data);
    } catch (error) {
      console.error("Error loading feedback:", error);
    } finally {
      setLoading(false);
    }
  }

  function getStatusColor(status: Feedback["status"]) {
    switch (status) {
      case "open":
        return "destructive";
      case "in_progress":
        return "default";
      case "resolved":
        return "success";
      case "closed":
        return "secondary";
      default:
        return "outline";
    }
  }

  function getSeverityBadge(severity: Feedback["severity"]) {
    const variants: Record<
      string,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      low: "secondary",
      medium: "outline",
      high: "default",
      critical: "destructive",
    };

    return <Badge variant={variants[severity] || "outline"}>{severity}</Badge>;
  }

  function openFeedbackDetail(feedback: Feedback) {
    setSelectedFeedback(feedback);
    setIsDialogOpen(true);
  }

  async function handleStatusChange(newStatus: string) {
    if (!selectedFeedback) return;

    setUpdating(true);
    try {
      await feedbackService.updateStatus(
        selectedFeedback.id,
        newStatus as Feedback["status"]
      );
      // Update the selected feedback
      setSelectedFeedback({
        ...selectedFeedback,
        status: newStatus as Feedback["status"],
      });
      // Update the list
      setFeedbackList((prev) =>
        prev.map((item) =>
          item.id === selectedFeedback.id
            ? { ...item, status: newStatus as Feedback["status"] }
            : item
        )
      );
      toast({
        title: "Status Updated",
        description: `Feedback marked as ${newStatus.replace("_", " ")}.`,
      });
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        title: "Update Failed",
        description: "Could not update status.",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Provider Feedback</h1>
        <Button onClick={loadFeedback} variant="outline">
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Feedback ({feedbackList.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feedbackList.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No feedback submissions found.
                  </TableCell>
                </TableRow>
              ) : (
                feedbackList.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant={getStatusColor(item.status) as any}>
                        {item.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {item.createdAt?.toDate
                        ? formatDistanceToNow(item.createdAt.toDate(), {
                            addSuffix: true,
                          })
                        : "Just now"}
                    </TableCell>
                    <TableCell className="capitalize">
                      {item.category.replace("_", " ")}
                    </TableCell>
                    <TableCell>{getSeverityBadge(item.severity)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {item.providerName || "Unknown"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {item.providerEmail}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell
                      className="max-w-xs truncate"
                      title={item.description}
                    >
                      {item.description}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openFeedbackDetail(item)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Feedback Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl">Feedback Details</DialogTitle>
              {selectedFeedback && (
                <Badge variant="outline" className="text-xs uppercase">
                  {selectedFeedback.id.slice(0, 8)}
                </Badge>
              )}
            </div>
          </DialogHeader>

          {selectedFeedback && (
            <div className="space-y-6">
              {/* Status and Meta */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <p className="text-sm text-muted-foreground">
                  Submitted on{" "}
                  {selectedFeedback.createdAt?.toDate
                    ? format(selectedFeedback.createdAt.toDate(), "PPP p")
                    : "Unknown Date"}
                </p>
                <div className="w-full sm:w-[180px]">
                  <Select
                    value={selectedFeedback.status}
                    onValueChange={handleStatusChange}
                    disabled={updating}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Category and Severity */}
              <div className="flex gap-2">
                <Badge>{selectedFeedback.category.replace("_", " ")}</Badge>
                <Badge
                  variant={
                    selectedFeedback.severity === "critical"
                      ? "destructive"
                      : selectedFeedback.severity === "high"
                        ? "default"
                        : selectedFeedback.severity === "low"
                          ? "secondary"
                          : "outline"
                  }
                >
                  Severity: {selectedFeedback.severity}
                </Badge>
              </div>

              {/* Description */}
              <div>
                <h4 className="font-semibold mb-2">Description</h4>
                <p className="whitespace-pre-wrap text-sm">
                  {selectedFeedback.description}
                </p>
              </div>

              {/* Context */}
              {(selectedFeedback.url || selectedFeedback.userAgent) && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Context</h4>
                    {selectedFeedback.url && (
                      <div className="flex items-center gap-2 text-sm mb-2">
                        <span className="font-medium">Source URL:</span>
                        <a
                          href={selectedFeedback.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1 truncate"
                        >
                          {selectedFeedback.url}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                    {selectedFeedback.userAgent && (
                      <div className="flex items-start gap-2 text-sm">
                        <Monitor className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <span className="text-muted-foreground break-all text-xs">
                          {selectedFeedback.userAgent}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}

              <Separator />

              {/* Reporter Info */}
              <div>
                <h4 className="font-semibold mb-3">Reporter Info</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-secondary p-2 rounded-full">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {selectedFeedback.providerName || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">Provider</p>
                    </div>
                  </div>

                  {selectedFeedback.providerEmail && (
                    <div className="flex items-center gap-3">
                      <div className="bg-secondary p-2 rounded-full">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {selectedFeedback.providerEmail}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Contact Email
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground pt-2">
                    <p>User ID:</p>
                    <code className="bg-muted p-1 rounded">
                      {selectedFeedback.providerId}
                    </code>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminFeedbackPage() {
  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminNavigation>
        <FeedbackContent />
      </AdminNavigation>
    </ProtectedRoute>
  );
}
