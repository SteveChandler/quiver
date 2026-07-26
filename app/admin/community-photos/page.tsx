import type { Metadata } from "next";

import { CommunityPhotoModeration } from "@/components/admin/community-photo-moderation";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export const metadata: Metadata = {
  title: "Community Photos",
  description: "Moderate, feature, retain, and recover community spot photos",
};

export default function AdminCommunityPhotosPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Community Photos"
        description="Review reports, reversible moderation, featured pins, investigation holds, and contributor restrictions."
      />
      <CommunityPhotoModeration />
    </div>
  );
}
