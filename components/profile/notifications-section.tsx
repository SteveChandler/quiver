"use client";

import {
  Bell,
  Mail,
  AppWindow,
  UserPlus,
  Heart,
  Users,
  Clock,
  Sparkles,
  ChevronDown,
  CloudSun,
} from "lucide-react";
import { FormSwitch } from "@/components/ui/form-fields";
import type { Control } from "react-hook-form";

interface NotificationsSectionProps {
  control: Control<any>;
}

export function NotificationsSection({ control }: NotificationsSectionProps) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">
        Notifications
      </h3>
      <p className="text-sm text-muted-foreground">
        Choose how you&apos;d like to get updates about your sessions and
        friends.
      </p>
      <p className="text-sm text-muted-foreground">
        You can change these anytime — we&apos;ll only notify you about things
        you care about.
      </p>

      {/* Master Notification Toggles */}
      <div className="mt-2 divide-y divide-gray-200 dark:divide-gray-800 border-y border-gray-200 dark:border-gray-800">
        <FormSwitch
          control={control}
          name="notif_push_enabled"
          label="Push Notifications"
          icon={Bell}
          variant="row"
        />
        <FormSwitch
          control={control}
          name="notif_email_enabled"
          label="Email Notifications"
          icon={Mail}
          variant="row"
        />
        <FormSwitch
          control={control}
          name="notif_inapp_enabled"
          label="In-App Notifications"
          icon={AppWindow}
          variant="row"
        />
      </div>

      {/* Advanced Settings - Collapsible */}
      <details className="mt-3 group">
        <summary className="flex cursor-pointer items-center justify-between py-2 text-sm font-medium text-foreground hover:text-[#F78E42] transition-colors">
          Advanced Settings
          <ChevronDown
            className="h-4 w-4 transition-transform duration-200 group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>

        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
          <FormSwitch
            control={control}
            name="notif_forecast_alerts"
            label="Forecast Alerts"
            icon={CloudSun}
            variant="row"
          />
          <FormSwitch
            control={control}
            name="notif_session_invites"
            label="Session Invites"
            icon={UserPlus}
            variant="row"
          />
          <FormSwitch
            control={control}
            name="notif_likes"
            label="Likes"
            icon={Heart}
            variant="row"
          />
          <FormSwitch
            control={control}
            name="notif_follows"
            label="Follows"
            icon={Users}
            variant="row"
          />
          <FormSwitch
            control={control}
            name="notif_reminders"
            label="Reminders"
            icon={Clock}
            variant="row"
          />
          <FormSwitch
            control={control}
            name="notif_xp_updates"
            label="XP Updates"
            icon={Sparkles}
            variant="row"
          />
        </div>
      </details>
    </section>
  );
}
