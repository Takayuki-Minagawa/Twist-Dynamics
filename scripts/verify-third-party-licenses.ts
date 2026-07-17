import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyThirdPartyDistribution } from "./thirdPartyLicenses";

export function runThirdPartyLicenseVerification(
  workspaceRoot = process.cwd(),
  distributionDirectory = resolve(workspaceRoot, "dist")
): void {
  const manifest = verifyThirdPartyDistribution(workspaceRoot, distributionDirectory);
  process.stdout.write(
    `OK: ${manifest.productionPackages.length} production package license(s) cover ` +
      `${manifest.bundledPackages.length} package(s) present in the bundle.\n`
  );
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  runThirdPartyLicenseVerification();
}
