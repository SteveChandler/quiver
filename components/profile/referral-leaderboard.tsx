"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { Users, Share2, Trophy, Medal, Award } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import {
  getReferralLeaderboard,
  getReferralStats,
  getOrCreateReferralCode,
  type ReferralLeaderboardEntry,
} from "@/actions/referral-actions";

/**
 * Rank badge for the top 3 referrers.
 */
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 rotate-[-2deg]">
        <Trophy className="h-4 w-4 text-amber-400" />
      </div>
    );
  if (rank === 2)
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-300/20 border border-slate-300/40 rotate-[1deg]">
        <Medal className="h-4 w-4 text-slate-300" />
      </div>
    );
  if (rank === 3)
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-700/20 border border-orange-700/40 rotate-[-1deg]">
        <Award className="h-4 w-4 text-orange-600" />
      </div>
    );
  return (
    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.06]">
      <span className="text-sm font-mono text-[#9AABC6]">#{rank}</span>
    </div>
  );
}

interface ReferralLeaderboardProps {
  onInvite?: () => void;
}

/**
 * ReferralLeaderboard — Shows top referrers with a competitive ranking.
 *
 * Placed on the profile page. Fetches leaderboard data from the
 * `get_referral_leaderboard` DB function and the current user's stats.
 * Includes a CTA to share/invite friends.
 */
export function ReferralLeaderboard({ onInvite }: ReferralLeaderboardProps) {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    const result = await getReferralLeaderboard(10);
    return result?.data ?? ([] as ReferralLeaderboardEntry[]);
  }, []);

  const fetchStats = useCallback(async () => {
    const result = await getReferralStats();
    return result?.data ?? {
      total_referrals: 0,
      completed_referrals: 0,
      pending_referrals: 0,
      expired_referrals: 0,
      referral_code: null as string | null,
    };
  }, []);

  const {
    data: leaderboard,
    loading: leaderboardLoading,
  } = useDataFetcher(fetchLeaderboard);

  const {
    data: stats,
    loading: statsLoading,
  } = useDataFetcher(fetchStats);

  // Load referral code for the invite CTA
  useEffect(() => {
    if (!user) return;
    getOrCreateReferralCode()
      .then((result) => {
        if (result?.data?.code) setReferralCode(result.data.code);
      })
      .catch(() => {
        // Ignore — the invite CTA just won't show the code
      });
  }, [user]);

  const loading = leaderboardLoading || statsLoading;

  const handleShare = async () => {
    if (onInvite) {
      onInvite();
      return;
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";
    const shareUrl = referralCode
      ? `${baseUrl}/?ref=${referralCode}`
      : baseUrl;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join me on Quiver",
          text: "Check out Quiver — surf forecasts, conditions, and crew all in one app.",
          url: shareUrl,
        });
      } catch {
        // User cancelled share
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
    }
  };

  if (loading) {
    return (
      <Card className="bg-[#1a2055] border-white/[0.08]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white font-heading">
            <Users className="h-5 w-5 text-[#F78E42]" />
            Referral Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 rounded-xl bg-white/[0.06]" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const myStats = stats ?? {
    total_referrals: 0,
    completed_referrals: 0,
    pending_referrals: 0,
    expired_referrals: 0,
    referral_code: null,
  };

  const hasLeaderboardData =
    leaderboard && Array.isArray(leaderboard) && leaderboard.length > 0;

  // Hide entire section when empty — showing "0 referrals" and an empty
  // leaderboard signals isolation, not community. Only render when the user
  // or someone on the platform has referral activity to display.
  if (!hasLeaderboardData && myStats.total_referrals === 0) {
    return null;
  }

  // Find current user's rank in the leaderboard
  const myRank = hasLeaderboardData
    ? leaderboard.find(
        (entry: ReferralLeaderboardEntry) => entry.user_id === user?.id
      )?.rank
    : null;

  return (
    <Card className="bg-[#1a2055] border-white/[0.08] overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-white font-heading text-lg">
          <Users className="h-5 w-5 text-[#F78E42]" />
          Referral Crew
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current user's stats summary */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-[#F78E42]/10 border border-[#F78E42]/20">
          <div>
            <p className="text-sm text-[#B0C0D6]">Your referrals</p>
            <p className="text-2xl font-heading font-bold text-white">
              {myStats.total_referrals}
            </p>
          </div>
          <div className="text-right">
            {myRank ? (
              <p className="text-sm text-[#F78E42] font-medium">
                Rank #{myRank}
              </p>
            ) : myStats.total_referrals > 0 ? (
              <p className="text-sm text-[#9AABC6]">Ranked</p>
            ) : null}
            {myStats.pending_referrals > 0 && (
              <p className="text-xs text-[#9AABC6]">
                {myStats.pending_referrals} pending
              </p>
            )}
          </div>
        </div>

        {/* Leaderboard list */}
        {hasLeaderboardData ? (
          <div className="space-y-2">
            {leaderboard.map((entry: ReferralLeaderboardEntry) => {
              const isCurrentUser = entry.user_id === user?.id;
              return (
                <div
                  key={entry.user_id}
                  className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors ${
                    isCurrentUser
                      ? "bg-[#F78E42]/10 border border-[#F78E42]/20"
                      : "bg-white/[0.03] hover:bg-white/[0.06]"
                  }`}
                >
                  <RankBadge rank={entry.rank} />
                  <UserAvatar
                    src={entry.avatar_url}
                    name={entry.display_name}
                    size="sm"
                    className="ring-1 ring-white/10"
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${
                        isCurrentUser ? "text-[#F78E42]" : "text-white"
                      }`}
                    >
                      {isCurrentUser ? "You" : entry.display_name}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-mono text-white">
                      {entry.referral_count}
                    </p>
                    <p className="text-[10px] text-[#9AABC6]">
                      {entry.referral_count === 1 ? "referral" : "referrals"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty state */
          <div className="text-center py-6 space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-white/[0.06] flex items-center justify-center">
              <Users className="h-6 w-6 text-[#9AABC6]" />
            </div>
            <p className="text-sm text-[#9AABC6]">
              Be the first to invite your crew
            </p>
            <p className="text-xs text-[#9AABC6]/70">
              Share your referral link and climb the leaderboard
            </p>
          </div>
        )}

        {/* Invite CTA */}
        <Button
          onClick={handleShare}
          className="w-full bg-[#F78E42] hover:bg-[#F78E42]/90 text-[#11100D] font-heading font-semibold rounded-xl"
        >
          <Share2 className="h-4 w-4 mr-2" />
          Invite a friend
        </Button>

        {/* Referral code display */}
        {referralCode && (
          <p className="text-center text-xs text-[#9AABC6]">
            Your code:{" "}
            <span className="font-mono text-white/80 bg-white/[0.06] px-2 py-0.5 rounded">
              {referralCode}
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
