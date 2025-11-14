/**
 * PreferencesAnnouncementDialog Component
 *
 * Welcome dialog to announce enhanced profile preferences to returning users.
 * Displays a modal with information about the new preference options and
 * guides users to update their profile.
 *
 * Features:
 * - Clean, welcoming design with emojis
 * - Lists 5 new/enhanced preference fields
 * - Primary action: Update Profile
 * - Secondary action: Maybe Later
 * - Keyboard accessible (ESC to close)
 * - Click outside to dismiss
 * - Mobile responsive
 *
 * @example
 * ```tsx
 * <PreferencesAnnouncementDialog
 *   open={showAnnouncement}
 *   onClose={() => setShowAnnouncement(false)}
 *   onUpdateProfile={() => router.push('/profile/preferences')}
 * />
 * ```
 */

'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

interface PreferencesAnnouncementDialogProps {
  /** Controls dialog visibility */
  open: boolean;
  /** Called when user dismisses the dialog */
  onClose: () => void;
  /** Called when user clicks "Update Profile" */
  onUpdateProfile: () => void;
}

/** Feature highlight data with emojis and descriptions */
const FEATURE_HIGHLIGHTS = [
  {
    emoji: '🏄‍♂️',
    title: 'Experience Level',
    description: 'Choose from Beginner to Expert',
  },
  {
    emoji: '🏄',
    title: 'Surf Styles',
    description: 'Select your favorite boards and styles',
  },
  {
    emoji: '🌊',
    title: 'Preferred Wave Size',
    description: 'From small rollers to big barrels',
  },
  {
    emoji: '🏖️',
    title: 'Preferred Break Type',
    description: 'Beach, reef, or point breaks',
  },
  {
    emoji: '👥',
    title: 'Crowd Preference',
    description: 'Social sessions or peaceful solitude',
  },
] as const;

export function PreferencesAnnouncementDialog({
  open,
  onClose,
  onUpdateProfile,
}: PreferencesAnnouncementDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-lg sm:max-w-xl"
        aria-describedby="preferences-announcement-description"
      >
        {/* Header with icon */}
        <DialogHeader>
          <div className="flex items-center justify-center mb-2">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
          </div>
          <DialogTitle className="text-2xl text-center">
            We've Enhanced Your Profile Preferences!
          </DialogTitle>
          <DialogDescription
            id="preferences-announcement-description"
            className="text-center text-base pt-2"
          >
            We've added new customization options to help you find the perfect
            waves. Update your profile to get more personalized surf
            recommendations tailored to your style.
          </DialogDescription>
        </DialogHeader>

        {/* Feature highlights list */}
        <div className="space-y-3 py-4">
          {FEATURE_HIGHLIGHTS.map((feature) => (
            <div
              key={feature.title}
              className="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-blue-50 to-teal-50 hover:from-blue-100 hover:to-teal-100 transition-colors"
            >
              <span className="text-2xl flex-shrink-0" aria-hidden="true">
                {feature.emoji}
              </span>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-gray-900">
                  {feature.title}
                </h4>
                <p className="text-sm text-gray-600">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto order-2 sm:order-1"
          >
            Maybe Later
          </Button>
          <Button
            onClick={onUpdateProfile}
            className="w-full sm:w-auto order-1 sm:order-2 bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600"
          >
            Update Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
