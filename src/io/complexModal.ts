import type { ComplexModalFile, ComplexMode } from "../core/types";
import { parseBaseShapeInfo } from "./baseShape";
import { extractMarkedSection, toTrimmedLines } from "./text";

const freqRegex =
  /^\s*(\d+)次\s+([+\-]?\d+(?:\.\d+)?(?:[Ee][+\-]?\d+)?)\s+([+\-]?\d+(?:\.\d+)?(?:[Ee][+\-]?\d+)?).*?\(([+\-]?\d+(?:\.\d+)?(?:[Ee][+\-]?\d+)?),\s*([+\-]?\d+(?:\.\d+)?(?:[Ee][+\-]?\d+)?)\)/;

const vecRegex =
  /^([A-Z]{2}_[0-9]+)\s+([+\-]?\d+(?:\.\d+)?(?:[Ee][+\-]?\d+)?)\s+([+\-]?\d+(?:\.\d+)?(?:[Ee][+\-]?\d+)?)\s+\(([+\-]?\d+(?:\.\d+)?(?:[Ee][+\-]?\d+)?),\s*([+\-]?\d+(?:\.\d+)?(?:[Ee][+\-]?\d+)?)\)/;

export function parseComplexModalDat(text: string): ComplexModalFile {
  const lines = toTrimmedLines(text);
  const section = extractMarkedSection(lines, {
    sectionName: "ComplexModalResult",
    startMarker: "#ComplexModalResult",
    endMarker: "#End_ComplexModalResult"
  });

  const baseShape = parseBaseShapeInfo(section.before.join("\n"));
  const body = section.body;

  const modes: ComplexMode[] = [];
  let currentMode: ComplexMode | null = null;

  for (let i = 0; i < body.length; i++) {
    const line = body[i].trim();
    if (!line) continue;

    const freqMatch = line.match(freqRegex);
    if (freqMatch) {
      modes.push({
        mode: Number(freqMatch[1]),
        frequencyHz: Number(freqMatch[2]),
        dampingRatioPercent: Number(freqMatch[3]),
        eigenValueReal: Number(freqMatch[4]),
        eigenValueImag: Number(freqMatch[5]),
        vectors: []
      });
      continue;
    }

    const modeHeader = line.match(/^\*\*\s*(\d+)次$/);
    if (modeHeader) {
      const modeNo = Number(modeHeader[1]);
      currentMode = modes.find((m) => m.mode === modeNo) ?? null;
      continue;
    }

    const vecMatch = line.match(vecRegex);
    if (currentMode && vecMatch) {
      currentMode.vectors.push({
        component: vecMatch[1],
        amplitude: Number(vecMatch[2]),
        phaseRad: Number(vecMatch[3]),
        complexReal: Number(vecMatch[4]),
        complexImag: Number(vecMatch[5])
      });
    }
  }

  return { baseShape, modes: modes.sort((a, b) => a.mode - b.mode) };
}

export function summarizeComplexModalDat(text: string): Record<string, unknown> {
  const data = parseComplexModalDat(text);
  return {
    story: data.baseShape.story ?? null,
    modeCount: data.modes.length,
    firstFrequencyHz: data.modes[0]?.frequencyHz ?? null,
    firstModeVectorCount: data.modes[0]?.vectors.length ?? null
  };
}
