"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useXPToastSystem, XPBoosterCard } from "./xp-toast-system";
import { UserXPCard } from "./user-xp-card";
import { BadgeGallery } from "./badge-gallery";
import { trackXP, getUserXPStatus, getUserBadges, getAllBadgeDefinitions } from "@/lib/gamification-actions";
import type { XPAction } from "@/lib/gamification-actions";
import { Zap, Trophy, Star, Package, MessageSquare, Users } from "lucide-react";

// Test component for validating gamification system
export function GamificationTestPage() {
  const [xpData, setXpData] = useState(null);
  const [badges, setBadges] = useState([]);
  const [allBadges, setAllBadges] = useState([]);
  const [loading, setLoading] = useState(false);
  const { showXPGainedToast } = useXPToastSystem();

  // Mock user data
  const mockUser = {
    id: "test-user",
    username: "test_surfer",
    display_name: "Test Surfer",
    avatar_url: undefined,
  };

  const handleTestXP = async (action: XPAction) => {
    setLoading(true);
    try {
      const result = await trackXP(action);
      
      if (result.success) {
        showXPGainedToast(result.data);
        await refreshData();
      } else {
        console.error("XP tracking failed:", result.error);
      }
    } catch (error) {
      console.error("XP test error:", error);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    try {
      const [xpResult, badgesResult, allBadgesResult] = await Promise.all([
        getUserXPStatus(),
        getUserBadges(),
        getAllBadgeDefinitions(),
      ]);

      if (xpResult.success) {
        setXpData(xpResult.data);
      }
      
      if (badgesResult.success) {
        setBadges(badgesResult.data);
      }
      
      if (allBadgesResult.success) {
        setAllBadges(allBadgesResult.data);
      }
    } catch (error) {
      console.error("Data refresh error:", error);
    }
  };

  const xpActions = [
    { action: 'plan_session' as XPAction, label: 'Plan Session', icon: <Star className="h-4 w-4" />, xp: 50 },
    { action: 'add_board' as XPAction, label: 'Add Board', icon: <Package className="h-4 w-4" />, xp: 30 },
    { action: 'post_beach_intel' as XPAction, label: 'Post Intel', icon: <MessageSquare className="h-4 w-4" />, xp: 50 },
    { action: 'invite_friend' as XPAction, label: 'Invite Friend', icon: <Users className="h-4 w-4" />, xp: 100 },
    { action: 'write_reflection' as XPAction, label: 'Write Reflection', icon: <Trophy className="h-4 w-4" />, xp: 25 },
  ];

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">🏄‍♂️ Gamification Test</h1>
        <p className="text-muted-foreground">
          Test the XP tracking, badge unlocks, and UI components
        </p>
      </div>

      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Test XP Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {xpActions.map(({ action, label, icon, xp }) => (
              <Button
                key={action}
                variant="outline"
                className="h-auto p-4 justify-start"
                onClick={() => handleTestXP(action)}
                disabled={loading}
              >
                <div className="flex items-center gap-3 w-full">
                  {icon}
                  <div className="text-left">
                    <div className="font-medium">{label}</div>
                    <div className="text-sm text-green-600">+{xp} XP</div>
                  </div>
                </div>
              </Button>
            ))}
          </div>
          
          <div className="flex gap-4 mt-4">
            <Button onClick={refreshData} variant="secondary">
              Refresh Data
            </Button>
            <Badge variant="outline">
              Actions will trigger toasts and confetti!
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* XP Boosters Demo */}
      <Card>
        <CardHeader>
          <CardTitle>XP Boosters Demo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <XPBoosterCard
              action="log_reflection"
              xpValue={25}
              icon={<Trophy className="h-4 w-4 text-blue-600" />}
              description="Add a reflection to earn +25 XP!"
            />
            <XPBoosterCard
              action="add_board"
              xpValue={30}
              icon={<Package className="h-4 w-4 text-purple-600" />}
              description="Add a new board to your quiver"
            />
            <XPBoosterCard
              action="invite_friend"
              xpValue={100}
              icon={<Users className="h-4 w-4 text-green-600" />}
              description="Invite friends to join Quiver"
            />
          </div>
        </CardContent>
      </Card>

      {/* User XP Card */}
      {xpData && (
        <UserXPCard
          user={mockUser}
          xpData={xpData}
          badges={badges}
          onViewAllBadges={() => console.log("View all badges clicked")}
        />
      )}

      {/* Badge Gallery */}
      {allBadges.length > 0 && (
        <BadgeGallery
          badges={allBadges}
          userBadges={badges.map(b => b.badge_slug)}
        />
      )}

      {/* Debug Information */}
      <Card>
        <CardHeader>
          <CardTitle>Debug Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Current XP Data:</h4>
              <pre className="text-sm bg-gray-100 p-2 rounded overflow-x-auto">
                {JSON.stringify(xpData, null, 2)}
              </pre>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">User Badges ({badges.length}):</h4>
              <pre className="text-sm bg-gray-100 p-2 rounded overflow-x-auto max-h-40">
                {JSON.stringify(badges, null, 2)}
              </pre>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">All Badge Definitions ({allBadges.length}):</h4>
              <pre className="text-sm bg-gray-100 p-2 rounded overflow-x-auto max-h-40">
                {JSON.stringify(allBadges, null, 2)}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}