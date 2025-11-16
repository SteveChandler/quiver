"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Loader2,
  Heart,
  MapPin,
  Waves,
  Users,
  Car,
  Accessibility,
} from "lucide-react";
import {
  removeFavoriteBeach,
  reorderFavoriteBeaches,
} from "@/actions/beach/beach-favorite-actions";
import { useAuth } from "@/context/auth-context";
import Link from "next/link";
import { toast } from "@/components/ui/use-toast";
import type { Beach } from "@/types/database";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { beachNavigation } from "@/lib/navigation-utils";
import { getBeachLocation } from "@/lib/utils/beach-card-utils";

export function FavoriteBeaches() {
  const { user } = useAuth();
  const [beaches, setBeaches] = useState<Beach[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  // Standard data fetching pattern
  const fetchFavorites = useCallback(async () => {
    if (!user?.id) return [] as Beach[];
    try {
      const res = await fetch("/api/beaches/favorites", {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) return [] as Beach[];
      const json = await res.json();
      return (json?.data?.beaches || []) as Beach[];
    } catch (e) {
      console.error("FavoriteBeaches: failed to fetch favorites via API", e);
      return [] as Beach[];
    }
  }, [user?.id]);

  const { data: favorites, loading: favLoading } = useDataFetcher(
    fetchFavorites,
    {
      immediate: true,
      skip: !user,
      initialData: [] as Beach[],
    }
  );

  useEffect(() => {
    setBeaches(favorites || []);
    setLoading(favLoading);
  }, [favorites, favLoading]);

  const handleRemoveFavorite = async (beachId: string) => {
    if (!user) return;

    setRemoving(beachId);
    try {
      const result = await removeFavoriteBeach(beachId);
      if (result.success) {
        setBeaches((prev) => prev.filter((beach) => beach.id !== beachId));
        toast({
          title: "Beach removed",
          description: "Beach removed from favorites.",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to remove beach from favorites.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error removing favorite beach:", error);
      toast({
        title: "Error",
        description: "Failed to remove beach from favorites.",
        variant: "destructive",
      });
    } finally {
      setRemoving(null);
    }
  };

  const moveBeach = (index: number, direction: -1 | 1) => {
    setBeaches((prev) => {
      const next = prev.slice();
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const saveOrder = async () => {
    if (!user) return;
    setSavingOrder(true);
    try {
      const orderedIds = beaches.map((b) => b.id);
      const result = await reorderFavoriteBeaches(user.id, orderedIds);
      if (result?.success) {
        toast({ title: "Order saved", description: "Favorites updated." });
      } else {
        throw new Error(result?.error || "Failed to save order");
      }
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to save order.",
        variant: "destructive",
      });
    } finally {
      setSavingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (beaches.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>You don&apos;t have any favorite beaches yet.</p>
        <Button variant="link" asChild>
          <Link href="/map">Explore beaches</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={saveOrder}
          disabled={savingOrder}
          variant="secondary"
          size="sm"
        >
          {savingOrder ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Save Order"
          )}
        </Button>
      </div>
      {beaches.map((beach, idx) => (
        <Card key={beach.id} className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{beach.name}</CardTitle>
            <CardDescription className="flex items-center">
              <MapPin className="h-4 w-4 mr-1" />
              {getBeachLocation(beach)}
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center">
                <Waves className="h-4 w-4 mr-1 text-blue-500" />
                <span>
                  Wave Quality: {beach.wave_quality_rating?.toFixed(1)}/5
                </span>
              </div>
              <div className="flex items-center">
                <Users className="h-4 w-4 mr-1 text-orange-500" />
                <span>Crowd: {beach.crowd_density_rating?.toFixed(1)}/5</span>
              </div>
              <div className="flex items-center">
                <Car className="h-4 w-4 mr-1 text-gray-500" />
                <span>Parking: {beach.parking_rating?.toFixed(1)}/5</span>
              </div>
              <div className="flex items-center">
                <Accessibility className="h-4 w-4 mr-1 text-green-500" />
                <span>Access: {beach.accessibility_rating?.toFixed(1)}/5</span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between items-center gap-2 pt-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => moveBeach(idx, -1)}
                disabled={idx === 0}
              >
                Move Up
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => moveBeach(idx, 1)}
                disabled={idx === beaches.length - 1}
              >
                Move Down
              </Button>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={beachNavigation.toBeachDetail(beach)}>View Details</Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRemoveFavorite(beach.id)}
              disabled={removing === beach.id}
            >
              {removing === beach.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Heart className="h-4 w-4 text-red-500 fill-red-500" />
              )}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
