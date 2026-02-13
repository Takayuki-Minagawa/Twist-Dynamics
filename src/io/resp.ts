import type { RespFile } from "../core/types";
import { parseBaseShapeInfo } from "./baseShape";
import {
  extractMarkedSection,
  FormatParseError,
  splitCsvLikeLine,
  toNumberList,
  toTrimmedLines
} from "./text";

function getNumericValue(tokens: string[], label: string, fallback = 0): number {
  const index = tokens.findIndex((token) => token === label);
  if (index < 0 || index + 1 >= tokens.length) return fallback;
  const n = Number(tokens[index + 1]);
  return Number.isFinite(n) ? n : fallback;
}

export function parseRespCsv(text: string): RespFile {
  const lines = toTrimmedLines(text);
  const section = extractMarkedSection(lines, {
    sectionName: "Resp_Result",
    startMarker: "#Resp_Result"
  });
  const baseShape = parseBaseShapeInfo(section.before.join("\n"));

  if (section.body.length < 2) {
    throw new FormatParseError("Resp_Result: meta/header lines are missing.");
  }

  const metaTokens = splitCsvLikeLine(section.body[0]);
  const header = splitCsvLikeLine(section.body[1]);
  const records: number[][] = [];

  for (let i = 2; i < section.body.length; i++) {
    const line = section.body[i].trim();
    if (!line) continue;
    const row = toNumberList(splitCsvLikeLine(line));
    if (row.length > 0) records.push(row);
  }

  const colCount = records.reduce((max, row) => Math.max(max, row.length), 0);
  const columnMaxAbs = new Array<number>(colCount).fill(0);
  for (const row of records) {
    for (let i = 0; i < row.length; i++) {
      const abs = Math.abs(row[i]);
      if (abs > columnMaxAbs[i]) columnMaxAbs[i] = abs;
    }
  }

  return {
    baseShape,
    meta: {
      massCount: getNumericValue(metaTokens, "質点数", 0),
      dt: getNumericValue(metaTokens, "出力時間刻み(s)", 0.01),
      damperCount: getNumericValue(metaTokens, "ダンパー数", 0)
    },
    header,
    records,
    columnMaxAbs
  };
}

export function summarizeRespCsv(text: string): Record<string, unknown> {
  const data = parseRespCsv(text);
  return {
    story: data.baseShape.story ?? null,
    massCount: data.meta.massCount,
    dt: data.meta.dt,
    rows: data.records.length,
    columns: data.header.length,
    maxAbsFirstResponseColumn: data.columnMaxAbs[1] ?? null
  };
}
