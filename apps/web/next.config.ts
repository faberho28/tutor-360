import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A self-contained server for the Docker image: only the files it needs.
  output: "standalone",
  // The workspace root, so the trace includes the hoisted pnpm packages.
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
};

export default nextConfig;
