import type { BaseShapeInfo } from "../core/types";
import { normalizeNewLines, splitCsvLikeLine, toNumberList } from "./text";

export function parseBaseShapeInfo(text: string): BaseShapeInfo {
  const lines = normalizeNewLines(text)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const base: BaseShapeInfo = {
    zLevel: [],
    massCenters: []
  };

  for (const line of lines) {
    const tokens = splitCsvLikeLine(line);
    if (tokens.length === 0) continue;
    if (tokens[0] === "Story") {
      base.story = Number(tokens[1]);
      continue;
    }
    if (tokens[0] === "Zlebe") {
      base.zLevel = toNumberList(tokens.slice(1));
      continue;
    }
    if (tokens[0].startsWith("MC")) {
      const values = toNumberList(tokens.slice(1));
      if (values.length >= 3) {
        base.massCenters.push({
          layer: values[0],
          x: values[1],
          y: values[2]
        });
      }
    }
  }

  return base;
}
