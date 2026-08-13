"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Trash2,
  Edit2,
  Heart,
  MessageCircle,
  X,
  ChevronLeft,
  ChevronRight,
  Camera,
  Upload,
  Loader2,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  deleteSessionPhotoAction,
  updatePhotoCaptionAction,
  getSessionPhotosAction,
  uploadSessionPhotosAction,
} from "@/actions/session-media-actions";
import { toast } from "sonner";
import { getTransformedUrl } from "@/lib/utils/image-utils";

interface SessionPhoto {
  id: string;
  session_id: string;
  user_id: string;
  public_url: string;
  storage_path: string;
  caption?: string;
  file_size: number;
  metadata?: {
    width?: number;
    height?: number;
    compression_ratio?: number;
  };
  created_at: string;
  // Add profile info if needed
  profiles?: {
    username?: string;
    avatar_url?: string;
  };
}

interface SessionPhotoGalleryProps {
  sessionId: string;
  photos: SessionPhoto[];
  canEdit?: boolean;
  showMetadata?: boolean;
  onPhotosChange?: (photos: SessionPhoto[]) => void;
}

interface LightboxState {
  isOpen: boolean;
  currentIndex: number;
}

export default function SessionPhotoGallery({
  sessionId,
  photos: initialPhotos,
  canEdit = false,
  showMetadata = false,
  onPhotosChange,
}: SessionPhotoGalleryProps) {
  const [photos, setPhotos] = useState<SessionPhoto[]>(initialPhotos);
  const [lightbox, setLightbox] = useState<LightboxState>({
    isOpen: false,
    currentIndex: 0,
  });
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [captionText, setCaptionText] = useState("");
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update photos when prop changes
  useEffect(() => {
    setPhotos(initialPhotos);
  }, [initialPhotos]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const openLightbox = (index: number) => {
    setLightbox({ isOpen: true, currentIndex: index });
  };

  const closeLightbox = () => {
    setLightbox({ isOpen: false, currentIndex: 0 });
  };

  const navigateLightbox = (direction: "prev" | "next") => {
    setLightbox((prev) => {
      const newIndex =
        direction === "prev"
          ? (prev.currentIndex - 1 + photos.length) % photos.length
          : (prev.currentIndex + 1) % photos.length;
      return { ...prev, currentIndex: newIndex };
    });
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!canEdit) return;

    setDeletingPhotoId(photoId);

    try {
      const result = await deleteSessionPhotoAction(photoId);

      if (result.success) {
        const updatedPhotos = photos.filter((p) => p.id !== photoId);
        setPhotos(updatedPhotos);
        onPhotosChange?.(updatedPhotos);
        toast.success("Photo deleted successfully");

        // Close lightbox if we're viewing the deleted photo
        if (lightbox.isOpen && photos[lightbox.currentIndex]?.id === photoId) {
          if (updatedPhotos.length === 0) {
            closeLightbox();
          } else {
            const newIndex = Math.min(
              lightbox.currentIndex,
              updatedPhotos.length - 1,
            );
            setLightbox((prev) => ({ ...prev, currentIndex: newIndex }));
          }
        }
      } else {
        toast.error(result.error || "Failed to delete photo");
      }
    } catch (error) {
      toast.error("Failed to delete photo");
    } finally {
      setDeletingPhotoId(null);
    }
  };

  const startEditingCaption = (photo: SessionPhoto) => {
    setEditingCaption(photo.id);
    setCaptionText(photo.caption || "");
  };

  const cancelEditingCaption = () => {
    setEditingCaption(null);
    setCaptionText("");
  };

  const saveCaption = async (photoId: string) => {
    if (!canEdit) return;

    try {
      const result = await updatePhotoCaptionAction(photoId, captionText);

      if (result.success) {
        const updatedPhotos = photos.map((p) =>
          p.id === photoId ? { ...p, caption: captionText } : p,
        );
        setPhotos(updatedPhotos);
        onPhotosChange?.(updatedPhotos);
        setEditingCaption(null);
        setCaptionText("");
        toast.success("Caption updated successfully");
      } else {
        toast.error(result.error || "Failed to update caption");
      }
    } catch (error) {
      toast.error("Failed to update caption");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !canEdit) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("fileCount", selectedFiles.length.toString());

      selectedFiles.forEach((file, index) => {
        formData.append(`file_${index}`, file);
      });

      const result = await uploadSessionPhotosAction(sessionId, formData);

      if (result.success) {
        const uploaded = result.data?.uploaded ?? selectedFiles.length;
        toast.success(
          `Photos uploaded: ${uploaded} of ${selectedFiles.length}`,
        );

        // Refresh photos
        const photosResult = await getSessionPhotosAction(sessionId);
        if (photosResult.success) {
          const newPhotos = photosResult.data || [];
          setPhotos(newPhotos);
          onPhotosChange?.(newPhotos);
        }

        // Clear selection
        setSelectedFiles([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } else {
        toast.error(result.error || "Failed to upload photos");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload photos");
    } finally {
      setIsUploading(false);
    }
  };

  const clearSelectedFiles = () => {
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (photos.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center space-y-4">
          <div className="p-3 rounded-full bg-muted mb-2">
            <Camera className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            No photos in this session yet
          </p>

          {canEdit && (
            <div className="space-y-3 w-full max-w-xs">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />

              {selectedFiles.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {selectedFiles.length} photo(s) selected
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleUpload}
                      disabled={isUploading}
                      className="flex-1"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={clearSelectedFiles}
                      variant="outline"
                      disabled={isUploading}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Photos
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const currentPhoto = photos[lightbox.currentIndex];

  return (
    <>
      {/* Upload UI */}
      {canEdit && (
        <div className="mb-4">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />

          {selectedFiles.length > 0 ? (
            <Card className="border-dashed border-primary bg-primary/5">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Camera className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">
                        {selectedFiles.length} photo(s) selected
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Ready to upload
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleUpload}
                      disabled={isUploading}
                      size="sm"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={clearSelectedFiles}
                      variant="outline"
                      size="sm"
                      disabled={isUploading}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add More Photos
            </Button>
          )}
        </div>
      )}

      {/* Photo Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {photos.map((photo, index) => (
          <div key={photo.id} className="relative group">
            <button
              type="button"
              className="aspect-square w-full overflow-hidden rounded-lg bg-gray-100 focus-ring"
              onClick={() => openLightbox(index)}
              aria-label={
                photo.caption
                  ? `View photo: ${photo.caption}`
                  : `View session photo ${index + 1}`
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getTransformedUrl(photo.public_url, "galleryPreview")}
                alt={photo.caption || `Session photo ${index + 1}`}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />

              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black/20 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>

            {/* Photo actions */}
            {canEdit && (
              <div className="absolute top-2 right-2 space-x-1">
                <Button
                  variant="secondary"
                  size="sm"
                  className="relative h-8 w-8 p-0 bg-white/90 hover:bg-white after:absolute after:-inset-[6px] after:content-['']"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditingCaption(photo);
                  }}
                  aria-label={`Edit caption for session photo ${index + 1}`}
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="relative h-8 w-8 p-0 bg-white/90 hover:bg-red-50 text-red-600 after:absolute after:-inset-[6px] after:content-['']"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeletePhoto(photo.id);
                  }}
                  disabled={deletingPhotoId === photo.id}
                  aria-label={`Delete session photo ${index + 1}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}

            {/* Photo info */}
            <div className="mt-2 space-y-1">
              {photo.caption && (
                <p className="text-xs text-foreground line-clamp-2">
                  {photo.caption}
                </p>
              )}
              {showMetadata && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatFileSize(photo.file_size)}</span>
                  <span>{formatDate(photo.created_at)}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      <Dialog open={lightbox.isOpen} onOpenChange={closeLightbox}>
        <DialogContent
          aria-describedby={undefined}
          className="max-w-4xl w-full p-0 overflow-hidden"
        >
          <DialogTitle className="sr-only">Photo Gallery</DialogTitle>
          {currentPhoto && (
            <div className="relative">
              {/* Image */}
              <div className="relative bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getTransformedUrl(currentPhoto.public_url, "fullWidth")}
                  alt={currentPhoto.caption || "Session photo"}
                  className="w-full max-h-[70vh] object-contain"
                />

                {/* Navigation buttons */}
                {photos.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/20 hover:bg-black/40 text-white"
                      onClick={() => navigateLightbox("prev")}
                      aria-label="Previous"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/20 hover:bg-black/40 text-white"
                      onClick={() => navigateLightbox("next")}
                      aria-label="Next"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </>
                )}

                {/* Close button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 bg-black/20 hover:bg-black/40 text-white"
                  onClick={closeLightbox}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </Button>

                {/* Photo counter */}
                {photos.length > 1 && (
                  <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                    {lightbox.currentIndex + 1} of {photos.length}
                  </div>
                )}
              </div>

              {/* Photo details */}
              <div className="p-4 space-y-3">
                {/* Caption */}
                <div>
                  {editingCaption === currentPhoto.id ? (
                    <div className="space-y-2">
                      <Label htmlFor="caption">Caption</Label>
                      <Input
                        id="caption"
                        value={captionText}
                        onChange={(e) => setCaptionText(e.target.value)}
                        placeholder="Add a caption..."
                        className="text-sm"
                      />
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={cancelEditingCaption}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => saveCaption(currentPhoto.id)}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {currentPhoto.caption ? (
                          <p className="text-sm">{currentPhoto.caption}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">
                            No caption
                          </p>
                        )}
                      </div>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditingCaption(currentPhoto)}
                          aria-label="Edit caption"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Metadata */}
                {showMetadata && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                    <div className="space-x-4">
                      <span>{formatFileSize(currentPhoto.file_size)}</span>
                      {currentPhoto.metadata?.width &&
                        currentPhoto.metadata?.height && (
                          <span>
                            {currentPhoto.metadata.width} ×{" "}
                            {currentPhoto.metadata.height}
                          </span>
                        )}
                    </div>
                    <span>{formatDate(currentPhoto.created_at)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
