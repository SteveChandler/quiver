"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import {
  MapPin,
  Instagram,
  Edit,
  WavesIcon as Surfboard,
} from "lucide-react";
import { ANIMATION_VARIANTS } from "@/lib/constants/animations";
import type { ProfilePageProfile } from "@/types/profile-page";

interface ProfileHeaderProps {
  profile: ProfilePageProfile;
  email?: string;
  onEditClick: () => void;
}

/**
 * ProfileHeader - Hero section of the profile page
 *
 * Displays:
 * - User avatar
 * - Name and email
 * - Bio
 * - Location, experience level, and Instagram badges
 * - Home beach (if set)
 * - Edit button
 */
export function ProfileHeader({
  profile,
  email,
  onEditClick,
}: ProfileHeaderProps) {
  return (
    <motion.section
      {...ANIMATION_VARIANTS.fadeUpWithDelay(0.1)}
      className="relative py-3 sm:py-4 lg:py-5"
    >
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-r from-ocean-blue/10 via-transparent to-sunset-orange/10" />

      <div className="relative max-w-3xl mx-auto px-2 sm:px-4">
        <Card className="overflow-hidden bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow duration-300 border-white/50">
          <CardContent className="p-3 sm:p-4 lg:p-5">
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
              {/* Avatar */}
              <motion.div
                {...ANIMATION_VARIANTS.staggerItem(0)}
                className="flex-shrink-0"
                data-testid="user-avatar"
              >
                <UserAvatar
                  src={profile.avatar_url}
                  name={profile.full_name}
                  email={email}
                  size="md"
                  className="ring-1 ring-ocean-blue/20 shadow"
                />
              </motion.div>

              {/* Profile Info */}
              <motion.div
                {...ANIMATION_VARIANTS.staggerItem(1)}
                className="flex-1 text-center sm:text-left space-y-1"
              >
                <h2 className="text-lg sm:text-xl font-roboto font-bold text-dark-grey">
                  {profile.full_name || "Surfer"}
                </h2>
                <p className="text-sm text-muted-foreground font-open-sans">
                  {email}
                </p>

                {/* Bio */}
                {profile.bio && (
                  <p className="text-xs sm:text-sm font-open-sans text-gray-600 max-w-md">
                    {profile.bio}
                  </p>
                )}

                {/* Profile Details Badges */}
                <div className="flex flex-wrap justify-center sm:justify-start gap-2 pt-1 text-xs font-open-sans text-muted-foreground">
                  {profile.location && (
                    <div className="flex items-center bg-ocean-blue/10 px-2 py-0.5 rounded-full">
                      <MapPin className="h-3 w-3 mr-1 text-ocean-blue" />
                      <span>{profile.location}</span>
                    </div>
                  )}

                  {profile.experience_level && (
                    <div className="flex items-center bg-sunset-orange/10 px-2 py-0.5 rounded-full">
                      <Surfboard className="h-3 w-3 mr-1 text-sunset-orange" />
                      <span>{profile.experience_level}</span>
                    </div>
                  )}

                  {profile.instagram && (
                    <a
                      href={`https://instagram.com/${profile.instagram.replace("@", "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center bg-gradient-to-r from-purple-500/10 to-pink-500/10 px-2 py-0.5 rounded-full hover:from-purple-500/20 hover:to-pink-500/20 transition-colors"
                    >
                      <Instagram className="h-3 w-3 mr-1 text-purple-600" />
                      <span>{profile.instagram}</span>
                    </a>
                  )}
                </div>

                {/* Home Break */}
                {profile.home_beach_id && (
                  <div className="text-xs font-open-sans pt-0.5">
                    <span className="text-muted-foreground">Home Break: </span>
                    <span className="font-medium text-ocean-blue">
                      {profile.homeBeachName || "Set"}
                    </span>
                  </div>
                )}
              </motion.div>

              {/* Edit Button */}
              <motion.div
                {...ANIMATION_VARIANTS.staggerItem(2)}
                className="flex-shrink-0"
              >
                <Button
                  size="sm"
                  onClick={onEditClick}
                  aria-label="Edit profile"
                  className="bg-gradient-to-r from-ocean-blue to-blue-600 hover:from-blue-600 hover:to-ocean-blue text-white px-3 py-1.5 text-xs font-roboto font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.section>
  );
}
