/**
 * Review Prompt Hook
 *
 * Manages the post-session review prompt flow including:
 * - Dialog open/close state
 * - Auto-dismiss timeout handling
 * - Review submission tracking
 * - Skip/timeout analytics
 *
 * @see components/beach/beach-review-form.tsx
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { track } from '@/lib/analytics';
import { toast } from '@/hooks/use-toast';

export interface ReviewPromptData {
  beachId: string;
  beachName: string;
  sessionId?: string | null;
}

interface UseReviewPromptOptions {
  /** Auto-dismiss timeout in milliseconds (default: 60000) */
  autoDismissTimeout?: number;
  /** Callback when review is submitted successfully */
  onReviewSubmit?: () => void;
  /** Callback when prompt is skipped or dismissed */
  onDismiss?: () => void;
}

export function useReviewPrompt(options: UseReviewPromptOptions = {}) {
  const {
    autoDismissTimeout = 60000, // 60 seconds default
    onReviewSubmit,
    onDismiss,
  } = options;

  const [isOpen, setIsOpen] = useState(false);
  const [reviewData, setReviewData] = useState<ReviewPromptData | null>(null);
  const resolvedRef = useRef(false);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, []);

  /**
   * Handle skip action (user-initiated or timeout)
   */
  const handleSkip = useCallback((reason: 'skip' | 'timeout') => {
    if (resolvedRef.current) return;

    resolvedRef.current = true;
    setIsOpen(false);

    // Clear timeout
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }

    // Track skip event
    try {
      track('review_prompt_skipped', {
        session_id: reviewData?.sessionId,
        beach_id: reviewData?.beachId,
        reason,
      });
    } catch (error) {
      console.error('Failed to track review skip:', error);
    }

    // Invoke dismiss callback
    onDismiss?.();
  }, [reviewData, onDismiss]);

  /**
   * Handle successful review submission
   */
  const handleSuccess = useCallback(() => {
    if (resolvedRef.current) return;

    resolvedRef.current = true;
    setIsOpen(false);

    // Clear timeout
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }

    toast({
      title: 'Review Posted',
      description: 'Thanks for leaving a review!',
    });

    // Invoke success callback
    onReviewSubmit?.();
  }, [onReviewSubmit]);

  /**
   * Show the review prompt for a specific beach
   */
  const showPrompt = useCallback((data: ReviewPromptData) => {
    // Reset state for new prompt
    resolvedRef.current = false;
    setReviewData(data);
    setIsOpen(true);

    // Set up auto-dismiss timeout
    timeoutIdRef.current = setTimeout(() => {
      if (!resolvedRef.current) {
        handleSkip('timeout');
      }
    }, autoDismissTimeout);
  }, [autoDismissTimeout, handleSkip]);

  /**
   * Manually dismiss the prompt (e.g., dialog close button)
   */
  const dismiss = useCallback(() => {
    handleSkip('skip');
  }, [handleSkip]);

  return {
    isOpen,
    reviewData,
    showPrompt,
    handleSuccess,
    handleSkip,
    dismiss,
  };
}
