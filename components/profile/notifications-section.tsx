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
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import type { Control } from "react-hook-form";

interface NotificationsSectionProps {
  control: Control<any>;
}

export function NotificationsSection({ control }: NotificationsSectionProps) {
  // Reusable toggle row component
  const ToggleRow = ({
    name,
    label,
    Icon,
  }: {
    name: string;
    label: string;
    Icon: React.FC<any>;
  }) => (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <Icon
              className="h-5 w-5 text-muted-foreground"
              aria-hidden="true"
            />
            <FormLabel className="text-sm font-normal text-foreground cursor-pointer">
              {label}
            </FormLabel>
          </div>
          <FormControl>
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
              className="data-[state=checked]:bg-[#0077B6] focus-visible:ring-[#0077B6]/50 hover:shadow-[0_0_0_3px_rgba(0,119,182,0.15)]"
              aria-label={label}
            />
          </FormControl>
        </FormItem>
      )}
    />
  );

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
        <ToggleRow
          name="notif_push_enabled"
          label="Push Notifications"
          Icon={Bell}
        />
        <ToggleRow
          name="notif_email_enabled"
          label="Email Notifications"
          Icon={Mail}
        />
        <ToggleRow
          name="notif_inapp_enabled"
          label="In-App Notifications"
          Icon={AppWindow}
        />
      </div>

      {/* Advanced Settings - Collapsible */}
      <details className="mt-3 group">
        <summary className="flex cursor-pointer items-center justify-between py-2 text-sm font-medium text-foreground hover:text-[#0077B6] transition-colors">
          Advanced Settings
          <ChevronDown
            className="h-4 w-4 transition-transform duration-200 group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>

        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
          <ToggleRow
            name="notif_session_invites"
            label="Session Invites"
            Icon={UserPlus}
          />
          <ToggleRow name="notif_likes" label="Likes" Icon={Heart} />
          <ToggleRow name="notif_follows" label="Follows" Icon={Users} />
          <ToggleRow name="notif_reminders" label="Reminders" Icon={Clock} />
          <ToggleRow
            name="notif_xp_updates"
            label="XP Updates"
            Icon={Sparkles}
          />
        </div>
      </details>
    </section>
  );
}
