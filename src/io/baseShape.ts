import type { BaseShapeInfo } from "../core/types";
import {
  FormatParseError,
  normalizeNewLines,
  parseNumberToken,
  splitCsvLikeLine,
  toNumberListStrict
} from "./text";

export function parseBaseShapeInfo(text: string): BaseShapeInfo {
  const lines = normalizeNewLines(text)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const base: BaseShapeInfo = {
    zLevel: [],
    massCenters: []
  };
  let hasStory = false;
  let hasZLevel = false;

  for (const line of lines) {
    const tokens = splitCsvLikeLine(line);
    if (tokens.length === 0) continue;
    if (tokens[0] === "Story") {
      if (tokens.length < 2) {
        throw new FormatParseError("BaseShapeInfo: Story value is missing.");
      }
      base.story = parseNumberToken(tokens[1], "BaseShapeInfo.Story");
      hasStory = true;
      continue;
    }
    if (tokens[0] === "Zlebe") {
      base.zLevel = toNumberListStrict(tokens.slice(1), "BaseShapeInfo.Zlebe");
      hasZLevel = true;
      continue;
    }
    if (tokens[0].startsWith("MC")) {
      const values = toNumberListStrict(tokens.slice(1), "BaseShapeInfo.MC");
      if (values.length < 3) {
        throw new FormatParseError("BaseShapeInfo: MC must contain layer,x,y.");
      }
      base.massCenters.push({
        layer: values[0],
        x: values[1],
        y: values[2]
      });
    }
  }

  if (!hasStory) {
    throw new FormatParseError("BaseShapeInfo: Story is required.");
  }
  if (!hasZLevel) {
    throw new FormatParseError("BaseShapeInfo: Zlebe is required.");
  }

  return base;
}
