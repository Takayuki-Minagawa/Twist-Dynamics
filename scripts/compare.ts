import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compareByType, type CompareIssue, type CompareType } from "../src/core/compare";
import { decodeText } from "../src/io";

type OutputFormat = "text" | "json";

interface CliOptions {
  type: CompareType;
  referencePath: string;
  targetPath: string;
  rtol: number;
  atol: number;
  format: OutputFormat;
  maxIssues: number;
}

function arg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(name);
  if (index < 0 || index + 1 >= process.argv.length) return fallback;
  return process.argv[index + 1];
}

function numArg(name: string, fallback: number): number {
  const raw = arg(name, "");
  if (raw.trim().length === 0) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function readText(pathLike: string): string {
  const abs = resolve(pathLike);
  const raw = readFileSync(abs);
  const source = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  return decodeText(source, "shift_jis");
}

function usage(): string {
  return (
    "Usage: npm run compare -- --type modal|complex|resp --reference <path> --target <path> " +
    "[--rtol 0.01] [--atol 1e-6] [--format text|json] [--max-issues 50]"
  );
}

function parseType(rawType: string): CompareType | null {
  if (rawType === "modal" || rawType === "complex" || rawType === "resp") {
    return rawType;
  }
  return null;
}

function parseOutputFormat(raw: string): OutputFormat {
  return raw === "json" ? "json" : "text";
}

function parseCliOptions(): CliOptions {
  const type = parseType(arg("--type"));
  const referencePath = arg("--reference");
  const targetPath = arg("--target");
  const rtol = numArg("--rtol", 0.01);
  const atol = numArg("--atol", 1e-6);
  const format = parseOutputFormat(arg("--format", "text"));
  const maxIssues = Math.max(1, Math.trunc(numArg("--max-issues", 50)));

  if (!type || !referencePath || !targetPath) {
    throw new Error(usage());
  }

  return {
    type,
    referencePath,
    targetPath,
    rtol,
    atol,
    format,
    maxIssues
  };
}

function printTextResult(issues: CompareIssue[], maxIssues: number): void {
  if (issues.length === 0) {
    console.log("OK: no differences beyond tolerance.");
    return;
  }

  console.error(`NG: ${issues.length} issue(s) found.`);
  for (const issue of issues.slice(0, maxIssues)) {
    console.error(`- ${issue.message}`);
  }
}

function printJsonResult(
  options: CliOptions,
  issues: CompareIssue[],
  referencePath: string,
  targetPath: string
): void {
  const payload = {
    ok: issues.length === 0,
    type: options.type,
    referencePath,
    targetPath,
    tolerance: {
      rtol: options.rtol,
      atol: options.atol
    },
    issueCount: issues.length,
    issues: issues.slice(0, options.maxIssues)
  };
  console.log(JSON.stringify(payload, null, 2));
}

function main(): void {
  let options: CliOptions;
  try {
    options = parseCliOptions();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
    return;
  }

  const referenceText = readText(options.referencePath);
  const targetText = readText(options.targetPath);
  const result = compareByType(options.type, referenceText, targetText, {
    rtol: options.rtol,
    atol: options.atol
  });

  if (options.format === "json") {
    printJsonResult(options, result.issues, options.referencePath, options.targetPath);
  } else {
    printTextResult(result.issues, options.maxIssues);
  }

  process.exit(result.issues.length === 0 ? 0 : 1);
}

main();
