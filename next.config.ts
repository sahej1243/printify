import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDF.js dynamically loads its worker at runtime. Keep the package external
  // so Next's server bundler does not rewrite that worker import to a missing chunk.
  serverExternalPackages: ["pdfjs-dist"],
  // The dynamic import is not detected by Vercel's output tracing automatically.
  outputFileTracingIncludes: {
    "/api/orders": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
