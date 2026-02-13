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
