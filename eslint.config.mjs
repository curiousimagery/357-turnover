import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import designTokens from "./eslint-rules/design-tokens.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // The design-token contract applies to our code, not the vendored
    // shadcn primitives in components/ui (Section 7.2; see DECISIONS.md).
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    ignores: ["components/ui/**"],
    plugins: { "design-tokens": designTokens },
    rules: {
      "design-tokens/class-tokens": "error",
      "design-tokens/spacing-scale": "warn",
    },
  },
];

export default eslintConfig;
