import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import InboxPageClient from "./inbox-client";

export const metadata: Metadata = buildPageMetadata({
  title: "Inbox - Surf Session Invitations | Quiver",
  description:
    "View and respond to surf session invitations. Stay updated on surf activity and coordinate sessions with your crew. Sign in to manage your invitations and notifications.",
  path: "/inbox",
  keywords: [
    "surf notifications",
    "session invitations",
    "surf inbox",
    "surf crew",
    "coordinate surf sessions",
  ],
});

export default function InboxPage() {
  return <InboxPageClient />;
}
