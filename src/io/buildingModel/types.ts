import type { BuildingModel, StructType } from "../../core/types";

export interface BuildingModelJsonDocument {
  format: string;
  version: number;
  model: unknown;
}

export interface BuildingModelSummary {
  story: number | null;
  structType: StructType | null;
  floorCount: number;
  columnCount: number;
  wallCount: number;
  wallCharaCount: number;
  massDamperCount: number;
  braceDamperCount: number;
  dxPanelCount: number;
}

export interface BuildingModelParserModule {
  parse(jsonText: string): BuildingModel;
  serialize(model: BuildingModel): string;
  summarize(model: BuildingModel): BuildingModelSummary;
}
