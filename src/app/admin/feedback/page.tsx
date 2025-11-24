"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Loader2, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function AdminFeedbackList() {
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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
        return "destructive"; // Red for attention
      case "in_progress":
        return "default"; // Blue/Primary
      case "resolved":
        return "success"; // Green
      case "closed":
        return "secondary"; // Gray
      default:
        return "outline";
    }
  }

  function getSeverityBadge(severity: Feedback["severity"]) {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      low: "secondary",
      medium: "outline",
      high: "default",
      critical: "destructive",
    };
    
    return <Badge variant={variants[severity] || "outline"}>{severity}</Badge>;
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
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                      {item.createdAt?.toDate ? formatDistanceToNow(item.createdAt.toDate(), { addSuffix: true }) : "Just now"}
                    </TableCell>
                    <TableCell className="capitalize">{item.category.replace("_", " ")}</TableCell>
                    <TableCell>{getSeverityBadge(item.severity)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{item.providerName || "Unknown"}</span>
                        <span className="text-xs text-muted-foreground">{item.providerEmail}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate" title={item.description}>
                      {item.description}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => router.push(`/admin/feedback/${item.id}`)}
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
    </div>
  );
}

