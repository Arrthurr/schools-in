"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProviderFeedbackRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/provider/notes");
  }, [router]);
  return null;
}
