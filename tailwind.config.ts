import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", ".theme-retro-dark"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/onborda/dist/**/*.{js,ts,jsx,tsx}", // Onborda styles
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
      },
      colors: {
        "ocean-blue": "#F78E42",
        "sunset-orange": "#FDB84B",
        "sandy-beige": "#2D357D",
        "dark-grey": "#333333",
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
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
