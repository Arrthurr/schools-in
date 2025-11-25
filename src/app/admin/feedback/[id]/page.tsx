import { FeedbackDetail } from "@/components/admin/FeedbackDetail";

export async function generateStaticParams() {
  // In static export mode, we must pre-render at least one path or all paths.
  // Since we don't have database access at build time, we generate a placeholder.
  // Real IDs will be handled by client-side routing or fallback if configured.
  return [{ id: "details" }];
}

export default function Page() {
  return <FeedbackDetail />;
}
