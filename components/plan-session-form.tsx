"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, CalendarDays, Clock, MapPin, WavesIcon as Surfboard, Waves, Check } from "lucide-react"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ForecastCard } from "@/components/forecast-card"

export function PlanSessionForm() {
  const [step, setStep] = useState(1)
  const [selectedBeach, setSelectedBeach] = useState("")
  const [selectedDate, setSelectedDate] = useState("")
  const [selectedTime, setSelectedTime] = useState("")
  const [selectedBoard, setSelectedBoard] = useState("")

  const handleNext = () => {
    setStep(step + 1)
  }

  const handleBack = () => {
    setStep(step - 1)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // In a real app, we would save the session plan here
    setStep(4) // Success step
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="container flex items-center h-16 px-4">
          <Link href="/" className="mr-2">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-bold">Plan a Session</h1>
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
          {/* Step 1: Select Beach */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium">Select a Beach</h2>

              <div className="space-y-2">
                <Label htmlFor="beach-search">Search Beaches</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="beach-search" placeholder="Search beaches..." className="pl-9" />
                </div>
              </div>

              <h3 className="text-sm font-medium pt-2">Nearby Beaches</h3>

              <div className="space-y-2">
                {["Huntington Beach", "Newport Beach", "Laguna Beach"].map((beach) => (
                  <Card
                    key={beach}
                    className={`cursor-pointer ${selectedBeach === beach ? "border-primary" : ""}`}
                    onClick={() => setSelectedBeach(beach)}
                  >
                    <CardContent className="p-3 flex justify-between items-center">
                      <div>
                        <p className="font-medium">{beach}</p>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3 mr-1" />
                          <span>2.5 miles away</span>
                        </div>
                      </div>
                      {selectedBeach === beach && (
                        <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-4 w-4 text-primary-foreground" />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="pt-4">
                <Button type="button" className="w-full" onClick={handleNext} disabled={!selectedBeach}>
                  Next
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Select Date & Time */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium">When do you want to surf?</h2>

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
                  />
                </div>
              </div>

              <div className="pt-2">
                <h3 className="text-sm font-medium mb-2">Forecast for {selectedBeach}</h3>
                <ForecastCard
                  beachName="Morning"
                  waveHeight="3-4 ft"
                  waterTemp="68°F"
                  windSpeed="5 mph"
                  tide="Rising"
                  time="8:00 AM"
                />
              </div>

              <div className="pt-4 flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={handleBack}>
                  Back
                </Button>
                <Button type="button" className="flex-1" onClick={handleNext} disabled={!selectedDate || !selectedTime}>
                  Next
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Select Board */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium">Select a Board</h2>

              <div className="space-y-2">
                <Label htmlFor="board">Your Quiver</Label>
                <Select value={selectedBoard} onValueChange={setSelectedBoard}>
                  <SelectTrigger id="board" className="w-full">
                    <SelectValue placeholder="Select a board" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pyzel">Pyzel Ghost (6'0")</SelectItem>
                    <SelectItem value="firewire">Firewire Seaside (5'8")</SelectItem>
                    <SelectItem value="takayama">Takayama DT-2 (9'2")</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedBoard && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="h-16 w-16 rounded-md bg-muted flex items-center justify-center">
                        <Surfboard className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium">
                          {selectedBoard === "pyzel" && "Pyzel Ghost"}
                          {selectedBoard === "firewire" && "Firewire Seaside"}
                          {selectedBoard === "takayama" && "Takayama DT-2"}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {selectedBoard === "pyzel" && 'Shortboard - 6\'0" x 19" x 2.38"'}
                          {selectedBoard === "firewire" && 'Fish - 5\'8" x 20.5" x 2.5"'}
                          {selectedBoard === "takayama" && 'Longboard - 9\'2" x 22.75" x 2.87"'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="pt-4">
                <h3 className="text-sm font-medium mb-2">Session Summary</h3>
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">Beach</p>
                        <p className="font-medium">{selectedBeach}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">Date & Time</p>
                        <p className="font-medium">
                          {selectedDate} at {selectedTime}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Waves className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">Forecast</p>
                        <p className="font-medium">3-4 ft, 68°F, Light winds</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="pt-4 flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={handleBack}>
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={!selectedBoard}>
                  Save Session
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
                <h2 className="text-2xl font-bold">Session Planned!</h2>
                <p className="text-muted-foreground mt-1">Your surf session has been added to your calendar.</p>
              </div>
              <div className="pt-4">
                <Link href="/">
                  <Button className="w-full">Back to Home</Button>
                </Link>
              </div>
            </div>
          )}
        </form>
      </main>
    </div>
  )
}
