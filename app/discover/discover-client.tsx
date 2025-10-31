"use client";

import { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Users, TrendingUp } from "lucide-react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
// import { getSuggestedUsers } from "@/actions/social-actions";
import { FollowButton } from "@/components/social/follow-button";
import { useAuth } from "@/context/auth-context";
import { UserProfileModal } from "@/components/social/user-profile-modal";

export default function DiscoverPageClient() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Temporarily disabled - will implement suggested users later
  const suggestedUsers: Array<{
    id: string;
    full_name?: string | null;
    avatar_url?: string | null;
    followers_count?: number | null;
  }> = [];
  const loading = false;
  const error = null;

  // User search functionality
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Update follower count for a specific user in search results
  const updateUserFollowerCount = useCallback(
    (userId: string, newCount: number) => {
      setSearchResults((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, followers_count: newCount } : user
        )
      );
    },
    []
  );

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) return;

    setSearchLoading(true);
    try {
      const response = await fetch(
        `/api/users/search?q=${encodeURIComponent(searchQuery)}&limit=20`
      );
      const data = await response.json();

      if (data.success) {
        setSearchResults(data.data.users || []);
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
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
        <div className="container py-16">
          <div className="max-w-2xl mx-auto text-center">
            <Users className="h-20 w-20 text-ocean-blue mx-auto mb-6" />
            <h1 className="text-4xl font-bold mb-4">Discover Surfers</h1>
            <p className="text-muted-foreground text-lg mb-8">
              Sign in to discover and follow other surfers in your community. Connect with local surfers, coordinate sessions, and build your surf network.
            </p>
            <div className="flex gap-4 justify-center">
              <Button
                size="lg"
                onClick={() => {
                  window.location.href = "/auth/sign-in";
                }}
                className="bg-ocean-blue hover:bg-ocean-blue/90"
              >
                Sign In
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  window.location.href = "/auth/sign-up";
                }}
              >
                Sign Up
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Users className="h-8 w-8 text-primary" />
          Discover Surfers
        </h1>
        <p className="text-muted-foreground">
          Find and follow other surfers to coordinate sessions and build your
          surf community.
        </p>
      </div>

      {/* Search Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={handleSearch}
              disabled={!searchQuery.trim() || searchLoading}
            >
              <Search className="h-4 w-4 mr-2" />
              {searchLoading ? "Searching..." : "Search"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Search for surfers by name or email to send them a follow request.
          </p>
        </CardContent>
      </Card>

      {/* Search Results Section */}
      {searchResults.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Results ({searchResults.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {searchResults.map((searchUser: any) => (
                <div
                  key={searchUser.id}
                  className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={searchUser.avatar_url} />
                    <AvatarFallback>
                      {searchUser.full_name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">
                      {searchUser.full_name || "Anonymous User"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {searchUser.followers_count || 0} followers
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedUserId(searchUser.id);
                        setIsProfileModalOpen(true);
                      }}
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
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Suggested Users Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Suggested Surfers
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Popular surfers and active community members you might want to
            follow.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-4 rounded-lg border animate-pulse"
                >
                  <div className="w-12 h-12 bg-muted rounded-full"></div>
                  <div className="flex-1">
                    <div className="w-32 h-4 bg-muted rounded mb-2"></div>
                    <div className="w-24 h-3 bg-muted rounded"></div>
                  </div>
                  <div className="w-20 h-8 bg-muted rounded"></div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Unable to load suggested users</p>
              <p className="text-sm">{error}</p>
            </div>
          ) : !suggestedUsers || suggestedUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium mb-2">
                No suggested users right now
              </p>
              <p className="text-sm">
                As more people join Quiver, you&apos;ll see suggested surfers to
                follow here. Invite friends to join the community!
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {suggestedUsers.map((suggestedUser: any) => (
                <div
                  key={suggestedUser.id}
                  className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={suggestedUser.avatar_url} />
                    <AvatarFallback>
                      {suggestedUser.full_name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">
                      {suggestedUser.full_name || "Anonymous User"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {suggestedUser.followers_count || 0} followers
                    </p>
                  </div>

                  <FollowButton
                    userId={suggestedUser.id}
                    initialFollowersCount={suggestedUser.followers_count || 0}
                    variant="default"
                    size="sm"
                    followingLabel="Following"
                    onFollowersCountChange={(newCount) =>
                      updateUserFollowerCount(suggestedUser.id, newCount)
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* How Following Works */}
      <Card className="mt-8 bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-blue-800 mb-2">
                How Following Works
              </h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Follow other surfers to see their session activities</li>
                <li>• Invite followers to join your planned surf sessions</li>
                <li>
                  • Get notifications when people you follow plan epic sessions
                </li>
                <li>
                  • Build your local surf community and coordinate better
                  sessions
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Profile Modal */}
      {selectedUserId && (
        <UserProfileModal
          userId={selectedUserId}
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
        />
      )}
    </div>
  );
}
