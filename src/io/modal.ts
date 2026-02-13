import type { ModalDatFile } from "../core/types";
import { parseBaseShapeInfo } from "./baseShape";
import {
  extractMarkedSection,
  FormatParseError,
  splitCsvLikeLine,
  toNumberListStrict,
  toTrimmedLines
} from "./text";

function parseEffectiveMassRatio(
  lines: string[],
  label: "X" | "Y"
): number[] {
  const index = lines.findIndex((line) => line.startsWith(`有効質量比${label}`));
  if (index < 0 || index + 1 >= lines.length) return [];
  return toNumberListStrict(splitCsvLikeLine(lines[index + 1]), `ModalResult.有効質量比${label}`);
}

export function parseModalDat(text: string): ModalDatFile {
  const lines = toTrimmedLines(text);
  const section = extractMarkedSection(lines, {
    sectionName: "ModalResult",
    startMarker: "#ModalResult",
    endMarker: "#End_ModalResult"
  });
  const baseShape = parseBaseShapeInfo(section.before.join("\n"));
  const modalLines = section.body;

  const freqIndex = modalLines.findIndex((line) => line.includes("固有振動数"));
  if (freqIndex < 0 || freqIndex + 2 >= modalLines.length) {
    throw new FormatParseError('ModalResult: "固有振動数" section is missing.');
  }
  const frequenciesHz = toNumberListStrict(
    splitCsvLikeLine(modalLines[freqIndex + 2]).slice(1),
    "ModalResult.固有振動数"
  );

  const pfxLine = modalLines.find((line) => line.startsWith("刺激係数X"));
  const pfyLine = modalLines.find((line) => line.startsWith("刺激係数Y"));
  if (!pfxLine || !pfyLine) {
    throw new FormatParseError("ModalResult: participation factor rows are missing.");
  }
  const participationFactorX = toNumberListStrict(
    splitCsvLikeLine(pfxLine).slice(1),
    "ModalResult.刺激係数X"
  );
  const participationFactorY = toNumberListStrict(
    splitCsvLikeLine(pfyLine).slice(1),
    "ModalResult.刺激係数Y"
  );

  const effectiveMassRatioX = parseEffectiveMassRatio(modalLines, "X");
  const effectiveMassRatioY = parseEffectiveMassRatio(modalLines, "Y");

  const eigenIndex = modalLines.findIndex((line) => line.includes("固有ベクトル"));
  if (eigenIndex < 0) {
    throw new FormatParseError('ModalResult: "固有ベクトル" section is missing.');
  }
  const eigenVectors: Array<{ label: string; values: number[] }> = [];
  for (let i = eigenIndex + 2; i < modalLines.length; i++) {
    const line = modalLines[i].trim();
    if (line.length === 0 || line.startsWith("#")) break;
    const tokens = splitCsvLikeLine(line);
    if (tokens.length < 2) {
      throw new FormatParseError(`ModalResult: invalid eigen vector row at line ${i + 1}.`);
    }
    eigenVectors.push({
      label: tokens[0],
      values: toNumberListStrict(tokens.slice(1), `ModalResult.固有ベクトル.${tokens[0]}`)
    });
  }
  if (eigenVectors.length === 0) {
    throw new FormatParseError("ModalResult: eigen vector rows are missing.");
  }

  return {
    baseShape,
    modal: {
      frequenciesHz,
      participationFactorX,
      participationFactorY,
      effectiveMassRatioX,
      effectiveMassRatioY,
      eigenVectors
    }
  };
}

export function summarizeModalDat(text: string): Record<string, unknown> {
  const modal = parseModalDat(text);
  return {
    story: modal.baseShape.story ?? null,
    modeCount: modal.modal.frequenciesHz.length,
    firstFrequencyHz: modal.modal.frequenciesHz[0] ?? null,
    eigenVectorRows: modal.modal.eigenVectors.length
  };
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const abs = Math.abs(value);
  if (abs > 0 && (abs < 1e-3 || abs >= 1e4)) {
    return value.toExponential(6);
  }
  return value.toFixed(6).replace(/\.?0+$/, "");
}

function formatModeHeader(modeCount: number): string {
  const labels = [""];
  for (let i = 0; i < modeCount; i++) {
    labels.push(`${i + 1}次`);
  }
  return labels.join(",");
}

export function serializeModalDat(data: ModalDatFile): string {
  const frequencies = data.modal.frequenciesHz;
  const modeCount = frequencies.length;

  const lines: string[] = [];
  lines.push("#BaseShapeInfo");
  lines.push(`Story,${data.baseShape.story ?? data.baseShape.massCenters.length}`);
  lines.push(`Zlebe,${data.baseShape.zLevel.map(formatNumber).join(",")}`);
  lines.push("#MassCenter");
  for (const center of data.baseShape.massCenters) {
    lines.push(
      `MC   ,${center.layer},${formatNumber(center.x)},${formatNumber(center.y)}`
    );
  }
  lines.push("");
  lines.push("#ModalResult");
  lines.push("〇固有振動数");
  lines.push(formatModeHeader(modeCount));
  lines.push(`,${frequencies.map(formatNumber).join(",")}`);
  lines.push(`刺激係数X,${data.modal.participationFactorX.map(formatNumber).join(",")}`);
  lines.push(`刺激係数Y,${data.modal.participationFactorY.map(formatNumber).join(",")}`);
  lines.push("有効質量比X");
  lines.push(data.modal.effectiveMassRatioX.map(formatNumber).join(","));
  lines.push("有効質量比Y");
  lines.push(data.modal.effectiveMassRatioY.map(formatNumber).join(","));
  lines.push("");
  lines.push("〇固有ベクトル");
  lines.push(formatModeHeader(modeCount));
  for (const row of data.modal.eigenVectors) {
    lines.push(`${row.label},${row.values.map(formatNumber).join(",")}`);
  }
  lines.push("");
  lines.push("#End_ModalResult");

  return `${lines.join("\n")}\n`;
}
