import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  collectProductionPackageLicenses,
  createBundleManifest,
  createThirdPartyLicenseDocument,
  packageDirectoryFromModuleId
} from "../scripts/thirdPartyLicenses";

const EXPECTED_PRODUCTION_PACKAGES = [
  "@babel/runtime@7.28.6",
  "@nodable/entities@3.0.0",
  "anynum@1.0.1",
  "complex.js@2.4.3",
  "decimal.js@10.6.0",
  "escape-latex@1.2.0",
  "fast-xml-builder@1.3.0",
  "fast-xml-parser@5.10.1",
  "fraction.js@5.3.4",
  "is-any-array@2.0.1",
  "is-unsafe@2.0.0",
  "javascript-natural-sort@0.7.1",
  "mathjs@15.2.0",
  "ml-array-max@1.2.4",
  "ml-array-min@1.2.3",
  "ml-array-rescale@1.3.7",
  "ml-matrix@6.12.1",
  "path-expression-matcher@1.6.2",
  "seedrandom@3.0.5",
  "strnum@2.4.1",
  "three@0.185.1",
  "tiny-emitter@2.1.0",
  "typed-function@4.2.2",
  "xml-naming@0.3.0"
];

describe("third-party production license inventory", () => {
  it("covers the complete installed production dependency closure", () => {
    const packages = collectProductionPackageLicenses();

    expect(packages.map((pkg) => pkg.key)).toEqual(EXPECTED_PRODUCTION_PACKAGES);
    for (const pkg of packages) {
      expect(pkg.license).not.toBe("");
      expect(pkg.source).not.toBe("(not declared)");
      expect(pkg.licenseFiles.length).toBeGreaterThan(0);
      expect(pkg.licenseFiles.every((file) => file.text.length > 500)).toBe(true);
    }
  });

  it("generates a self-contained document with Apache license and NOTICE text", () => {
    const packages = collectProductionPackageLicenses();
    const document = createThirdPartyLicenseDocument(packages);
    const mathjs = packages.find((pkg) => pkg.name === "mathjs");

    expect(document).toContain(`Production packages covered: ${packages.length}`);
    for (const pkg of packages) expect(document).toContain(`\n${pkg.key}\n`);
    expect(mathjs?.licenseFiles.some((file) => file.text.includes("END OF TERMS AND CONDITIONS")))
      .toBe(true);
    expect(mathjs?.noticeFiles.map((file) => file.name)).toContain("NOTICE");
    expect(document).toContain("--- NOTICE ---");
    expect(document).toContain("Copyright (C) 2013-2026 Jos de Jong");
    expect(document).not.toContain("Full license text is available at node_modules");
  });

  it("keeps the repository inventory synchronized with installed versions", () => {
    const markdown = readFileSync(resolve("THIRD_PARTY_LICENSES.md"), "utf8");
    for (const pkg of collectProductionPackageLicenses()) {
      expect(markdown).toContain(`| \`${pkg.name}\` | \`${pkg.version}\` |`);
    }
  });

  it("keeps bundle evidence linked to the same production inventory", () => {
    const packages = collectProductionPackageLicenses();
    const manifest = createBundleManifest(packages, [
      {
        key: "three@0.185.1",
        name: "three",
        version: "0.185.1",
        license: "MIT",
        chunks: ["assets/three.js"],
        moduleCount: 3
      }
    ]);

    expect(manifest.productionPackages).toHaveLength(EXPECTED_PRODUCTION_PACKAGES.length);
    expect(manifest.bundledPackages[0]).toMatchObject({
      key: "three@0.185.1",
      chunks: ["assets/three.js"],
      moduleCount: 3
    });
  });
});

describe("bundle module package resolution", () => {
  it("recognizes unscoped, scoped, nested, and query-suffixed package modules", () => {
    expect(packageDirectoryFromModuleId("/repo/node_modules/three/build/three.module.js"))
      .toBe("/repo/node_modules/three");
    expect(packageDirectoryFromModuleId("/repo/node_modules/@nodable/entities/src/index.js?x=1"))
      .toBe("/repo/node_modules/@nodable/entities");
    expect(
      packageDirectoryFromModuleId(
        "/repo/node_modules/outer/node_modules/inner/index.js"
      )
    ).toBe("/repo/node_modules/outer/node_modules/inner");
    expect(packageDirectoryFromModuleId("/repo/src/main.ts")).toBeNull();
  });
});
