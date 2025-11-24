"use client";

import { FeedbackForm } from "@/components/feedback/FeedbackForm";

export default function FeedbackPage() {
  return (
    <div className="container max-w-4xl py-8 mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Help & Feedback</h1>
        <p className="text-muted-foreground mt-2">
          We value your input. Please let us know if you encounter any issues or have suggestions for improvement.
        </p>
      </div>
      
      <FeedbackForm />
    </div>
  );
}

