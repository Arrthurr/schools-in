import { LoginForm } from "@/components/auth/LoginForm";
import { BrandHeader } from "@/components/ui/logo";
import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-sm sm:max-w-md space-y-6 sm:space-y-8">
        <BrandHeader title="Sign In" subtitle="Welcome back to Schools-In" />

        <LoginForm />

        <p className="text-sm text-muted-foreground text-center">
          Don't have an account?{" "}
          <Link
            href="/register"
            className="underline hover:text-foreground transition-colors touch-target"
          >
            Sign Up
          </Link>
        </p>
      </div>
    </main>
  );
}
