import type { BaseShapeInfo, BuildingModel } from "../types";
import { FormatParseError } from "../../io";
import { STANDARD_GRAVITY_CM, type AnalysisMatrices, type AnalysisOptions } from "./types";
import { calculateStoryContributions } from "./storySummary";

function createZeroMatrix(size: number): number[][] {
  return Array.from({ length: size }, () => new Array<number>(size).fill(0));
}

function dofLabelForFloor(layer: number): string[] {
  return [`DX_${layer}`, `DY_${layer}`, `RZ_${layer}`];
}

function addStoryBlock(
  globalMatrix: number[][],
  storyIndex: number,
  block: [number, number, number, number, number],
  storyCount: number
): void {
  const [xx, yy, xr, yr, rr] = block;
  const local = [
    [xx, 0, xr],
    [0, yy, yr],
    [xr, yr, rr]
  ];

  const rowBase = storyIndex * 3;

  const addAt = (a: number, b: number, sign: number): void => {
    const ra = a * 3;
    const rb = b * 3;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        globalMatrix[ra + i][rb + j] += sign * local[i][j];
      }
    }
  };

  if (storyIndex === 0) {
    addAt(0, 0, 1);
    return;
  }

  const lower = storyIndex - 1;
  addAt(storyIndex, storyIndex, 1);
  addAt(lower, lower, 1);
  addAt(storyIndex, lower, -1);
  addAt(lower, storyIndex, -1);

  if (storyIndex >= storyCount) {
    throw new FormatParseError(`Invalid story index: ${storyIndex}`);
  }

  if (!Number.isFinite(rowBase)) {
    throw new FormatParseError("Invalid matrix index while assembling story block.");
  }
}

function buildBaseShape(model: BuildingModel, storyCount: number): BaseShapeInfo {
  return {
    story: storyCount,
    zLevel: model.structInfo?.zLevel.slice() ?? [],
    massCenters: (model.structInfo?.wCenter ?? []).map((center, index) => ({
      layer: index + 1,
      x: center.x,
      y: center.y
    }))
  };
}

export function assembleAnalysisMatrices(
  model: BuildingModel,
  options: AnalysisOptions = {}
): AnalysisMatrices {
  const structInfo = model.structInfo;
  if (!structInfo) {
    throw new FormatParseError("Analysis: structInfo is required.");
  }

  const storyCount = structInfo.massN;
  if (storyCount < 1) {
    throw new FormatParseError("Analysis: massN must be >= 1.");
  }

  if (structInfo.weight.length !== storyCount || structInfo.wMoment.length !== storyCount) {
    throw new FormatParseError("Analysis: weight/wMoment length must match massN.");
  }
  if (structInfo.wCenter.length !== storyCount) {
    throw new FormatParseError("Analysis: wCenter length must match massN.");
  }

  const dofCount = storyCount * 3;
  const mass = createZeroMatrix(dofCount);
  const stiffness = createZeroMatrix(dofCount);
  const damping = createZeroMatrix(dofCount);
  const contributions = calculateStoryContributions(model);
  const baseShape = buildBaseShape(model, storyCount);

  for (const damper of model.massDampers) {
    const storyIndex = damper.layer - 1;
    const mdMass = damper.weight / STANDARD_GRAVITY_CM;
    const addMassIndex = storyIndex * 3;
    mass[addMassIndex][addMassIndex] += mdMass;
    mass[addMassIndex + 1][addMassIndex + 1] += mdMass;
  }

  for (let i = 0; i < storyCount; i++) {
    const m = structInfo.weight[i] / STANDARD_GRAVITY_CM;
    const inertia = structInfo.wMoment[i] / STANDARD_GRAVITY_CM;
    const base = i * 3;
    mass[base][base] += m;
    mass[base + 1][base + 1] += m;
    mass[base + 2][base + 2] += inertia;
  }

  for (let i = 0; i < storyCount; i++) {
    const s = contributions[i];
    addStoryBlock(stiffness, i, [s.kxx, s.kyy, s.kxr, s.kyr, s.krr], storyCount);
    addStoryBlock(damping, i, [s.cxx, s.cyy, s.cxr, s.cyr, s.crr], storyCount);
  }

  const dofLabels = Array.from({ length: storyCount }, (_, i) => dofLabelForFloor(i + 1)).flat();

  if ((options.defaultDampingRatio ?? 0.02) < 0) {
    throw new FormatParseError("Analysis: defaultDampingRatio must be >= 0.");
  }

  return {
    model,
    storyCount,
    dofCount,
    mass,
    stiffness,
    damping,
    baseShape,
    dofLabels
  };
}
