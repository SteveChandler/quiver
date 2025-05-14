"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Heart, Loader2 } from "lucide-react"
import { addFavoriteBeach, removeFavoriteBeach, getFavoriteBeaches } from "@/actions/beach-actions"
import { useAuth } from "@/context/auth-context"
import { toast } from "@/components/ui/use-toast"
import type { Beach } from "@/types/database"

interface FavoriteButtonProps {
  beachId: string
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg" | "icon"
}

export function FavoriteButton({ beachId, variant = "ghost", size = "sm" }: FavoriteButtonProps) {
  const { user } = useAuth()
  const [isFavorite, setIsFavorite] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    async function checkIfFavorite() {
      if (!user) {
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const result = await getFavoriteBeaches(user.id)
        if (result.success) {
          const favorites = result.data || []
          setIsFavorite(favorites.some((beach: Beach) => beach.id === beachId))
        }
      } catch (error) {
        console.error("Error checking if beach is favorite:", error)
      } finally {
        setLoading(false)
      }
    }

    checkIfFavorite()
  }, [user, beachId])

  const toggleFavorite = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to favorite beaches.",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)
    try {
      if (isFavorite) {
        const result = await removeFavoriteBeach(user.id, beachId)
        if (result.success) {
          setIsFavorite(false)
          toast({
            title: "Beach removed",
            description: "Beach removed from favorites.",
          })
        } else {
          throw new Error(result.error || "Failed to remove beach from favorites")
        }
      } else {
        const result = await addFavoriteBeach(user.id, beachId)
        if (result.success) {
          setIsFavorite(true)
          toast({
            title: "Beach added",
            description: "Beach added to favorites.",
          })
        } else {
          throw new Error(result.error || "Failed to add beach to favorites")
        }
      }
    } catch (error) {
      console.error("Error toggling favorite:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update favorites.",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  if (loading) {
    return (
      <Button variant={variant} size={size} disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    )
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={toggleFavorite}
      disabled={isProcessing}
      aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
    >
      {isProcessing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Heart className={`h-4 w-4 ${isFavorite ? "fill-red-500 text-red-500" : ""}`} />
      )}
    </Button>
  )
}
