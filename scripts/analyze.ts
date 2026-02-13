import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  decodeText,
  parseBuildingModelJson,
  parseBuildingModelXml,
  serializeComplexModalDat,
  serializeModalDat
} from "../src/io";
import { analyzeComplexEigen, analyzeRealEigen } from "../src/core/analysis";

type AnalyzeType = "modal" | "complex";

interface CliOptions {
  type: AnalyzeType;
  inputPath: string;
  outputPath: string;
  modalOutputPath?: string;
  dampingRatio: number;
}

function arg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(name);
  if (index < 0 || index + 1 >= process.argv.length) return fallback;
  return process.argv[index + 1];
}

function numArg(name: string, fallback: number): number {
  const raw = arg(name, "").trim();
  if (raw.length === 0) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function parseType(raw: string): AnalyzeType | null {
  return raw === "modal" || raw === "complex" ? raw : null;
}

function usage(): string {
  return [
    "Usage:",
    "  npm run analyze -- --type modal|complex --input <building-model.json|xml> --output <result.dat>",
    "  [--modal-output <modal.dat>] [--damping-ratio 0.02]"
  ].join(" ");
}

function parseCli(): CliOptions {
  const type = parseType(arg("--type"));
  const inputPath = arg("--input");
  const outputPath = arg("--output");
  const modalOutputPath = arg("--modal-output");
  const dampingRatio = numArg("--damping-ratio", 0.02);

  if (!type || !inputPath || !outputPath) {
    throw new Error(usage());
  }
  if (dampingRatio < 0) {
    throw new Error("--damping-ratio must be >= 0");
  }

  return {
    type,
    inputPath,
    outputPath,
    modalOutputPath: modalOutputPath || undefined,
    dampingRatio
  };
}

function readInputModel(pathLike: string) {
  const raw = readFileSync(resolve(pathLike));
  const source = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const text = decodeText(source, "shift_jis");
  const trimmed = text.trimStart();

  if (pathLike.toLowerCase().endsWith(".xml") || trimmed.startsWith("<")) {
    return parseBuildingModelXml(text);
  }
  return parseBuildingModelJson(text);
}

function writeText(pathLike: string, content: string): void {
  writeFileSync(resolve(pathLike), content, { encoding: "utf-8" });
}

function main(): void {
  let options: CliOptions;
  try {
    options = parseCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
    return;
  }

  try {
    const model = readInputModel(options.inputPath);
    if (options.type === "modal") {
      const { modal } = analyzeRealEigen(model, { defaultDampingRatio: options.dampingRatio });
      writeText(options.outputPath, serializeModalDat(modal));
      console.log(`Modal result written: ${options.outputPath}`);
      return;
    }

    const { modal, complex } = analyzeComplexEigen(model, {
      defaultDampingRatio: options.dampingRatio
    });
    writeText(options.outputPath, serializeComplexModalDat(complex));
    console.log(`Complex modal result written: ${options.outputPath}`);

    if (options.modalOutputPath) {
      writeText(options.modalOutputPath, serializeModalDat(modal));
      console.log(`Modal result written: ${options.modalOutputPath}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
