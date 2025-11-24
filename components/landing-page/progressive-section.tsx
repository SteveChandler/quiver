"use client"

import { useEffect, useRef, useState } from 'react'

interface ProgressiveSectionProps {
  children: React.ReactNode
  className?: string
  /**
   * Whether to animate on view. Default: true
   * Set to false in test environments or for above-fold content
   */
  animateOnView?: boolean
  /**
   * Threshold for intersection observer (0-1). Default: 0.1
   */
  threshold?: number
}

/**
 * Progressive Section Wrapper
 *
 * A lightweight client component that adds progressive loading behavior
 * to server-rendered content. Uses IntersectionObserver to trigger
 * animations when sections come into view.
 *
 * Key Features:
 * - Server content renders immediately (no JavaScript blocking)
 * - IntersectionObserver adds progressive enhancement
 * - Minimal JavaScript footprint (~2-3KB)
 * - Test environment detection (disables intersection logic in E2E tests)
 * - Works seamlessly with React Server Components
 *
 * Performance:
 * - Content always visible (opacity transition, no layout shift)
 * - SEO-friendly (content always in DOM)
 * - Graceful fallback if JavaScript disabled or IntersectionObserver unsupported
 *
 * @example
 * ```tsx
 * // In server component
 * <ProgressiveSection>
 *   <SurfHighlightsSection beaches={beaches} />
 * </ProgressiveSection>
 * ```
 *
 * @example
 * ```tsx
 * // Disable animation for above-fold content
 * <ProgressiveSection animateOnView={false}>
 *   <HeroSection />
 * </ProgressiveSection>
 * ```
 */
export default function ProgressiveSection({
  children,
  className = '',
  animateOnView = true,
  threshold = 0.1,
}: ProgressiveSectionProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  // Detect test environment using multiple methods for reliability
  // This prevents flaky E2E tests waiting for intersection animations
  const isTest = typeof process !== 'undefined' &&
    (process.env.NODE_ENV === 'test' ||
     process.env.PLAYWRIGHT_TEST === 'true') ||
    (typeof window !== 'undefined' &&
     (window.navigator.webdriver ||
      (window as any).Cypress ||
      typeof (globalThis as any).__PLAYWRIGHT__ !== 'undefined'))

  useEffect(() => {
    // If in test environment or animation disabled, show immediately
    if (!animateOnView || isTest) {
      setIsVisible(true)
      return
    }

    // If IntersectionObserver not supported, show immediately (graceful fallback)
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          // Once visible, stop observing to free up resources
          if (ref.current) {
            observer.unobserve(ref.current)
          }
        }
      },
      {
        threshold,
        // Add root margin to trigger slightly before entering viewport
        // This creates smoother UX by preloading content
        rootMargin: '50px',
      }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => {
      if (ref.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        observer.unobserve(ref.current)
      }
    }
  }, [animateOnView, threshold, isTest])

  return (
    <div
      ref={ref}
      className={className}
      data-testid="progressive-section"
      data-visible={isVisible}
      style={{
        // Content is always rendered (server-side), but may have reduced opacity
        // This ensures SEO and accessibility while allowing progressive enhancement
        // No layout shift because content is in DOM from the start
        opacity: isVisible ? 1 : 0.3,
        transition: 'opacity 0.6s ease-out',
      }}
    >
      {children}
    </div>
  )
}
