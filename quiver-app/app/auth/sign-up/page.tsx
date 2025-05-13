import { SignUpForm } from "@/components/auth/sign-up-form"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sign Up - Quiver",
  description: "Create a new Quiver account",
}

export default function SignUpPage() {
  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-primary">Create an account</h1>
          <p className="text-sm text-muted-foreground">Enter your email and password to create your account</p>
        </div>
        <SignUpForm />
      </div>
    </div>
  )
}
