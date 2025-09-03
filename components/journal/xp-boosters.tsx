"use client";

import { XPBoosterCard } from "@/components/gamification/xp-toast-system";
import { BookOpen, Thermometer, Tag, Users, Star, Calendar } from "lucide-react";
import { useRouter } from "next/navigation";

interface JournalXPBoostersProps {
  sessionId?: string;
  hasReflection?: boolean;
  hasTemperature?: boolean;
  hasTags?: boolean;
  hasFriends?: boolean;
  hasRating?: boolean;
}

export function JournalXPBoosters({
  sessionId,
  hasReflection = false,
  hasTemperature = false,
  hasTags = false,
  hasFriends = false,
  hasRating = false,
}: JournalXPBoostersProps) {
  const router = useRouter();

  const boosters = [
    {
      action: "Write Reflection",
      xpValue: 25,
      icon: <BookOpen className="h-4 w-4 text-blue-600" />,
      description: "Add a reflection to this session",
      completed: hasReflection,
      onClick: () => sessionId && router.push(`/sessions/${sessionId}/edit#reflection`),
    },
    {
      action: "Record Temperature",
      xpValue: 10,
      icon: <Thermometer className="h-4 w-4 text-cyan-600" />,
      description: "Log water temperature",
      completed: hasTemperature,
      onClick: () => sessionId && router.push(`/sessions/${sessionId}/edit#conditions`),
    },
    {
      action: "Add Surf Tags",
      xpValue: 20,
      icon: <Tag className="h-4 w-4 text-purple-600" />,
      description: "Tag your surf style",
      completed: hasTags,
      onClick: () => sessionId && router.push(`/sessions/${sessionId}/edit#tags`),
    },
    {
      action: "Tag Friends",
      xpValue: 20,
      icon: <Users className="h-4 w-4 text-green-600" />,
      description: "Tag friends in this session",
      completed: hasFriends,
      onClick: () => sessionId && router.push(`/sessions/${sessionId}/edit#friends`),
    },
    {
      action: "Rate Waves",
      xpValue: 15,
      icon: <Star className="h-4 w-4 text-yellow-600" />,
      description: "Rate the wave quality",
      completed: hasRating,
      onClick: () => sessionId && router.push(`/sessions/${sessionId}/edit#rating`),
    },
  ];

  const activeBoosters = boosters.filter(b => !b.completed);

  if (activeBoosters.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Calendar className="h-4 w-4" />
        <span>Complete actions to earn XP</span>
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