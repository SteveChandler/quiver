"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import dynamic from "next/dynamic";
import type { Beach } from "@/types/database";

// Dynamically import session form components
const SessionForm = dynamic(
  () => import("@/components/session-forms/SessionForm").then((m) => ({ default: m.SessionForm })),
  { ssr: false }
);

interface SessionPlanningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  beach: Beach;
  initialMode?: "log" | "plan";
}

export function SessionPlanningModal({
  open,
  onOpenChange,
  beach,
  initialMode = "log",
}: SessionPlanningModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Session at {beach.name}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue={initialMode} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="log">Log Session</TabsTrigger>
            <TabsTrigger value="plan">Plan Session</TabsTrigger>
          </TabsList>

          <TabsContent value="log" className="mt-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Record your surf session at {beach.name}. Track waves, conditions, and your experience.
              </p>
              <SessionForm
                beachId={beach.id}
                beachName={beach.name}
                onSuccess={() => onOpenChange(false)}
                mode="log"
              />
            </div>
          </TabsContent>

          <TabsContent value="plan" className="mt-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Plan an upcoming session at {beach.name}. Set a date and time based on forecast conditions.
              </p>
              <SessionForm
                beachId={beach.id}
                beachName={beach.name}
                onSuccess={() => onOpenChange(false)}
                mode="plan"
              />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
