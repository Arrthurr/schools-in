import FeedbackDetailClient from "./FeedbackDetailClient";

export async function generateStaticParams() {
  // Return empty array for static export - pages will be client-side rendered
  return [];
}

export default function FeedbackDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return <FeedbackDetailClient feedbackId={params.id} />;
}
