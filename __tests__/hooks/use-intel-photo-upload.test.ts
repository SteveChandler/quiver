import { renderHook, act, waitFor } from '@testing-library/react';
import { useIntelPhotoUpload } from '@/hooks/use-intel-photo-upload';

// Mock uploadImage utility
jest.mock('@/lib/image-upload', () => ({
  uploadImage: jest.fn(),
}));

import { uploadImage } from '@/lib/image-upload';

const mockUploadImage = uploadImage as jest.Mock;

// Mock FileReader
const mockFileReader = {
  readAsDataURL: jest.fn(),
  result: 'data:image/jpeg;base64,test',
  onload: null as ((e: ProgressEvent<FileReader>) => void) | null,
};

global.FileReader = jest.fn(() => mockFileReader) as any;

describe('useIntelPhotoUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUploadImage.mockResolvedValue({ success: true, url: 'https://storage.example.com/photo.jpg' });
  });

  describe('initialization', () => {
    it('initializes with no photo selected', () => {
      const { result } = renderHook(() => useIntelPhotoUpload());

      expect(result.current.selectedPhoto).toBeNull();
      expect(result.current.photoPreview).toBeNull();
      expect(result.current.isUploading).toBe(false);
    });
  });

  describe('handlePhotoSelect', () => {
    it('sets selected photo', () => {
      const { result } = renderHook(() => useIntelPhotoUpload());
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      act(() => {
        result.current.handlePhotoSelect(mockFile);
      });

      expect(result.current.selectedPhoto).toBe(mockFile);
    });

    it('creates preview from file', async () => {
      const { result } = renderHook(() => useIntelPhotoUpload());
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      act(() => {
        result.current.handlePhotoSelect(mockFile);
      });

      // Simulate FileReader onload
      act(() => {
        if (mockFileReader.onload) {
          mockFileReader.onload({ target: { result: 'data:image/jpeg;base64,test' } } as any);
        }
      });

      expect(result.current.photoPreview).toBe('data:image/jpeg;base64,test');
    });
  });

  describe('handlePhotoRemove', () => {
    it('clears selected photo and preview', () => {
      const { result } = renderHook(() => useIntelPhotoUpload());
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      // First select a photo
      act(() => {
        result.current.handlePhotoSelect(mockFile);
        if (mockFileReader.onload) {
          mockFileReader.onload({ target: { result: 'data:image/jpeg;base64,test' } } as any);
        }
      });

      expect(result.current.selectedPhoto).toBe(mockFile);

      // Then remove it
      act(() => {
        result.current.handlePhotoRemove();
      });

      expect(result.current.selectedPhoto).toBeNull();
      expect(result.current.photoPreview).toBeNull();
    });
  });

  describe('uploadPhoto', () => {
    it('returns null when no photo selected', async () => {
      const { result } = renderHook(() => useIntelPhotoUpload());

      let uploadResult: { url?: string; storagePath?: string } | null = null;
      await act(async () => {
        uploadResult = await result.current.uploadPhoto();
      });

      expect(uploadResult).toBeNull();
      expect(mockUploadImage).not.toHaveBeenCalled();
    });

    it('uploads photo and returns urls', async () => {
      mockUploadImage.mockResolvedValue({
        success: true,
        url: 'https://storage.example.com/intel-posts/photo.jpg',
      });

      const { result } = renderHook(() => useIntelPhotoUpload());
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      act(() => {
        result.current.handlePhotoSelect(mockFile);
      });

      let uploadResult: { url?: string; storagePath?: string } | null = null;
      await act(async () => {
        uploadResult = await result.current.uploadPhoto();
      });

      expect(mockUploadImage).toHaveBeenCalledWith(mockFile, 'intel-photos', 'intel-posts');
      expect(uploadResult).toEqual({
        url: 'https://storage.example.com/intel-posts/photo.jpg',
        storagePath: 'photo.jpg',
      });
    });

    it('sets isUploading during upload', async () => {
      mockUploadImage.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ success: true, url: 'test.jpg' }), 50))
      );

      const { result } = renderHook(() => useIntelPhotoUpload());
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      act(() => {
        result.current.handlePhotoSelect(mockFile);
      });

      expect(result.current.isUploading).toBe(false);

      let uploadPromise: Promise<{ url?: string; storagePath?: string } | null>;
      act(() => {
        uploadPromise = result.current.uploadPhoto();
      });

      // Check uploading state during upload
      expect(result.current.isUploading).toBe(true);

      await act(async () => {
        await uploadPromise;
      });

      expect(result.current.isUploading).toBe(false);
    });

    it('throws error on upload failure', async () => {
      mockUploadImage.mockResolvedValue({
        success: false,
        error: 'Upload failed',
      });

      const { result } = renderHook(() => useIntelPhotoUpload());
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      act(() => {
        result.current.handlePhotoSelect(mockFile);
      });

      await expect(async () => {
        await act(async () => {
          await result.current.uploadPhoto();
        });
      }).rejects.toThrow('Upload failed');
    });
  });

  describe('reset', () => {
    it('resets all state', () => {
      const { result } = renderHook(() => useIntelPhotoUpload());
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      act(() => {
        result.current.handlePhotoSelect(mockFile);
        if (mockFileReader.onload) {
          mockFileReader.onload({ target: { result: 'data:image/jpeg;base64,test' } } as any);
        }
      });

      expect(result.current.selectedPhoto).not.toBeNull();

      act(() => {
        result.current.reset();
      });

      expect(result.current.selectedPhoto).toBeNull();
      expect(result.current.photoPreview).toBeNull();
      expect(result.current.isUploading).toBe(false);
    });
  });
});
