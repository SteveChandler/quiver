"use client";

/**
 * Photos Admin Page
 *
 * Admin interface for moderating session media and beach photos.
 * Implements tabbed interface with soft delete and approval workflows.
 */

import { useCallback, useState, useEffect } from "react";
import { toast } from "sonner";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { PhotoTable } from "@/components/admin/photo-table";
import { PhotoPreviewDialog } from "@/components/admin/photo-preview-dialog";
import { ConfirmActionDialog } from "@/components/admin/confirm-action-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import { useDataFetcher } from "@/hooks/use-data-fetcher";
import {
  listSessionMedia,
  listBeachPhotos,
  softDeleteSessionMedia,
  restoreSessionMedia,
  softDeleteBeachPhoto,
  restoreBeachPhoto,
  toggleBeachPhotoApproval,
  getPhotoStats,
  bulkSoftDeleteSessionMedia,
  bulkSoftDeleteBeachPhotos,
  hardDeleteBeachPhoto,
  bulkHardDeleteBeachPhotos,
  type PhotoModerationItem,
} from "@/actions/admin/photos";

export default function AdminPhotosPage() {
  // State management
  const [activeTab, setActiveTab] = useState<"session" | "beach">("session");
  const [showDeleted, setShowDeleted] = useState(false);
  const [showApprovedOnly, setShowApprovedOnly] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<PhotoModerationItem | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => Promise<void>;
    variant?: "default" | "destructive";
  }>({
    open: false,
    title: "",
    description: "",
    action: async () => {},
  });

  // Fetch session media
  const fetchSessionMedia = useCallback(async () => {
    const result = await listSessionMedia({ includeDeleted: showDeleted });
    if (!result.success) {
      throw new Error(result.error || "Failed to fetch session media");
    }
    return result.data || [];
  }, [showDeleted]);

  const {
    data: sessionMedia,
    loading: sessionLoading,
    refetch: refetchSession,
  } = useDataFetcher<PhotoModerationItem[]>(fetchSessionMedia);

  // Fetch beach photos
  const fetchBeachPhotos = useCallback(async () => {
    const result = await listBeachPhotos({
      includeDeleted: showDeleted,
      approvedOnly: showApprovedOnly,
    });
    if (!result.success) {
      throw new Error(result.error || "Failed to fetch beach photos");
    }
    return result.data || [];
  }, [showDeleted, showApprovedOnly]);

  const {
    data: beachPhotos,
    loading: beachLoading,
    refetch: refetchBeach,
  } = useDataFetcher<PhotoModerationItem[]>(fetchBeachPhotos);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    const result = await getPhotoStats();
    if (!result.success) {
      return null;
    }
    return result.data;
  }, []);

  const { data: stats } = useDataFetcher(fetchStats);

  // Refetch current tab when switching or filters change
  useEffect(() => {
    if (activeTab === "session") {
      refetchSession();
    } else {
      refetchBeach();
    }
  }, [activeTab, showDeleted, showApprovedOnly, refetchSession, refetchBeach]);

  // Handle preview
  const handlePreview = (photo: PhotoModerationItem) => {
    setPreviewPhoto(photo);
  };

  // Handle delete session media
  const handleDeleteSessionMedia = (photo: PhotoModerationItem) => {
    setConfirmDialog({
      open: true,
      title: "Delete Session Photo",
      description: `Are you sure you want to delete this photo? This will remove both the database record and the storage file. This action can be undone by restoring the photo later.`,
      variant: "destructive",
      action: async () => {
        const result = await softDeleteSessionMedia(photo.id);
        if (!result.success) {
          toast.error(result.error || "Failed to delete photo");
          return;
        }
        toast.success("Photo deleted successfully");
        refetchSession();
      },
    });
  };

  // Handle restore session media
  const handleRestoreSessionMedia = (photo: PhotoModerationItem) => {
    setConfirmDialog({
      open: true,
      title: "Restore Session Photo",
      description: `Are you sure you want to restore this photo? Note: The storage file may have been permanently deleted.`,
      variant: "default",
      action: async () => {
        const result = await restoreSessionMedia(photo.id);
        if (!result.success) {
          toast.error(result.error || "Failed to restore photo");
          return;
        }
        toast.success("Photo restored successfully");
        refetchSession();
      },
    });
  };

  // Handle delete beach photo
  const handleDeleteBeachPhoto = (photo: PhotoModerationItem) => {
    setConfirmDialog({
      open: true,
      title: "Delete Beach Photo",
      description: `Are you sure you want to delete this beach photo? This action can be undone by restoring the photo later.`,
      variant: "destructive",
      action: async () => {
        const result = await softDeleteBeachPhoto(photo.id);
        if (!result.success) {
          toast.error(result.error || "Failed to delete photo");
          return;
        }
        toast.success("Photo deleted successfully");
        refetchBeach();
      },
    });
  };

  // Handle restore beach photo
  const handleRestoreBeachPhoto = (photo: PhotoModerationItem) => {
    setConfirmDialog({
      open: true,
      title: "Restore Beach Photo",
      description: `Are you sure you want to restore this beach photo? It will become visible again.`,
      variant: "default",
      action: async () => {
        const result = await restoreBeachPhoto(photo.id);
        if (!result.success) {
          toast.error(result.error || "Failed to restore photo");
          return;
        }
        toast.success("Photo restored successfully");
        refetchBeach();
      },
    });
  };

  // Handle approve/unapprove beach photo
  const handleApproveBeachPhoto = async (photo: PhotoModerationItem, approved: boolean) => {
    const result = await toggleBeachPhotoApproval(photo.id, approved);
    if (!result.success) {
      toast.error(result.error || "Failed to update approval status");
      return;
    }
    toast.success(approved ? "Photo approved" : "Photo unapproved");
    refetchBeach();
  };

  // Handle bulk delete
  const handleBulkDelete = (photoIds: string[], photoType: "session_media" | "beach_photo") => {
    const count = photoIds.length;
    const isSessionMedia = photoType === "session_media";

    setConfirmDialog({
      open: true,
      title: `Delete ${count} Photo${count !== 1 ? "s" : ""}`,
      description: isSessionMedia
        ? `Are you sure you want to delete ${count} session photo${
            count !== 1 ? "s" : ""
          }? This will remove both the database records and the storage files. This action can be undone by restoring the photos later.`
        : `Are you sure you want to delete ${count} beach photo${
            count !== 1 ? "s" : ""
          }? This action can be undone by restoring the photos later.`,
      variant: "destructive",
      action: async () => {
        let result;
        if (isSessionMedia) {
          result = await bulkSoftDeleteSessionMedia(photoIds);
        } else {
          result = await bulkSoftDeleteBeachPhotos(photoIds);
        }

        if (!result.success) {
          toast.error(result.error || "Failed to delete photos");
          return;
        }

        const { success, failed, errors } = result.data || { success: 0, failed: 0, errors: [] };

        if (failed > 0) {
          toast.error(
            `Deleted ${success} of ${count} photos. ${failed} failed.${
              errors.length > 0 ? ` First error: ${errors[0].error}` : ""
            }`
          );
        } else {
          toast.success(`Successfully deleted ${success} photo${success !== 1 ? "s" : ""}`);
        }

        // Refetch the appropriate tab
        if (isSessionMedia) {
          refetchSession();
        } else {
          refetchBeach();
        }
      },
    });
  };

  // Handle hard delete beach photo (permanent)
  const handleHardDeleteBeachPhoto = async (photo: PhotoModerationItem) => {
    const result = await hardDeleteBeachPhoto(photo.id);
    if (!result.success) {
      toast.error(result.error || "Failed to permanently delete photo");
      return;
    }
    toast.success("Photo permanently deleted");
    refetchBeach();
  };

  // Handle bulk hard delete
  const handleBulkHardDelete = async (photoIds: string[], photoType: "session_media" | "beach_photo") => {
    if (photoType === "session_media") {
      // Session media doesn't have hard delete yet, use soft delete
      toast.error("Permanent delete is only available for beach photos");
      return;
    }

    const result = await bulkHardDeleteBeachPhotos(photoIds);

    if (!result.success) {
      toast.error(result.error || "Failed to permanently delete photos");
      return;
    }

    const { success, failed, errors } = result.data || { success: 0, failed: 0, errors: [] };

    if (failed > 0) {
      toast.error(
        `Permanently deleted ${success} of ${photoIds.length} photos. ${failed} failed.${
          errors.length > 0 ? ` First error: ${errors[0].error}` : ""
        }`
      );
    } else {
      toast.success(`Permanently deleted ${success} photo${success !== 1 ? "s" : ""}`);
    }

    refetchBeach();
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Photo Moderation"
        description="Review and moderate session media and beach photos"
      />

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Session Media</CardDescription>
              <CardTitle className="text-3xl">{stats.sessionMedia.total}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                {stats.sessionMedia.deleted} deleted
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Beach Photos</CardDescription>
              <CardTitle className="text-3xl">{stats.beachPhotos.total}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                {stats.beachPhotos.deleted} deleted
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Approved</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                {stats.beachPhotos.approved}
                <Badge variant="default" className="bg-blue-600 text-sm">
                  Beach
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">Beach photos approved</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                {stats.beachPhotos.pending}
                <Badge variant="secondary" className="text-sm">
                  Beach
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">Awaiting approval</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "session" | "beach")}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="session">
              Session Media
              {sessionMedia && <Badge className="ml-2">{sessionMedia.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="beach">
              Beach Photos
              {beachPhotos && <Badge className="ml-2">{beachPhotos.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-deleted"
                checked={showDeleted}
                onCheckedChange={(checked) => setShowDeleted(checked === true)}
              />
              <Label htmlFor="show-deleted" className="text-sm font-medium cursor-pointer">
                Show deleted
              </Label>
            </div>

            {activeTab === "beach" && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="show-approved-only"
                  checked={showApprovedOnly}
                  onCheckedChange={(checked) => setShowApprovedOnly(checked === true)}
                />
                <Label htmlFor="show-approved-only" className="text-sm font-medium cursor-pointer">
                  Approved only
                </Label>
              </div>
            )}
          </div>
        </div>

        {/* Session Media Tab */}
        <TabsContent value="session" className="space-y-4">
          <PhotoTable
            photos={sessionMedia || []}
            loading={sessionLoading}
            onPreview={handlePreview}
            onDelete={handleDeleteSessionMedia}
            onRestore={handleRestoreSessionMedia}
            onBulkDelete={handleBulkDelete}
          />
        </TabsContent>

        {/* Beach Photos Tab */}
        <TabsContent value="beach" className="space-y-4">
          <PhotoTable
            photos={beachPhotos || []}
            loading={beachLoading}
            onPreview={handlePreview}
            onDelete={handleDeleteBeachPhoto}
            onRestore={handleRestoreBeachPhoto}
            onApprove={handleApproveBeachPhoto}
            onBulkDelete={handleBulkDelete}
            onHardDelete={handleHardDeleteBeachPhoto}
            onBulkHardDelete={handleBulkHardDelete}
          />
        </TabsContent>
      </Tabs>

      {/* Photo Preview Dialog */}
      <PhotoPreviewDialog
        open={!!previewPhoto}
        onOpenChange={(open) => !open && setPreviewPhoto(null)}
        photo={previewPhoto}
        onDelete={
          previewPhoto?.type === "session_media"
            ? handleDeleteSessionMedia
            : handleDeleteBeachPhoto
        }
        onRestore={
          previewPhoto?.type === "session_media"
            ? handleRestoreSessionMedia
            : handleRestoreBeachPhoto
        }
        onApprove={previewPhoto?.type === "beach_photo" ? handleApproveBeachPhoto : undefined}
      />

      {/* Confirmation Dialog */}
      <ConfirmActionDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        actionLabel={confirmDialog.variant === "destructive" ? "Delete" : "Restore"}
        actionVariant={confirmDialog.variant}
        onConfirm={confirmDialog.action}
      />
    </div>
  );
}
