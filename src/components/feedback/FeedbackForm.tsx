"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter, usePathname } from "next/navigation";
import { useCachedAuth } from "@/lib/hooks/useCachedAuth";
import { feedbackService } from "@/lib/services/feedbackService";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const feedbackSchema = z.object({
  category: z.enum(["bug", "feature_request", "general", "other"], {
    required_error: "Please select a category.",
  }),
  severity: z.enum(["low", "medium", "high", "critical"], {
    required_error: "Please select a severity level.",
  }),
  description: z.string().min(10, {
    message: "Description must be at least 10 characters.",
  }),
  providerEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
});

type FeedbackFormValues = z.infer<typeof feedbackSchema>;

export function FeedbackForm() {
  const { user } = useCachedAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultValues: Partial<FeedbackFormValues> = {
    category: "bug",
    severity: "medium",
    description: "",
    providerEmail: user?.email || "",
  };

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackSchema),
    defaultValues,
  });

  async function onSubmit(data: FeedbackFormValues) {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to submit feedback.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await feedbackService.submitFeedback({
        providerId: user.uid,
        providerName: user.displayName || "Unknown Provider",
        providerEmail: data.providerEmail || user.email,
        category: data.category,
        severity: data.severity,
        description: data.description,
        url: window.location.href, // Capture current URL context
        userAgent: navigator.userAgent,
      });

      toast({
        title: "Feedback Submitted",
        description: "Thank you! Your feedback has been received.",
      });

      form.reset();
      // Optional: Redirect back to dashboard after short delay or let them stay
      setTimeout(() => router.push("/provider/dashboard"), 2000);
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast({
        title: "Submission Failed",
        description: "There was a problem submitting your feedback. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Submit Feedback</CardTitle>
        <CardDescription>
          Report a bug, request a feature, or send us general feedback.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="bug">Bug Report</SelectItem>
                        <SelectItem value="feature_request">Feature Request</SelectItem>
                        <SelectItem value="general">General Feedback</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="severity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Severity</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select severity" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low (Minor issue)</SelectItem>
                        <SelectItem value="medium">Medium (Standard)</SelectItem>
                        <SelectItem value="high">High (Major feature broken)</SelectItem>
                        <SelectItem value="critical">Critical (Cannot use app)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Please describe the issue or idea in detail..."
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Include steps to reproduce if reporting a bug.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="providerEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Email (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="your@email.com" {...field} />
                  </FormControl>
                  <FormDescription>
                    We may contact you if we need more information.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Feedback"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

