"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, CalendarDays, Clock, Users, Star, ImagePlus, Check, Loader2, AlertCircle } from "lucide-react"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import { getBeaches } from "@/actions/beach-actions"
import { getUserBoards } from "@/actions/board-actions"
import { createSession } from "@/actions/session-actions"
import type { Beach, Board } from "@/types/database"
import { Alert, AlertDescription } from "@/components/ui/alert"

export function LogSessionForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [selectedBeach, setSelectedBeach] = useState("")
  const [selectedDate, setSelectedDate] = useState("")
  const [selectedTime, setSelectedTime] = useState("")
  const [selectedBoard, setSelectedBoard] = useState("")
  const [waveHeight, setWaveHeight] = useState("")
  const [waterTemp, setWaterTemp] = useState("")
  const [waveRating, setWaveRating] = useState(3)
  const [crowdRating, setCrowdRating] = useState(3)
  const [notes, setNotes] = useState("")
  const [isPublic, setIsPublic] = useState(true)
  const [beaches, setBeaches] = useState<Beach[]>([])
  const [boards, setBoards] = useState<Board[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      if (!user) return

      setLoading(true)
      try {
        // Fetch beaches
        const beachesResult = await getBeaches()
        if (beachesResult.success && beachesResult.data) {
          setBeaches(beachesResult.data)

          // Check if beach ID is in URL params
          const beachId = searchParams.get("beach")
          if (beachId) {
            setSelectedBeach(beachId)
          }
        }

        // Fetch user boards
        const boardsResult = await getUserBoards(user.id)
        if (boardsResult.success && boardsResult.data) {
          setBoards(boardsResult.data)
          if (boardsResult.data.length > 0) {
            setSelectedBoard(boardsResult.data[0].id)
          }
        }

        // Set default date and time
        const now = new Date()
        setSelectedDate(now.toISOString().split("T")[0])
        setSelectedTime(now.toTimeString().slice(0, 5))
      } catch (error) {
        console.error("Error loading data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user, searchParams])

  const handleNext = () => {
    setStep(step + 1)
  }

  const handleBack = () => {
    setStep(step - 1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setSubmitting(true)
    setError(null)

    try {
      // Prepare session data
      const sessionData = {
        beach_id: selectedBeach,
        board_id: selectedBoard || null,
        session_date: selectedDate,
        session_time: selectedTime,
        wave_height: waveHeight,
        water_temp: waterTemp,
        rating: waveRating,
        crowd_rating: crowdRating,
        description: notes,
        image_url: null, // We'll add image upload later
        is_public: isPublic,
      }

      // Create session
      const result = await createSession(user.id, sessionData)

      if (!result.success) {
        throw new Error(result.error || "Failed to create session")
      }

      // Move to success step
      setStep(4)
    } catch (error) {
      console.error("Error creating session:", error)
      setError(error instanceof Error ? error.message : "An unknown error occurred")
    } finally {
      setSubmitting(false)
    }
  }

  // Find beach name by ID
  const getBeachName = (id: string) => {
    const beach = beaches.find((b) => b.id === id)
    return beach ? beach.name : "Unknown Beach"
  }

  // Find board name by ID
  const getBoardName = (id: string) => {
    const board = boards.find((b) => b.id === id)
    return board ? board.name : "Unknown Board"
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="container flex items-center h-16 px-4">
          <Link href="/" className="mr-2">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-bold">Log a Session</h1>
        </div>
      </header>

      {/* Progress Indicator */}
      <div className="container px-4 py-4">
        <div className="flex items-center justify-between">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center">
              <div
                className={`rounded-full h-8 w-8 flex items-center justify-center ${
                  step >= i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {step > i ? <Check className="h-5 w-5" /> : i}
              </div>
              {i < 3 && <div className={`h-1 w-10 ${step > i ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 container px-4 py-2 space-y-6 overflow-auto pb-20">
        <form onSubmit={handleSubmit}>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium">Session Details</h2>

              <div className="space-y-2">
                <Label htmlFor="beach-select">Beach</Label>
                <Select value={selectedBeach} onValueChange={setSelectedBeach} required>
                  <SelectTrigger id="beach-select" className="w-full">
                    <SelectValue placeholder="Select a beach" />
                  </SelectTrigger>
                  <SelectContent>
                    {beaches.map((beach) => (
                      <SelectItem key={beach.id} value={beach.id}>
                        {beach.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="date"
                    type="date"
                    className="pl-9"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="time">Time</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="time"
                    type="time"
                    className="pl-9"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="board">Board Used</Label>
                <Select value={selectedBoard} onValueChange={setSelectedBoard}>
                  <SelectTrigger id="board" className="w-full">
                    <SelectValue placeholder="Select a board (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {boards.length > 0 ? (
                      boards.map((board) => (
                        <SelectItem key={board.id} value={board.id}>
                          {board.name} ({board.board_type})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        No boards available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {boards.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    <Link href="/profile" className="text-primary hover:underline">
                      Add a board to your quiver
                    </Link>{" "}
                    to track which board you used.
                  </p>
                )}
              </div>

              <div className="pt-4">
                <Button
                  type="button"
                  className="w-full"
                  onClick={handleNext}
                  disabled={!selectedBeach || !selectedDate || !selectedTime}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Conditions & Ratings */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium">Conditions & Ratings</h2>

              <div className="space-y-2">
                <Label htmlFor="wave-height">Wave Height</Label>
                <Select value={waveHeight} onValueChange={setWaveHeight}>
                  <SelectTrigger id="wave-height" className="w-full">
                    <SelectValue placeholder="Select wave height" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Flat (0-1 ft)">Flat (0-1 ft)</SelectItem>
                    <SelectItem value="Small (1-2 ft)">Small (1-2 ft)</SelectItem>
                    <SelectItem value="Medium (2-4 ft)">Medium (2-4 ft)</SelectItem>
                    <SelectItem value="Large (4-6 ft)">Large (4-6 ft)</SelectItem>
                    <SelectItem value="XL (6+ ft)">XL (6+ ft)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="water-temp">Water Temperature</Label>
                <Select value={waterTemp} onValueChange={setWaterTemp}>
                  <SelectTrigger id="water-temp" className="w-full">
                    <SelectValue placeholder="Select water temperature" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cold (below 60°F)">Cold (below 60°F)</SelectItem>
                    <SelectItem value="Cool (60-65°F)">Cool (60-65°F)</SelectItem>
                    <SelectItem value="Mild (65-70°F)">Mild (65-70°F)</SelectItem>
                    <SelectItem value="Warm (70-75°F)">Warm (70-75°F)</SelectItem>
                    <SelectItem value="Hot (above 75°F)">Hot (above 75°F)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="wave-quality">Wave Quality</Label>
                  <div className="flex">
                    {Array(5)
                      .fill(0)
                      .map((_, i) => (
                        <Star
                          key={i}
                          className={`h-5 w-5 cursor-pointer ${
                            i < waveRating ? "text-yellow-500 fill-yellow-500" : "text-gray-300"
                          }`}
                          onClick={() => setWaveRating(i + 1)}
                        />
                      ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="crowd-density">Crowd Density</Label>
                  <div className="flex">
                    {Array(5)
                      .fill(0)
                      .map((_, i) => (
                        <Users
                          key={i}
                          className={`h-5 w-5 cursor-pointer ${
                            i < crowdRating ? "text-yellow-500 fill-yellow-500" : "text-gray-300"
                          }`}
                          onClick={() => setCrowdRating(i + 1)}
                        />
                      ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={handleBack}>
                  Back
                </Button>
                <Button type="button" className="flex-1" onClick={handleNext}>
                  Next
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Notes & Media */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium">Notes & Media</h2>

              <div className="space-y-2">
                <Label htmlFor="notes">Session Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="How was your session? What did you learn?"
                  className="min-h-[120px]"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Add Photos/Videos</Label>
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <div className="flex flex-col items-center">
                    <ImagePlus className="h-10 w-10 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Image upload will be available in a future update</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is-public"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="is-public">Share this session with the community</Label>
                </div>
              </div>

              <div className="pt-4 flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={handleBack}>
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Session"
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 4 && (
            <div className="space-y-6 text-center py-8">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Check className="h-10 w-10 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Session Logged!</h2>
                <p className="text-muted-foreground mt-1">Your surf session has been saved to your profile.</p>
              </div>
              <div className="space-y-2">
                <Link href="/sessions">
                  <Button className="w-full">View My Sessions</Button>
                </Link>
                <Link href="/">
                  <Button variant="outline" className="w-full">
                    Back to Home
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </form>
      </main>
    </div>
  )
}
