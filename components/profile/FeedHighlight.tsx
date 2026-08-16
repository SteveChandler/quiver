"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FeedHighlightProps {
  sessionId: string | null;
  onShare: () => void;
  onDismiss: () => void;
}

export function FeedHighlight({ sessionId, onShare, onDismiss }: FeedHighlightProps) {
  const [visible, setVisible] = useState(!!sessionId);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  // Auto-dismiss after 10 seconds
  useEffect(() => {
    if (!sessionId) return;
    const timer = setTimeout(() => {
      setVisible(false);
      onDismissRef.current();
    }, 10000);
    return () => clearTimeout(timer);
  }, [sessionId]);

  if (!visible || !sessionId) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4 flex items-center justify-between"
      >
        <span className="text-sm font-medium text-orange-800">
          Share your session?
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onShare}
            className="bg-orange-500 hover:bg-orange-600 text-white rounded-lg"
          >
            <Share2 className="h-3.5 w-3.5 mr-1" />
            Share
          </Button>
          <button
            type="button"
            onClick={() => { setVisible(false); onDismiss(); }}
            className="text-orange-400 hover:text-orange-600 p-1 focus-ring"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
