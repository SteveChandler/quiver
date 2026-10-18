import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GarminLinkConfirm } from "@/components/garmin/garmin-link-confirm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Link Garmin watch", robots: { index: false, follow: false } };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function GarminLinkPage({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<React.ReactElement> {
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value !== undefined) params.set(key, value);
  }
  const code = params.get("code");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const next = `/sessions/garmin-link${params.toString() ? `?${params.toString()}` : ""}`;
    redirect(`/auth/sign-in?redirectTo=${encodeURIComponent(next)}`);
  }

  return <main className="mx-auto min-h-screen max-w-xl px-4 py-10"><GarminLinkConfirm initialCode={code} /></main>;
}
