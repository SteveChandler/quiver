"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Waves, MapPin, Star, Calendar } from "lucide-react"
import { getUserStats } from "@/actions/profile-actions"

interface UserStatsProps {
  userId: string
}

interface UserStatsData {
  sessionCount: number
  boardCount: number
  averageRating: number
  mostVisitedBeach: string | null
  mostVisitedBeachCount: number
}

export function UserStats({ userId }: UserStatsProps) {
  const [stats, setStats] = useState<UserStatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      try {
        const result = await getUserStats(userId)
        if (result.success && result.data) {
          setStats(result.data)
        }
      } catch (error) {
        console.error("Error loading user stats:", error)
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [userId])

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!stats) {
    return <div className="text-center py-4 text-muted-foreground">Stats unavailable</div>
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Sessions</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.sessionCount}</div>
          <p className="text-xs text-muted-foreground">Total surf sessions</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Boards</CardTitle>
          <Waves className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.boardCount}</div>
          <p className="text-xs text-muted-foreground">Boards in quiver</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Rating</CardTitle>
          <Star className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.averageRating || "-"}</div>
          <p className="text-xs text-muted-foreground">Average session rating</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Favorite Spot</CardTitle>
          <MapPin className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold truncate">{stats.mostVisitedBeach || "-"}</div>
          <p className="text-xs text-muted-foreground">
            {stats.mostVisitedBeachCount ? `${stats.mostVisitedBeachCount} visits` : "No sessions yet"}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
