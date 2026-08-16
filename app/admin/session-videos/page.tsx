import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { SessionVideoQueue } from "@/components/admin/session-video-queue";
export const metadata: Metadata = { title: "Session Videos", description: "Moderate session videos" };
export default function SessionVideosPage() { return <div className="space-y-6"><AdminPageHeader title="Session Videos" description="Review pending session video uploads." /><SessionVideoQueue /></div>; }
