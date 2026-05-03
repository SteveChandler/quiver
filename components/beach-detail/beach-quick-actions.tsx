"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Waves, Share2 } from "lucide-react";
import { FavoriteButton } from "@/components/favorite-button";
import { ShareSheet } from "@/components/share/share-sheet";
import Link from "next/link";
import { motion } from "framer-motion";
import { MAP_MOTION } from "@/lib/constants/animations";
import type { Beach } from "@/types/database";

interface BeachQuickActionsProps {
  beach: Beach;
  isAuthenticated: boolean;
}

export function BeachQuickActions({
  beach,
  isAuthenticated,
}: BeachQuickActionsProps) {
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <motion.div 
      className="p-4 flex gap-2"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <motion.div 
        className="flex-1"
        variants={MAP_MOTION.quickAction}
        initial="rest"
        whileHover="hover"
        whileTap="pressed"
      >
        <Link
          href={
            isAuthenticated ? `/sessions/new?beach=${beach.id}&beachName=${encodeURIComponent(beach.name)}` : "/auth/sign-in"
          }
          className="block"
        >
          <Button className="w-full">
            <motion.div
              animate={{ 
                rotate: [0, -5, 5, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity, 
                repeatDelay: 4,
                ease: "easeInOut" 
              }}
            >
              <Waves className="h-4 w-4 mr-1" />
            </motion.div>
            Log Session
          </Button>
        </Link>
      </motion.div>
      
      <motion.div
        variants={MAP_MOTION.quickAction}
        initial="rest"
        whileHover="hover"
        whileTap="pressed"
      >
        <FavoriteButton beachId={beach.id} variant="outline" size="default" />
      </motion.div>

      <motion.div
        variants={MAP_MOTION.quickAction}
        initial="rest"
        whileHover="hover"
        whileTap="pressed"
      >
        <Button
          variant="outline"
          size="default"
          onClick={() => setShareOpen(true)}
          aria-label="Share this beach"
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </motion.div>

      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        imageUrl={`/api/og/beach?slug=${beach.slug}`}
        type="wave"
        filename={`quiver-${beach.slug}`}
        title={`${beach.name} Surf Report`}
        text={`Check out the surf conditions at ${beach.name}`}
      />
    </motion.div>
  );
}
