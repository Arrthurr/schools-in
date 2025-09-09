/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        // Custom breakpoints for PWA-first design
        xs: "475px", // Small mobile devices
        sm: "640px", // Mobile devices
        md: "768px", // Tablets
        lg: "1024px", // Small laptops
        xl: "1280px", // Desktops
        "2xl": "1536px", // Large desktops
        // Custom utility breakpoints
        mobile: "640px", // Up to mobile
        tablet: "768px", // Up to tablet
        desktop: "1024px", // Desktop and up
        // Touch-first responsive utilities
        touch: { raw: "(hover: none) and (pointer: coarse)" },
        hover: { raw: "(hover: hover) and (pointer: fine)" },
      },
      spacing: {
        // Touch-friendly spacing for mobile interfaces
        "touch-sm": "44px", // Minimum touch target (iOS guidelines)
        touch: "48px", // Recommended touch target
        "touch-lg": "56px", // Large touch target
        "safe-top": "env(safe-area-inset-top)",
        "safe-bottom": "env(safe-area-inset-bottom)",
        "safe-left": "env(safe-area-inset-left)",
        "safe-right": "env(safe-area-inset-right)",
      },
      colors: {
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#154690",
          700: "#0f3a7a",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554",
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        // Brand-specific color scheme
        brand: {
          primary: "#154690",
          "primary-dark": "#0f3a7a",
          "primary-light": "#eff6ff",
          "primary-50": "#eff6ff",
          "primary-100": "#dbeafe",
          "primary-200": "#bfdbfe",
          "primary-600": "#154690",
          "primary-700": "#0f3a7a",
        },
        success: "#10b981",
        warning: "#f59e0b",
        error: "#ef4444",
        info: "#06b6d4",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        "card-foreground": "hsl(var(--card-foreground))",
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        "popover-foreground": "hsl(var(--popover-foreground))",
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        "muted-foreground": "hsl(var(--muted-foreground))",
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        "accent-foreground": "hsl(var(--accent-foreground))",
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        "destructive-foreground": "hsl(var(--destructive-foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
