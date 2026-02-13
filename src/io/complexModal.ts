import type { ComplexModalFile, ComplexMode } from "../core/types";
import { parseBaseShapeInfo } from "./baseShape";
import { extractMarkedSection, FormatParseError, toTrimmedLines } from "./text";

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
      currentMode = {
        mode: Number(freqMatch[1]),
        frequencyHz: Number(freqMatch[2]),
        dampingRatioPercent: Number(freqMatch[3]),
        eigenValueReal: Number(freqMatch[4]),
        eigenValueImag: Number(freqMatch[5]),
        vectors: []
      };
      modes.push(currentMode);
      continue;
    }
    if (/^\d+次/.test(line)) {
      throw new FormatParseError(`ComplexModalResult: invalid mode row "${line}".`);
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
      continue;
    }
    if (/^[A-Z]{2}_[0-9]+/.test(line)) {
      throw new FormatParseError(`ComplexModalResult: invalid vector row "${line}".`);
    }
  }

  if (modes.length === 0) {
    throw new FormatParseError("ComplexModalResult: mode rows are missing.");
  }
  for (const mode of modes) {
    if (mode.vectors.length === 0) {
      throw new FormatParseError(`ComplexModalResult: vectors are missing for mode ${mode.mode}.`);
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

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const abs = Math.abs(value);
  if (abs > 0 && (abs < 1e-3 || abs >= 1e4)) {
    return value.toExponential(6);
  }
  return value.toFixed(6).replace(/\.?0+$/, "");
}

export function serializeComplexModalDat(data: ComplexModalFile): string {
  const lines: string[] = [];

  lines.push("#BaseShapeInfo");
  lines.push(`Story,${data.baseShape.story ?? data.baseShape.massCenters.length}`);
  lines.push(`Zlebe,${data.baseShape.zLevel.map(formatNumber).join(",")}`);
  lines.push("#MassCenter");
  for (const center of data.baseShape.massCenters) {
    lines.push(`MC   ,${center.layer},${formatNumber(center.x)},${formatNumber(center.y)}`);
  }
  lines.push("");
  lines.push("#ComplexModalResult");
  lines.push("** 複素固有値解析結果");
  lines.push("");
  lines.push("** 固有振動数 (減衰固有振動数 モード減衰(%))");
  for (const mode of data.modes) {
    lines.push(
      `${mode.mode}次 ${formatNumber(mode.frequencyHz)} ${formatNumber(mode.dampingRatioPercent)} (${formatNumber(mode.eigenValueReal ?? 0)}, ${formatNumber(mode.eigenValueImag ?? 0)})`
    );
  }
  lines.push("");
  lines.push("** 固有ベクトル (基準化振幅 位相角)");
  lines.push("");

  for (const mode of data.modes) {
    lines.push(`** ${mode.mode}次`);
    for (const vector of mode.vectors) {
      lines.push(
        `${vector.component} ${formatNumber(vector.amplitude)} ${formatNumber(vector.phaseRad)} (${formatNumber(vector.complexReal ?? 0)}, ${formatNumber(vector.complexImag ?? 0)})`
      );
    }
    lines.push("");
  }

  lines.push("#End_ComplexModalResult");
  return `${lines.join("\n")}\n`;
}
