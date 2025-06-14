import { Button } from "@/components/ui/button";
import { CalendarDays, Waves } from "lucide-react";
import Link from "next/link";
import type { Beach } from "@/types/database";

interface BeachQuickActionsProps {
  beach: Beach;
  isAuthenticated: boolean;
}

export function BeachQuickActions({
  beach,
  isAuthenticated,
}: BeachQuickActionsProps) {
  return (
    <div className="p-4 flex gap-2">
      <Link
        href={
          isAuthenticated ? `/plan-session?beach=${beach.id}` : "/auth/sign-in"
        }
        className="flex-1"
      >
        <Button className="w-full">
          <CalendarDays className="h-4 w-4 mr-1" />
          Plan Session
        </Button>
      </Link>
      <Link
        href={
          isAuthenticated ? `/log-session?beach=${beach.id}` : "/auth/sign-in"
        }
        className="flex-1"
      >
        <Button variant="outline" className="w-full">
          <Waves className="h-4 w-4 mr-1" />
          Log Session
        </Button>
      </Link>
    </div>
  );
}
