"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import type { User, Session } from "@supabase/supabase-js"
import { getClientBrowserClient } from "@/lib/supabase"
import { copyBoardTemplates } from "@/actions/board-actions"

type AuthContextType = {
  user: User | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
  signUp: (email: string, password: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [setupComplete, setSetupComplete] = useState(false)
  const supabase = getClientBrowserClient()

  // Function to handle user setup (profile creation and board template copying)
  const setupUserAccount = async (userId: string) => {
    if (!userId || setupComplete) return

    try {
      // Add a significant delay to ensure auth is fully established
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Copy board templates
      const result = await copyBoardTemplates(userId)

      if (!result.success) {
        console.error("Error setting up user account:", result.error)
      } else {
        console.log("User account setup complete:", result.message)
        setSetupComplete(true)
      }
    } catch (error) {
      console.error("Exception in setupUserAccount:", error)
      // Don't sign out the user if setup fails
    }
  }

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      setIsLoading(true)

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session) {
          setSession(session)
          setUser(session.user)
          setIsAuthenticated(true)

          // If user is already logged in, set up their account
          setupUserAccount(session.user.id)
        } else {
          setSession(null)
          setUser(null)
          setIsAuthenticated(false)
        }
      } catch (error) {
        console.error("Error getting session:", error)
        // Don't reset user state on error to prevent unintended sign-outs
      } finally {
        setIsLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state change:", event)

      if (session) {
        setSession(session)
        setUser(session.user)
        setIsAuthenticated(true)
        setIsLoading(false)

        // If this is a new sign-up or sign-in, ensure profile exists and copy board templates
        if (event === "SIGNED_IN" || event === "SIGNED_UP") {
          setupUserAccount(session.user.id)
        }
      } else {
        // Only clear user state on explicit sign out
        if (event === "SIGNED_OUT") {
          setSession(null)
          setUser(null)
          setIsAuthenticated(false)
          setSetupComplete(false)
        }
        setIsLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        throw error
      }
    } catch (error) {
      console.error("Sign up error:", error)
      throw error
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw error
      }
    } catch (error) {
      console.error("Sign in error:", error)
      throw error
    }
  }

  const signOut = async () => {
    try {
      setSetupComplete(false)
      const { error } = await supabase.auth.signOut()

      if (error) {
        throw error
      }
    } catch (error) {
      console.error("Sign out error:", error)
      throw error
    }
  }

  const value = {
    user,
    session,
    isLoading,
    isAuthenticated,
    signUp,
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }

  return context
}
