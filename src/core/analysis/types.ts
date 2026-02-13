import type { BaseShapeInfo, BuildingModel } from "../types";

export const STANDARD_GRAVITY_CM = 980.665;

export interface AnalysisMatrices {
  model: BuildingModel;
  storyCount: number;
  dofCount: number;
  mass: number[][];
  stiffness: number[][];
  damping: number[][];
  baseShape: BaseShapeInfo;
  dofLabels: string[];
}

export interface AnalysisOptions {
  defaultDampingRatio?: number;
}

export interface StoryContribution {
  kxx: number;
  kyy: number;
  kxr: number;
  kyr: number;
  krr: number;
  cxx: number;
  cyy: number;
  cxr: number;
  cyr: number;
  crr: number;
}

export interface ComplexValue {
  re: number;
  im: number;
}
