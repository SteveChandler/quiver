"use client";

/**
 * Photo Table Component
 *
 * Data table for displaying and managing photos in the admin portal.
 * Supports both session media and beach photos with different actions.
 * Includes multi-select functionality for bulk deletion.
 */

import { useState, useMemo } from "react";
import { Eye, Trash2, RotateCcw, CheckCircle, XCircle, X } from "lucide-react";
import Image from "next/image";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

import type { PhotoModerationItem } from "@/actions/admin/photos";

interface PhotoTableProps {
  photos: PhotoModerationItem[];
  onPreview: (photo: PhotoModerationItem) => void;
  onDelete: (photo: PhotoModerationItem) => void;
  onRestore: (photo: PhotoModerationItem) => void;
  onApprove?: (photo: PhotoModerationItem, approved: boolean) => void; // Beach photos only
  onBulkDelete?: (photoIds: string[], photoType: "session_media" | "beach_photo") => void; // Bulk delete
  loading?: boolean;
}

export function PhotoTable({
  photos,
  onPreview,
  onDelete,
  onRestore,
  onApprove,
  onBulkDelete,
  loading = false,
}: PhotoTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter photos
  const filteredPhotos = useMemo(() => {
    if (!searchTerm) return photos;

    const search = searchTerm.toLowerCase();
    return photos.filter((photo) => {
      return (
        photo.metadata.userName?.toLowerCase().includes(search) ||
        photo.metadata.beachName?.toLowerCase().includes(search) ||
        photo.metadata.caption?.toLowerCase().includes(search) ||
        photo.metadata.source?.toLowerCase().includes(search)
      );
    });
  }, [photos, searchTerm]);

  // Selection handlers
  const isAllSelected =
    filteredPhotos.length > 0 && selectedIds.size === filteredPhotos.length;
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPhotos.map((p) => p.id)));
    }
  };

  const handleSelectOne = (photoId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(photoId)) {
      newSelected.delete(photoId);
    } else {
      newSelected.add(photoId);
    }
    setSelectedIds(newSelected);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
    if (!onBulkDelete || selectedIds.size === 0) return;

    // Get the selected photos to determine their type
    const selectedPhotos = filteredPhotos.filter((p) => selectedIds.has(p.id));
    if (selectedPhotos.length === 0) return;

    // All selected photos should be the same type (enforced by UI - different tabs)
    const photoType = selectedPhotos[0].type;
    const selectedIdsArray = Array.from(selectedIds);

    onBulkDelete(selectedIdsArray, photoType);
    setSelectedIds(new Set());
  };

  const isDeleted = (photo: PhotoModerationItem) => photo.status === "deleted";
  const isBeachPhoto = (photo: PhotoModerationItem) => photo.type === "beach_photo";

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "N/A";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search by user, beach, caption, or source..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
        <div className="text-sm text-muted-foreground">
          {filteredPhotos.length} of {photos.length} photos
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {selectedIds.size > 0 && onBulkDelete && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">
              {selectedIds.size} photo{selectedIds.size !== 1 ? "s" : ""} selected
            </span>
            <Button variant="ghost" size="sm" onClick={handleClearSelection}>
              <X className="h-4 w-4 mr-1" />
              Clear Selection
            </Button>
          </div>
          <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
            <Trash2 className="h-4 w-4 mr-1" />
            Delete Selected ({selectedIds.size})
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {onBulkDelete && (
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={isSomeSelected ? "indeterminate" : isAllSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all photos"
                  />
                </TableHead>
              )}
              <TableHead className="w-[100px]">Preview</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={onBulkDelete ? 8 : 7}
                  className="text-center py-8 text-muted-foreground"
                >
                  Loading photos...
                </TableCell>
              </TableRow>
            ) : filteredPhotos.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={onBulkDelete ? 8 : 7}
                  className="text-center py-8 text-muted-foreground"
                >
                  {searchTerm ? "No photos found matching your search" : "No photos found"}
                </TableCell>
              </TableRow>
            ) : (
              filteredPhotos.map((photo) => (
                <TableRow
                  key={photo.id}
                  className={`${isDeleted(photo) ? "bg-muted/30 opacity-60" : ""} ${
                    selectedIds.has(photo.id) ? "bg-blue-50/50" : ""
                  }`}
                >
                  {/* Checkbox */}
                  {onBulkDelete && (
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(photo.id)}
                        onCheckedChange={() => handleSelectOne(photo.id)}
                        aria-label={`Select photo ${photo.id}`}
                      />
                    </TableCell>
                  )}

                  {/* Preview Thumbnail */}
                  <TableCell>
                    <button
                      onClick={() => onPreview(photo)}
                      className="relative h-16 w-16 overflow-hidden rounded border hover:opacity-75 transition-opacity"
                    >
                      <Image
                        src={photo.thumbUrl || photo.imageUrl}
                        alt="Photo preview"
                        fill
                        loading="lazy"
                        className="object-cover"
                        // Admin-only: unoptimized for simplicity, low traffic impact
                        unoptimized
                      />
                    </button>
                  </TableCell>

                  {/* Type */}
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {photo.type === "session_media" ? "Session" : "Beach"}
                    </Badge>
                  </TableCell>

                  {/* Details */}
                  <TableCell>
                    <div className="space-y-1">
                      {photo.metadata.userName && (
                        <div className="text-sm font-medium">{photo.metadata.userName}</div>
                      )}
                      {photo.metadata.beachName && (
                        <div className="text-sm text-muted-foreground">
                          {photo.metadata.beachName}
                        </div>
                      )}
                      {photo.metadata.caption && (
                        <div className="text-xs text-muted-foreground line-clamp-2">
                          {photo.metadata.caption}
                        </div>
                      )}
                      {photo.metadata.source && (
                        <div className="text-xs text-muted-foreground">
                          Source: {photo.metadata.source}
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* File Size */}
                  <TableCell className="text-sm text-muted-foreground">
                    {formatFileSize(photo.fileSize)}
                  </TableCell>

                  {/* Upload Date */}
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(photo.uploadedAt)}
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <div className="space-y-1">
                      {isDeleted(photo) ? (
                        <Badge variant="destructive">Deleted</Badge>
                      ) : (
                        <Badge variant="default" className="bg-green-600">
                          Active
                        </Badge>
                      )}
                      {isBeachPhoto(photo) && !isDeleted(photo) && (
                        <div>
                          {photo.approved ? (
                            <Badge variant="default" className="bg-blue-600">
                              Approved
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* Preview Button (always available) */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onPreview(photo)}
                        className="h-8 w-8 p-0"
                      >
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">Preview photo</span>
                      </Button>

                      {!isDeleted(photo) ? (
                        <>
                          {/* Approve/Unapprove (beach photos only) */}
                          {isBeachPhoto(photo) && onApprove && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onApprove(photo, !photo.approved)}
                              className={`h-8 w-8 p-0 ${
                                photo.approved
                                  ? "text-muted-foreground hover:text-foreground"
                                  : "text-blue-600 hover:text-blue-700"
                              }`}
                            >
                              {photo.approved ? (
                                <XCircle className="h-4 w-4" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                              <span className="sr-only">
                                {photo.approved ? "Unapprove" : "Approve"} photo
                              </span>
                            </Button>
                          )}

                          {/* Delete Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(photo)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete photo</span>
                          </Button>
                        </>
                      ) : (
                        /* Restore Button */
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRestore(photo)}
                          className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                        >
                          <RotateCcw className="h-4 w-4" />
                          <span className="sr-only">Restore photo</span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
