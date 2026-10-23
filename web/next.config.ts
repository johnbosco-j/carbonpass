import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The extraction route reads cached outputs and sample PDFs from disk at runtime.
  outputFileTracingIncludes: {
    "/api/extract": ["./data/extractions/**", "./public/samples/**"],
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
