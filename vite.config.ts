/// <reference types="vitest" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import { thirdPartyLicensePlugin } from "./scripts/thirdPartyLicenses";

interface PackageJson {
  version?: string;
}

function loadAppVersion(): string {
  const raw = readFileSync(resolve(process.cwd(), "package.json"), "utf-8");
  const pkg = JSON.parse(raw) as PackageJson;
  const version = typeof pkg.version === "string" ? pkg.version : "0.0.0";
  return `Ver.${version}`;
}

const APP_VERSION = loadAppVersion();

export default defineConfig({
  base: "./",
  plugins: [thirdPartyLicensePlugin(process.cwd())],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION)
  },
  build: {
    // Three.js is isolated from the application chunk; its tree-shaken renderer bundle is
    // intentionally larger than Vite's generic 500 kB warning threshold.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/three/")) return "three";
          if (id.includes("/node_modules/mathjs/") || id.includes("/node_modules/ml-matrix/")) {
            return "analysis";
          }
          return undefined;
        }
      }
    }
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node"
  }
});
