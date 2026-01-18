import { useState, useCallback } from 'react';
import { uploadImage } from '@/lib/image-upload';
import { INTEL_CONFIG, INTEL_UI_TEXT } from '@/lib/constants/intel';

export interface PhotoUploadResult {
  /** Public URL of the uploaded photo */
  url: string;
  /** Storage path for deletion purposes */
  storagePath: string;
}

export interface UseIntelPhotoUploadResult {
  /** Currently selected photo file */
  selectedPhoto: File | null;
  /** Data URL preview of the selected photo */
  photoPreview: string | null;
  /** Whether photo is currently uploading */
  isUploading: boolean;
  /** Select a photo file and create preview */
  handlePhotoSelect: (file: File) => void;
  /** Remove selected photo and preview */
  handlePhotoRemove: () => void;
  /** Upload the selected photo, returns result or null if no photo */
  uploadPhoto: () => Promise<PhotoUploadResult | null>;
  /** Reset all photo state */
  reset: () => void;
}

/**
 * Hook for managing photo selection, preview, and upload in intel forms.
 *
 * Features:
 * - File selection with preview generation
 * - Async photo upload with loading state
 * - Error handling for upload failures
 * - Reset functionality for form clearing
 */
export function useIntelPhotoUpload(): UseIntelPhotoUploadResult {
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  /**
   * Select a photo file and create a preview
   */
  const handlePhotoSelect = useCallback((file: File) => {
    setSelectedPhoto(file);

    // Create preview using FileReader
    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  /**
   * Remove selected photo and preview
   */
  const handlePhotoRemove = useCallback(() => {
    setSelectedPhoto(null);
    setPhotoPreview(null);
  }, []);

  /**
   * Upload the selected photo to storage.
   * Returns upload result or null if no photo selected.
   * Throws error if upload fails.
   */
  const uploadPhoto = useCallback(async (): Promise<PhotoUploadResult | null> => {
    if (!selectedPhoto) {
      return null;
    }

    setIsUploading(true);
    try {
      const uploadResult = await uploadImage(
        selectedPhoto,
        INTEL_CONFIG.PHOTO_UPLOAD_BUCKET,
        'intel-posts'
      );

      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(uploadResult.error || INTEL_UI_TEXT.ERROR.PHOTO_UPLOAD_FAILED);
      }

      // Extract storage path from URL for deletion purposes
      const storagePath = uploadResult.url.split('/').pop() || '';

      return {
        url: uploadResult.url,
        storagePath,
      };
    } finally {
      setIsUploading(false);
    }
  }, [selectedPhoto]);

  /**
   * Reset all photo state
   */
  const reset = useCallback(() => {
    setSelectedPhoto(null);
    setPhotoPreview(null);
    setIsUploading(false);
  }, []);

  return {
    selectedPhoto,
    photoPreview,
    isUploading,
    handlePhotoSelect,
    handlePhotoRemove,
    uploadPhoto,
    reset,
  };
}
