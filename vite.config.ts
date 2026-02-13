/// <reference types="vitest" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

interface PackageJson {
  version?: string;
}

function loadAppVersion(): string {
  const raw = readFileSync(resolve(process.cwd(), "package.json"), "utf-8");
  const pkg = JSON.parse(raw) as PackageJson;
  const version = typeof pkg.version === "string" ? pkg.version : "0.0.0";
  return `Ver${version}`;
}

const APP_VERSION = loadAppVersion();

export default defineConfig({
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION)
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node"
  }
});
