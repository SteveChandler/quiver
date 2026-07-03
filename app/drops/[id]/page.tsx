import { notFound, redirect } from "next/navigation";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import { createSurfDropsRepository } from "@/lib/surf-drops/repository";
import {
  getSurfDropStatus,
  toDropDetailPayload,
  viewerCanAccessDrop,
} from "@/lib/surf-drops/service";
import { DropDetailCard } from "@/components/surf-drops/drop-detail-card";
import { UnavailableState } from "@/components/surf-drops/unavailable-state";
import type { SurfDropDetail } from "@/types/surf-drops";

export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; slug?: string }>;
}

export default async function DropDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const search = await searchParams;

  if (!UUID_REGEX.test(id)) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user ?? null;

  if (!user) {
    redirect(`/auth/sign-in?redirectTo=${encodeURIComponent(`/drops/${id}`)}`);
  }

  const serviceRepo = createSurfDropsRepository(createSupabaseServiceRoleClient());
  const drop = await serviceRepo.findDropByShareSlug
    ? await serviceRepo.findDropById(id)
    : null;

  if (!drop) {
    notFound();
  }

  const status = getSurfDropStatus(drop);
  if (status === "notfound") {
    notFound();
  }

  // Authorization check. Creator is always allowed.
  const authorized =
    user.id === drop.user_id ||
    (await viewerCanAccessDrop(serviceRepo, drop, user.id));

  if (!authorized) {
    return (
      <UnavailableState
        status="notfound"
        creatorName={drop.creator?.display_name ?? null}
        generalArea={drop.general_area}
      />
    );
  }

  if (status === "cancelled" || status === "expired") {
    return (
      <UnavailableState
        status={status}
        creatorName={drop.creator?.display_name ?? null}
        generalArea={drop.general_area}
      />
    );
  }

  const participants = (await serviceRepo.listActiveParticipants?.(id)) ?? [];
  const detail = toDropDetailPayload(drop, {
    viewerId: user.id,
    participants,
  }) as unknown as SurfDropDetail;

  const viaShareSlug =
    search.from === "go" && typeof search.slug === "string" ? search.slug : undefined;

  return (
    <DropDetailCard initialDrop={detail} viaShareSlug={viaShareSlug} />
  );
}
