"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";

function ErrorCard() {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");

  const getErrorMessage = (reason: string | null) => {
    switch (reason) {
      case "invalid_or_expired_link":
        return "The reset link is invalid or has expired. Please request a new password reset link.";
      case "expired_link":
        return "Your session has expired. Please request a new password reset link.";
      default:
        return "An unexpected error occurred. Please try again.";
    }
  };

  const getErrorTitle = (reason: string | null) => {
    switch (reason) {
      case "invalid_or_expired_link":
      case "expired_link":
        return "Link Expired";
      default:
        return "Error";
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-2">
          <AlertCircle className="h-6 w-6 text-destructive" />
          {getErrorTitle(reason)}
        </CardTitle>
        <CardDescription>{getErrorMessage(reason)}</CardDescription>
      </CardHeader>
      <CardContent>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{getErrorMessage(reason)}</AlertDescription>
        </Alert>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button asChild className="w-full">
          <Link href="/auth/forgot-password">Request New Reset Link</Link>
        </Button>
        <Button variant="outline" asChild className="w-full">
          <Link href="/auth/sign-in">Back to Sign In</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function ErrorPage() {
  return (
    <Suspense fallback={<div className="text-center text-sm text-muted-foreground">Loading…</div>}>
      <ErrorCard />
    </Suspense>
  );
}
