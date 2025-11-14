/**
 * Unit tests for AvatarUpload component
 *
 * These tests focus on component logic with mocked storage operations.
 * E2E tests handle the full user flow in the browser.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AvatarUpload } from '@/components/profile/shared/avatar-upload';
import { toast } from '@/components/ui/use-toast';
import * as imageUpload from '@/lib/image-upload';
import * as profileActions from '@/actions/profile-actions';

// Create mock functions
const mockUpdateProfile = jest.fn().mockResolvedValue({ success: true });

// Mock dependencies
jest.mock('@/components/ui/use-toast');
jest.mock('@/lib/image-upload');
jest.mock('@/actions/profile-actions', () => ({
  updateProfile: mockUpdateProfile,
}));

describe('AvatarUpload', () => {
  const mockOnAvatarChange = jest.fn();
  const mockToast = toast as jest.MockedFunction<typeof toast>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Set up default mock implementations
    (imageUpload.uploadImage as jest.Mock).mockResolvedValue({
      success: true,
      url: 'https://example.com/avatar.png'
    });
    (imageUpload.deleteImage as jest.Mock).mockResolvedValue({ success: true });
    mockUpdateProfile.mockResolvedValue({ success: true });
  });

  describe('File Validation', () => {
    it('should reject files larger than 5MB', async () => {
      render(
        <AvatarUpload
          avatarUrl=""
          onAvatarChange={mockOnAvatarChange}
          persistImmediately={false}
        />
      );

      // Find the hidden file input - it's a sibling of the "Change Photo" button
      const changePhotoButton = screen.getByRole("button", { name: /change photo/i });
      const fileInput = changePhotoButton.nextElementSibling as HTMLInputElement;

      // Create a mock file larger than 5MB
      const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.png', {
        type: 'image/png',
      });

      fireEvent.change(fileInput, { target: { files: [largeFile] } });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'File too large',
          description: 'Please select an image smaller than 5MB.',
          variant: 'destructive',
        });
      });

      expect(mockOnAvatarChange).not.toHaveBeenCalled();
    });

    it('should reject non-image files', async () => {
      render(
        <AvatarUpload
          avatarUrl=""
          onAvatarChange={mockOnAvatarChange}
          persistImmediately={false}
        />
      );

      // Find the hidden file input - it's a sibling of the "Change Photo" button
      const changePhotoButton = screen.getByRole("button", { name: /change photo/i });
      const fileInput = changePhotoButton.nextElementSibling as HTMLInputElement;

      const textFile = new File(['hello'], 'test.txt', {
        type: 'text/plain',
      });

      fireEvent.change(fileInput, { target: { files: [textFile] } });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Invalid file type',
          description: 'Please select an image file.',
          variant: 'destructive',
        });
      });

      expect(mockOnAvatarChange).not.toHaveBeenCalled();
    });

    it('should accept valid image files', async () => {
      const mockUploadResult = {
        success: true,
        url: 'https://example.com/avatar.png',
      };

      (imageUpload.uploadImage as jest.Mock).mockResolvedValue(mockUploadResult);
      (imageUpload.deleteImage as jest.Mock).mockResolvedValue({ success: true });

      render(
        <AvatarUpload
          avatarUrl=""
          onAvatarChange={mockOnAvatarChange}
          persistImmediately={false}
        />
      );

      // Find the hidden file input - it's a sibling of the "Change Photo" button
      const changePhotoButton = screen.getByRole("button", { name: /change photo/i });
      const fileInput = changePhotoButton.nextElementSibling as HTMLInputElement;

      const validFile = new File(['image'], 'test.png', {
        type: 'image/png',
      });
      Object.defineProperty(validFile, 'size', { value: 1024 }); // 1KB

      fireEvent.change(fileInput, { target: { files: [validFile] } });

      await waitFor(() => {
        expect(imageUpload.uploadImage).toHaveBeenCalledWith(
          validFile,
          'avatars',
          'profiles'
        );
      });

      await waitFor(() => {
        expect(mockOnAvatarChange).toHaveBeenCalledWith(mockUploadResult.url);
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Profile picture updated',
        description: 'Your profile picture has been updated successfully.',
      });
    });
  });

  describe('Upload with Persistence', () => {
    it('should persist avatar to database when persistImmediately is true', async () => {
      const mockUploadResult = {
        success: true,
        url: 'https://example.com/avatar.png',
      };
      const mockUpdateResult = { success: true };

      (imageUpload.uploadImage as jest.Mock).mockResolvedValue(mockUploadResult);
      (mockUpdateProfile).mockResolvedValue(mockUpdateResult);

      render(
        <AvatarUpload
          avatarUrl=""
          onAvatarChange={mockOnAvatarChange}
          persistImmediately={true}
        />
      );

      // Find the hidden file input - it's a sibling of the "Change Photo" button
      const changePhotoButton = screen.getByRole("button", { name: /change photo/i });
      const fileInput = changePhotoButton.nextElementSibling as HTMLInputElement;

      const validFile = new File(['image'], 'test.png', {
        type: 'image/png',
      });
      Object.defineProperty(validFile, 'size', { value: 1024 });

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [validFile] } });
      });

      // Wait for upload to complete first
      await waitFor(() => {
        expect(imageUpload.uploadImage).toHaveBeenCalled();
      }, { timeout: 5000 });

      // Wait for toast (happens at the very end, after all operations)
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Profile picture updated',
          description: 'Your profile picture has been updated successfully.',
        });
      }, { timeout: 5000 });

      // Verify persistence was called (happens before callback/toast)
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        avatar_url: mockUploadResult.url,
      });

      // Verify callback was called
      expect(mockOnAvatarChange).toHaveBeenCalledWith(mockUploadResult.url);
    });

    it('should not persist when persistImmediately is false', async () => {
      const mockUploadResult = {
        success: true,
        url: 'https://example.com/avatar.png',
      };

      (imageUpload.uploadImage as jest.Mock).mockResolvedValue(mockUploadResult);

      render(
        <AvatarUpload
          avatarUrl=""
          onAvatarChange={mockOnAvatarChange}
          persistImmediately={false}
        />
      );

      // Find the hidden file input - it's a sibling of the "Change Photo" button
      const changePhotoButton = screen.getByRole("button", { name: /change photo/i });
      const fileInput = changePhotoButton.nextElementSibling as HTMLInputElement;

      const validFile = new File(['image'], 'test.png', {
        type: 'image/png',
      });
      Object.defineProperty(validFile, 'size', { value: 1024 });

      fireEvent.change(fileInput, { target: { files: [validFile] } });

      await waitFor(() => {
        expect(imageUpload.uploadImage).toHaveBeenCalled();
      });

      expect(mockUpdateProfile).not.toHaveBeenCalled();
    });
  });

  describe('Avatar Removal', () => {
    it('should delete avatar and update state', async () => {
      (imageUpload.deleteImage as jest.Mock).mockResolvedValue({ success: true });
      (mockUpdateProfile).mockResolvedValue({ success: true });

      render(
        <AvatarUpload
          avatarUrl="https://example.com/old-avatar.png"
          onAvatarChange={mockOnAvatarChange}
          persistImmediately={true}
        />
      );

      // Find and click the remove button (X icon button with destructive variant)
      // The button has no accessible name, so find it by its position/class
      const buttons = screen.getAllByRole('button');
      const removeButton = buttons.find(btn => 
        btn.classList.contains('bg-destructive') || 
        btn.querySelector('.lucide-x')
      );
      if (!removeButton) throw new Error('Remove button not found');
      
      await act(async () => {
        fireEvent.click(removeButton);
      });

      // Wait for deleteImage to be called first
      await waitFor(() => {
        expect(imageUpload.deleteImage).toHaveBeenCalledWith(
          'https://example.com/old-avatar.png',
          'avatars'
        );
      }, { timeout: 5000 });

      // Wait for toast (happens at the very end, after all operations)
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Image removed',
          description: 'Your profile picture has been removed.',
        });
      }, { timeout: 5000 });

      // Verify persistence was called (happens before callback/toast)
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        avatar_url: '',
      });

      // Verify callback was called
      expect(mockOnAvatarChange).toHaveBeenCalledWith(
        expect.stringContaining('placeholder.svg')
      );
    });

    it('should not show remove button when avatar is placeholder', () => {
      render(
        <AvatarUpload
          avatarUrl="/placeholder.svg"
          onAvatarChange={mockOnAvatarChange}
        />
      );

      const removeButton = screen.queryByRole('button', { name: /remove|delete/i });
      expect(removeButton).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle upload errors gracefully', async () => {
      (imageUpload.uploadImage as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Upload failed',
      });

      render(
        <AvatarUpload
          avatarUrl=""
          onAvatarChange={mockOnAvatarChange}
          persistImmediately={false}
        />
      );

      // Find the hidden file input - it's a sibling of the "Change Photo" button
      const changePhotoButton = screen.getByRole("button", { name: /change photo/i });
      const fileInput = changePhotoButton.nextElementSibling as HTMLInputElement;

      const validFile = new File(['image'], 'test.png', {
        type: 'image/png',
      });
      Object.defineProperty(validFile, 'size', { value: 1024 });

      fireEvent.change(fileInput, { target: { files: [validFile] } });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Upload failed',
          description: 'Upload failed',
          variant: 'destructive',
        });
      });

      expect(mockOnAvatarChange).not.toHaveBeenCalled();
    });

    it('should handle database persistence errors', async () => {
      (imageUpload.uploadImage as jest.Mock).mockResolvedValue({
        success: true,
        url: 'https://example.com/avatar.png',
      });
      (mockUpdateProfile).mockResolvedValue({
        success: false,
        error: 'Database error',
      });

      render(
        <AvatarUpload
          avatarUrl=""
          onAvatarChange={mockOnAvatarChange}
          persistImmediately={true}
        />
      );

      // Find the hidden file input - it's a sibling of the "Change Photo" button
      const changePhotoButton = screen.getByRole("button", { name: /change photo/i });
      const fileInput = changePhotoButton.nextElementSibling as HTMLInputElement;

      const validFile = new File(['image'], 'test.png', {
        type: 'image/png',
      });
      Object.defineProperty(validFile, 'size', { value: 1024 });

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [validFile] } });
      });

      // Upload succeeds first
      await waitFor(() => {
        expect(imageUpload.uploadImage).toHaveBeenCalled();
      }, { timeout: 5000 });

      // Wait for toast (happens at the very end, after all operations)
      // Component shows success toast (because upload succeeded)
      // Even though persistence fails, the component treats upload success as the main success
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Profile picture updated',
          }),
        );
      }, { timeout: 5000 });

      // Verify persistence was attempted (even though it fails)
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        avatar_url: 'https://example.com/avatar.png',
      });

      // Verify callback was called
      expect(mockOnAvatarChange).toHaveBeenCalledWith('https://example.com/avatar.png');
    });
  });

  describe('Old Avatar Cleanup', () => {
    it('should delete old avatar after successful new upload', async () => {
      const oldAvatarUrl = 'https://example.com/old-avatar.png';
      const newAvatarUrl = 'https://example.com/new-avatar.png';

      (imageUpload.uploadImage as jest.Mock).mockResolvedValue({
        success: true,
        url: newAvatarUrl,
      });
      (imageUpload.deleteImage as jest.Mock).mockResolvedValue({ success: true });

      render(
        <AvatarUpload
          avatarUrl={oldAvatarUrl}
          onAvatarChange={mockOnAvatarChange}
          persistImmediately={false}
        />
      );

      // Find the hidden file input - it's a sibling of the "Change Photo" button
      const changePhotoButton = screen.getByRole("button", { name: /change photo/i });
      const fileInput = changePhotoButton.nextElementSibling as HTMLInputElement;

      const validFile = new File(['image'], 'test.png', {
        type: 'image/png',
      });
      Object.defineProperty(validFile, 'size', { value: 1024 });

      fireEvent.change(fileInput, { target: { files: [validFile] } });

      await waitFor(() => {
        expect(imageUpload.deleteImage).toHaveBeenCalledWith(
          oldAvatarUrl,
          'avatars'
        );
      });
    });

    it('should not delete placeholder avatars', async () => {
      (imageUpload.uploadImage as jest.Mock).mockResolvedValue({
        success: true,
        url: 'https://example.com/new-avatar.png',
      });

      render(
        <AvatarUpload
          avatarUrl="/placeholder.svg"
          onAvatarChange={mockOnAvatarChange}
          persistImmediately={false}
        />
      );

      // Find the hidden file input - it's a sibling of the "Change Photo" button
      const changePhotoButton = screen.getByRole("button", { name: /change photo/i });
      const fileInput = changePhotoButton.nextElementSibling as HTMLInputElement;

      const validFile = new File(['image'], 'test.png', {
        type: 'image/png',
      });
      Object.defineProperty(validFile, 'size', { value: 1024 });

      fireEvent.change(fileInput, { target: { files: [validFile] } });

      await waitFor(() => {
        expect(imageUpload.uploadImage).toHaveBeenCalled();
      });

      expect(imageUpload.deleteImage).not.toHaveBeenCalled();
    });
  });
});
