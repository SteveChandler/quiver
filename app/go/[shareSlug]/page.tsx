import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import { createSurfDropsRepository } from "@/lib/surf-drops/repository";
import {
  buildSurfDropTeaserPayload,
  viewerCanAccessDrop,
} from "@/lib/surf-drops/service";
import {
  isValidSurfDropSlug,
  resolveGoPageAction,
} from "@/lib/surf-drops/go-page-action";
import { DropTeaserCard } from "@/components/surf-drops/drop-teaser-card";
import { UnavailableState } from "@/components/surf-drops/unavailable-state";
import { GoPageRedirector } from "@/components/surf-drops/go-page-redirector";
import type { SurfDropTeaser } from "@/types/surf-drops";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ shareSlug: string }>;
}

async function loadTeaserForShareSlug(
  shareSlug: string,
): Promise<{ teaser: SurfDropTeaser; isSignedIn: boolean } | null> {
  const repository = createSurfDropsRepository(createSupabaseServiceRoleClient());
  const drop = await repository.findDropByShareSlug(shareSlug);

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user ?? null;

  const viewerAuthorized = drop
    ? await viewerCanAccessDrop(repository, drop, user?.id ?? null)
    : false;

  const teaser = buildSurfDropTeaserPayload(drop, {
    viewerAuthorized,
    viewerSignedIn: Boolean(user),
    slug: shareSlug,
  }) as unknown as SurfDropTeaser;

  return { teaser, isSignedIn: Boolean(user) };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { shareSlug } = await params;
  if (!isValidSurfDropSlug(shareSlug)) {
    return {
      title: "Surf Drop | Quiver",
      description: "Meet your crew in the water.",
    };
  }

  const ogUrl = `/api/og/drop/${shareSlug}`;

  return {
    title: "Surf Drop | Quiver",
    description: "I'm in. Pull up if you are too.",
    openGraph: {
      title: "Surf Drop | Quiver",
      description: "I'm in. Pull up if you are too.",
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Surf Drop | Quiver",
      description: "I'm in. Pull up if you are too.",
      images: [ogUrl],
    },
    robots: { index: false, follow: false },
  };
}

export default async function GoSharePage({ params }: PageProps) {
  const { shareSlug } = await params;

  if (!isValidSurfDropSlug(shareSlug)) {
    notFound();
  }

  const loaded = await loadTeaserForShareSlug(shareSlug);
  const teaser = loaded?.teaser ?? null;
  const action = resolveGoPageAction(shareSlug, teaser, {
    isSignedIn: loaded?.isSignedIn ?? false,
  });

  switch (action.kind) {
    case "invalid-slug":
      notFound();
    case "unavailable":
      return (
        <UnavailableState
          status={action.status}
          creatorName={action.teaser.creator?.display_name ?? null}
          generalArea={action.teaser.general_area}
        />
      );
    case "signin-required":
      return <DropTeaserCard teaser={action.teaser} />;
    case "claim-required":
      return (
        <GoPageRedirector slug={shareSlug} action="claim" />
      );
    case "redirect-to-drop":
      return (
        <GoPageRedirector
          slug={shareSlug}
          action="redirect"
          dropId={action.dropId}
        />
      );
  }
}
