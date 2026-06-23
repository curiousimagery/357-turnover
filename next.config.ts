import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components (PPR) is intentionally OFF. Pages that read the user's
  // session from cookies (home, settings, the shared header) are dynamic by
  // nature; conventional App Router rendering handles that automatically and
  // keeps the code simple — no <Suspense> boundary required around every
  // cookie read. See DECISIONS.md.
};

export default nextConfig;
