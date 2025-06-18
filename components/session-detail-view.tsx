"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  Star,
  MapPin,
  Calendar,
  Clock,
  Waves,
  Thermometer,
  Users,
  Edit,
  Trash2,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { getSessionById, deleteSession } from "@/actions/session-actions";
import type { SessionWithDetails } from "@/types/database";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SessionComments } from "@/components/session-comments";

interface SessionDetailViewProps {
  id: string;
}

export function SessionDetailView({ id }: SessionDetailViewProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [session, setSession] = useState<SessionWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function loadSession() {
      if (!user) return;

      setLoading(true);
      try {
        const result = await getSessionById(id, user.id);
        if (result.success && result.data) {
          setSession(result.data);
        } else {
          setError("Session not found");
        }
      } catch (error) {
        console.error("Error loading session:", error);
        setError("Failed to load session");
      } finally {
        setLoading(false);
      }
    }

    loadSession();
  }, [id, user]);

  const handleDelete = async () => {
    if (!user) return;

    setDeleting(true);
    try {
      const result = await deleteSession(id, user.id);
      if (result.success) {
        router.push("/profile");
      } else {
        setError("Failed to delete session");
      }
    } catch (error) {
      console.error("Error deleting session:", error);
      setError("Failed to delete session");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex-1 flex flex-col">
        <header className="sticky top-0 z-10 bg-background border-b">
          <div className="container flex items-center h-16 px-4">
            <Link href="/profile" className="mr-2">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-xl font-bold">Session Details</h1>
          </div>
        </header>
        <main className="flex-1 container px-4 py-6">
          <Alert variant="destructive">
            <AlertDescription>{error || "Session not found"}</AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button asChild>
              <Link href="/profile">Back to Profile</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const arrivalTime = session.session_date
    ? new Date(session.session_date)
    : null;
  const formattedDate = arrivalTime?.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = arrivalTime?.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex-1 flex flex-col">
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="container flex items-center justify-between h-16 px-4">
          <div className="flex items-center">
            <Link href="/profile" className="mr-2">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-xl font-bold">Session Details</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" asChild>
              <Link href={`/log-session?edit=${session.id}`}>
                <Edit className="h-5 w-5" />
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Session</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this session? This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-destructive text-destructive-foreground"
                  >
                    {deleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </header>

      <main className="flex-1 container px-4 py-6 space-y-6 overflow-auto pb-20">
        {/* Session Image */}
        <div className="relative h-48 rounded-lg overflow-hidden">
          <Image
            src={session.image_url || "/placeholder.svg?height=400&width=800"}
            alt="Session"
            fill
            className="object-cover"
          />
        </div>

        {/* Session Info */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">
              {session.beach?.name || "Unknown Beach"}
            </h2>
            <div className="flex">
              {Array(5)
                .fill(0)
                .map((_, i) => (
                  <Star
                    key={i}
                    className={`h-5 w-5 ${
                      i < session.rating
                        ? "text-yellow-500 fill-yellow-500"
                        : "text-gray-300"
                    }`}
                  />
                ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{session.beach?.location || "Unknown Location"}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{formattedDate}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{formattedTime}</span>
            </div>
          </div>

          {session.description && (
            <Card>
              <CardContent className="p-4">
                <p>{session.description}</p>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-4">
            {session.wave_height && (
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <Waves className="h-6 w-6 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Wave Height</p>
                    <p className="font-medium">{session.wave_height}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {session.water_temp && (
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <Thermometer className="h-6 w-6 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Water Temp</p>
                    <p className="font-medium">{session.water_temp}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {session.crowd_rating && (
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <Users className="h-6 w-6 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Crowd</p>
                    <div className="flex">
                      {Array(5)
                        .fill(0)
                        .map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < session.crowd_rating
                                ? "text-yellow-500 fill-yellow-500"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {session.board && (
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-6 w-6 text-primary flex items-center justify-center">
                    🏄
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Board</p>
                    <p className="font-medium">{session.board.name}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Comments Section */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Comments</h3>
            <SessionComments sessionId={session.id} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
