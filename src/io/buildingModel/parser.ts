import type { BuildingModel } from "../../core/types";
import { FormatParseError } from "../text";
import { normalizeBuildingModel } from "./normalize";
import { parseBuildingModelDocument } from "./validator";

export function parseBuildingModelJson(jsonText: string): BuildingModel {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new FormatParseError("BuildingModel JSON: invalid JSON.");
  }

  const model = parseBuildingModelDocument(parsed);
  return normalizeBuildingModel(model);
}
