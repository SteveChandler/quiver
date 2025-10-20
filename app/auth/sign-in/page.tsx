import { Suspense } from "react";
import { SignInForm } from "@/components/auth/sign-in-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In - Quiver",
  description: "Sign in to your Quiver account",
};

export default function SignInPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center py-12 px-4">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-primary">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your email and password to sign in to your account
          </p>
          <p className="text-xs text-muted-foreground">
            Don't have an account?{" "}
            <a href="/auth/sign-up" className="text-primary hover:underline">
              Sign up
            </a>
          </p>
        </div>
        <Suspense
          fallback={
            <div className="text-sm text-muted-foreground">
              Loading sign in…
            </div>
          }
        >
          <SignInForm />
        </Suspense>
      </div>
    </div>
  );
}
