import type { BuildingModel } from "../../core/types";
import { FormatParseError } from "../text";
import { normalizeBuildingModel } from "./normalize";
import { parseBuildingModelDocumentWithMeta } from "./validator";
import type { BuildingModelParseResult } from "./types";

export function parseBuildingModelJson(jsonText: string): BuildingModel {
  return parseBuildingModelJsonWithMeta(jsonText).model;
}

export function parseBuildingModelJsonWithMeta(jsonText: string): BuildingModelParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new FormatParseError("BuildingModel JSON: invalid JSON.");
  }

  const result = parseBuildingModelDocumentWithMeta(parsed);
  return {
    model: normalizeBuildingModel(result.model),
    warnings: result.warnings
  };
}
