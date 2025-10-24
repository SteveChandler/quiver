import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutDashboard, MapPin, ImageIcon, FileText, CalendarDays, StarIcon, CloudSun } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Overview",
  description: "Admin portal overview and quick navigation",
};

const quickLinks = [
  {
    title: "Forecasts",
    description: "Manage beach forecasts and data updates",
    href: "/admin/forecasts",
    icon: CloudSun,
  },
  {
    title: "Beaches",
    description: "Manage beach locations and information",
    href: "/admin/beaches",
    icon: MapPin,
  },
  {
    title: "Photos",
    description: "Moderate session and beach photos",
    href: "/admin/photos",
    icon: ImageIcon,
  },
  {
    title: "Intel",
    description: "Manage surf intel posts and reports",
    href: "/admin/intel",
    icon: FileText,
  },
  {
    title: "Sessions",
    description: "View and moderate surf sessions",
    href: "/admin/sessions",
    icon: CalendarDays,
  },
  {
    title: "Reviews",
    description: "Moderate beach reviews and ratings",
    href: "/admin/reviews",
    icon: StarIcon,
  },
];

export default function AdminOverviewPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Admin Portal"
        description="Manage Quiver platform content and community"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <link.icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{link.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{link.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
