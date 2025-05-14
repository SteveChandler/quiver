import { SignInForm } from "@/components/auth/sign-in-form"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sign In - Quiver",
  description: "Sign in to your Quiver account",
}

export default function SignInPage() {
  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-primary">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Enter your email and password to sign in to your account</p>
        </div>
        <SignInForm />
      </div>
    </div>
  )
}
