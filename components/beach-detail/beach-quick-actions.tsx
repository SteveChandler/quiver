import { Button } from "@/components/ui/button";
import { CalendarDays, Waves } from "lucide-react";
import { FavoriteButton } from "@/components/favorite-button";
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
            isAuthenticated ? `/sessions/new?mode=plan&beach=${beach.id}` : "/auth/sign-in"
          }
          className="block"
        >
          <Button className="w-full">
            <motion.div
              animate={{ rotate: [0, 10, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 3 }}
            >
              <CalendarDays className="h-4 w-4 mr-1" />
            </motion.div>
            Plan Session
          </Button>
        </Link>
      </motion.div>
      
      <motion.div 
        className="flex-1"
        variants={MAP_MOTION.quickAction}
        initial="rest"
        whileHover="hover"
        whileTap="pressed"
      >
        <Link
          href={
            isAuthenticated ? `/sessions/new?mode=log&beach=${beach.id}` : "/auth/sign-in"
          }
          className="block"
        >
          <Button variant="outline" className="w-full">
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
    </motion.div>
  );
}
