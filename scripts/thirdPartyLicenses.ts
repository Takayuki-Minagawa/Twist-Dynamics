import {
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Plugin } from "vite";

const LICENSE_FILE_NAME = "THIRD_PARTY_LICENSES.txt";
const BUNDLE_MANIFEST_FILE_NAME = "THIRD_PARTY_BUNDLE_MANIFEST.json";

interface RepositoryValue {
  url?: string;
}

interface PackageJson {
  name?: string;
  version?: string;
  license?: string;
  author?: string | { name?: string };
  homepage?: string;
  repository?: string | RepositoryValue;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

export interface LicenseTextFile {
  name: string;
  text: string;
}

export interface ProductionPackageLicense {
  key: string;
  name: string;
  version: string;
  license: string;
  source: string;
  directory: string;
  licenseFiles: LicenseTextFile[];
  noticeFiles: LicenseTextFile[];
}

export interface BundlePackageEvidence {
  key: string;
  name: string;
  version: string;
  license: string;
  chunks: string[];
  moduleCount: number;
}

export interface ThirdPartyBundleManifest {
  schemaVersion: 1;
  generatedBy: string;
  licenseFile: string;
  productionPackages: Array<{
    key: string;
    name: string;
    version: string;
    license: string;
  }>;
  bundledPackages: BundlePackageEvidence[];
}

interface BundleOutput {
  type: string;
  fileName: string;
  modules?: Record<string, unknown>;
}

export type LicenseOutputBundle = Record<string, BundleOutput>;

const EMBEDDED_LICENSES: Readonly<Record<string, LicenseTextFile>> = {
  "@nodable/entities@3.0.0": {
    name: "LICENSE (upstream val-parsers repository)",
    text: `MIT License

Copyright (c) 2026 Nodable

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`
  },
  "javascript-natural-sort@0.7.1": {
    name: "LICENSE (upstream javascript-natural-sort repository)",
    text: `The MIT License (MIT)

Copyright (c) 2008-2016 Jim Palmer

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.`
  },
  "seedrandom@3.0.5": {
    name: "LICENSE (embedded in upstream README and seedrandom.js)",
    text: `LICENSE (MIT)

Copyright 2019 David Bau.

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`
  }
};

function normalizedText(text: string): string {
  return `${text.replace(/\r\n?/g, "\n").trimEnd()}\n`;
}

function readJson(path: string): PackageJson {
  return JSON.parse(readFileSync(path, "utf8")) as PackageJson;
}

function packageJsonPath(directory: string): string {
  return join(directory, "package.json");
}

function sourceUrl(pkg: PackageJson): string {
  const repository = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
  const value = repository ?? pkg.homepage ?? "(not declared)";
  return value
    .replace(/^git\+/, "")
    .replace(/^ssh:\/\/git@github\.com\//, "https://github.com/")
    .replace(/^git:\/\//, "https://")
    .replace(/^git@github\.com:/, "https://github.com/")
    .replace(/\.git$/, "");
}

function resolveInstalledPackage(parentDirectory: string, packageName: string): string | null {
  let current = resolve(parentDirectory);
  while (true) {
    const candidate = join(current, "node_modules", ...packageName.split("/"));
    if (existsSync(packageJsonPath(candidate))) return realpathSync(candidate);
    const next = dirname(current);
    if (next === current) return null;
    current = next;
  }
}

function matchingTextFiles(
  directory: string,
  predicate: (name: string) => boolean
): LicenseTextFile[] {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => ({
      name: entry.name,
      text: normalizedText(readFileSync(join(directory, entry.name), "utf8"))
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function createPackageRecord(directory: string, pkg: PackageJson): ProductionPackageLicense {
  if (!pkg.name || !pkg.version || !pkg.license) {
    throw new Error(`${packageJsonPath(directory)} must declare name, version, and license.`);
  }
  const key = `${pkg.name}@${pkg.version}`;
  let licenseFiles = matchingTextFiles(
    directory,
    (name) => /^(?:licen[cs]e|copying)(?:[._-].*)?$/i.test(name)
  );
  if (licenseFiles.length === 0) {
    const embedded = EMBEDDED_LICENSES[key];
    if (!embedded) {
      throw new Error(
        `${key} has no packaged license text. Add an exact-version embedded license before shipping it.`
      );
    }
    licenseFiles = [{ ...embedded, text: normalizedText(embedded.text) }];
  }
  const noticeFiles = matchingTextFiles(
    directory,
    (name) => /^notice(?:[._-].*)?$/i.test(name)
  );
  return {
    key,
    name: pkg.name,
    version: pkg.version,
    license: pkg.license,
    source: sourceUrl(pkg),
    directory: realpathSync(directory),
    licenseFiles,
    noticeFiles
  };
}

/** Collect the installed dependency closure reachable from package.json `dependencies`. */
export function collectProductionPackageLicenses(
  workspaceRoot = process.cwd()
): ProductionPackageLicense[] {
  const root = resolve(workspaceRoot);
  const rootPackage = readJson(packageJsonPath(root));
  const records = new Map<string, ProductionPackageLicense>();
  const visitedDirectories = new Set<string>();

  const visitDependency = (parentDirectory: string, dependencyName: string, optional: boolean): void => {
    const directory = resolveInstalledPackage(parentDirectory, dependencyName);
    if (!directory) {
      if (optional) return;
      throw new Error(`Production dependency ${dependencyName} is not installed from ${parentDirectory}.`);
    }
    if (visitedDirectories.has(directory)) return;
    visitedDirectories.add(directory);

    const pkg = readJson(packageJsonPath(directory));
    const record = createPackageRecord(directory, pkg);
    records.set(record.key, record);

    const required = pkg.dependencies ?? {};
    const optionalDependencies = pkg.optionalDependencies ?? {};
    for (const name of Object.keys(required).sort()) {
      visitDependency(directory, name, false);
    }
    for (const name of Object.keys(optionalDependencies).sort()) {
      if (!(name in required)) visitDependency(directory, name, true);
    }
  };

  const rootDependencies = rootPackage.dependencies ?? {};
  const rootOptionalDependencies = rootPackage.optionalDependencies ?? {};
  for (const name of Object.keys(rootDependencies).sort()) {
    visitDependency(root, name, false);
  }
  for (const name of Object.keys(rootOptionalDependencies).sort()) {
    if (!(name in rootDependencies)) visitDependency(root, name, true);
  }

  return [...records.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function createThirdPartyLicenseDocument(
  packages: readonly ProductionPackageLicense[]
): string {
  const lines = [
    "THIRD-PARTY SOFTWARE LICENSES AND NOTICES",
    "=========================================",
    "",
    "This file is generated at build time from the complete installed production",
    "dependency tree. It intentionally includes every production dependency, even",
    "when tree-shaking excludes a package from a particular bundle.",
    "",
    `Production packages covered: ${packages.length}`,
    ""
  ];

  for (const pkg of packages) {
    lines.push(
      "===============================================================================",
      pkg.key,
      `License: ${pkg.license}`,
      `Source: ${pkg.source}`,
      ""
    );
    for (const file of pkg.licenseFiles) {
      lines.push(`--- ${file.name} ---`, "", file.text.trimEnd(), "");
    }
    for (const file of pkg.noticeFiles) {
      lines.push(`--- ${file.name} ---`, "", file.text.trimEnd(), "");
    }
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function packageDirectoryFromModuleId(moduleId: string): string | null {
  const normalized = moduleId.replace(/^\0/, "").replace(/\\/g, "/").split("?", 1)[0];
  const marker = "/node_modules/";
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex < 0) return null;
  const base = normalized.slice(0, markerIndex + marker.length);
  const parts = normalized.slice(markerIndex + marker.length).split("/");
  if (parts[0].startsWith("@")) {
    if (parts.length < 2) return null;
    return `${base}${parts[0]}/${parts[1]}`;
  }
  return parts[0] ? `${base}${parts[0]}` : null;
}

function isOutputChunk(
  value: BundleOutput
): value is BundleOutput & { type: "chunk"; modules: Record<string, unknown> } {
  return value.type === "chunk" && value.modules !== undefined;
}

export function collectBundledPackageEvidence(
  bundle: LicenseOutputBundle,
  productionPackages: readonly ProductionPackageLicense[]
): BundlePackageEvidence[] {
  const packageByDirectory = new Map(
    productionPackages.map((pkg) => [realpathSync(pkg.directory), pkg] as const)
  );
  const evidence = new Map<
    string,
    { pkg: ProductionPackageLicense; chunks: Set<string>; modules: Set<string> }
  >();

  for (const output of Object.values(bundle)) {
    if (!isOutputChunk(output)) continue;
    for (const moduleId of Object.keys(output.modules)) {
      const directory = packageDirectoryFromModuleId(moduleId);
      if (!directory || !existsSync(directory)) continue;
      const resolvedDirectory = realpathSync(directory);
      const pkg = packageByDirectory.get(resolvedDirectory);
      if (!pkg) {
        throw new Error(
          `Bundled module ${moduleId} belongs to ${resolvedDirectory}, which is absent from the production license inventory.`
        );
      }
      const current = evidence.get(pkg.key) ?? {
        pkg,
        chunks: new Set<string>(),
        modules: new Set<string>()
      };
      current.chunks.add(output.fileName);
      current.modules.add(moduleId);
      evidence.set(pkg.key, current);
    }
  }

  return [...evidence.values()]
    .map(({ pkg, chunks, modules }) => ({
      key: pkg.key,
      name: pkg.name,
      version: pkg.version,
      license: pkg.license,
      chunks: [...chunks].sort(),
      moduleCount: modules.size
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function createBundleManifest(
  productionPackages: readonly ProductionPackageLicense[],
  bundledPackages: readonly BundlePackageEvidence[]
): ThirdPartyBundleManifest {
  return {
    schemaVersion: 1,
    generatedBy: "scripts/thirdPartyLicenses.ts",
    licenseFile: LICENSE_FILE_NAME,
    productionPackages: productionPackages.map(({ key, name, version, license }) => ({
      key,
      name,
      version,
      license
    })),
    bundledPackages: [...bundledPackages]
  };
}

export function thirdPartyLicensePlugin(workspaceRoot = process.cwd()): Plugin {
  return {
    name: "twist-dynamics-third-party-licenses",
    apply: "build",
    generateBundle(_options, bundle) {
      const productionPackages = collectProductionPackageLicenses(workspaceRoot);
      const bundledPackages = collectBundledPackageEvidence(bundle, productionPackages);
      if (bundledPackages.length === 0) {
        throw new Error("No production packages were detected in the generated bundle.");
      }
      const document = createThirdPartyLicenseDocument(productionPackages);
      const manifest = createBundleManifest(productionPackages, bundledPackages);
      this.emitFile({ type: "asset", fileName: LICENSE_FILE_NAME, source: document });
      this.emitFile({
        type: "asset",
        fileName: BUNDLE_MANIFEST_FILE_NAME,
        source: `${JSON.stringify(manifest, null, 2)}\n`
      });
    }
  };
}

export function verifyThirdPartyDistribution(
  workspaceRoot = process.cwd(),
  distributionDirectory = join(workspaceRoot, "dist")
): ThirdPartyBundleManifest {
  const packages = collectProductionPackageLicenses(workspaceRoot);
  const expectedDocument = createThirdPartyLicenseDocument(packages);
  const licensePath = join(distributionDirectory, LICENSE_FILE_NAME);
  const manifestPath = join(distributionDirectory, BUNDLE_MANIFEST_FILE_NAME);
  if (!existsSync(licensePath)) throw new Error(`${LICENSE_FILE_NAME} is missing from the distribution.`);
  if (!existsSync(manifestPath)) {
    throw new Error(`${BUNDLE_MANIFEST_FILE_NAME} is missing from the distribution.`);
  }
  const actualDocument = normalizedText(readFileSync(licensePath, "utf8"));
  if (actualDocument !== normalizedText(expectedDocument)) {
    throw new Error(`${LICENSE_FILE_NAME} does not match the installed production dependency tree.`);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ThirdPartyBundleManifest;
  if (manifest.schemaVersion !== 1 || manifest.licenseFile !== LICENSE_FILE_NAME) {
    throw new Error(`${BUNDLE_MANIFEST_FILE_NAME} has an unsupported schema.`);
  }
  const expectedKeys = packages.map((pkg) => pkg.key);
  const manifestKeys = manifest.productionPackages.map((pkg) => pkg.key);
  if (JSON.stringify(manifestKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error("The bundle manifest production inventory is incomplete or out of date.");
  }
  if (manifest.bundledPackages.length === 0) {
    throw new Error("The bundle manifest does not identify any bundled production package.");
  }
  const expectedKeySet = new Set(expectedKeys);
  for (const pkg of manifest.bundledPackages) {
    if (!expectedKeySet.has(pkg.key)) {
      throw new Error(`Bundled package ${pkg.key} is missing from the production license inventory.`);
    }
    if (!Number.isInteger(pkg.moduleCount) || pkg.moduleCount < 1 || pkg.chunks.length === 0) {
      throw new Error(`Bundled package ${pkg.key} has no module/chunk evidence.`);
    }
    for (const chunk of pkg.chunks) {
      if (!existsSync(join(distributionDirectory, chunk))) {
        throw new Error(`Bundle evidence for ${pkg.key} references missing chunk ${chunk}.`);
      }
    }
  }

  for (const pkg of packages.filter((entry) => entry.license.includes("Apache-2.0"))) {
    const combined = pkg.licenseFiles.map((file) => file.text).join("\n");
    if (!combined.includes("END OF TERMS AND CONDITIONS")) {
      throw new Error(`${pkg.key} does not include the complete Apache-2.0 license text.`);
    }
    if (pkg.noticeFiles.length > 0 && !actualDocument.includes(`--- ${pkg.noticeFiles[0].name} ---`)) {
      throw new Error(`${pkg.key} NOTICE text is missing from ${LICENSE_FILE_NAME}.`);
    }
  }

  return manifest;
}

export const THIRD_PARTY_LICENSE_ARTIFACT = LICENSE_FILE_NAME;
export const THIRD_PARTY_BUNDLE_MANIFEST = BUNDLE_MANIFEST_FILE_NAME;
