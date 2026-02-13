import type { BuildingModel } from "../../core/types";
import {
  BUILDING_MODEL_JSON_FORMAT,
  BUILDING_MODEL_JSON_VERSION
} from "./constants";
import { normalizeBuildingModel } from "./normalize";

export function serializeBuildingModelJson(model: BuildingModel): string {
  const normalizedModel = normalizeBuildingModel(model);
  return `${JSON.stringify(
    {
      format: BUILDING_MODEL_JSON_FORMAT,
      version: BUILDING_MODEL_JSON_VERSION,
      model: normalizedModel
    },
    null,
    2
  )}\n`;
}
