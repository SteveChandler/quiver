"use client";

/**
 * Photo Preview Dialog
 *
 * Lightbox dialog for previewing photos with metadata and quick actions.
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, RotateCcw, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import Image from "next/image";

import type { PhotoModerationItem } from "@/actions/admin/photos";

interface PhotoPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photo: PhotoModerationItem | null;
  onDelete?: (photo: PhotoModerationItem) => void;
  onRestore?: (photo: PhotoModerationItem) => void;
  onApprove?: (photo: PhotoModerationItem, approved: boolean) => void;
}

export function PhotoPreviewDialog({
  open,
  onOpenChange,
  photo,
  onDelete,
  onRestore,
  onApprove,
}: PhotoPreviewDialogProps) {
  if (!photo) return null;

  const isDeleted = photo.status === "deleted";
  const isBeachPhoto = photo.type === "beach_photo";

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "N/A";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Photo Preview
            <Badge variant="outline" className="capitalize">
              {photo.type === "session_media" ? "Session Media" : "Beach Photo"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Image */}
          <div className="relative w-full aspect-video bg-muted rounded-lg overflow-hidden">
            <Image
              src={photo.imageUrl}
              alt="Photo preview"
              fill
              loading="lazy"
              className="object-contain"
              // Admin-only: unoptimized for simplicity, low traffic impact
              unoptimized
            />
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Left Column */}
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Status</div>
                <div className="mt-1 flex items-center gap-2">
                  {isDeleted ? (
                    <Badge variant="destructive">Deleted</Badge>
                  ) : (
                    <Badge variant="default" className="bg-green-600">
                      Active
                    </Badge>
                  )}
                  {isBeachPhoto && !isDeleted && (
                    <>
                      {photo.approved ? (
                        <Badge variant="default" className="bg-blue-600">
                          Approved
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Pending Approval</Badge>
                      )}
                    </>
                  )}
                </div>
              </div>

              {photo.metadata.userName && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Uploaded By</div>
                  <div className="mt-1 text-sm">{photo.metadata.userName}</div>
                </div>
              )}

              {photo.metadata.beachName && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Beach</div>
                  <div className="mt-1 text-sm">{photo.metadata.beachName}</div>
                </div>
              )}

              {photo.metadata.source && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Source</div>
                  <div className="mt-1 text-sm capitalize">{photo.metadata.source}</div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Upload Date</div>
                <div className="mt-1 text-sm">{formatDate(photo.uploadedAt)}</div>
              </div>

              {photo.fileSize && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">File Size</div>
                  <div className="mt-1 text-sm">{formatFileSize(photo.fileSize)}</div>
                </div>
              )}

              <div>
                <div className="text-sm font-medium text-muted-foreground">Photo ID</div>
                <div className="mt-1 text-xs font-mono text-muted-foreground">{photo.id}</div>
              </div>
            </div>
          </div>

          {/* Caption */}
          {photo.metadata.caption && (
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">Caption</div>
              <div className="text-sm p-3 bg-muted rounded-md">{photo.metadata.caption}</div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            {/* View Original Link */}
            <Button variant="outline" size="sm" asChild>
              <a href={photo.imageUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                View Original
              </a>
            </Button>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {!isDeleted ? (
                <>
                  {/* Approve/Unapprove (beach photos only) */}
                  {isBeachPhoto && onApprove && (
                    <Button
                      variant={photo.approved ? "outline" : "default"}
                      size="sm"
                      onClick={() => {
                        onApprove(photo, !photo.approved);
                        onOpenChange(false);
                      }}
                    >
                      {photo.approved ? (
                        <>
                          <XCircle className="mr-2 h-4 w-4" />
                          Unapprove
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve
                        </>
                      )}
                    </Button>
                  )}

                  {/* Delete Button */}
                  {onDelete && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        onDelete(photo);
                        onOpenChange(false);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  )}
                </>
              ) : (
                /* Restore Button */
                onRestore && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      onRestore(photo);
                      onOpenChange(false);
                    }}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Restore
                  </Button>
                )
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
