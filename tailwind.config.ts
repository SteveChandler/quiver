import type { Config } from "tailwindcss";

// Tailwind's plain `var(--token)` form cannot generate `/opacity` utilities.
// color-mix keeps the zine CSS variable as the source of truth while preserving
// modifiers such as `bg-ink/40`.
const zineColor = (variable: string, fallback: string): string =>
  `color-mix(in srgb, var(${variable}, ${fallback}) calc(<alpha-value> * 100%), transparent)`;

const config: Config = {
  darkMode: ["class", ".theme-retro-dark"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        'xs': '475px',  // Extra small devices
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        heading: ["var(--font-heading)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        handwritten: ["var(--font-handwritten)", "cursive"],
      },
      colors: {
        // ocean-blue is the primary interactive CTA token used across buttons.
        // Updated to #9E5010 (27° 82% 34%) — WCAG AA compliant: 5.82:1 on white.
        // White text on this background also passes at 5.82:1.
        // Previous value #F78E42 was 2.36:1 (WCAG AA fail for normal text).
        "ocean-blue": "#9E5010",
        // Decorative brand orange: use for non-interactive accents, badges, glows,
        // loading spinners, and text on dark navy (#252D6B) backgrounds (5.34:1).
        // NEVER use as button background with white text — 2.36:1 fails WCAG AA.
        "ocean-blue-decorative": "#F78E42",
        "sunset-orange": "#FDB84B",
        "sandy-beige": "#2D357D",
        "dark-grey": "#333333",
        // Zine palette. Ink on paper is 16.06:1; keep these variable-backed so
        // palette changes in app/styles/zine.css propagate to Tailwind classes.
        ink: zineColor("--ink", "#11100D"),
        paper: zineColor("--paper", "#F4EBD8"),
        "paper-shadow": zineColor("--paper-shadow", "#E5D4B3"),
        "paper-deep": zineColor("--paper-deep", "#D9C49C"),
        "stamp-red": zineColor("--stamp-red", "#B91C1C"),
        // Stamp blue on paper is 9.44:1.
        "stamp-blue": zineColor("--stamp-blue", "#0B3A75"),
        tape: zineColor("--tape", "#C8A46B"),
        "tape-light": zineColor("--tape-light", "#DCC18B"),
        "warning-black": zineColor("--warning-black", "#0A0A08"),
        "hi-yellow": zineColor("--hi-yellow", "#F2C94C"),
        ocean: zineColor("--ocean", "#7FA7B8"),
        "q-twilight": zineColor("--q-twilight", "#252D6B"),
        "q-bg-0": zineColor("--q-bg-0", "#0D1020"),
        "q-bg-1": zineColor("--q-bg-1", "#1A1535"),
        // Charming orange is 2.36:1 with white; pair it with ink text.
        "q-orange": zineColor("--q-orange", "#F78E42"),
        "q-cream": zineColor("--q-cream", "#F5EEDC"),
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          orange: "#FDB84B", // Secondary accent — warm highlights, badges
        },
        header: {
          start: "#1E2558", // Dark gradient start (dark Deep Twilight)
          end: "#252D6B", // Dark gradient end (Deep Twilight)
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      zIndex: {
        'overlay': '60',
        'toast': '70',
        'auth-wall': '80',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      scale: {
        "102": "1.02",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        // Landing page animations to replace framer-motion
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        oceanSwell: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        heartbeat: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.15)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(34, 197, 94, 0.4)" },
          "50%": { boxShadow: "0 0 20px 10px rgba(34, 197, 94, 0)" },
        },
        pulseGlowBlue: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(59, 130, 246, 0.4)" },
          "50%": { boxShadow: "0 0 15px 8px rgba(59, 130, 246, 0)" },
        },
        waveFlow: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        kenBurnsZoomIn: {
          "0%": { transform: "scale(1)" },
          "100%": { transform: "scale(1.15)" },
        },
        kenBurnsZoomOut: {
          "0%": { transform: "scale(1.15)" },
          "100%": { transform: "scale(1)" },
        },
        kenBurnsSlowPan: {
          "0%": { transform: "scale(1.1) translateX(-2%)" },
          "100%": { transform: "scale(1.1) translateX(2%)" },
        },
        // FormGrid onboarding keyframes
        formgridKenBurns: {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.05)" },
          "100%": { transform: "scale(1)" },
        },
        formgridCtaSweep: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        formgridFloat: {
          "0%, 100%": { transform: "translateY(0) translateX(0)" },
          "25%": { transform: "translateY(-20px) translateX(10px)" },
          "50%": { transform: "translateY(-10px) translateX(-15px)" },
          "75%": { transform: "translateY(-25px) translateX(5px)" },
        },
        formgridStickerSlap: {
          "0%": { transform: "scale(1.5) rotate(-5deg)", opacity: "0" },
          "60%": { transform: "scale(0.95) rotate(1deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
        },
        waveParticleDrift: {
          "0%": { transform: "translateY(100%) scale(0.5)", opacity: "0" },
          "20%": { opacity: "0.6" },
          "80%": { opacity: "0.3" },
          "100%": { transform: "translateY(-20%) scale(1)", opacity: "0" },
        },
        // Container personality system keyframes
        containerWaveScroll: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-200px)" },
        },
        containerTopoDrift: {
          "0%": { transform: "translate(0, 0) rotate(0deg)" },
          "33%": { transform: "translate(15px, -10px) rotate(1deg)" },
          "66%": { transform: "translate(-10px, 12px) rotate(-0.5deg)" },
          "100%": { transform: "translate(0, 0) rotate(0deg)" },
        },
        containerGradientShift: {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        containerFadeSlideUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        // Landing page animations
        "fade-in": "fadeIn 0.8s ease-out",
        "fade-in-fast": "fadeIn 0.4s ease-out",
        "fade-in-up": "fadeInUp 0.8s ease-out",
        "fade-in-up-fast": "fadeInUp 0.6s ease-out",
        shimmer: "shimmer 1.5s infinite linear",
        "ocean-swell": "oceanSwell 2s ease-in-out infinite",
        heartbeat: "heartbeat 1.2s ease-in-out infinite",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "pulse-glow-blue": "pulseGlowBlue 2s ease-in-out infinite",
        "wave-flow": "waveFlow 8s linear infinite",
        "ticker-scroll": "waveFlow 30s linear infinite",
        "ken-burns-zoom-in": "kenBurnsZoomIn 10s ease-out forwards",
        "ken-burns-zoom-out": "kenBurnsZoomOut 10s ease-out forwards",
        "ken-burns-slow-pan": "kenBurnsSlowPan 10s ease-out forwards",
        // FormGrid onboarding animations
        "formgrid-ken-burns": "formgridKenBurns 20s ease-in-out infinite alternate",
        "formgrid-cta-sweep": "formgridCtaSweep 3s ease-in-out infinite",
        "formgrid-sticker-slap": "formgridStickerSlap 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        // Container personality system animations
        "container-wave-scroll": "containerWaveScroll 12s linear infinite",
        "container-topo-drift": "containerTopoDrift 24s ease-in-out infinite",
        "container-gradient-shift": "containerGradientShift 8s ease-in-out infinite",
        "container-fade-slide-up": "containerFadeSlideUp 0.5s ease-out both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
