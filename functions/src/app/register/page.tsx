import { RegistrationForm } from "@/components/auth/RegistrationForm";
import { BrandHeader } from "@/components/ui/logo";
import Link from "next/link";

export default function RegistrationPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-sm sm:max-w-md space-y-6 sm:space-y-8">
        <BrandHeader title="Create an Account" subtitle="Join Schools-In" />

        <RegistrationForm />

        <p className="text-sm text-muted-foreground text-center">
          Already have an account?{" "}
          <Link
            href="/"
            className="underline hover:text-foreground transition-colors touch-target"
          >
            Sign In
          </Link>
        </p>
      </div>
    </main>
  );
}
