// Standard animation variants for consistent motion throughout the app
export const ANIMATION_VARIANTS = {
  // Fade up from bottom
  fadeUpSlow: {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8 },
  },

  // Fade up with delay
  fadeUpWithDelay: (delay: number = 0) => ({
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, delay },
  }),

  // Staggered animation for lists
  staggerItem: (index: number, duration: number = 0.6) => ({
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration, delay: index * 0.1 },
  }),

  // Hero text animation
  heroText: (delay: number = 0) => ({
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 1, delay },
  }),

  // Standard view animation
  fadeInView: {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.8 },
  },
};

// Standard durations
export const DURATIONS = {
  fast: 0.3,
  standard: 0.6,
  slow: 0.8,
  hero: 1,
} as const;
