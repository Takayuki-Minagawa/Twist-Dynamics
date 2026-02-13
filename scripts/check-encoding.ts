import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { TextDecoder } from "node:util";

interface EncodingIssue {
  file: string;
  issue: string;
}

function hasUtf8Bom(bytes: Buffer): boolean {
  return bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
}

function main(): void {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const binaryExtensions = new Set([
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".ico",
    ".webp",
    ".pdf",
    ".zip",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".mp3",
    ".wav",
    ".mp4"
  ]);
  const files = execSync("git ls-files", { encoding: "utf8" })
    .split(/\r?\n/)
    .filter((line) => line.length > 0);

  const issues: EncodingIssue[] = [];

  for (const file of files) {
    if (binaryExtensions.has(extname(file).toLowerCase())) continue;
    const bytes = readFileSync(file);

    if (hasUtf8Bom(bytes)) {
      issues.push({ file, issue: "UTF-8 BOM detected" });
      continue;
    }

    try {
      decoder.decode(bytes);
    } catch {
      issues.push({ file, issue: "Not valid UTF-8" });
    }
  }

  if (issues.length === 0) {
    console.log(`OK: ${files.length} tracked file(s) are UTF-8 without BOM.`);
    process.exit(0);
  }

  console.error(`NG: ${issues.length} encoding issue(s) found.`);
  for (const entry of issues) {
    console.error(`- ${entry.file}: ${entry.issue}`);
  }
  process.exit(1);
}

main();
