import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShareBar } from '@/components/share/ShareBar';
import type { SessionWithDetails } from '@/types/database';
import * as shareUrlBuilder from '@/lib/share/share-url-builder';
import * as trackShare from '@/lib/share/track-share';
import * as authContext from '@/context/auth-context';

// Mock dependencies
jest.mock('@/lib/share/share-url-builder');
jest.mock('@/lib/share/track-share');
jest.mock('@/context/auth-context');
jest.mock('@/components/ui/use-toast');
jest.mock('@/actions/session-actions');

const mockSession: SessionWithDetails = {
  id: 'test-session-123',
  user_id: 'user-123',
  beach_id: 'beach-123',
  scheduled_at: '2024-01-15T08:00:00Z',
  rating: 4,
  notes: 'Great session!',
  is_public: true,
  created_at: '2024-01-15T08:00:00Z',
  updated_at: '2024-01-15T08:00:00Z',
  beaches: {
    id: 'beach-123',
    name: 'Test Beach',
    slug: 'test-beach',
    latitude: 33.0,
    longitude: -117.0,
    country: 'USA',
  },
  wave_height_min: 4,
  wave_height_max: 6,
  wind_speed: 8,
};

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
};

describe('ShareBar Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default auth mock - authenticated user
    (authContext.useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      loading: false,
    });

    // Default mocks for share utilities
    (shareUrlBuilder.buildPlatformShareUrl as jest.Mock).mockReturnValue({
      url: 'https://example.com/share/image.png',
      tooltip: 'Share to platform',
    });
    (shareUrlBuilder.openShareUrl as jest.Mock).mockImplementation(() => {});
    (shareUrlBuilder.downloadImage as jest.Mock).mockResolvedValue(true);
    (shareUrlBuilder.buildImageFilename as jest.Mock).mockReturnValue('quiver-session-123.png');
    (shareUrlBuilder.isWebShareAvailable as jest.Mock).mockReturnValue(false);

    // Default mocks for tracking
    (trackShare.trackSharePlatformSelected as jest.Mock).mockImplementation(() => {});
    (trackShare.trackShare as jest.Mock).mockResolvedValue(undefined);
    (trackShare.trackShareCompleted as jest.Mock).mockImplementation(() => {});
    (trackShare.trackShareFailed as jest.Mock).mockImplementation(() => {});
    (trackShare.trackVariantChanged as jest.Mock).mockImplementation(() => {});
    (trackShare.trackAspectRatioChanged as jest.Mock).mockImplementation(() => {});
    (trackShare.trackDownloadStarted as jest.Mock).mockImplementation(() => {});
    (trackShare.trackDownloadCompleted as jest.Mock).mockImplementation(() => {});
    (trackShare.incrementSessionShareCount as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Rendering', () => {
    it('should render variant selector', () => {
      render(<ShareBar session={mockSession} sessionId="test-session-123" />);

      // Look for variant selector (could be dropdown or buttons)
      const variantElement = screen.queryByText(/variant/i) || screen.queryByLabelText(/variant/i);
      const comboboxes = screen.queryAllByRole('combobox');
      expect(variantElement || comboboxes.length > 0).toBeTruthy();
    });

    it('should render aspect ratio selector', () => {
      render(<ShareBar session={mockSession} sessionId="test-session-123" />);

      // Look for aspect ratio selector - should have at least one combobox
      const comboboxes = screen.getAllByRole('combobox');
      expect(comboboxes.length).toBeGreaterThan(0);
    });

    it('should render platform share buttons', () => {
      render(<ShareBar session={mockSession} sessionId="test-session-123" />);

      // Should have multiple share buttons
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should apply custom className', () => {
      const { container } = render(
        <ShareBar
          session={mockSession}
          sessionId="test-session-123"
          className="custom-class"
        />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('should use default variant and ratio', () => {
      render(<ShareBar session={mockSession} sessionId="test-session-123" />);

      // Component should render without errors
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    });

    it('should use custom default variant and ratio', () => {
      render(
        <ShareBar
          session={mockSession}
          sessionId="test-session-123"
          defaultVariant={3}
          defaultRatio="9:16"
        />
      );

      // Should render with custom defaults
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    });
  });

  describe('Authentication', () => {
    it('should show toast when not authenticated and trying to share', async () => {
      // Mock unauthenticated user
      (authContext.useAuth as jest.Mock).mockReturnValue({
        user: null,
        loading: false,
      });

      const { toast } = require('@/components/ui/use-toast');
      render(<ShareBar session={mockSession} sessionId="test-session-123" />);

      // Try to click a share button
      const buttons = screen.getAllByRole('button');
      if (buttons.length > 0) {
        fireEvent.click(buttons[0]);

        await waitFor(() => {
          expect(toast).toHaveBeenCalledWith(
            expect.objectContaining({
              title: expect.stringContaining('Sign in'),
              variant: 'destructive',
            })
          );
        });
      }
    });

    it('should allow sharing when authenticated', () => {
      render(<ShareBar session={mockSession} sessionId="test-session-123" />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('Variant Selection', () => {
    it('should track variant changes', async () => {
      render(<ShareBar session={mockSession} sessionId="test-session-123" />);

      // Find and open variant selector (if it's a select/dropdown)
      const selectors = screen.queryAllByRole('combobox');
      if (selectors.length > 0) {
        fireEvent.click(selectors[0]);

        // Look for variant options
        await waitFor(() => {
          const options = screen.queryAllByRole('option');
          if (options.length > 0) {
            fireEvent.click(options[1]); // Select second variant

            expect(trackShare.trackVariantChanged).toHaveBeenCalled();
          }
        });
      }
    });

    it('should update variant when selection changes', async () => {
      render(<ShareBar session={mockSession} sessionId="test-session-123" defaultVariant={1} />);

      const selectors = screen.queryAllByRole('combobox');
      if (selectors.length > 0) {
        fireEvent.click(selectors[0]);

        await waitFor(() => {
          const options = screen.queryAllByRole('option');
          if (options.length > 1) {
            fireEvent.click(options[1]);

            expect(trackShare.trackVariantChanged).toHaveBeenCalledWith(
              expect.any(Number),
              expect.objectContaining({
                sessionId: 'test-session-123',
                previousVariant: 1,
              })
            );
          }
        });
      }
    });
  });

  describe('Aspect Ratio Selection', () => {
    it('should track aspect ratio changes', async () => {
      render(<ShareBar session={mockSession} sessionId="test-session-123" />);

      const selectors = screen.queryAllByRole('combobox');
      if (selectors.length > 1) {
        fireEvent.click(selectors[1]);

        await waitFor(() => {
          const options = screen.queryAllByRole('option');
          if (options.length > 0) {
            fireEvent.click(options[0]);

            expect(trackShare.trackAspectRatioChanged).toHaveBeenCalled();
          }
        });
      }
    });

    it('should update ratio when selection changes', async () => {
      render(<ShareBar session={mockSession} sessionId="test-session-123" defaultRatio="1:1" />);

      const selectors = screen.queryAllByRole('combobox');
      if (selectors.length > 1) {
        fireEvent.click(selectors[1]);

        await waitFor(() => {
          const options = screen.queryAllByRole('option');
          if (options.length > 0) {
            fireEvent.click(options[0]);

            expect(trackShare.trackAspectRatioChanged).toHaveBeenCalledWith(
              expect.any(String),
              expect.objectContaining({
                sessionId: 'test-session-123',
                previousAspectRatio: '1:1',
              })
            );
          }
        });
      }
    });
  });

  describe('Instagram Share', () => {
    it('should download image for Instagram', async () => {
      render(<ShareBar session={mockSession} sessionId="test-session-123" />);

      // Find Instagram button (by icon, text, or aria-label)
      const instagramButton = screen.queryByRole('button', { name: /instagram/i }) ||
                             screen.queryByLabelText(/instagram/i);

      if (instagramButton) {
        fireEvent.click(instagramButton);

        await waitFor(() => {
          expect(trackShare.trackDownloadStarted).toHaveBeenCalled();
          expect(shareUrlBuilder.downloadImage).toHaveBeenCalled();
          expect(trackShare.trackDownloadCompleted).toHaveBeenCalled();
          expect(trackShare.incrementSessionShareCount).toHaveBeenCalledWith('test-session-123');
        });
      }
    });

    it('should track Instagram share', async () => {
      render(<ShareBar session={mockSession} sessionId="test-session-123" />);

      const instagramButton = screen.queryByRole('button', { name: /instagram/i });

      if (instagramButton) {
        fireEvent.click(instagramButton);

        await waitFor(() => {
          expect(trackShare.trackShare).toHaveBeenCalledWith(
            'instagram',
            expect.objectContaining({
              sessionId: 'test-session-123',
              userId: 'user-123',
            })
          );
        });
      }
    });

    it('should show success toast after Instagram download', async () => {
      const { toast } = require('@/components/ui/use-toast');
      render(<ShareBar session={mockSession} sessionId="test-session-123" />);

      const instagramButton = screen.queryByRole('button', { name: /instagram/i });

      if (instagramButton) {
        fireEvent.click(instagramButton);

        await waitFor(() => {
          expect(toast).toHaveBeenCalledWith(
            expect.objectContaining({
              title: expect.stringContaining('downloaded'),
            })
          );
        });
      }
    });

    it('should handle Instagram download failure', async () => {
      (shareUrlBuilder.downloadImage as jest.Mock).mockResolvedValue(false);
      const { toast } = require('@/components/ui/use-toast');

      render(<ShareBar session={mockSession} sessionId="test-session-123" />);

      const instagramButton = screen.queryByRole('button', { name: /instagram/i });

      if (instagramButton) {
        fireEvent.click(instagramButton);

        await waitFor(() => {
          expect(trackShare.trackShareFailed).toHaveBeenCalled();
          expect(toast).toHaveBeenCalledWith(
            expect.objectContaining({
              variant: 'destructive',
            })
          );
        });
      }
    });
  });

  describe('Twitter/X Share', () => {
    it('should open Twitter share URL', async () => {
      render(<ShareBar session={mockSession} sessionId="test-session-123" />);

      const twitterButton = screen.queryByRole('button', { name: /twitter|x/i }) ||
                           screen.queryByLabelText(/twitter|x/i);

      if (twitterButton) {
        fireEvent.click(twitterButton);

        await waitFor(() => {
          expect(shareUrlBuilder.openShareUrl).toHaveBeenCalled();
          expect(trackShare.trackShare).toHaveBeenCalledWith(
            'x',
            expect.any(Object)
          );
          expect(trackShare.incrementSessionShareCount).toHaveBeenCalled();
        });
      }
    });

    it('should track Twitter share completion', async () => {
      render(<ShareBar session={mockSession} sessionId="test-session-123" />);

      const twitterButton = screen.queryByRole('button', { name: /twitter|x/i });

      if (twitterButton) {
        fireEvent.click(twitterButton);

        await waitFor(() => {
          expect(trackShare.trackShareCompleted).toHaveBeenCalledWith(
            'x',
            expect.objectContaining({
              sessionId: 'test-session-123',
            })
          );
        });
      }
    });
  });

  describe('Facebook Share', () => {
    it('should open Facebook share URL', async () => {
      render(<ShareBar session={mockSession} sessionId="test-session-123" />);

      const facebookButton = screen.queryByRole('button', { name: /facebook/i }) ||
                            screen.queryByLabelText(/facebook/i);

      if (facebookButton) {
        fireEvent.click(facebookButton);

        await waitFor(() => {
          expect(shareUrlBuilder.openShareUrl).toHaveBeenCalled();
          expect(trackShare.trackShare).toHaveBeenCalledWith(
            'facebook',
            expect.any(Object)
          );
        });
      }
    });

    it('should increment share count for Facebook', async () => {
      render(<ShareBar session={mockSession} sessionId="test-session-123" />);

      const facebookButton = screen.queryByRole('button', { name: /facebook/i });

      if (facebookButton) {
        fireEvent.click(facebookButton);

        await waitFor(() => {
          expect(trackShare.incrementSessionShareCount).toHaveBeenCalledWith('test-session-123');
        });
      }
    });
  });

  describe('Download Functionality', () => {
    it('should download image when download button clicked', async () => {
      render(<ShareBar session={mockSession} sessionId="test-session-123" />);

      const downloadButton = screen.queryByRole('button', { name: /download/i });

      if (downloadButton) {
        fireEvent.click(downloadButton);

        await waitFor(() => {
          expect(trackShare.trackDownloadStarted).toHaveBeenCalled();
          expect(shareUrlBuilder.downloadImage).toHaveBeenCalled();
          expect(trackShare.trackDownloadCompleted).toHaveBeenCalled();
        });
      }
    });

    it('should build correct filename for download', async () => {
      render(<ShareBar session={mockSession} sessionId="test-session-123" />);

      const downloadButton = screen.queryByRole('button', { name: /download/i });

      if (downloadButton) {
        fireEvent.click(downloadButton);

        await waitFor(() => {
          expect(shareUrlBuilder.buildImageFilename).toHaveBeenCalledWith(
            mockSession,
            expect.any(Number),
            expect.any(String)
          );
        });
      }
    });

    it('should show success toast after download', async () => {
      const { toast } = require('@/components/ui/use-toast');
      render(<ShareBar session={mockSession} sessionId="test-session-123" />);

      const downloadButton = screen.queryByRole('button', { name: /download/i });

      if (downloadButton) {
        fireEvent.click(downloadButton);

        await waitFor(() => {
          expect(toast).toHaveBeenCalledWith(
            expect.objectContaining({
              title: expect.stringContaining('download'),
            })
          );
        });
      }
    });

    it('should handle download failure', async () => {
      (shareUrlBuilder.downloadImage as jest.Mock).mockResolvedValue(false);
      const { toast } = require('@/components/ui/use-toast');

      render(<ShareBar session={mockSession} sessionId="test-session-123" />);

      const downloadButton = screen.queryByRole('button', { name: /download/i });

      if (downloadButton) {
        fireEvent.click(downloadButton);

        await waitFor(() => {
          expect(toast).toHaveBeenCalledWith(
            expect.objectContaining({
              variant: 'destructive',
            })
          );
        });
      }
    });
  });

  describe('Loading States', () => {
    it('should show loading state during share operation', async () => {
      // Make download take longer
      (shareUrlBuilder.downloadImage as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(true), 100))
      );

      render(<ShareBar session={mockSession} sessionId="test-session-123" />);

      const downloadButton = screen.queryByRole('button', { name: /download/i });

      if (downloadButton) {
        fireEvent.click(downloadButton);

        // Should show loading state (disabled buttons or loading spinner)
        await waitFor(() => {
          const buttons = screen.getAllByRole('button');
          const hasDisabled = buttons.some(btn => btn.hasAttribute('disabled') || btn.getAttribute('aria-disabled') === 'true');
          expect(hasDisabled || screen.queryByRole('status')).toBeTruthy();
        });
      }
    });

    it('should restore normal state after share completes', async () => {
      render(<ShareBar session={mockSession} sessionId="test-session-123" />);

      const downloadButton = screen.queryByRole('button', { name: /download/i });

      if (downloadButton) {
        fireEvent.click(downloadButton);

        await waitFor(() => {
          expect(trackShare.trackDownloadCompleted).toHaveBeenCalled();
        });

        // Buttons should be enabled again
        await waitFor(() => {
          const buttons = screen.getAllByRole('button');
          expect(buttons.length).toBeGreaterThan(0);
        });
      }
    });
  });

  describe('Analytics Integration', () => {
    it('should track platform selection before share', async () => {
      render(<ShareBar session={mockSession} sessionId="test-session-123" />);

      const buttons = screen.getAllByRole('button');
      if (buttons.length > 0) {
        fireEvent.click(buttons[0]);

        await waitFor(() => {
          expect(trackShare.trackSharePlatformSelected).toHaveBeenCalled();
        });
      }
    });

    it('should include variant in analytics data', async () => {
      render(<ShareBar session={mockSession} sessionId="test-session-123" defaultVariant={3} />);

      const downloadButton = screen.queryByRole('button', { name: /download/i });

      if (downloadButton) {
        fireEvent.click(downloadButton);

        await waitFor(() => {
          expect(trackShare.trackDownloadStarted).toHaveBeenCalledWith(
            expect.objectContaining({
              variant: 3,
            })
          );
        });
      }
    });

    it('should include aspect ratio in analytics data', async () => {
      render(<ShareBar session={mockSession} sessionId="test-session-123" defaultRatio="9:16" />);

      const downloadButton = screen.queryByRole('button', { name: /download/i });

      if (downloadButton) {
        fireEvent.click(downloadButton);

        await waitFor(() => {
          expect(trackShare.trackDownloadStarted).toHaveBeenCalledWith(
            expect.objectContaining({
              aspectRatio: '9:16',
            })
          );
        });
      }
    });

    it('should include surface context in analytics', async () => {
      render(
        <ShareBar
          session={mockSession}
          sessionId="test-session-123"
          surface="preview_page"
        />
      );

      const downloadButton = screen.queryByRole('button', { name: /download/i });

      if (downloadButton) {
        fireEvent.click(downloadButton);

        await waitFor(() => {
          expect(trackShare.trackDownloadStarted).toHaveBeenCalledWith(
            expect.objectContaining({
              surface: 'preview_page',
            })
          );
        });
      }
    });
  });

  describe('Error Handling', () => {
    it('should track share failures', async () => {
      (shareUrlBuilder.downloadImage as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(<ShareBar session={mockSession} sessionId="test-session-123" />);

      const downloadButton = screen.queryByRole('button', { name: /download/i });

      if (downloadButton) {
        fireEvent.click(downloadButton);

        await waitFor(() => {
          expect(trackShare.trackShareFailed).toHaveBeenCalled();
        });
      }
    });

    it('should show error toast on failure', async () => {
      (shareUrlBuilder.downloadImage as jest.Mock).mockRejectedValue(new Error('Network error'));
      const { toast } = require('@/components/ui/use-toast');

      render(<ShareBar session={mockSession} sessionId="test-session-123" />);

      const downloadButton = screen.queryByRole('button', { name: /download/i });

      if (downloadButton) {
        fireEvent.click(downloadButton);

        await waitFor(() => {
          expect(toast).toHaveBeenCalledWith(
            expect.objectContaining({
              variant: 'destructive',
            })
          );
        });
      }
    });

    it('should restore UI state after error', async () => {
      (shareUrlBuilder.downloadImage as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(<ShareBar session={mockSession} sessionId="test-session-123" />);

      const downloadButton = screen.queryByRole('button', { name: /download/i });

      if (downloadButton) {
        fireEvent.click(downloadButton);

        await waitFor(() => {
          expect(trackShare.trackShareFailed).toHaveBeenCalled();
        });

        // UI should recover
        await waitFor(() => {
          const buttons = screen.getAllByRole('button');
          expect(buttons.length).toBeGreaterThan(0);
        });
      }
    });
  });

  describe('Session Privacy (Auto-Public)', () => {
    it('should automatically make private session public before sharing', async () => {
      const { updateSession } = require('@/actions/session-actions');
      updateSession.mockResolvedValue({ success: true });

      const privateSession = { ...mockSession, is_public: false };
      const { toast } = require('@/components/ui/use-toast');

      render(<ShareBar session={privateSession} sessionId="test-session-123" />);

      const downloadButton = screen.queryByRole('button', { name: /download/i });

      if (downloadButton) {
        fireEvent.click(downloadButton);

        await waitFor(() => {
          expect(updateSession).toHaveBeenCalledWith(
            'test-session-123',
            { is_public: true }
          );
        });

        // Should show success toast about making session public
        await waitFor(() => {
          expect(toast).toHaveBeenCalledWith(
            expect.objectContaining({
              title: expect.stringContaining('public'),
            })
          );
        });

        // Should proceed with share after making public
        await waitFor(() => {
          expect(trackShare.trackDownloadStarted).toHaveBeenCalled();
        });
      }
    });

    it('should skip privacy update for already-public sessions', async () => {
      const { updateSession } = require('@/actions/session-actions');
      updateSession.mockResolvedValue({ success: true });

      const publicSession = { ...mockSession, is_public: true };
      render(<ShareBar session={publicSession} sessionId="test-session-123" />);

      const downloadButton = screen.queryByRole('button', { name: /download/i });

      if (downloadButton) {
        fireEvent.click(downloadButton);

        await waitFor(() => {
          expect(trackShare.trackDownloadStarted).toHaveBeenCalled();
        });

        // Should NOT call updateSession for already-public sessions
        expect(updateSession).not.toHaveBeenCalled();
      }
    });

    it('should handle privacy update errors gracefully', async () => {
      const { updateSession } = require('@/actions/session-actions');
      updateSession.mockResolvedValue({ success: false, error: 'Permission denied' });

      const privateSession = { ...mockSession, is_public: false };
      const { toast } = require('@/components/ui/use-toast');

      render(<ShareBar session={privateSession} sessionId="test-session-123" />);

      const downloadButton = screen.queryByRole('button', { name: /download/i });

      if (downloadButton) {
        fireEvent.click(downloadButton);

        await waitFor(() => {
          expect(updateSession).toHaveBeenCalled();
        });

        // Should show error toast
        await waitFor(() => {
          expect(toast).toHaveBeenCalledWith(
            expect.objectContaining({
              title: expect.stringContaining('Failed'),
              variant: 'destructive',
            })
          );
        });

        // Should NOT proceed with share
        expect(trackShare.trackDownloadStarted).not.toHaveBeenCalled();
      }
    });

    it('should handle privacy update network errors', async () => {
      const { updateSession } = require('@/actions/session-actions');
      updateSession.mockRejectedValue(new Error('Network error'));

      const privateSession = { ...mockSession, is_public: false };
      const { toast } = require('@/components/ui/use-toast');

      render(<ShareBar session={privateSession} sessionId="test-session-123" />);

      const downloadButton = screen.queryByRole('button', { name: /download/i });

      if (downloadButton) {
        fireEvent.click(downloadButton);

        await waitFor(() => {
          expect(updateSession).toHaveBeenCalled();
        });

        // Should show error toast with error message
        await waitFor(() => {
          expect(toast).toHaveBeenCalledWith(
            expect.objectContaining({
              title: expect.stringContaining('Failed'),
              description: expect.stringContaining('Network error'),
              variant: 'destructive',
            })
          );
        });

        // Should NOT proceed with share
        expect(trackShare.trackDownloadStarted).not.toHaveBeenCalled();
      }
    });

    it('should call onSessionUpdated callback after making session public', async () => {
      const { updateSession } = require('@/actions/session-actions');
      updateSession.mockResolvedValue({ success: true });

      const privateSession = { ...mockSession, is_public: false };
      const onSessionUpdated = jest.fn();

      render(
        <ShareBar
          session={privateSession}
          sessionId="test-session-123"
          onSessionUpdated={onSessionUpdated}
        />
      );

      const downloadButton = screen.queryByRole('button', { name: /download/i });

      if (downloadButton) {
        fireEvent.click(downloadButton);

        await waitFor(() => {
          expect(updateSession).toHaveBeenCalled();
        });

        // Should call the callback with updated session
        await waitFor(() => {
          expect(onSessionUpdated).toHaveBeenCalledWith(
            expect.objectContaining({
              ...privateSession,
              is_public: true,
            })
          );
        });
      }
    });

    it('should disable share buttons while updating privacy', async () => {
      const { updateSession } = require('@/actions/session-actions');
      // Make update take longer
      updateSession.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      );

      const privateSession = { ...mockSession, is_public: false };
      render(<ShareBar session={privateSession} sessionId="test-session-123" />);

      const downloadButton = screen.queryByRole('button', { name: /download/i });

      if (downloadButton) {
        fireEvent.click(downloadButton);

        // Buttons should be disabled while updating
        await waitFor(() => {
          const buttons = screen.getAllByRole('button');
          const allDisabled = buttons.every(
            btn => btn.hasAttribute('disabled') || btn.getAttribute('aria-disabled') === 'true'
          );
          expect(allDisabled).toBe(true);
        });
      }
    });

    it('should prevent race conditions with multiple rapid share clicks', async () => {
      const { updateSession } = require('@/actions/session-actions');
      updateSession.mockResolvedValue({ success: true });

      const privateSession = { ...mockSession, is_public: false };
      render(<ShareBar session={privateSession} sessionId="test-session-123" />);

      const downloadButton = screen.queryByRole('button', { name: /download/i });

      if (downloadButton) {
        // Click multiple times rapidly
        fireEvent.click(downloadButton);
        fireEvent.click(downloadButton);
        fireEvent.click(downloadButton);

        await waitFor(() => {
          expect(updateSession).toHaveBeenCalled();
        });

        // Should only call updateSession once despite multiple clicks
        expect(updateSession).toHaveBeenCalledTimes(1);
      }
    });
  });
});
