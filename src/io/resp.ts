import type { RespFile } from "../core/types";
import { parseBaseShapeInfo } from "./baseShape";
import {
  extractMarkedSection,
  FormatParseError,
  parseNumberToken,
  splitCsvLikeLine,
  toTrimmedLines
} from "./text";

function getNumericValue(tokens: string[], label: string): number {
  const index = tokens.findIndex((token) => token === label);
  if (index < 0 || index + 1 >= tokens.length) {
    throw new FormatParseError(`Resp_Result: "${label}" is missing in meta row.`);
  }
  return parseNumberToken(tokens[index + 1], `Resp_Result.${label}`);
}

function parseCsvRow(line: string, expectedLength: number, rowLabel: string): number[] {
  const tokens = splitCsvLikeLine(line);
  if (tokens.length !== expectedLength) {
    throw new FormatParseError(
      `${rowLabel}: column count mismatch. expected ${expectedLength}, got ${tokens.length}.`
    );
  }
  return tokens.map((token, index) => parseNumberToken(token, `${rowLabel}[${index}]`));
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
  if (header.length === 0) {
    throw new FormatParseError("Resp_Result: header row is empty.");
  }
  const dataLines = section.body.slice(2).filter((line) => line.trim().length > 0);
  if (dataLines.length === 0) {
    throw new FormatParseError("Resp_Result: record rows are missing.");
  }

  const firstRowTokens = splitCsvLikeLine(dataLines[0]);
  const dataColumnLength = firstRowTokens.length;
  if (dataColumnLength === 0) {
    throw new FormatParseError("Resp_Result: first record row is empty.");
  }

  if (header.length > dataColumnLength) {
    throw new FormatParseError(
      `Resp_Result: header column count (${header.length}) exceeds data column count (${dataColumnLength}).`
    );
  }
  if (header.length < dataColumnLength) {
    const extraCount = dataColumnLength - header.length;
    for (let i = 0; i < extraCount; i++) {
      header.push(`Extra_${i + 1}`);
    }
  }

  const records: number[][] = [];
  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    records.push(parseCsvRow(line, dataColumnLength, `Resp_Result.row${i + 1}`));
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
      massCount: getNumericValue(metaTokens, "質点数"),
      dt: getNumericValue(metaTokens, "出力時間刻み(s)"),
      damperCount: getNumericValue(metaTokens, "ダンパー数")
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
