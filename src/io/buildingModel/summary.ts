import type { BuildingModel } from "../../core/types";
import type { BuildingModelSummary } from "./types";

export function summarizeBuildingModel(model: BuildingModel): BuildingModelSummary {
  return {
    story: model.structInfo?.massN ?? null,
    structType: model.structInfo?.sType ?? null,
    floorCount: model.floors.length,
    columnCount: model.columns.length,
    wallCount: model.walls.length,
    wallCharaCount: model.wallCharaDB.length,
    massDamperCount: model.massDampers.length,
    braceDamperCount: model.braceDampers.length,
    dxPanelCount: model.dxPanels.length
  };
}
