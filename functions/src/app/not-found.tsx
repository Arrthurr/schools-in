"use client";

import { BrandHeader } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Home, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-8 pb-6">
          <BrandHeader
            title="Page Not Found"
            subtitle="The page you're looking for doesn't exist."
            className="mb-6"
          />

          <div className="flex justify-center mb-6">
            <div className="p-4 bg-red-50 rounded-full">
              <MapPin className="h-8 w-8 text-red-500" />
            </div>
          </div>

          <p className="text-gray-600 mb-8">
            Looks like you've wandered off the school grounds! Let's get you
            back to safety.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => router.back()}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
            <Link href="/dashboard">
              <Button className="flex items-center gap-2 w-full sm:w-auto">
                <Home className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
