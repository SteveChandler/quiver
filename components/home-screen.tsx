"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BottomNavigation } from "@/components/bottom-navigation"
import { ForecastCard } from "@/components/forecast-card"
import { BeachCard } from "@/components/beach-card"
import { SessionCard } from "@/components/session-card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CalendarDays, Waves, Plus, Loader2 } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import Link from "next/link"
import { getBeaches } from "@/actions/beach-actions"
import { getBeachForecasts } from "@/actions/forecast-actions"
import { getPublicSessions } from "@/actions/session-actions"
import type { Beach, Forecast, SessionWithDetails } from "@/types/database"

export function HomeScreen() {
  const [activeTab, setActiveTab] = useState("forecast")
  const { user, isLoading: authLoading } = useAuth()
  const [beaches, setBeaches] = useState<Beach[]>([])
  const [forecasts, setForecasts] = useState<{ [beachId: string]: Forecast[] }>({})
  const [sessions, setSessions] = useState<SessionWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  // Get user initials for avatar fallback
  const getInitials = () => {
    if (!user?.email) return "G"
    return user.email.charAt(0).toUpperCase()
  }

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        // Fetch beaches
        const beachesResult = await getBeaches()
        if (beachesResult.success && beachesResult.data) {
          setBeaches(beachesResult.data)

          // Fetch forecasts for each beach
          const forecastsData: { [beachId: string]: Forecast[] } = {}
          for (const beach of beachesResult.data.slice(0, 3)) {
            // Just get forecasts for first 3 beaches
            const forecastResult = await getBeachForecasts(beach.id)
            if (forecastResult.success && forecastResult.data) {
              forecastsData[beach.id] = forecastResult.data
            }
          }
          setForecasts(forecastsData)
        }

        // Fetch public sessions
        const sessionsResult = await getPublicSessions(5)
        if (sessionsResult.success && sessionsResult.data) {
          setSessions(sessionsResult.data)
        }
      } catch (error) {
        console.error("Error loading data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="container flex items-center justify-between h-16 px-4">
          <h1 className="text-2xl font-bold text-primary">Quiver</h1>
          <div className="flex items-center space-x-2">
            {authLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : user ? (
              <Link href="/profile">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="/placeholder.svg?height=32&width=32" alt="User" />
                  <AvatarFallback>{getInitials()}</AvatarFallback>
                </Avatar>
              </Link>
            ) : (
              <Link href="/auth/sign-in">
                <Button size="sm">Sign In</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container px-4 py-6 space-y-6 overflow-auto">
        {/* Welcome Section */}
        <section className="space-y-2">
          <h2 className="text-2xl font-bold">Hey, {user ? user.user_metadata?.full_name || "Surfer" : "Guest"}!</h2>
          <p className="text-muted-foreground">The waves are looking good today. Ready to catch some?</p>
        </section>

        {/* Quick Actions */}
        <section className="grid grid-cols-2 gap-4">
          <Link href={user ? "/plan-session" : "/auth/sign-in"}>
            <Button className="h-auto py-4 flex flex-col items-center gap-2 w-full" variant="default">
              <CalendarDays className="h-6 w-6" />
              <span>Plan Session</span>
            </Button>
          </Link>
          <Link href={user ? "/log-session" : "/auth/sign-in"}>
            <Button className="h-auto py-4 flex flex-col items-center gap-2 w-full" variant="outline">
              <Waves className="h-6 w-6" />
              <span>Log Session</span>
            </Button>
          </Link>
        </section>

        {/* Tabs Section */}
        <Tabs defaultValue="forecast" className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="forecast">Forecast</TabsTrigger>
            <TabsTrigger value="nearby">Nearby</TabsTrigger>
            <TabsTrigger value="community">Community</TabsTrigger>
          </TabsList>

          <TabsContent value="forecast" className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : beaches.length > 0 && Object.keys(forecasts).length > 0 ? (
              beaches.slice(0, 3).map((beach) => {
                const beachForecasts = forecasts[beach.id] || []
                if (beachForecasts.length === 0) return null

                const forecast = beachForecasts[0] // Get the first forecast for this beach
                return (
                  <ForecastCard
                    key={beach.id}
                    beachName={beach.name}
                    waveHeight={forecast.wave_height}
                    waterTemp={forecast.water_temp}
                    windSpeed={forecast.wind_speed}
                    tide={forecast.tide || "Unknown"}
                    time={new Date(forecast.forecast_date + "T" + forecast.forecast_time).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  />
                )
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">No forecast data available</div>
            )}
          </TabsContent>

          <TabsContent value="nearby" className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : beaches.length > 0 ? (
              beaches.slice(0, 5).map((beach) => (
                <BeachCard
                  key={beach.id}
                  name={beach.name}
                  distance={`${Math.floor(Math.random() * 20) + 1} miles`} // Placeholder distance
                  rating={beach.wave_quality_rating || 4.0}
                  reviewCount={Math.floor(Math.random() * 200) + 50} // Placeholder review count
                  imageUrl="/placeholder.svg?height=120&width=300"
                />
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">No beaches found nearby</div>
            )}
          </TabsContent>

          <TabsContent value="community" className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : sessions.length > 0 ? (
              sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  username={session.user?.full_name || "Anonymous Surfer"}
                  beachName={session.beach?.name || "Unknown Beach"}
                  date={new Date(session.session_date).toLocaleDateString() + ", " + session.session_time}
                  rating={session.rating}
                  description={session.description || "No description provided."}
                  imageUrl={session.image_url || "/placeholder.svg?height=200&width=300"}
                  likes={session.likes_count}
                  comments={session.comments_count}
                />
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">No community sessions found</div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Floating Action Button */}
      <div className="fixed bottom-20 right-4 z-10">
        <Button size="icon" className="h-14 w-14 rounded-full shadow-lg">
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  )
}
