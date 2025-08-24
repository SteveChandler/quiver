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

// Enhanced animation variants for viral growth motion
export const ENHANCED_ANIMATIONS = {
  // Social sharing animations
  shareCard: {
    initial: { scale: 1, rotateY: 0 },
    sharing: { 
      scale: 1.05, 
      rotateY: 5,
      transition: { duration: 0.4, ease: "easeOut" }
    },
    shared: { 
      scale: 1, 
      rotateY: 0,
      transition: { duration: 0.6, ease: "easeOut" }
    },
  },

  // Like button spring animation with heart burst
  likeButton: {
    idle: { scale: 1 },
    pressed: { scale: 0.95 },
    liked: { 
      scale: [1, 1.3, 1.1, 1],
      transition: { duration: 0.65, ease: "easeOut" }
    },
    heartBurst: {
      scale: [1, 1.4, 1.2, 1],
      rotate: [0, 15, -10, 0],
      transition: { duration: 0.65, ease: "easeOut" }
    }
  },

  // Social feed card interactions
  sessionCard: {
    hover: { 
      scale: 1.02,
      y: -2,
      transition: { duration: 0.2, ease: "easeOut" }
    },
    tap: { 
      scale: 0.98,
      transition: { duration: 0.1 }
    }
  },

  // Follow button microinteractions
  followButton: {
    idle: { scale: 1 },
    hover: { 
      scale: 1.05,
      transition: { duration: 0.2, ease: "easeOut" }
    },
    pressed: { scale: 0.95 },
    success: {
      scale: [1, 1.1, 1],
      transition: { duration: 0.4, ease: "easeOut" }
    }
  },

  // Success celebrations
  celebration: {
    pulse: {
      scale: [1, 1.1, 1],
      transition: { duration: 0.8, ease: "easeOut" }
    },
    bounce: {
      y: [0, -10, 0],
      transition: { duration: 0.8, ease: "easeOut" }
    }
  }
};

// Motion timing system for consistent durations
export const MOTION_TIMING = {
  micro: 0.1,      // Button press feedback
  quick: 0.2,      // Hover states, focus changes  
  standard: 0.4,   // Page transitions, modal open/close
  deliberate: 0.6, // Complex state changes
  slow: 0.8,       // Success celebrations
  bounce: 0.8,     // Playful interactions
} as const;

// Viral growth motion system
export const QUIVER_MOTION = {
  // Growth-critical animations
  viral: {
    shareSession: ENHANCED_ANIMATIONS.shareCard,
    likeButton: ENHANCED_ANIMATIONS.likeButton,
    followButton: ENHANCED_ANIMATIONS.followButton,
    successCelebration: ENHANCED_ANIMATIONS.celebration,
  },

  // Social feed interactions
  social: {
    sessionCard: ENHANCED_ANIMATIONS.sessionCard,
    feedStagger: (index: number) => ({
      initial: { opacity: 0, y: 20 },
      whileInView: { opacity: 1, y: 0 },
      viewport: { once: true },
      transition: { duration: 0.4, delay: index * 0.1 },
    }),
  },

  // System-wide settings
  settings: {
    respectReducedMotion: true,
    gpuAcceleration: true,
    hapticFeedback: true, // Mobile only
  },
} as const;

// Phase 2 Motion Specifications
export const PHASE2_ANIMATIONS = {
  // Session Creation Wizard Motion
  sessionWizard: {
    stepTransition: {
      initial: { x: 300, opacity: 0 },
      animate: { x: 0, opacity: 1 },
      exit: { x: -300, opacity: 0 },
      transition: { type: "spring", damping: 20, stiffness: 300 }
    },
    progressBar: {
      initial: { scaleX: 0 },
      animate: { scaleX: 1 },
      transition: { duration: 0.8, ease: "easeOut" }
    },
    fieldFocus: {
      initial: { scale: 1, borderColor: "transparent" },
      focus: { scale: 1.02, borderColor: "rgb(59 130 246)" },
      transition: { duration: 0.2, ease: "easeOut" }
    },
    autoSave: {
      initial: { scale: 1, opacity: 0 },
      saving: { scale: 1.05, opacity: 0.8 },
      saved: { scale: 1, opacity: 1 },
      transition: { duration: 0.3, ease: "easeOut" }
    }
  },

  // Beach Discovery & Map Motion
  mapDiscovery: {
    beachMarkerHover: {
      initial: { scale: 1 },
      hover: { scale: 1.2 },
      transition: { duration: 0.3, ease: "easeOut" }
    },
    beachMarkerSelected: {
      initial: { scale: 1, boxShadow: "0 0 0 rgba(0,119,182,0)" },
      selected: { 
        scale: 1.4, 
        boxShadow: "0 0 20px rgba(0,119,182,0.5)",
        transition: { duration: 0.4, ease: "easeOut" }
      }
    },
    forecastPopup: {
      initial: { y: 20, opacity: 0, scale: 0.9 },
      animate: { y: 0, opacity: 1, scale: 1 },
      exit: { y: -20, opacity: 0, scale: 0.9 },
      transition: { type: "spring", bounce: 0.3, duration: 0.4 }
    },
    locationSelection: {
      initial: { scale: 1, rotate: 0 },
      selecting: { scale: 1.1, rotate: 5 },
      selected: { scale: 1.05, rotate: 0 },
      transition: { duration: 0.3, ease: "easeOut" }
    },
    searchResults: {
      initial: { y: 10, opacity: 0 },
      animate: { y: 0, opacity: 1 },
      transition: { duration: 0.2, ease: "easeOut" }
    }
  },

  // Form Validation & Feedback Motion
  formValidation: {
    error: {
      initial: { x: 0, borderColor: "transparent" },
      error: { 
        x: [-10, 10, -10, 10, 0], 
        borderColor: "rgb(239 68 68)",
        transition: { duration: 0.4, ease: "easeInOut" }
      }
    },
    success: {
      initial: { scale: 1, borderColor: "transparent" },
      success: { 
        scale: [1, 1.02, 1], 
        borderColor: "rgb(34 197 94)",
        transition: { duration: 0.3, ease: "easeOut" }
      }
    },
    focus: {
      initial: { scale: 1, borderColor: "transparent" },
      focus: { 
        scale: 1.01, 
        borderColor: "rgb(59 130 246)",
        transition: { duration: 0.2, ease: "easeOut" }
      }
    },
    completion: {
      initial: { scale: 1, opacity: 0 },
      animate: { scale: [1, 1.1, 1], opacity: 1 },
      transition: { duration: 0.5, ease: "bounce" }
    }
  },

  // Enhanced Timing System for Phase 2
  timing: {
    micro: 0.1,      // Button press feedback
    quick: 0.2,      // Hover states, focus changes
    standard: 0.4,   // Page transitions, modal open/close
    deliberate: 0.6, // Complex state changes
    slow: 0.8,       // Success celebrations
    bounce: 0.8,     // Playful interactions
    wizard: 0.3,     // Step transitions
    validation: 0.4  // Form feedback
  }
};

// Add Phase 2 specific easing functions
export const PHASE2_EASING = {
  spring: [0.4, 0.0, 0.2, 1], // Material Design
  bounce: [0.68, -0.55, 0.265, 1.55], // Bouncy
  smooth: [0.25, 0.46, 0.45, 0.94], // Smooth
  quick: [0.4, 0.0, 1, 1], // Quick out
  slow: [0.0, 0.0, 0.2, 1] // Slow in
};

// Export everything together
export const ALL_MOTION = {
  ...ANIMATION_VARIANTS,
  ...ENHANCED_ANIMATIONS,
  ...PHASE2_ANIMATIONS,
  timing: { ...MOTION_TIMING, ...PHASE2_ANIMATIONS.timing },
  easing: PHASE2_EASING
};
