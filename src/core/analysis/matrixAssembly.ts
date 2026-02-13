import type { BaseShapeInfo, BuildingModel, Point2D, WallCharaDB } from "../types";
import { FormatParseError } from "../../io";
import { STANDARD_GRAVITY_CM, type AnalysisMatrices, type AnalysisOptions, type StoryContribution } from "./types";

function createZeroMatrix(size: number): number[][] {
  return Array.from({ length: size }, () => new Array<number>(size).fill(0));
}

function createStoryContribution(): StoryContribution {
  return {
    kxx: 0,
    kyy: 0,
    kxr: 0,
    kyr: 0,
    krr: 0,
    cxx: 0,
    cyy: 0,
    cxr: 0,
    cyr: 0,
    crr: 0
  };
}

function dofLabelForFloor(layer: number): string[] {
  return [`DX_${layer}`, `DY_${layer}`, `RZ_${layer}`];
}

function addDirectionalContribution(
  target: StoryContribution,
  direction: "X" | "Y",
  value: number,
  position: Point2D,
  center: Point2D,
  kind: "k" | "c"
): void {
  if (!Number.isFinite(value) || value === 0) return;

  const yOffset = position.y - center.y;
  const xOffset = position.x - center.x;

  if (direction === "X") {
    if (kind === "k") {
      target.kxx += value;
      target.kxr += -value * yOffset;
      target.krr += value * yOffset * yOffset;
    } else {
      target.cxx += value;
      target.cxr += -value * yOffset;
      target.crr += value * yOffset * yOffset;
    }
  } else {
    if (kind === "k") {
      target.kyy += value;
      target.kyr += value * xOffset;
      target.krr += value * xOffset * xOffset;
    } else {
      target.cyy += value;
      target.cyr += value * xOffset;
      target.crr += value * xOffset * xOffset;
    }
  }
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

function findWallChara(wallCharaDB: WallCharaDB[], name: string): WallCharaDB {
  const found = wallCharaDB.find((entry) => entry.name === name);
  if (!found) {
    throw new FormatParseError(`Analysis: wallChara "${name}" was not found.`);
  }
  return found;
}

function classifyWallDirection(start: Point2D, end: Point2D): "X" | "Y" {
  if (start.x === end.x) return "X";
  if (start.y === end.y) return "Y";
  throw new FormatParseError("Analysis: wall must be aligned to X or Y axis.");
}

function wallLength(start: Point2D, end: Point2D): number {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

function computeWallValue(chara: WallCharaDB, length: number, field: "k" | "c"): number {
  const raw = field === "k" ? chara.k : chara.c;
  return chara.isKCUnitChara ? raw * length : raw;
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

function safeLayerToIndex(layer: number, storyCount: number, itemName: string): number {
  if (!Number.isInteger(layer) || layer < 1 || layer > storyCount) {
    throw new FormatParseError(`Analysis: ${itemName}.layer must be between 1 and ${storyCount}.`);
  }
  return layer - 1;
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
  const contributions = Array.from({ length: storyCount }, () => createStoryContribution());
  const baseShape = buildBaseShape(model, storyCount);

  const addToStory = (
    storyIndex: number,
    direction: "X" | "Y",
    kValue: number,
    cValue: number,
    position: Point2D
  ): void => {
    const center = structInfo.wCenter[storyIndex];
    addDirectionalContribution(contributions[storyIndex], direction, kValue, position, center, "k");
    addDirectionalContribution(contributions[storyIndex], direction, cValue, position, center, "c");
  };

  for (const column of model.columns) {
    const storyIndex = safeLayerToIndex(column.layer, storyCount, "column");
    addToStory(storyIndex, "X", column.kx, 0, column.pos);
    addToStory(storyIndex, "Y", column.ky, 0, column.pos);
  }

  for (const wall of model.walls) {
    const storyIndex = safeLayerToIndex(wall.layer, storyCount, "wall");
    const chara = findWallChara(model.wallCharaDB, wall.name);
    const direction = classifyWallDirection(wall.pos[0], wall.pos[1]);
    const length = wallLength(wall.pos[0], wall.pos[1]);
    const center = {
      x: (wall.pos[0].x + wall.pos[1].x) / 2,
      y: (wall.pos[0].y + wall.pos[1].y) / 2
    };

    const kValue = chara.isEigenEffectK ? computeWallValue(chara, length, "k") : 0;
    // wallChara.c semantics differ across legacy datasets; keep it out of baseline damping
    // and rely on Rayleigh + explicit dampers for stable, readable modal results.
    const cValue = 0;
    addToStory(storyIndex, direction, kValue, cValue, center);
  }

  for (const panel of model.dxPanels) {
    const storyIndex = safeLayerToIndex(panel.layer, storyCount, "dxPanel");
    if (panel.pos.length === 0) continue;
    const centroid = panel.pos.reduce(
      (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
      { x: 0, y: 0 }
    );
    const point = {
      x: centroid.x / panel.pos.length,
      y: centroid.y / panel.pos.length
    };
    addToStory(storyIndex, panel.direct, panel.k, 0, point);
  }

  for (const brace of model.braceDampers) {
    const storyIndex = safeLayerToIndex(brace.layer, storyCount, "braceDamper");
    const kValue = brace.isEigenEffectK ? brace.k : 0;
    addToStory(storyIndex, brace.direct, kValue, brace.c, brace.pos);
  }

  for (const damper of model.massDampers) {
    const storyIndex = safeLayerToIndex(damper.layer, storyCount, "massDamper");
    const mdMass = damper.weight / STANDARD_GRAVITY_CM;
    const addMassIndex = storyIndex * 3;
    mass[addMassIndex][addMassIndex] += mdMass;
    mass[addMassIndex + 1][addMassIndex + 1] += mdMass;

    const kx = (4 * Math.PI * Math.PI * damper.weight * damper.freq.x * damper.freq.x) /
      (STANDARD_GRAVITY_CM * 100);
    const ky = (4 * Math.PI * Math.PI * damper.weight * damper.freq.y * damper.freq.y) /
      (STANDARD_GRAVITY_CM * 100);

    const cx = 2 * damper.h.x * Math.sqrt(Math.max(kx, 0) * Math.max(mdMass, 0));
    const cy = 2 * damper.h.y * Math.sqrt(Math.max(ky, 0) * Math.max(mdMass, 0));

    addToStory(storyIndex, "X", kx, cx, damper.pos);
    addToStory(storyIndex, "Y", ky, cy, damper.pos);
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
