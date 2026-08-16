import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, isAdmin } from "@/lib/auth/admin";
import {
  LayoutDashboard,
  MapPin,
  ImageIcon,
  FileText,
  CalendarDays,
  StarIcon,
  CloudSun,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";

export const metadata: Metadata = {
  title: {
    default: "Admin Portal",
    template: "%s | Admin | Quiver",
  },
  description: "Admin portal for managing Quiver platform content and users",
  robots: "noindex, nofollow", // Prevent search engine indexing
};

// Navigation items for admin sidebar
const navItems = [
  {
    title: "Overview",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Forecasts",
    href: "/admin/forecasts",
    icon: CloudSun,
  },
  {
    title: "Beaches",
    href: "/admin/beaches",
    icon: MapPin,
  },
  {
    title: "Photos",
    href: "/admin/photos",
    icon: ImageIcon,
  },
  {
    title: "Community Photos",
    href: "/admin/community-photos",
    icon: ImageIcon,
  },
  { title: "Session Videos", href: "/admin/session-videos", icon: ImageIcon },
  {
    title: "Intel",
    href: "/admin/intel",
    icon: FileText,
  },
  {
    title: "Sessions",
    href: "/admin/sessions",
    icon: CalendarDays,
  },
  {
    title: "Reviews",
    href: "/admin/reviews",
    icon: StarIcon,
  },
] as const;


export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side admin check - redirect if not authorized
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/sign-in?redirectTo=/admin");
  }

  if (!isAdmin(user)) {
    redirect("/");
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-b border-sidebar-border">
          <div className="flex items-center gap-2 px-2 py-3">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
              Admin Portal
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Management</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        {/* Header with breadcrumbs and sidebar trigger */}
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 sm:px-6">
          <SidebarTrigger />
          <div className="flex-1">
            <AdminBreadcrumbs />
          </div>
        </header>

        {/* Main content area */}
        <main className="flex-1 p-4 sm:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
