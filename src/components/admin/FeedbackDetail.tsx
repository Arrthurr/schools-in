"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { feedbackService } from "@/lib/services/feedbackService";
import { Feedback } from "@/lib/firebase/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowLeft, ExternalLink, Mail, User, Monitor } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";

export function FeedbackDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (typeof id === "string") {
      loadFeedback(id);
    }
  }, [id]);

  async function loadFeedback(feedbackId: string) {
    setLoading(true);
    try {
      const data = await feedbackService.getFeedbackById(feedbackId);
      setFeedback(data);
    } catch (error) {
      console.error("Error loading feedback details:", error);
      toast({
        title: "Error",
        description: "Could not load feedback details.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (!feedback) return;

    setUpdating(true);
    try {
      await feedbackService.updateStatus(feedback.id, newStatus as Feedback["status"]);
      setFeedback({ ...feedback, status: newStatus as Feedback["status"] });
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

  if (!feedback) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-2xl font-bold mb-4">Feedback Not Found</h2>
        <Button onClick={() => router.push("/admin/feedback")}>Back to List</Button>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-6 mx-auto">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.push("/admin/feedback")} className="mb-4 pl-0 hover:bg-transparent">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Feedback
        </Button>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold">Feedback Details</h1>
              <Badge variant="outline" className="text-sm uppercase">
                {feedback.id.slice(0, 8)}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Submitted on {feedback.createdAt?.toDate ? format(feedback.createdAt.toDate(), "PPP p") : "Unknown Date"}
            </p>
          </div>

          <div className="flex items-center gap-3">
             <div className="w-[200px]">
              <Select
                value={feedback.status}
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
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
              <div className="flex gap-2 mt-2">
                <Badge>{feedback.category.replace("_", " ")}</Badge>
                <Badge variant={
                  feedback.severity === "critical" ? "destructive" :
                  feedback.severity === "high" ? "default" :
                  feedback.severity === "low" ? "secondary" : "outline"
                }>
                  Severity: {feedback.severity}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="prose max-w-none">
              <p className="whitespace-pre-wrap text-base">{feedback.description}</p>
            </CardContent>
          </Card>

          {feedback.url && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Context</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">Source URL:</span>
                  <a
                    href={feedback.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1 truncate max-w-full"
                  >
                    {feedback.url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                {feedback.userAgent && (
                  <div className="flex items-start gap-2 text-sm mt-3">
                    <Monitor className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <span className="text-muted-foreground break-all">{feedback.userAgent}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Reporter Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="bg-secondary p-2 rounded-full">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium">{feedback.providerName || "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">Provider</p>
                </div>
              </div>

              {feedback.providerEmail && (
                <div className="flex items-center gap-3">
                  <div className="bg-secondary p-2 rounded-full">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{feedback.providerEmail}</p>
                    <p className="text-xs text-muted-foreground">Contact Email</p>
                  </div>
                </div>
              )}

              <Separator />

              <div className="text-xs text-muted-foreground">
                <p>User ID:</p>
                <code className="bg-muted p-1 rounded">{feedback.providerId}</code>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
