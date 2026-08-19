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
import { SimpleCardLayout } from "@/components/ui/form-layout";
import {
  getFormText,
  SessionFormMode,
} from "@/lib/constants/session-form-constants";
import {
  SESSION_PHOTO_ACCEPT_ATTRIBUTE,
  SESSION_PHOTO_MAX_PER_SESSION,
  validateSessionPhotoInput,
} from "@/lib/media/session-photo-policy";

interface FilePreview {
  file: File;
  url: string;
  id: string;
  originalSize: number;
}

interface PhotoSelectionSectionProps {
  mode: SessionFormMode;
  selectedFiles: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
  maxPhotos?: number;
}

export function PhotoSelectionSection({
  mode,
  selectedFiles,
  onFilesChange,
  disabled = false,
  maxPhotos = SESSION_PHOTO_MAX_PER_SESSION,
}: PhotoSelectionSectionProps) {
  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hooks must be called unconditionally; gate rendering later

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
      setIsProcessing(true);
      const newFiles: File[] = [];
      const newPreviews: FilePreview[] = [];
      const errors: string[] = [];

      // Check total file count
      if (selectedFiles.length + fileList.length > maxPhotos) {
        setError(`Maximum ${maxPhotos} photos allowed per session`);
        setIsProcessing(false);
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
        };

        newFiles.push(file);
        newPreviews.push(preview);
      }

      if (errors.length > 0) {
        setError(errors.join(", "));
      } else {
        setError(null);
      }

      if (newFiles.length > 0) {
        const updatedFiles = [...selectedFiles, ...newFiles];
        const updatedPreviews = [...filePreviews, ...newPreviews];

        onFilesChange(updatedFiles);
        setFilePreviews(updatedPreviews);
      }

      setIsProcessing(false);
    },
    [selectedFiles, filePreviews, maxPhotos, onFilesChange]
  );

  const removeFile = (fileId: string) => {
    const previewIndex = filePreviews.findIndex((p) => p.id === fileId);
    if (previewIndex === -1) return;

    // Clean up object URL
    URL.revokeObjectURL(filePreviews[previewIndex].url);

    // Remove from both arrays
    const updatedPreviews = filePreviews.filter((p) => p.id !== fileId);
    const updatedFiles = selectedFiles.filter(
      (_, index) => index !== previewIndex
    );

    setFilePreviews(updatedPreviews);
    onFilesChange(updatedFiles);
  };

  const clearAllFiles = () => {
    filePreviews.forEach((p) => URL.revokeObjectURL(p.url));
    setFilePreviews([]);
    onFilesChange([]);
    setError(null);
  };

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

      if (disabled || isProcessing) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        processFiles(files);
      }
    },
    [disabled, isProcessing, processFiles]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || disabled || isProcessing) return;
    processFiles(e.target.files);
  };

  const text = getFormText(mode);

  return (
    <SimpleCardLayout
      title={
        <div className="flex items-center">
          <Camera className="w-5 h-5 mr-2 text-primary" />
          {text.photos}
        </div>
      }
      description="Add photos from your surf session (optional - you can skip this)"
    >
      <div className="space-y-4">
        {/* Upload Area */}
        <Card
          className={cn(
            "border-2 border-dashed transition-colors cursor-pointer bg-[#354090] border-[#404C92]",
            isDragging && "border-primary bg-primary/5",
            (disabled || isProcessing) && "opacity-50 cursor-not-allowed"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() =>
            !disabled && !isProcessing && fileInputRef.current?.click()
          }
        >
          <CardContent className="flex flex-col items-center justify-center py-8 px-4">
            <div className="p-3 rounded-full bg-primary/10 mb-4">
              {isProcessing ? (
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
              ) : filePreviews.length > 0 ? (
                <CheckCircle2 className="h-6 w-6 text-primary" />
              ) : (
                <Camera className="h-6 w-6 text-primary" />
              )}
            </div>

            <div className="text-center space-y-1">
              <p className="text-sm font-medium">
                {isProcessing
                  ? "Processing photos..."
                  : filePreviews.length > 0
                  ? `${filePreviews.length} photo(s) selected`
                  : "Add session photos"}
              </p>
              <p className="text-xs text-muted-foreground">
                Drag and drop or click to browse • Max {maxPhotos} photos •
                JPEG, PNG, WebP
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4 bg-[#354090] border-[#404C92] text-[#A8B8D0] hover:bg-[#404C92] hover:text-[#F0F0F0]"
              disabled={disabled || isProcessing}
            >
              <Upload className="h-4 w-4 mr-2" />
              Choose Files
            </Button>
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
        {filePreviews.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Selected Photos</h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearAllFiles}
                disabled={disabled}
              >
                Clear All
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filePreviews.map((filePreview) => (
                <div key={filePreview.id} className="relative group">
                  <div className="aspect-square rounded-lg overflow-hidden bg-[#354090]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={filePreview.url}
                      alt={`Selected photo: ${filePreview.file.name}`}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Always visible: a hover-only reveal is unreachable on touch,
                      which is where sessions actually get logged. The ::after
                      pseudo-element widens the hit area to 44px without growing
                      the badge over the thumbnail. */}
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    aria-label={`Remove photo ${filePreview.file.name}`}
                    className="absolute -top-2 -right-2 h-8 w-8 rounded-full p-0 shadow-sm after:absolute after:-inset-[6px] after:content-['']"
                    onClick={() => removeFile(filePreview.id)}
                    disabled={disabled}
                  >
                    <X className="h-4 w-4" />
                  </Button>

                  <div className="mt-1 text-xs text-muted-foreground">
                    <div className="truncate">{filePreview.file.name}</div>
                    <div>{formatFileSize(filePreview.originalSize)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SimpleCardLayout>
  );
}
