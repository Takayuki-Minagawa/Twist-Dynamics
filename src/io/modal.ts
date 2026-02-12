import type { ModalDatFile } from "../core/types";
import { parseBaseShapeInfo } from "./baseShape";
import { extractMarkedSection, splitCsvLikeLine, toNumberList, toTrimmedLines } from "./text";

function parseEffectiveMassRatio(
  lines: string[],
  label: "X" | "Y"
): number[] {
  const index = lines.findIndex((line) => line.startsWith(`有効質量比${label}`));
  if (index < 0 || index + 1 >= lines.length) return [];
  return toNumberList(splitCsvLikeLine(lines[index + 1]));
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
  const frequenciesHz =
    freqIndex >= 0 && freqIndex + 2 < modalLines.length
      ? toNumberList(splitCsvLikeLine(modalLines[freqIndex + 2]).slice(1))
      : [];

  const pfxLine = modalLines.find((line) => line.startsWith("刺激係数X")) ?? "";
  const pfyLine = modalLines.find((line) => line.startsWith("刺激係数Y")) ?? "";
  const participationFactorX = toNumberList(splitCsvLikeLine(pfxLine).slice(1));
  const participationFactorY = toNumberList(splitCsvLikeLine(pfyLine).slice(1));

  const effectiveMassRatioX = parseEffectiveMassRatio(modalLines, "X");
  const effectiveMassRatioY = parseEffectiveMassRatio(modalLines, "Y");

  const eigenIndex = modalLines.findIndex((line) => line.includes("固有ベクトル"));
  const eigenVectors: Array<{ label: string; values: number[] }> = [];
  if (eigenIndex >= 0) {
    for (let i = eigenIndex + 2; i < modalLines.length; i++) {
      const line = modalLines[i].trim();
      if (line.length === 0 || line.startsWith("#")) break;
      const tokens = splitCsvLikeLine(line);
      if (tokens.length < 2) continue;
      eigenVectors.push({
        label: tokens[0],
        values: toNumberList(tokens.slice(1))
      });
    }
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
