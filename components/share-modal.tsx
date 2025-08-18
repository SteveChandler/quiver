"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/context/auth-context";
import { updateSession } from "@/actions/session-actions";

type Variant = "story" | "square";

interface ShareModalProps {
  sessionId: string;
  defaultVariant?: Variant;
  isPublic?: boolean;
  open: boolean;
  onClose: () => void;
  onMadePublic?: () => void;
}

function buildShareUrl(sessionId: string, variant: Variant) {
  const url = new URL("/api/social/share/og", window.location.origin);
  url.searchParams.set("sessionId", sessionId);
  url.searchParams.set("variant", variant);
  return url.toString();
}

export function ShareModal({
  sessionId,
  defaultVariant,
  isPublic: initialPublic,
  open,
  onClose,
  onMadePublic,
}: ShareModalProps) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [variant, setVariant] = useState<Variant>(
    defaultVariant || (isMobile ? "story" : "square")
  );
  const [warming, setWarming] = useState(false);
  const [imgReady, setImgReady] = useState(false);
  const [isPublic, setIsPublic] = useState<boolean>(!!initialPublic);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (open) {
      // Warm the function via HEAD
      const url = buildShareUrl(sessionId, variant);
      setWarming(true);
      setImgReady(false);
      fetch(url, { method: "HEAD" })
        .catch(() => void 0)
        .finally(() => setWarming(false));
    }
  }, [open, sessionId, variant]);

  useEffect(() => {
    if (defaultVariant) setVariant(defaultVariant);
  }, [defaultVariant]);

  const imgUrl = useMemo(
    () => buildShareUrl(sessionId, variant),
    [sessionId, variant]
  );

  const makePublic = async () => {
    if (!user) return;
    try {
      setUpdating(true);
      const res = await updateSession(sessionId, user.id, { is_public: true });
      if ((res as any)?.success !== false) {
        setIsPublic(true);
        onMadePublic?.();
        // Re-warm and reload image post visibility change
        setWarming(true);
        setImgReady(false);
        await fetch(imgUrl, { method: "HEAD" }).catch(() => void 0);
      }
    } finally {
      setUpdating(false);
      setWarming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Share Session</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Tabs value={variant} onValueChange={(v) => setVariant(v as Variant)}>
            <TabsList>
              <TabsTrigger value="story">Story (1080x1920)</TabsTrigger>
              <TabsTrigger value="square">Square (1080x1080)</TabsTrigger>
            </TabsList>
          </Tabs>

          {!isPublic && (
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium">
                  This session isn’t shareable yet
                </div>
                <div className="text-sm text-muted-foreground">
                  Make it public to generate and share images.
                </div>
              </div>
              <Button onClick={makePublic} disabled={updating}>
                {updating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Making
                    public...
                  </>
                ) : (
                  "Make shareable"
                )}
              </Button>
            </div>
          )}

          <div className="relative w-full bg-muted rounded-md overflow-hidden">
            {(warming || !imgReady) && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Generating preview...
                </span>
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgUrl}
              alt="Share preview"
              className={`w-full ${
                variant === "story" ? "aspect-[9/16]" : "aspect-square"
              } object-contain`}
              onLoad={() => setImgReady(true)}
              onError={() => setImgReady(true)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
