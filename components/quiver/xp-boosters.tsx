"use client";

import { XPBoosterCard } from "@/components/gamification/xp-toast-system";
import { Package, Settings, Activity, Plus, Zap } from "lucide-react";
import { useRouter } from "next/navigation";

interface QuiverXPBoostersProps {
  boardCount?: number;
  boardsWithSpecs?: number;
  boardsUsedInSessions?: number;
}

export function QuiverXPBoosters({
  boardCount = 0,
  boardsWithSpecs = 0,
  boardsUsedInSessions = 0,
}: QuiverXPBoostersProps) {
  const router = useRouter();

  const boosters = [
    {
      action: "Add First Board",
      xpValue: 30,
      icon: <Plus className="h-4 w-4 text-green-600" />,
      description: "Add your first board to the quiver",
      completed: boardCount > 0,
      visible: boardCount === 0,
      onClick: () => router.push("/quiver/new"),
    },
    {
      action: "Add Another Board",
      xpValue: 30,
      icon: <Package className="h-4 w-4 text-blue-600" />,
      description: "Expand your quiver collection",
      completed: false,
      visible: boardCount > 0 && boardCount < 10,
      onClick: () => router.push("/quiver/new"),
    },
    {
      action: "Add Board Specs",
      xpValue: 20,
      icon: <Settings className="h-4 w-4 text-purple-600" />,
      description: "Add detailed specs to your boards",
      completed: boardsWithSpecs >= boardCount && boardCount > 0,
      visible: boardCount > 0 && boardsWithSpecs < boardCount,
      onClick: () => router.push("/quiver"),
    },
    {
      action: "Use Board in Session",
      xpValue: 20,
      icon: <Activity className="h-4 w-4 text-orange-600" />,
      description: "Tag a board in your next session",
      completed: boardsUsedInSessions > 0,
      visible: boardCount > 0,
      onClick: () => router.push("/sessions/new"),
    },
    {
      action: "Build Your Quiver",
      xpValue: 100,
      icon: <Zap className="h-4 w-4 text-yellow-600" />,
      description: "Reach 3 boards for Quiver Builder badge",
      completed: boardCount >= 3,
      visible: boardCount < 3,
      onClick: () => router.push("/quiver/new"),
    },
  ];

  const activeBoosters = boosters.filter(b => b.visible && !b.completed);

  if (activeBoosters.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Package className="h-4 w-4" />
        <span>Grow your quiver to earn XP</span>
      </div>
      
      <div className="grid gap-2">
        {activeBoosters.slice(0, 3).map((booster) => (
          <XPBoosterCard
            key={booster.action}
            action={booster.action}
            xpValue={booster.xpValue}
            icon={booster.icon}
            description={booster.description}
            onClick={booster.onClick}
            completed={booster.completed}
          />
        ))}
      </div>
    </div>
  );
}