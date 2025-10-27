"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface SocialPostCardProps {
  id: string;
  name: string | null | undefined;
  activity: string;
  imageUrl: string;
  avatar: string;
  index: number;
}

export default function SocialPostCard({
  name,
  activity,
  imageUrl,
  avatar,
  index,
}: SocialPostCardProps) {
  const [imageError, setImageError] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
    >
      <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer relative aspect-square">
        {/* Background Image */}
        <div className="absolute inset-0">
          {!imageError ? (
            <Image
              src={imageUrl}
              alt={`${name || "User"}'s surf session`}
              fill
              loading="lazy"
              sizes="(max-width: 640px) 100vw, 33vw"
              className="object-cover"
              unoptimized
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full bg-gray-200" />
          )}
        </div>

        {/* Bottom overlay with user info */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10 border-2 border-white/80">
              <AvatarImage src={avatar} alt={name || "User"} />
              <AvatarFallback className="bg-ocean-blue text-white font-semibold text-sm">
                {name
                  ? name
                      .split(" ")
                      .map((n) => n.charAt(0))
                      .join("")
                      .toUpperCase()
                  : ""}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-white font-roboto font-semibold text-sm leading-tight">
                {name || ""}
              </p>
              <p className="text-white/90 font-open-sans text-xs leading-tight mt-0.5">
                {activity}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
