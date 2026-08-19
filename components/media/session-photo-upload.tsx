"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  Upload,
  X,
  Camera,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  uploadSessionPhotosAction,
  getUserStorageUsageAction,
} from "@/actions/session-media-actions";
import {
  SESSION_PHOTO_ACCEPT_ATTRIBUTE,
  SESSION_PHOTO_MAX_PER_SESSION,
  validateSessionPhotoInput,
} from "@/lib/media/session-photo-policy";
import { toast } from "sonner";

interface SessionPhotoUploadProps {
  sessionId: string;
  onUploadComplete: (uploadedCount: number) => void;
  maxPhotos?: number;
  disabled?: boolean;
}

interface FilePreview {
  file: File;
  url: string;
  id: string;
  compressing?: boolean;
  compressedSize?: number;
  originalSize: number;
}

interface StorageInfo {
  total_bytes: number;
  image_count: number;
  remaining_bytes: number;
  can_upload: boolean;
}

export default function SessionPhotoUpload({
  sessionId,
  onUploadComplete,
  maxPhotos = SESSION_PHOTO_MAX_PER_SESSION,
  disabled = false,
}: SessionPhotoUploadProps) {
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load storage information on component mount
  React.useEffect(() => {
    loadStorageInfo();
  }, []);

  const loadStorageInfo = async () => {
    try {
      const result = await getUserStorageUsageAction();
      if (result.success) {
        setStorageInfo(result.data ?? null);
      }
    } catch (error) {
      console.error("Failed to load storage info:", error);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    const validationError = validateSessionPhotoInput(file);
    if (validationError === "invalid_file_type") {
      return "Only JPEG, PNG, and WebP images are allowed";
    }
    if (validationError === "file_too_large") {
      return "File size must be less than 10MB";
    }
    return null;
  };

  const processFiles = useCallback(
    async (fileList: FileList) => {
      const newFiles: FilePreview[] = [];
      const errors: string[] = [];

      // Check storage availability
      if (!storageInfo?.can_upload) {
        setError("Storage quota exceeded. Please delete some images first.");
        return;
      }

      // Check total file count
      if (files.length + fileList.length > maxPhotos) {
        setError(`Maximum ${maxPhotos} photos allowed per session`);
        return;
      }

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const validationError = validateFile(file);

        if (validationError) {
          errors.push(`${file.name}: ${validationError}`);
          continue;
        }

        const preview: FilePreview = {
          file,
          url: URL.createObjectURL(file),
          id: `${Date.now()}-${i}`,
          originalSize: file.size,
          compressing: true,
        };

        newFiles.push(preview);
      }

      if (errors.length > 0) {
        setError(errors.join(", "));
      }

      if (newFiles.length > 0) {
        setFiles((prev) => [...prev, ...newFiles]);

        // Simulate compression preview (in real app, this would show actual compression results)
        setTimeout(() => {
          setFiles((prev) =>
            prev.map((f) =>
              newFiles.find((nf) => nf.id === f.id)
                ? {
                    ...f,
                    compressing: false,
                    compressedSize: Math.floor(f.originalSize * 0.6),
                  }
                : f
            )
          );
        }, 1000);
      }
    },
    [files.length, maxPhotos, storageInfo]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      setError(null);

      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles.length > 0) {
        processFiles(droppedFiles);
      }
    },
    [processFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      const selectedFiles = e.target.files;
      if (selectedFiles && selectedFiles.length > 0) {
        processFiles(selectedFiles);
      }
    },
    [processFiles]
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const fileToRemove = prev.find((f) => f.id === id);
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.url);
      }
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const handleUpload = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Create FormData
      const formData = new FormData();
      formData.append("fileCount", files.length.toString());

      files.forEach((filePreview, index) => {
        formData.append(`file_${index}`, filePreview.file);
      });

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const result = await uploadSessionPhotosAction(sessionId, formData);

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (result.success && result.data) {
        toast.success(`Successfully uploaded ${result.data.uploaded} photo(s)`);

        if (result.data.failed > 0) {
          toast.warning(`${result.data.failed} photo(s) failed to upload`);
        }

        // Clean up file previews
        files.forEach((f) => URL.revokeObjectURL(f.url));
        setFiles([]);

        // Refresh storage info
        await loadStorageInfo();

        onUploadComplete(result.data.uploaded);
      } else {
        throw new Error(result.error || "Upload failed");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Upload failed";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const clearFiles = () => {
    files.forEach((f) => URL.revokeObjectURL(f.url));
    setFiles([]);
    setError(null);
  };

  return (
    <div className="space-y-4">
      {/* Storage Info */}
      {storageInfo && (
        <div className="text-sm text-muted-foreground">
          Storage: {formatFileSize(storageInfo.total_bytes)} used (
          {storageInfo.image_count} images) •{" "}
          {formatFileSize(storageInfo.remaining_bytes)} remaining
        </div>
      )}

      {/* Upload Area */}
      <Card
        className={cn(
          "border-2 border-dashed transition-colors cursor-pointer",
          isDragging && "border-primary bg-primary/5",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <CardContent className="flex flex-col items-center justify-center py-8 px-4">
          {isUploading ? (
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="space-y-2">
                <p className="text-sm font-medium">Uploading photos...</p>
                <Progress value={uploadProgress} className="w-32" />
              </div>
            </div>
          ) : (
            <>
              <div className="p-3 rounded-full bg-primary/10 mb-4">
                {files.length > 0 ? (
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                ) : (
                  <Camera className="h-6 w-6 text-primary" />
                )}
              </div>

              <div className="text-center space-y-1">
                <p className="text-sm font-medium">
                  {files.length > 0
                    ? `${files.length} photo(s) selected`
                    : "Add session photos"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Drag and drop or click to browse • Max {maxPhotos} photos •
                  JPEG, PNG, WebP
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                disabled={disabled}
              >
                <Upload className="h-4 w-4 mr-2" />
                Choose Files
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={SESSION_PHOTO_ACCEPT_ATTRIBUTE}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* File Previews */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Selected Photos</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFiles}
              disabled={isUploading}
            >
              Clear All
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {files.map((filePreview) => (
              <div key={filePreview.id} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={filePreview.url}
                    alt={`Selected photo: ${filePreview.file.name}`}
                    className="w-full h-full object-cover"
                  />
                  {filePreview.compressing && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                    </div>
                  )}
                </div>

                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute -top-2 -right-2 h-8 w-8 rounded-full p-0 after:absolute after:-inset-[6px] after:content-['']"
                  onClick={() => removeFile(filePreview.id)}
                  disabled={isUploading}
                  aria-label={`Remove ${filePreview.file.name}`}
                >
                  <X className="h-3 w-3" />
                </Button>

                <div className="mt-1 text-xs text-muted-foreground">
                  <div className="truncate">{filePreview.file.name}</div>
                  <div className="flex items-center justify-between">
                    <span>{formatFileSize(filePreview.originalSize)}</span>
                    {filePreview.compressedSize && (
                      <span className="text-green-600">
                        → {formatFileSize(filePreview.compressedSize)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Upload Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleUpload}
              disabled={isUploading || files.some((f) => f.compressing)}
              className="min-w-32"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Photos
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
