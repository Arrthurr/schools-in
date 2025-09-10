"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useId } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { signInWithEmail, signInWithGoogle } from "@/lib/firebase/auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LoadingButton } from "@/components/ui/loading";
import { useAnnouncement, ScreenReaderOnly, ARIA } from "@/lib/accessibility";

const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters." }),
});

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Accessibility hooks
  const { announce } = useAnnouncement();
  const formId = useId();
  const errorId = useId();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true);
    setError(null);

    try {
      await signInWithEmail(values.email, values.password);
      announce("Successfully signed in", "polite");
    } catch (error: any) {
      const errorMessage = error.message;
      setError(errorMessage);
      announce(`Sign in failed: ${errorMessage}`, "assertive");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);

    try {
      await signInWithGoogle();
      announce("Successfully signed in with Google", "polite");
    } catch (error: any) {
      const errorMessage = error.message;
      setError(errorMessage);
      announce(`Google sign in failed: ${errorMessage}`, "assertive");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          aria-labelledby={`${formId}-title`}
          aria-describedby={error ? errorId : undefined}
          noValidate
        >
          <ScreenReaderOnly>
            <h2 id={`${formId}-title`}>Sign in to your account</h2>
          </ScreenReaderOnly>

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm sm:text-base">Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    className="touch-target text-base sm:text-sm"
                    autoComplete="email"
                    aria-describedby={
                      form.formState.errors.email
                        ? `${field.name}-error`
                        : undefined
                    }
                    {...field}
                  />
                </FormControl>
                <FormMessage
                  id={
                    form.formState.errors.email
                      ? `${field.name}-error`
                      : undefined
                  }
                />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm sm:text-base">Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Enter your password"
                    className="touch-target text-base sm:text-sm"
                    autoComplete="current-password"
                    aria-describedby={
                      form.formState.errors.password
                        ? `${field.name}-error`
                        : undefined
                    }
                    {...field}
                  />
                </FormControl>
                <FormMessage
                  id={
                    form.formState.errors.password
                      ? `${field.name}-error`
                      : undefined
                  }
                />
              </FormItem>
            )}
          />
          {error && (
            <Alert
              variant="destructive"
              className="text-sm"
              role="alert"
              id={errorId}
            >
              <AlertTitle>Error</AlertTitle>
              <AlertDescription className="break-words">
                {error}
              </AlertDescription>
            </Alert>
          )}
          <LoadingButton
            type="submit"
            className="w-full touch-target text-base sm:text-sm micro-scale"
            isLoading={loading}
            loadingText="Signing In..."
            aria-describedby={error ? errorId : undefined}
          >
            Sign In
          </LoadingButton>
        </form>
      </Form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>

      <LoadingButton
        variant="outline"
        className="w-full touch-target text-base sm:text-sm micro-scale"
        onClick={handleGoogleSignIn}
        isLoading={loading}
        loadingText="Connecting..."
        aria-label="Sign in with Google OAuth"
      >
        Sign in with Google
      </LoadingButton>
    </div>
  );
}
