import type { BuildingModel } from "../../core/types";

export interface BuildingModelJsonDocument {
  format: string;
  version: number;
  model: unknown;
}

export interface BuildingModelSummary {
  story: number | null;
  floorCount: number;
  columnCount: number;
  wallCount: number;
  wallCharaCount: number;
  massDamperCount: number;
  braceDamperCount: number;
}

export type BuildingModelWarningCode =
  | "legacy-struct-type-ignored"
  | "legacy-dx-panels-converted";

export interface BuildingModelWarning {
  code: BuildingModelWarningCode;
  message: string;
  path: "structInfo.sType" | "dxPanels";
  count?: number;
}

export interface BuildingModelParseResult {
  model: BuildingModel;
  warnings: BuildingModelWarning[];
}

export interface BuildingModelParserModule {
  parse(jsonText: string): BuildingModel;
  serialize(model: BuildingModel): string;
  summarize(model: BuildingModel): BuildingModelSummary;
}
