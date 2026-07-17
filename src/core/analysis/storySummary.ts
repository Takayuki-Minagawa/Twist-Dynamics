import { FormatParseError } from "../../io";
import type { BuildingModel, Point2D, WallCharaDB } from "../types";
import { STANDARD_GRAVITY_CM, type StoryContribution } from "./types";

export interface StorySummary extends StoryContribution {
  layer: number;
  massCenter: Point2D;
  stiffnessCenter: { x: number | null; y: number | null };
  eccentricityX: number | null;
  eccentricityY: number | null;
  torsionalStiffnessAtCenter: number | null;
  elasticRadiusX: number | null;
  elasticRadiusY: number | null;
  eccentricityRatioX: number | null;
  eccentricityRatioY: number | null;
  specificStiffnessX: number | null;
  specificStiffnessY: number | null;
  /** K/W normalized by the building-wide mean. This is not the statutory Japanese Rs. */
  relativeSpecificStiffnessX: number | null;
  /** K/W normalized by the building-wide mean. This is not the statutory Japanese Rs. */
  relativeSpecificStiffnessY: number | null;
}

export function createStoryContribution(): StoryContribution {
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

export function addDirectionalContribution(
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
    return;
  }

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

function safeLayerToIndex(layer: number, storyCount: number, itemName: string): number {
  if (!Number.isInteger(layer) || layer < 1 || layer > storyCount) {
    throw new FormatParseError(`Analysis: ${itemName}.layer must be between 1 and ${storyCount}.`);
  }
  return layer - 1;
}

function finiteRatio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return null;
  }
  return numerator / denominator;
}

export function calculateStoryContributions(model: BuildingModel): StoryContribution[] {
  const structInfo = model.structInfo;
  if (!structInfo) {
    throw new FormatParseError("Analysis: structInfo is required.");
  }

  const storyCount = structInfo.massN;
  const contributions = Array.from({ length: storyCount }, () => createStoryContribution());

  const addToStory = (
    storyIndex: number,
    direction: "X" | "Y",
    kValue: number,
    cValue: number,
    position: Point2D
  ): void => {
    const center = structInfo.wCenter[storyIndex];
    if (!center) {
      throw new FormatParseError(`Analysis: wCenter[${storyIndex}] is required.`);
    }
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
    const length = Math.hypot(
      wall.pos[1].x - wall.pos[0].x,
      wall.pos[1].y - wall.pos[0].y
    );
    const position = {
      x: (wall.pos[0].x + wall.pos[1].x) / 2,
      y: (wall.pos[0].y + wall.pos[1].y) / 2
    };
    const kValue = chara.isEigenEffectK
      ? chara.isKCUnitChara
        ? chara.k * length
        : chara.k
      : 0;
    // Legacy wall damping conventions vary by dataset. Keep baseline behavior:
    // Rayleigh damping and explicit dampers provide analysis damping.
    addToStory(storyIndex, direction, kValue, 0, position);
  }

  for (const brace of model.braceDampers) {
    const storyIndex = safeLayerToIndex(brace.layer, storyCount, "braceDamper");
    addToStory(
      storyIndex,
      brace.direct,
      brace.isEigenEffectK ? brace.k : 0,
      brace.c,
      brace.pos
    );
  }

  for (const damper of model.massDampers) {
    const storyIndex = safeLayerToIndex(damper.layer, storyCount, "massDamper");
    const mass = damper.weight / STANDARD_GRAVITY_CM;
    const kx =
      (4 * Math.PI * Math.PI * damper.weight * damper.freq.x * damper.freq.x) /
      (STANDARD_GRAVITY_CM * 100);
    const ky =
      (4 * Math.PI * Math.PI * damper.weight * damper.freq.y * damper.freq.y) /
      (STANDARD_GRAVITY_CM * 100);
    const cx = 2 * damper.h.x * Math.sqrt(Math.max(kx, 0) * Math.max(mass, 0));
    const cy = 2 * damper.h.y * Math.sqrt(Math.max(ky, 0) * Math.max(mass, 0));
    addToStory(storyIndex, "X", kx, cx, damper.pos);
    addToStory(storyIndex, "Y", ky, cy, damper.pos);
  }

  return contributions;
}

export function calculateStorySummaries(model: BuildingModel): StorySummary[] {
  const structInfo = model.structInfo;
  if (!structInfo) {
    throw new FormatParseError("Analysis: structInfo is required.");
  }

  const contributions = calculateStoryContributions(model);
  const specificX = contributions.map((item, index) =>
    finiteRatio(item.kxx, structInfo.weight[index] ?? 0)
  );
  const specificY = contributions.map((item, index) =>
    finiteRatio(item.kyy, structInfo.weight[index] ?? 0)
  );
  const average = (values: Array<number | null>): number | null => {
    const finite = values.filter((value): value is number => value !== null && Number.isFinite(value));
    if (finite.length === 0) return null;
    return finite.reduce((sum, value) => sum + value, 0) / finite.length;
  };
  const averageSpecificX = average(specificX);
  const averageSpecificY = average(specificY);

  return contributions.map((item, index) => {
    const massCenter = structInfo.wCenter[index];
    if (!massCenter) {
      throw new FormatParseError(`Analysis: wCenter[${index}] is required.`);
    }

    const stiffnessCenter = {
      x: item.kyy > 0 ? massCenter.x + item.kyr / item.kyy : null,
      y: item.kxx > 0 ? massCenter.y - item.kxr / item.kxx : null
    };
    const eccentricityX =
      stiffnessCenter.x === null ? null : stiffnessCenter.x - massCenter.x;
    const eccentricityY =
      stiffnessCenter.y === null ? null : stiffnessCenter.y - massCenter.y;
    const hasDirectionalStiffness = item.kxx > 0 || item.kyy > 0;
    const torsionalStiffnessAtCenter = hasDirectionalStiffness
      ? item.krr -
        (item.kxx > 0 ? (item.kxr * item.kxr) / item.kxx : 0) -
        (item.kyy > 0 ? (item.kyr * item.kyr) / item.kyy : 0)
      : null;
    const positiveTorsionalStiffness =
      torsionalStiffnessAtCenter !== null && torsionalStiffnessAtCenter > 0
        ? torsionalStiffnessAtCenter
        : null;
    const elasticRadiusX =
      positiveTorsionalStiffness === null || item.kxx <= 0
        ? null
        : Math.sqrt(positiveTorsionalStiffness / item.kxx);
    const elasticRadiusY =
      positiveTorsionalStiffness === null || item.kyy <= 0
        ? null
        : Math.sqrt(positiveTorsionalStiffness / item.kyy);

    return {
      ...item,
      layer: index + 1,
      massCenter: { ...massCenter },
      stiffnessCenter,
      eccentricityX,
      eccentricityY,
      torsionalStiffnessAtCenter,
      elasticRadiusX,
      elasticRadiusY,
      // X loading twists about the Y offset; Y loading twists about the X offset.
      eccentricityRatioX:
        eccentricityY === null || elasticRadiusX === null
          ? null
          : Math.abs(eccentricityY) / elasticRadiusX,
      eccentricityRatioY:
        eccentricityX === null || elasticRadiusY === null
          ? null
          : Math.abs(eccentricityX) / elasticRadiusY,
      specificStiffnessX: specificX[index],
      specificStiffnessY: specificY[index],
      relativeSpecificStiffnessX:
        specificX[index] === null || averageSpecificX === null || averageSpecificX <= 0
          ? null
          : specificX[index] / averageSpecificX,
      relativeSpecificStiffnessY:
        specificY[index] === null || averageSpecificY === null || averageSpecificY <= 0
          ? null
          : specificY[index] / averageSpecificY
    };
  });
}

function csvCell(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "" : String(value);
}

export function serializeStorySummariesCsv(summaries: StorySummary[]): string {
  const header = [
    "layer",
    "Kx(kN/cm)",
    "Ky(kN/cm)",
    "centerX(cm)",
    "centerY(cm)",
    "ex(cm)",
    "ey(cm)",
    "elasticRadiusX(cm)",
    "elasticRadiusY(cm)",
    "eccentricityRatioX",
    "eccentricityRatioY",
    "relativeSpecificStiffnessX(simple;not-statutory-Rs)",
    "relativeSpecificStiffnessY(simple;not-statutory-Rs)"
  ];
  const rows = summaries.map((summary) =>
    [
      String(summary.layer),
      csvCell(summary.kxx),
      csvCell(summary.kyy),
      csvCell(summary.stiffnessCenter.x),
      csvCell(summary.stiffnessCenter.y),
      csvCell(summary.eccentricityX),
      csvCell(summary.eccentricityY),
      csvCell(summary.elasticRadiusX),
      csvCell(summary.elasticRadiusY),
      csvCell(summary.eccentricityRatioX),
      csvCell(summary.eccentricityRatioY),
      csvCell(summary.relativeSpecificStiffnessX),
      csvCell(summary.relativeSpecificStiffnessY)
    ].join(",")
  );
  return [header.join(","), ...rows].join("\n") + "\n";
}
