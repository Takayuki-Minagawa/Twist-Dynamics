import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  decodeText,
  parseComplexModalDat,
  parseModalDat,
  parseRespCsv
} from "../src/io";

type CompareType = "modal" | "complex" | "resp";

function arg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(name);
  if (index < 0 || index + 1 >= process.argv.length) return fallback;
  return process.argv[index + 1];
}

function numArg(name: string, fallback: number): number {
  const raw = arg(name, "");
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function readText(pathLike: string): string {
  const abs = resolve(pathLike);
  const raw = readFileSync(abs);
  const buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  return decodeText(buffer, "shift_jis");
}

function relDiff(a: number, b: number): number {
  const scale = Math.max(Math.abs(a), Math.abs(b), 1e-12);
  return Math.abs(a - b) / scale;
}

function compareNumberArrays(
  name: string,
  a: number[],
  b: number[],
  rtol: number,
  atol: number
): string[] {
  const issues: string[] = [];
  if (a.length !== b.length) {
    issues.push(`${name}: length mismatch ${a.length} != ${b.length}`);
    return issues;
  }
  for (let i = 0; i < a.length; i++) {
    const abs = Math.abs(a[i] - b[i]);
    const rel = relDiff(a[i], b[i]);
    if (abs > atol && rel > rtol) {
      issues.push(
        `${name}[${i}] mismatch ref=${a[i]} target=${b[i]} abs=${abs} rel=${rel}`
      );
    }
  }
  return issues;
}

function compareModal(referenceText: string, targetText: string, rtol: number, atol: number): string[] {
  const ref = parseModalDat(referenceText).modal;
  const tgt = parseModalDat(targetText).modal;
  return [
    ...compareNumberArrays("frequenciesHz", ref.frequenciesHz, tgt.frequenciesHz, rtol, atol),
    ...compareNumberArrays(
      "participationFactorX",
      ref.participationFactorX,
      tgt.participationFactorX,
      rtol,
      atol
    ),
    ...compareNumberArrays(
      "participationFactorY",
      ref.participationFactorY,
      tgt.participationFactorY,
      rtol,
      atol
    )
  ];
}

function compareComplex(referenceText: string, targetText: string, rtol: number, atol: number): string[] {
  const ref = parseComplexModalDat(referenceText);
  const tgt = parseComplexModalDat(targetText);
  const refFreq = ref.modes.map((m) => m.frequencyHz);
  const tgtFreq = tgt.modes.map((m) => m.frequencyHz);
  const refDamp = ref.modes.map((m) => m.dampingRatioPercent);
  const tgtDamp = tgt.modes.map((m) => m.dampingRatioPercent);
  return [
    ...compareNumberArrays("complex.frequenciesHz", refFreq, tgtFreq, rtol, atol),
    ...compareNumberArrays("complex.dampingRatio", refDamp, tgtDamp, rtol, atol)
  ];
}

function compareResp(referenceText: string, targetText: string, rtol: number, atol: number): string[] {
  const ref = parseRespCsv(referenceText);
  const tgt = parseRespCsv(targetText);
  return [
    ...compareNumberArrays("resp.columnMaxAbs", ref.columnMaxAbs, tgt.columnMaxAbs, rtol, atol),
    ...compareNumberArrays(
      "resp.timeColumn",
      ref.records.map((row) => row[0]),
      tgt.records.map((row) => row[0]),
      rtol,
      atol
    )
  ];
}

function main(): void {
  const type = arg("--type") as CompareType;
  const referencePath = arg("--reference");
  const targetPath = arg("--target");
  const rtol = numArg("--rtol", 0.01);
  const atol = numArg("--atol", 1e-6);

  if (!type || !referencePath || !targetPath) {
    console.error(
      "Usage: npm run compare -- --type modal|complex|resp --reference <path> --target <path> [--rtol 0.01] [--atol 1e-6]"
    );
    process.exit(2);
  }

  const referenceText = readText(referencePath);
  const targetText = readText(targetPath);

  let issues: string[] = [];
  if (type === "modal") issues = compareModal(referenceText, targetText, rtol, atol);
  if (type === "complex") issues = compareComplex(referenceText, targetText, rtol, atol);
  if (type === "resp") issues = compareResp(referenceText, targetText, rtol, atol);

  if (issues.length === 0) {
    console.log("OK: no differences beyond tolerance.");
    process.exit(0);
  }

  console.error(`NG: ${issues.length} issue(s) found.`);
  for (const issue of issues.slice(0, 50)) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

main();
