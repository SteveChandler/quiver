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

  // Beach Discovery & Map Motion - Enhanced for Priority 1
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

// Session Wizard Motion Specifications
export const WIZARD_MOTION = {
  step: {
    initial: { x: 40, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -40, opacity: 0 },
    transition: { type: "spring", damping: 22, stiffness: 260 }
  },
  progress: {
    initial: { scaleX: 0 },
    animate: { scaleX: 1 },
    transition: { duration: 0.6, ease: "easeOut" }
  },
  focus: {
    rest:  { scale: 1, boxShadow: "0 0 0 0 rgba(0,119,182,0)" },
    focus: { scale: 1.01, boxShadow: "0 0 0 4px rgba(0,119,182,0.25)" },
    valid: { scale: 1.005, boxShadow: "0 0 0 4px rgba(34,197,94,0.25)" },
    error: {
      x: [0, -6, 6, -6, 6, 0] as number[],
      boxShadow: "0 0 0 4px rgba(239,68,68,0.25)",
    },
    transition: { duration: 0.24 }
  },
  hint: {
    initial: { y: 8, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit:    { y: 8, opacity: 0 },
    transition: { duration: 0.22 }
  },
  autosave: {
    initial: { scale: 1, opacity: 0 },
    saving: { 
      scale: 1.02, 
      opacity: 0.8,
      transition: { duration: 0.18, ease: "easeOut" }
    },
    saved: { 
      scale: 1, 
      opacity: 1,
      transition: { duration: 0.28, ease: "easeOut" }
    }
  },
  celebration: {
    initial: { scale: 1, rotate: 0 },
    animate: { 
      scale: [1, 1.1, 1.05, 1], 
      rotate: [0, 5, -3, 0],
      transition: { 
        duration: 0.8, 
        ease: "easeOut",
        times: [0, 0.3, 0.7, 1]
      }
    }
  }
} as const;

// MAP_MOTION - Priority 1: Geographic Expansion & Beach Discovery
// Addresses 85% San Diego isolation problem with engaging map interactions
export const MAP_MOTION = {
  beachMarker: {
    initial: { scale: 1, boxShadow: "0 0 0 rgba(0,119,182,0)" },
    hover: { 
      scale: 1.2,
      boxShadow: "0 0 15px rgba(0,119,182,0.4)",
      transition: { duration: 0.3, ease: "easeOut" }
    },
    selected: { 
      scale: 1.4, 
      boxShadow: "0 0 20px rgba(0,119,182,0.6)",
      transition: { duration: 0.4, type: "spring", bounce: 0.3 }
    },
    pulse: {
      scale: [1, 1.1, 1],
      boxShadow: [
        "0 0 0 rgba(0,119,182,0)",
        "0 0 20px rgba(0,119,182,0.4)",
        "0 0 0 rgba(0,119,182,0)"
      ],
      transition: { duration: 2, repeat: Infinity, ease: "easeInOut" }
    }
  },
  forecastPopup: {
    initial: { y: 20, opacity: 0, scale: 0.9 },
    animate: { y: 0, opacity: 1, scale: 1 },
    exit: { y: -20, opacity: 0, scale: 0.9 },
    transition: { type: "spring", bounce: 0.3, duration: 0.4 }
  },
  locationSearch: {
    initial: { y: 10, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    transition: { duration: 0.2, ease: "easeOut" }
  },
  searchResults: {
    stagger: (index: number) => ({
      initial: { y: 15, opacity: 0 },
      animate: { y: 0, opacity: 1 },
      transition: { duration: 0.3, delay: index * 0.05, ease: "easeOut" }
    })
  },
  quickAction: {
    rest: { scale: 1, y: 0 },
    hover: { 
      scale: 1.05, 
      y: -2,
      transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }
    },
    pressed: { 
      scale: 0.95,
      transition: { duration: 0.1 }
    },
    success: {
      scale: [1, 1.1, 1],
      y: [0, -5, 0],
      transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }
    }
  },
  mapZoom: {
    initial: { scale: 1, opacity: 1 },
    zooming: { 
      scale: 1.1, 
      opacity: 0.9,
      transition: { duration: 0.3, ease: "easeOut" }
    },
    zoomed: { 
      scale: 1, 
      opacity: 1,
      transition: { duration: 0.4, ease: "easeOut" }
    }
  },
  beachDiscovery: {
    newBeach: {
      initial: { scale: 0.8, opacity: 0, rotate: -10 },
      animate: { scale: 1, opacity: 1, rotate: 0 },
      transition: { type: "spring", bounce: 0.4, duration: 0.6 }
    },
    celebration: {
      scale: [1, 1.3, 1.1, 1],
      rotate: [0, 20, -15, 0],
      transition: { duration: 0.8, ease: "easeOut" }
    }
  }
};

// Home Header Polish - Energetic/Playful Interactions (Duolingo/AllTrails inspired)
export const HOME_HEADER_MOTION = {
  // Spring config for bouncy Duolingo-like feel
  spring: {
    stiffness: 400,
    damping: 17,
  },
  springGentle: {
    stiffness: 300,
    damping: 25,
  },

  // Time Slot Selector
  timeSlot: {
    spring: { stiffness: 400, damping: 17 },
    tap: { scale: 0.97 },
    selected: {
      scale: 1.03,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 17,
      },
    },
    glow: {
      boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.3)",
    },
  },

  // Primary Action Buttons
  button: {
    tap: { scale: 0.96, y: 1 },
    hover: { scale: 1.02 },
    spring: { type: "spring", stiffness: 400, damping: 17 },
    iconHover: {
      plus: { rotate: 90, transition: { duration: 0.2 } },
      calendar: { y: -2, transition: { duration: 0.15 } },
    },
  },

  // Hero Recommendation
  hero: {
    scoreGlow: {
      textShadow: [
        "0 0 8px rgba(251, 146, 60, 0.4)",
        "0 0 16px rgba(251, 146, 60, 0.6)",
        "0 0 8px rgba(251, 146, 60, 0.4)",
      ],
      transition: {
        duration: 2,
        repeat: 3, // Limited cycles to conserve battery on mobile
        ease: "easeInOut",
      },
    },
    beachName: {
      hover: { scale: 1.01 },
      tap: { scale: 0.99 },
      underline: {
        initial: { scaleX: 0, originX: 0 },
        hover: { scaleX: 1 },
        transition: { duration: 0.2 },
      },
    },
    badge: {
      initial: { opacity: 0, y: 8 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.15 },
    },
    badgeStagger: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },

  // Entry animations
  entry: {
    staggerChildren: 0.08,
    delayChildren: 0,
  },
  entryItem: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.25, ease: "easeOut" },
  },

  // Skeleton shimmer
  shimmer: {
    backgroundSize: "200% 100%",
    backgroundPosition: ["-200% 0", "200% 0"],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "linear",
    },
  },
} as const;
