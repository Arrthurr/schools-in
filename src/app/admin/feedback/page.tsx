"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminFeedbackRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/notes");
  }, [router]);
  return null;
}
