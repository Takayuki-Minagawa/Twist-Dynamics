import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  decodeText,
  parseBuildingModelJson,
  parseBuildingModelXml,
  serializeComplexModalDat,
  serializeModalDat,
  serializeRespCsv
} from "../src/io";
import { analyzeComplexEigen, analyzeRealEigen, analyzeTimeHistory, type GroundWave } from "../src/core/analysis";

type AnalyzeType = "modal" | "complex" | "resp";

interface CliOptions {
  type: AnalyzeType;
  inputPath: string;
  outputPath: string;
  modalOutputPath?: string;
  wavePath?: string;
  waveDt?: number;
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
  if (raw === "modal" || raw === "complex" || raw === "resp") return raw;
  return null;
}

function usage(): string {
  return [
    "Usage:",
    "  npm run analyze -- --type modal|complex|resp --input <building-model.json|xml> --output <result.dat|csv>",
    "  [--modal-output <modal.dat>] [--wave <wave.csv>] [--wave-dt 0.01] [--damping-ratio 0.02]"
  ].join(" ");
}

function parseCli(): CliOptions {
  const type = parseType(arg("--type"));
  const inputPath = arg("--input");
  const outputPath = arg("--output");
  const modalOutputPath = arg("--modal-output");
  const wavePath = arg("--wave");
  const waveDtRaw = arg("--wave-dt");
  const dampingRatio = numArg("--damping-ratio", 0.02);

  if (!type || !inputPath || !outputPath) {
    throw new Error(usage());
  }
  if (dampingRatio < 0) {
    throw new Error("--damping-ratio must be >= 0");
  }
  if (type === "resp" && !wavePath) {
    throw new Error("--wave is required when --type resp");
  }

  const waveDt = waveDtRaw.trim().length > 0 ? Number(waveDtRaw) : undefined;
  if (waveDt !== undefined && (!Number.isFinite(waveDt) || waveDt <= 0)) {
    throw new Error("--wave-dt must be a positive number");
  }

  return {
    type,
    inputPath,
    outputPath,
    modalOutputPath: modalOutputPath || undefined,
    wavePath: wavePath || undefined,
    waveDt,
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

function toLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

function parseNumericRow(line: string): number[] {
  return line
    .split(",")
    .map((token) => token.trim())
    .map((token) => Number(token));
}

function parseWaveCsv(pathLike: string, forcedDt?: number): GroundWave {
  const raw = readFileSync(resolve(pathLike));
  const source = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const text = decodeText(source, "shift_jis");
  const lines = toLines(text);
  if (lines.length === 0) {
    throw new Error("Wave CSV is empty.");
  }

  let start = 0;
  const firstTokens = lines[0].split(",").map((token) => token.trim());
  const hasHeader = firstTokens.some((token) => Number.isNaN(Number(token)));
  if (hasHeader) start = 1;

  const rows = lines.slice(start).map(parseNumericRow).filter((row) => row.length > 0);
  if (rows.length < 2) {
    throw new Error("Wave CSV must contain at least 2 numeric rows.");
  }

  let time: number[] = [];
  let accX: number[] = [];
  let accY: number[] = [];

  if (rows[0].length >= 3) {
    time = rows.map((row, index) => {
      const value = row[0];
      if (!Number.isFinite(value)) throw new Error(`Invalid time at row ${index + 1}.`);
      return value;
    });
    accX = rows.map((row, index) => {
      const value = row[1];
      if (!Number.isFinite(value)) throw new Error(`Invalid AX at row ${index + 1}.`);
      return value;
    });
    accY = rows.map((row, index) => {
      const value = row[2];
      if (!Number.isFinite(value)) throw new Error(`Invalid AY at row ${index + 1}.`);
      return value;
    });
  } else if (rows[0].length >= 2) {
    time = rows.map((row, index) => {
      const value = row[0];
      if (!Number.isFinite(value)) throw new Error(`Invalid time at row ${index + 1}.`);
      return value;
    });
    accX = rows.map((row, index) => {
      const value = row[1];
      if (!Number.isFinite(value)) throw new Error(`Invalid AX at row ${index + 1}.`);
      return value;
    });
    accY = new Array<number>(accX.length).fill(0);
  } else {
    if (forcedDt === undefined) {
      throw new Error("Single-column wave requires --wave-dt.");
    }
    accX = rows.map((row, index) => {
      const value = row[0];
      if (!Number.isFinite(value)) throw new Error(`Invalid AX at row ${index + 1}.`);
      return value;
    });
    accY = new Array<number>(accX.length).fill(0);
    time = accX.map((_, index) => index * forcedDt);
  }

  let dt = forcedDt;
  if (dt === undefined) {
    const inferred = time[1] - time[0];
    if (!Number.isFinite(inferred) || inferred <= 0) {
      throw new Error("Unable to infer wave dt from time column.");
    }
    dt = inferred;
  }

  return {
    dt,
    time,
    accX,
    accY
  };
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

    if (options.type === "complex") {
      const { modal, complex } = analyzeComplexEigen(model, {
        defaultDampingRatio: options.dampingRatio
      });
      writeText(options.outputPath, serializeComplexModalDat(complex));
      console.log(`Complex modal result written: ${options.outputPath}`);

      if (options.modalOutputPath) {
        writeText(options.modalOutputPath, serializeModalDat(modal));
        console.log(`Modal result written: ${options.modalOutputPath}`);
      }
      return;
    }

    const wave = parseWaveCsv(options.wavePath!, options.waveDt);
    const resp = analyzeTimeHistory(model, wave, {
      defaultDampingRatio: options.dampingRatio
    });
    writeText(options.outputPath, serializeRespCsv(resp));
    console.log(`Resp result written: ${options.outputPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
