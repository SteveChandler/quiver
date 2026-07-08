"use client";

import { useCallback, useEffect, useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Users, TrendingUp } from "lucide-react";
import { FollowButton } from "@/components/social/follow-button";
import { useAuth } from "@/context/auth-context";
import { UserProfileModal } from "@/components/social/user-profile-modal";
import { QuiverSticker, ZineSurface } from "@/components/zine";
import { track } from "@/lib/analytics";

interface DiscoverUser {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  followers_count?: number | null;
}

interface UserSearchResponse {
  success?: boolean;
  data?: {
    users?: DiscoverUser[];
  };
  error?: string;
}

type DiscoverSurface = "search" | "suggested";
type DiscoverEventType =
  | "discover_page_view"
  | "discover_suggested_users_impression"
  | "discover_profile_open"
  | "discover_follow_attempt";

interface SuggestedUsersResponse {
  success?: boolean;
  data?: {
    users?: DiscoverUser[];
    source?: string;
  };
  error?: string;
}

export default function DiscoverPageClient(): ReactElement {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;
  const [searchQuery, setSearchQuery] = useState("");
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [suggestedUsers, setSuggestedUsers] = useState<DiscoverUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // User search functionality
  const [searchResults, setSearchResults] = useState<DiscoverUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Update follower count for a specific user in search results
  const updateUserFollowerCount = useCallback(
    (userId: string, newCount: number) => {
      setSearchResults((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, followers_count: newCount } : user
        )
      );
      setSuggestedUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, followers_count: newCount } : user
        )
      );
    },
    []
  );

  const postDiscoverEvent = useCallback(
    (eventType: DiscoverEventType, metadata: Record<string, unknown> = {}) => {
      track(eventType, metadata);
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType, metadata }),
        keepalive: true,
      }).catch(() => {});
    },
    []
  );

  useEffect(() => {
    if (!userId) return;

    postDiscoverEvent("discover_page_view", { surface: "discover" });

    let cancelled = false;

    const loadSuggestedUsers = async (): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/users/suggested?limit=8", {
          cache: "no-store",
        });
        const data = (await response.json()) as SuggestedUsersResponse;

        if (cancelled) return;

        if (data.success) {
          const users = data.data?.users ?? [];
          setSuggestedUsers(users);
          postDiscoverEvent("discover_suggested_users_impression", {
            count: users.length,
            source: data.data?.source ?? "popular_profiles",
          });
        } else {
          setSuggestedUsers([]);
          setError(data.error ?? "Suggested surfers are unavailable.");
        }
      } catch (loadError) {
        if (cancelled) return;
        console.error("Suggested users failed:", loadError);
        setSuggestedUsers([]);
        setError("Suggested surfers are unavailable.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadSuggestedUsers();

    return () => {
      cancelled = true;
    };
  }, [postDiscoverEvent, userId]);

  const handleProfileOpen = useCallback(
    (targetUserId: string, surface: DiscoverSurface) => {
      postDiscoverEvent("discover_profile_open", {
        target_user_id: targetUserId,
        surface,
      });
      setSelectedUserId(targetUserId);
      setIsProfileModalOpen(true);
    },
    [postDiscoverEvent]
  );

  const handleFollowAttempt = useCallback(
    (targetUserId: string, surface: DiscoverSurface) => {
      postDiscoverEvent("discover_follow_attempt", {
        target_user_id: targetUserId,
        surface,
      });
    },
    [postDiscoverEvent]
  );

  const handleSearch = async (): Promise<void> => {
    if (!searchQuery.trim() || searchQuery.length < 2) return;

    setSearchLoading(true);
    try {
      const response = await fetch(
        `/api/users/search?q=${encodeURIComponent(searchQuery)}&limit=20`
      );
      const data = (await response.json()) as UserSearchResponse;

      if (data.success) {
        setSearchResults(data.data?.users || []);
      } else {
        console.error("Search error:", data.error);
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Search failed:", error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  if (!user) {
    return (
      <ZineSurface
        sectionLabel="Discover"
        editionLabel="Crew finder"
        data-testid="discover-zine-surface"
      >
        <main className="relative">
          <QuiverSticker
            sticker="orangeTape"
            className="absolute -top-8 right-4 hidden w-36 rotate-6 opacity-85 sm:block"
          />
          <section className="mx-auto max-w-3xl py-8 text-center sm:py-12">
            <div className="stamp-circle mx-auto mb-6">
              <Users className="h-9 w-9" aria-hidden />
              <span className="mt-1 text-[10px] leading-none">Crew</span>
            </div>
            <p className="label-black mb-5">Discover surfers</p>
            <h1 className="zine-h1 font-black uppercase leading-[0.88] tracking-normal text-[#11100D]">
              Discover Surfers
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#11100D]/75 sm:text-xl">
              Sign in to discover and follow other surfers in your community. Connect with local surfers, coordinate sessions, and build your surf network.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                onClick={() => {
                  router.push("/auth/sign-in");
                }}
                className="min-h-11 rounded-full border-2 border-[#11100D] bg-[#F78E42] px-5 py-2 font-semibold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.35)] transition-transform hover:-translate-y-0.5 hover:bg-[#F78E42]"
              >
                Sign In
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  router.push("/auth/sign-up");
                }}
                className="min-h-11 rounded-full border-2 border-[#11100D] bg-[#FBF6E8] px-5 py-2 font-semibold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.22)] transition-transform hover:-translate-y-0.5 hover:bg-[#FBF6E8]"
              >
                Sign Up
              </Button>
            </div>
          </section>
        </main>
      </ZineSurface>
    );
  }

  return (
    <ZineSurface
      sectionLabel="Discover"
      editionLabel="Crew finder"
      data-testid="discover-zine-surface"
    >
      <main>
        <header className="relative mb-10 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <QuiverSticker
            sticker="orangeTape"
            className="absolute -top-8 right-8 hidden w-36 rotate-6 opacity-85 sm:block"
          />
          <div>
            <p className="label-black mb-5">Discover surfers</p>
            <h1 className="zine-h1 font-black uppercase leading-[0.88] tracking-normal text-[#11100D]">
              Discover Surfers
            </h1>
            <p className="mt-6 max-w-2xl text-xl leading-relaxed text-[#11100D]/75 sm:text-2xl">
              Find and follow other surfers to coordinate sessions and build your
              surf community.
            </p>
          </div>
          <div className="torn torn-tb rot-2 border-2 border-[#11100D] bg-[#F0E5CC]">
            <p className="typewriter mb-3">Community search</p>
            <div className="grid gap-3 font-mono text-xs uppercase tracking-[0.14em] text-[#11100D]/68">
              <span>Search by surfer name</span>
              <span>View surfer profiles</span>
              <span>Follow the crew you paddle with</span>
            </div>
            <QuiverSticker
              sticker="spotLocation"
              className="absolute -bottom-8 right-4 hidden w-20 rotate-6 drop-shadow-sm sm:block"
            />
          </div>
        </header>

        {/* Search Section */}
        <section
          className="torn torn-tb mb-8 border-2 border-[#11100D] bg-[#FBF6E8]"
          aria-labelledby="discover-search-heading"
        >
          <div className="mb-5 flex flex-wrap items-center gap-3 border-b-2 border-dashed border-[#11100D]/35 pb-4">
            <span className="circled bg-[#F78E42]/35">
              <Search className="h-5 w-5" aria-hidden />
            </span>
            <h2
              id="discover-search-heading"
              className="font-display text-2xl font-black uppercase leading-tight text-[#11100D] sm:text-3xl"
            >
              Search Users
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="Search by surfer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-zine-input="true"
              className="min-h-11 flex-1 rounded-none border-2 border-[#11100D] bg-[#F4EBD8] font-sans text-[#11100D] placeholder:text-[#11100D]/45 focus-visible:ring-[#F78E42]"
            />
            <Button
              onClick={handleSearch}
              disabled={!searchQuery.trim() || searchLoading}
              className="min-h-11 rounded-full border-2 border-[#11100D] bg-[#F78E42] px-5 py-2 font-semibold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.35)] transition-transform hover:-translate-y-0.5 hover:bg-[#F78E42] disabled:translate-y-0 disabled:opacity-60"
            >
              <Search className="mr-2 h-4 w-4" />
              {searchLoading ? "Searching..." : "Search"}
            </Button>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[#11100D]/68">
            Search for surfers by name to send them a follow request.
          </p>
        </section>

        {/* Search Results Section */}
        {searchResults.length > 0 && (
          <section
            className="mb-8"
            aria-labelledby="discover-results-heading"
          >
            <div className="mb-5 border-b-2 border-dashed border-[#11100D]/35 pb-4">
              <p className="typewriter mb-2">Matched surfers</p>
              <h2
                id="discover-results-heading"
                className="font-display text-2xl font-black uppercase leading-tight text-[#11100D] sm:text-3xl"
              >
                Search Results ({searchResults.length})
              </h2>
            </div>
            <div className="grid gap-4">
              {searchResults.map((searchUser) => (
                <div
                  key={searchUser.id}
                  className="torn flex flex-col gap-4 border-2 border-[#11100D] bg-[#FBF6E8] p-4 text-[#11100D] transition-transform hover:-translate-y-0.5 sm:flex-row sm:items-center"
                >
                  <Avatar className="h-12 w-12 border-2 border-[#11100D]">
                    <AvatarImage src={searchUser.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-[#F0E5CC] font-display font-black uppercase text-[#11100D]">
                      {searchUser.full_name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-lg font-black uppercase leading-tight text-[#11100D]">
                      {searchUser.full_name || "Anonymous User"}
                    </h3>
                    <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em] text-[#11100D]/62">
                      {searchUser.followers_count || 0} followers
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleProfileOpen(searchUser.id, "search");
                      }}
                      className="rounded-full border-2 border-[#11100D] bg-[#FBF6E8] font-semibold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.2)] hover:bg-[#F0E5CC]"
                    >
                      View Profile
                    </Button>
                    <FollowButton
                      userId={searchUser.id}
                      initialFollowersCount={searchUser.followers_count || 0}
                      variant="default"
                      size="sm"
                      followingLabel="Following"
                      onFollowersCountChange={(newCount) =>
                        updateUserFollowerCount(searchUser.id, newCount)
                      }
                      onFollowAttempt={() =>
                        handleFollowAttempt(searchUser.id, "search")
                      }
                      className="[&_button]:rounded-full [&_button]:border-2 [&_button]:border-[#11100D] [&_button]:bg-[#FBF6E8] [&_button]:font-semibold [&_button]:text-[#11100D] [&_button]:shadow-[2px_2px_0_rgba(17,16,13,0.2)] [&_button:hover]:bg-[#F0E5CC] [&_svg]:text-[#11100D]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Suggested Users Section */}
        <section
          className="torn torn-tb border-2 border-[#11100D] bg-[#F0E5CC]"
          style={{ paddingTop: 56 }}
          aria-labelledby="suggested-surfers-heading"
        >
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b-2 border-dashed border-[#11100D]/35 pb-4">
            <div>
              <h2
                id="suggested-surfers-heading"
                className="flex items-center gap-2 font-display text-2xl font-black uppercase leading-tight text-[#11100D] sm:text-3xl"
              >
                <TrendingUp className="h-6 w-6" aria-hidden />
                Suggested Surfers
              </h2>
            </div>
            <QuiverSticker
              sticker="creamCoastMap"
              className="hidden w-20 rotate-6 drop-shadow-sm sm:block"
            />
          </div>
          <p className="mb-5 max-w-2xl text-sm leading-relaxed text-[#11100D]/68">
            Popular surfers and active community members you might want to
            follow.
          </p>
          {loading ? (
            <div className="grid gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex animate-pulse items-center gap-4 border-2 border-[#11100D]/35 bg-[#FBF6E8] p-4"
                >
                  <div className="h-12 w-12 rounded-full bg-[#D9C49C]"></div>
                  <div className="flex-1">
                    <div className="mb-2 h-4 w-32 rounded bg-[#D9C49C]"></div>
                    <div className="h-3 w-24 rounded bg-[#D9C49C]"></div>
                  </div>
                  <div className="h-8 w-20 rounded bg-[#D9C49C]"></div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="py-8 text-center text-[#11100D]/70">
              <p className="font-display text-lg font-black uppercase text-[#11100D]">
                Unable to load suggested users
              </p>
              <p className="mt-2 text-sm">{error}</p>
            </div>
          ) : !suggestedUsers || suggestedUsers.length === 0 ? (
            <div className="py-8 text-center text-[#11100D]/70">
              <Users className="mx-auto mb-4 h-12 w-12 text-[#11100D]/45" />
              <p className="mb-2 font-display text-xl font-black uppercase text-[#11100D]">
                No suggested users right now
              </p>
              <p className="mx-auto max-w-xl text-sm leading-relaxed">
                Search by surfer name or invite the people you paddle with.
                Suggested surfers will appear here as local community activity
                grows.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {suggestedUsers.map((suggestedUser) => (
                <div
                  key={suggestedUser.id}
                  className="torn flex flex-col gap-4 border-2 border-[#11100D] bg-[#FBF6E8] p-4 text-[#11100D] transition-transform hover:-translate-y-0.5 sm:flex-row sm:items-center"
                >
                  <Avatar className="h-12 w-12 border-2 border-[#11100D]">
                    <AvatarImage src={suggestedUser.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-[#F0E5CC] font-display font-black uppercase text-[#11100D]">
                      {suggestedUser.full_name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-lg font-black uppercase leading-tight text-[#11100D]">
                      {suggestedUser.full_name || "Anonymous User"}
                    </h3>
                    <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em] text-[#11100D]/62">
                      {suggestedUser.followers_count || 0} followers
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleProfileOpen(suggestedUser.id, "suggested");
                      }}
                      className="rounded-full border-2 border-[#11100D] bg-[#FBF6E8] font-semibold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.2)] hover:bg-[#F0E5CC]"
                    >
                      View Profile
                    </Button>
                    <FollowButton
                      userId={suggestedUser.id}
                      initialFollowersCount={suggestedUser.followers_count || 0}
                      variant="default"
                      size="sm"
                      followingLabel="Following"
                      onFollowersCountChange={(newCount) =>
                        updateUserFollowerCount(suggestedUser.id, newCount)
                      }
                      onFollowAttempt={() =>
                        handleFollowAttempt(suggestedUser.id, "suggested")
                      }
                      className="[&_button]:rounded-full [&_button]:border-2 [&_button]:border-[#11100D] [&_button]:bg-[#FBF6E8] [&_button]:font-semibold [&_button]:text-[#11100D] [&_button]:shadow-[2px_2px_0_rgba(17,16,13,0.2)] [&_button:hover]:bg-[#F0E5CC] [&_svg]:text-[#11100D]"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* How Following Works */}
        <section
          className="hazards-panel mt-8"
          aria-labelledby="following-works-heading"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <Users
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#F2C94C]"
              aria-hidden
            />
            <div>
              <h2
                id="following-works-heading"
                className="mb-3 font-display text-2xl font-black uppercase leading-tight text-[#F4EBD8]"
              >
                How Following Works
              </h2>
              <ul className="space-y-2 text-sm leading-relaxed text-[#F4EBD8]/82">
                <li>Follow other surfers to see their session activities</li>
                <li>Invite followers to join your planned surf sessions</li>
                <li>
                  Get notifications when people you follow plan epic sessions
                </li>
                <li>
                  Build your local surf community and coordinate better
                  sessions
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* User Profile Modal */}
        {selectedUserId && (
          <UserProfileModal
            userId={selectedUserId}
            isOpen={isProfileModalOpen}
            onClose={() => setIsProfileModalOpen(false)}
          />
        )}
      </main>
    </ZineSurface>
  );
}
