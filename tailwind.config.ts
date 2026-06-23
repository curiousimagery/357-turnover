import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

/**
 * Design tokens live here and in app/globals.css (the CSS variables).
 * This is the styling contract. See DESIGN_TOKENS.md.
 *
 * Rules:
 * - Only the four type tokens (display/heading/body/caption) in feature code.
 * - Only the semantic + status color tokens. Never a raw palette color.
 * - Spacing follows the base-8 scale (Tailwind's defaults are a superset).
 * - No arbitrary values. Lint enforces this (see eslint-rules/design-tokens.mjs).
 */
export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // The four-style type ramp. Size / line-height / weight are baked in,
      // so `text-heading` alone yields the full style. (Section 6.2)
      fontSize: {
        display: ["24px", { lineHeight: "32px", fontWeight: "600" }],
        heading: ["18px", { lineHeight: "24px", fontWeight: "600" }],
        body: ["16px", { lineHeight: "24px", fontWeight: "400" }],
        caption: ["13px", { lineHeight: "16px", fontWeight: "500" }],
      },
      colors: {
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
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // Status tokens — these do real work in the UI. (Section 6.2)
        urgent: {
          DEFAULT: "hsl(var(--urgent))",
          foreground: "hsl(var(--urgent-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        danger: {
          DEFAULT: "hsl(var(--danger))",
          foreground: "hsl(var(--danger-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      // One subtle card elevation token. Resist proliferation. (Section 6.2)
      boxShadow: {
        card: "0 1px 2px 0 hsl(220 22% 12% / 0.06), 0 1px 3px 0 hsl(220 22% 12% / 0.05)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
