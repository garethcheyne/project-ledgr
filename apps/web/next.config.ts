import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// fileURLToPath, not URL.pathname: on Windows the latter yields "/C:/Apps/..."
// with a leading slash, which is not a valid path and fails to canonicalize.
const here = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(here, "../..");

const config: NextConfig = {
  reactStrictMode: true,
  // Standalone output copies only the files the server needs, so the runtime
  // container doesn't ship the whole monorepo's node_modules.
  output: "standalone",
  // Without this, tracing starts at apps/web and misses the workspace packages
  // hoisted to the root.
  outputFileTracingRoot: monorepoRoot,
  // Workspace packages ship TypeScript, so Next has to compile them itself.
  transpilePackages: ["@ledgr/contracts"],
};

export default config;
