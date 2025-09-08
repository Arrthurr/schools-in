import { LoginForm } from "@/components/auth/LoginForm";
import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-8">Sign In</h1>
      <LoginForm />
      <p className="text-sm text-muted-foreground mt-4">
        Don't have an account?{" "}
        <Link href="/register" className="underline">
          Sign Up
        </Link>
      </p>
    </main>
  );
}
