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
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Two faces: Nunito for headings (the display/heading tokens, wired in
      // globals.css), Nunito Sans for body + buttons (the default `font-sans`).
      // The CSS variables are set by next/font in app/layout.tsx.
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      // The four-style type ramp. Size / line-height / weight are baked in,
      // so `text-heading` alone yields the full style. (Section 6.2)
      fontSize: {
        display: ["24px", { lineHeight: "32px", fontWeight: "600" }],
        heading: ["18px", { lineHeight: "24px", fontWeight: "600" }],
        body: ["16px", { lineHeight: "24px", fontWeight: "400" }],
        caption: ["13px", { lineHeight: "16px", fontWeight: "500" }],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        // Status tokens — these do real work in the UI. (Section 6.2)
        urgent: {
          DEFAULT: "var(--urgent)",
          foreground: "var(--urgent-foreground)",
        },
        success: {
          DEFAULT: "var(--success)",
          foreground: "var(--success-foreground)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          foreground: "var(--warning-foreground)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          foreground: "var(--danger-foreground)",
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
