import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import { AlertsManagementPage } from "@/components/alerts/alerts-management-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "Condition Alerts - Quiver",
  description:
    "Create and manage surf condition alerts for your saved beaches and forecast windows.",
  path: "/alerts",
  keywords: [
    "surf alerts",
    "condition alerts",
    "wave alerts",
    "surf forecast notifications",
  ],
});

export default function AlertsPage() {
  return <AlertsManagementPage />;
}
