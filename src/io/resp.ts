import type { RespFile } from "../core/types";
import { parseBaseShapeInfo } from "./baseShape";
import { normalizeNewLines, splitCsvLikeLine, toNumberList } from "./text";

function getNumericValue(tokens: string[], label: string, fallback = 0): number {
  const index = tokens.findIndex((token) => token === label);
  if (index < 0 || index + 1 >= tokens.length) return fallback;
  const n = Number(tokens[index + 1]);
  return Number.isFinite(n) ? n : fallback;
}

export function parseRespCsv(text: string): RespFile {
  const lines = normalizeNewLines(text)
    .split("\n")
    .map((line) => line.trimEnd());

  const resultStart = lines.findIndex((line) => line.includes("#Resp_Result"));
  if (resultStart < 0) {
    throw new Error("Resp_Result セクションが見つかりません。");
  }

  const baseShape = parseBaseShapeInfo(lines.slice(0, resultStart).join("\n"));

  const metaTokens = splitCsvLikeLine(lines[resultStart + 1] ?? "");
  const header = splitCsvLikeLine(lines[resultStart + 2] ?? "");
  const records: number[][] = [];

  for (let i = resultStart + 3; i < lines.length; i++) {
    const line = lines[i].trim();
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
