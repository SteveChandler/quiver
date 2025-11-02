/**
 * Unit tests for AvatarUpload component
 *
 * These tests focus on component logic with mocked storage operations.
 * E2E tests handle the full user flow in the browser.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AvatarUpload } from '@/components/profile/shared/avatar-upload';
import { toast } from '@/components/ui/use-toast';
import * as imageUpload from '@/lib/image-upload';
import * as profileActions from '@/actions/profile-actions';

// Mock dependencies
jest.mock('@/components/ui/use-toast');
jest.mock('@/lib/image-upload');
jest.mock('@/actions/profile-actions');

describe('AvatarUpload', () => {
  const mockOnAvatarChange = jest.fn();
  const mockToast = toast as jest.MockedFunction<typeof toast>;

  beforeEach(() => {
    jest.clearAllMocks();
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

      const fileInput = screen.getByLabelText(/change photo/i).nextElementSibling as HTMLInputElement;

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

      const fileInput = screen.getByLabelText(/change photo/i).nextElementSibling as HTMLInputElement;

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

      const fileInput = screen.getByLabelText(/change photo/i).nextElementSibling as HTMLInputElement;

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
      (profileActions.updateProfile as jest.Mock).mockResolvedValue(mockUpdateResult);

      render(
        <AvatarUpload
          avatarUrl=""
          onAvatarChange={mockOnAvatarChange}
          persistImmediately={true}
        />
      );

      const fileInput = screen.getByLabelText(/change photo/i).nextElementSibling as HTMLInputElement;

      const validFile = new File(['image'], 'test.png', {
        type: 'image/png',
      });
      Object.defineProperty(validFile, 'size', { value: 1024 });

      fireEvent.change(fileInput, { target: { files: [validFile] } });

      await waitFor(() => {
        expect(profileActions.updateProfile).toHaveBeenCalledWith({
          avatar_url: mockUploadResult.url,
        });
      });
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

      const fileInput = screen.getByLabelText(/change photo/i).nextElementSibling as HTMLInputElement;

      const validFile = new File(['image'], 'test.png', {
        type: 'image/png',
      });
      Object.defineProperty(validFile, 'size', { value: 1024 });

      fireEvent.change(fileInput, { target: { files: [validFile] } });

      await waitFor(() => {
        expect(imageUpload.uploadImage).toHaveBeenCalled();
      });

      expect(profileActions.updateProfile).not.toHaveBeenCalled();
    });
  });

  describe('Avatar Removal', () => {
    it('should delete avatar and update state', async () => {
      (imageUpload.deleteImage as jest.Mock).mockResolvedValue({ success: true });
      (profileActions.updateProfile as jest.Mock).mockResolvedValue({ success: true });

      render(
        <AvatarUpload
          avatarUrl="https://example.com/old-avatar.png"
          onAvatarChange={mockOnAvatarChange}
          persistImmediately={true}
        />
      );

      // Find and click the remove button
      const removeButton = screen.getByRole('button', { name: /remove|delete/i });
      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(imageUpload.deleteImage).toHaveBeenCalledWith(
          'https://example.com/old-avatar.png',
          'avatars'
        );
      });

      await waitFor(() => {
        expect(profileActions.updateProfile).toHaveBeenCalledWith({
          avatar_url: '',
        });
      });

      expect(mockOnAvatarChange).toHaveBeenCalledWith(
        expect.stringContaining('placeholder.svg')
      );

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Image removed',
        description: 'Your profile picture has been removed.',
      });
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

      const fileInput = screen.getByLabelText(/change photo/i).nextElementSibling as HTMLInputElement;

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
      (profileActions.updateProfile as jest.Mock).mockResolvedValue({
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

      const fileInput = screen.getByLabelText(/change photo/i).nextElementSibling as HTMLInputElement;

      const validFile = new File(['image'], 'test.png', {
        type: 'image/png',
      });
      Object.defineProperty(validFile, 'size', { value: 1024 });

      fireEvent.change(fileInput, { target: { files: [validFile] } });

      // Upload succeeds but persistence fails
      await waitFor(() => {
        expect(imageUpload.uploadImage).toHaveBeenCalled();
      });

      // Should show error for persistence failure
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'destructive',
          })
        );
      });
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

      const fileInput = screen.getByLabelText(/change photo/i).nextElementSibling as HTMLInputElement;

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

      const fileInput = screen.getByLabelText(/change photo/i).nextElementSibling as HTMLInputElement;

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
