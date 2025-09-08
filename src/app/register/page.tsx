import { RegistrationForm } from "@/components/auth/RegistrationForm";
import Link from "next/link";

export default function RegistrationPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-8">Create an Account</h1>
      <RegistrationForm />
      <p className="text-sm text-muted-foreground mt-4">
        Already have an account?{" "}
        <Link href="/" className="underline">
          Sign In
        </Link>
      </p>
    </main>
  );
}
