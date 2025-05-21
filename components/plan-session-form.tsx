"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  WavesIcon as Surfboard,
  Waves,
  Check,
  Timer,
  Thermometer,
  Users,
  CarFront,
  Pencil,
  Image,
} from "lucide-react";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ForecastCard } from "@/components/forecast-card";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSearchParams } from "next/navigation";
import {
  createPlannedSession,
  createLoggedSession,
  getUserBoards,
  getBeaches,
} from "@/actions/session-actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Board, Beach } from "@/types/database";

interface PlanSessionFormProps {
  mode?: "plan" | "log";
}

export function PlanSessionForm({ mode = "plan" }: PlanSessionFormProps) {
  const searchParams = useSearchParams();
  const paramMode = searchParams.get("mode") || mode;
  const isPlanning = paramMode === "plan";
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [selectedBeach, setSelectedBeach] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedBoard, setSelectedBoard] = useState("");
  const [boardId, setBoardId] = useState<string | undefined>();
  const [duration, setDuration] = useState("");
  const [waveQuality, setWaveQuality] = useState("");
  const [waterTemp, setWaterTemp] = useState("");
  const [crowdLevel, setCrowdLevel] = useState("");
  const [parkingEase, setParkingEase] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);

  const [boards, setBoards] = useState<Board[]>([]);
  const [beaches, setBeaches] = useState<Beach[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [navVisible, setNavVisible] = useState(false);
  const [filteredBeaches, setFilteredBeaches] = useState<Beach[]>([]);
  const [isBeachInputFocused, setIsBeachInputFocused] = useState(false);

  // Remove any existing datalist elements to prevent browser autocomplete dropdown
  useEffect(() => {
    // Remove any existing datalist elements
    const removeDatalist = () => {
      const datalist = document.getElementById("beach-list");
      if (datalist) {
        datalist.remove();
      }
    };

    // Call once on mount and before unmount to clean up
    removeDatalist();
    return () => removeDatalist();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingData(true);

        const userBoards = await getUserBoards();
        setBoards(userBoards);

        const beachList = await getBeaches();
        setBeaches(beachList);
      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Failed to load data. Some features may be limited.");
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    const board = boards.find((b) => b.id === selectedBoard);
    if (board) {
      setBoardId(board.id);
    }
  }, [selectedBoard, boards]);

  useEffect(() => {
    // Add CSS to hide the bottom nav by default
    const style = document.createElement("style");
    style.innerHTML = `
      nav[class*="bottom"], div[class*="bottom-nav"] {
        visibility: hidden;
        opacity: 0;
        transition: visibility 0.2s, opacity 0.2s;
      }
      nav[class*="bottom"].visible, div[class*="bottom-nav"].visible {
        visibility: visible;
        opacity: 1;
      }
    `;
    document.head.appendChild(style);

    // Add click listener to show nav
    const handleClick = () => {
      const navElements = document.querySelectorAll(
        'nav[class*="bottom"], div[class*="bottom-nav"]'
      );
      navElements.forEach((nav) => {
        nav.classList.add("visible");
        setTimeout(() => {
          nav.classList.remove("visible");
        }, 3000); // Hide after 3 seconds
      });
    };

    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("click", handleClick);
      document.head.removeChild(style);
    };
  }, []);

  const handleNext = () => {
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let durationMinutes: number | undefined = undefined;
      if (duration) {
        const hourMatch = duration.match(/(\d+)h/);
        const minuteMatch = duration.match(/(\d+)m/);
        const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
        const minutes = minuteMatch ? parseInt(minuteMatch[1]) : 0;
        durationMinutes = hours * 60 + minutes;
      }

      const sessionData = {
        beach_name: selectedBeach,
        session_date: selectedDate,
        start_time: selectedTime,
        board_id: boardId,
        notes: notes || undefined,
        status: isPlanning
          ? "planned"
          : ("completed" as "planned" | "completed"),
      };

      if (isPlanning) {
        await createPlannedSession(sessionData);
        toast.success("Session planned successfully!");
      } else {
        await createLoggedSession({
          ...sessionData,
          duration_minutes: durationMinutes,
          wave_quality: waveQuality ? parseInt(waveQuality) : undefined,
          water_temp: waterTemp || undefined,
          crowd_level: crowdLevel ? parseInt(crowdLevel) : undefined,
          parking_ease: parkingEase ? parseInt(parkingEase) : undefined,
        });
        toast.success("Session logged successfully!");
      }

      setStep(11);
    } catch (error) {
      console.error("Error saving session:", error);
      toast.error("Failed to save session. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const totalSteps = isPlanning ? 4 : 10;

  const renderRatingHelper = (label: string, min: string, max: string) => (
    <div className="flex justify-between text-xs text-muted-foreground mt-1">
      <span>1 = {min}</span>
      <span>5 = {max}</span>
    </div>
  );

  const handleFinish = () => {
    router.push("/dashboard");
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="container flex items-center h-16 px-4">
          <Link href="/" className="mr-2">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-bold">
            {isPlanning ? "Plan Session" : "Log Session"}
          </h1>
        </div>
      </header>

      {/* Progress Indicator */}
      <div className="container px-4 py-4">
        <div className="flex items-center justify-between">
          {Array.from({ length: Math.min(5, totalSteps) }).map((_, i) => (
            <div key={i} className="flex items-center">
              <div
                className={`rounded-full h-8 w-8 flex items-center justify-center ${
                  step >= i + 1
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step > i + 1 ? <Check className="h-5 w-5" /> : i + 1}
              </div>
              {i < Math.min(5, totalSteps) - 1 && (
                <div
                  className={`h-1 w-full ${
                    step > i + 1 ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 container px-4 py-2 space-y-6 overflow-auto pb-20">
        {step === 1 && (
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold">Ready to catch some waves?</h2>
            <p className="text-muted-foreground">Let's get the details.</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Step 1: Select Beach */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="beach-search">
                  Which beach are you heading to?
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="beach-search"
                    placeholder="Search or select from your favorites"
                    className="pl-9"
                    value={selectedBeach}
                    onChange={(e) => {
                      const input = e.target.value;
                      setSelectedBeach(input);
                      if (input.trim() === "") {
                        setFilteredBeaches([]);
                      } else {
                        const filtered = beaches.filter((beach) =>
                          beach.name.toLowerCase().includes(input.toLowerCase())
                        );
                        setFilteredBeaches(filtered);
                      }
                    }}
                    onFocus={() => setIsBeachInputFocused(true)}
                    onBlur={() => setIsBeachInputFocused(false)}
                    role="combobox"
                    aria-autocomplete="none"
                  />
                </div>
              </div>

              {(() => {
                const trimmedQuery = selectedBeach.trim();
                let currentListTitle: string | null = null;
                let currentBeachesToList: Beach[] = [];

                if (trimmedQuery) {
                  currentBeachesToList = filteredBeaches;
                  if (filteredBeaches.length > 0) {
                    currentListTitle = "Matching Beaches";
                  } else {
                    currentListTitle = "No Matching Beaches";
                  }
                } else {
                  // No query
                  if (isBeachInputFocused) {
                    // Focused and empty: show nothing
                    currentListTitle = null;
                    currentBeachesToList = [];
                  } else {
                    // Not focused and empty: show popular
                    if (beaches.length > 0) {
                      currentListTitle = "Popular Beaches";
                      currentBeachesToList = beaches.slice(0, 3);
                    } else {
                      currentListTitle = null;
                      currentBeachesToList = [];
                    }
                  }
                }

                return (
                  <>
                    {currentListTitle && (
                      <h3 className="text-sm font-medium pt-2">
                        {currentListTitle}
                      </h3>
                    )}
                    {currentBeachesToList.length > 0 && (
                      <div className="space-y-2">
                        {currentBeachesToList.map((beach) => (
                          <Card
                            key={beach.id}
                            className={`cursor-pointer ${
                              selectedBeach === beach.name
                                ? "border-primary"
                                : ""
                            }`}
                            onClick={() => {
                              setSelectedBeach(beach.name);
                              // Consider blurring the input to hide list immediately after selection:
                              // const beachSearchInput = document.getElementById('beach-search') as HTMLInputElement | null;
                              // beachSearchInput?.blur();
                            }}
                          >
                            <CardContent className="p-3 flex justify-between items-center">
                              <div>
                                <p className="font-medium">{beach.name}</p>
                                <div className="flex items-center text-sm text-muted-foreground">
                                  <MapPin className="h-3 w-3 mr-1" />
                                  <span>{beach.description?.slice(0, 30)}</span>
                                </div>
                              </div>
                              {selectedBeach === beach.name && (
                                <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                                  <Check className="h-4 w-4 text-primary-foreground" />
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                    {currentListTitle === "No Matching Beaches" &&
                      currentBeachesToList.length === 0 && (
                        <p className="text-sm text-muted-foreground pt-2">
                          No beaches found matching your search.
                        </p>
                      )}
                  </>
                );
              })()}

              <div className="pt-4">
                <Button
                  type="button"
                  className="w-full"
                  onClick={handleNext}
                  disabled={!selectedBeach || loading}
                >
                  {loading ? "Loading..." : "Next"}
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Select Date & Time */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="date">When do you plan to surf?</Label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="date"
                    type="date"
                    className="pl-9"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    placeholder="Tap to choose date & time"
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

              {isPlanning && (
                <div className="pt-2">
                  <h3 className="text-sm font-medium mb-2">
                    Forecast for {selectedBeach}
                  </h3>
                  <ForecastCard
                    beachName="Morning"
                    waveHeight="3-4 ft"
                    waterTemp="68°F"
                    windSpeed="5 mph"
                    tide="Rising"
                    time="8:00 AM"
                  />
                </div>
              )}

              <div className="pt-4 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleBack}
                  disabled={loading}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  onClick={handleNext}
                  disabled={!selectedDate || !selectedTime || loading}
                >
                  {loading ? "Loading..." : "Next"}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Select Board */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="board">Which board will you ride?</Label>
                <Select value={selectedBoard} onValueChange={setSelectedBoard}>
                  <SelectTrigger id="board" className="w-full">
                    <SelectValue placeholder="Select from your quiver" />
                  </SelectTrigger>
                  <SelectContent>
                    {boards.length > 0 ? (
                      boards.map((board) => (
                        <SelectItem key={board.id} value={board.id}>
                          {board.name} ({board.type})
                        </SelectItem>
                      ))
                    ) : (
                      <>
                        <SelectItem value="default-shortboard">
                          Default Shortboard
                        </SelectItem>
                        <SelectItem value="default-longboard">
                          Default Longboard
                        </SelectItem>
                        <SelectItem value="default-fish">
                          Default Fish
                        </SelectItem>
                      </>
                    )}
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
                          {boards.find((b) => b.id === selectedBoard)?.name ||
                            "Selected Board"}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {boards.find((b) => b.id === selectedBoard)?.type ||
                            "Surfboard"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="pt-4 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleBack}
                  disabled={loading}
                >
                  Back
                </Button>
                <Button
                  type={isPlanning ? "submit" : "button"}
                  className="flex-1"
                  onClick={isPlanning ? undefined : handleNext}
                  disabled={!selectedBoard || loading}
                >
                  {loading ? "Saving..." : isPlanning ? "Plan & Share" : "Next"}
                </Button>
              </div>
            </div>
          )}

          {/* Step 11: Success */}
          {step === 11 && (
            <div className="space-y-6 text-center py-8">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Check className="h-10 w-10 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">
                  Session {isPlanning ? "Planned" : "Logged"}!
                </h2>
                <p className="text-muted-foreground mt-1">
                  {isPlanning
                    ? "Your surf session has been added to your calendar."
                    : "Your surf session has been saved to your log."}
                </p>
              </div>
              <div className="pt-4">
                <Button className="w-full" onClick={handleFinish}>
                  Back to Dashboard
                </Button>
              </div>
            </div>
          )}
        </form>
      </main>
    </div>
  );
}
