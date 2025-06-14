"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SessionComments } from "@/components/session-comments";

interface CommentsModalProps {
  sessionId: string;
  beachName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CommentsModal({
  sessionId,
  beachName,
  isOpen,
  onClose,
}: CommentsModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Comments - {beachName}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto">
          <SessionComments sessionId={sessionId} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
