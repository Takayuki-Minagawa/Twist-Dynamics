import type { BuildingModel, Point2D } from "../core/types";
import type {
  AttachedPoint,
  CenterPrimitive,
  FloorPrimitive,
  MassDamperPrimitive,
  ModelGeometry,
  ModelGeometryBounds,
  SegmentPrimitive,
  StoryCenterSummary,
  Vec3,
  WallPrimitive
} from "./types";

const EPSILON = 1e-9;

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
  return value;
}

function copyPoint(point: Point2D, label: string): Point2D {
  return { x: finite(point.x, `${label}.x`), y: finite(point.y, `${label}.y`) };
}

function calculatePlanBounds(model: BuildingModel, storySummaries: StoryCenterSummary[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  const points: Point2D[] = [];
  for (const floor of model.floors) points.push(...floor.pos);
  for (const column of model.columns) points.push(column.pos);
  for (const wall of model.walls) points.push(...wall.pos);
  for (const brace of model.braceDampers) {
    points.push(brace.pos);
    const sign = brace.isLightPos ? 1 : -1;
    points.push({
      x: brace.pos.x + (brace.direct === "X" ? Math.abs(brace.width) * sign : 0),
      y: brace.pos.y + (brace.direct === "Y" ? Math.abs(brace.width) * sign : 0)
    });
  }
  for (const damper of model.massDampers) points.push(damper.pos);
  for (const center of model.structInfo?.wCenter ?? []) points.push(center);
  for (const summary of storySummaries) {
    const center = summary.stiffnessCenter;
    if (
      center &&
      center.x !== null &&
      center.y !== null &&
      Number.isFinite(center.x) &&
      Number.isFinite(center.y)
    ) {
      points.push({ x: center.x, y: center.y });
    }
  }

  if (points.length === 0) {
    return { minX: -50, maxX: 50, minY: -50, maxY: 50 };
  }

  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      maxX: Math.max(bounds.maxX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxY: Math.max(bounds.maxY, point.y)
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY
    }
  );
}

function createBounds(
  plan: ReturnType<typeof calculatePlanBounds>,
  zLevels: number[]
): ModelGeometryBounds {
  const minElevation = Math.min(...zLevels);
  const maxElevation = Math.max(...zLevels);
  const min: Vec3 = { x: plan.minX, y: minElevation, z: -plan.maxY };
  const max: Vec3 = { x: plan.maxX, y: maxElevation, z: -plan.minY };
  const size = { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z };
  const characteristicLength = Math.max(Math.hypot(size.x, size.z), size.y, 1);
  return {
    min,
    max,
    size,
    center: {
      x: (min.x + max.x) / 2,
      y: (min.y + max.y) / 2,
      z: (min.z + max.z) / 2
    },
    characteristicLength
  };
}

function attached(plan: Point2D, z: number, level: number): AttachedPoint {
  return { plan: { ...plan }, z, level };
}

function createSpring(
  anchor: Point2D,
  zStart: number,
  zEnd: number,
  radius: number
): Pick<MassDamperPrimitive, "spring" | "springZ"> {
  const turns = 4;
  const count = 25;
  const spring: Point2D[] = [];
  const springZ: number[] = [];
  for (let i = 0; i < count; i++) {
    const ratio = i / (count - 1);
    const taper = i === 0 || i === count - 1 ? 0 : 1;
    spring.push({
      x: anchor.x + Math.sin(ratio * turns * Math.PI * 2) * radius * 0.35 * taper,
      y: anchor.y
    });
    springZ.push(zStart + (zEnd - zStart) * ratio);
  }
  return { spring, springZ };
}

function storyHeight(zLevels: number[], story: number): number {
  return Math.max(0, (zLevels[story] ?? 0) - (zLevels[story - 1] ?? 0));
}

export function buildModelGeometry(
  model: BuildingModel,
  storySummaries: StoryCenterSummary[] = []
): ModelGeometry {
  const structInfo = model.structInfo;
  if (!structInfo) throw new Error("3D visualization requires structInfo.");
  const storyCount = structInfo.massN;
  if (!Number.isInteger(storyCount) || storyCount < 1) {
    throw new Error("3D visualization requires massN >= 1.");
  }
  if (structInfo.zLevel.length !== storyCount + 1) {
    throw new Error("3D visualization requires zLevel.length === massN + 1.");
  }
  if (structInfo.wCenter.length !== storyCount) {
    throw new Error("3D visualization requires one mass center per story.");
  }

  const zLevels = structInfo.zLevel.map((value, index) => finite(value, `zLevel[${index}]`));
  const planBounds = calculatePlanBounds(model, storySummaries);
  const bounds = createBounds(planBounds, zLevels);
  const planSpan = Math.max(bounds.size.x, bounds.size.z, 1);
  const memberRadius = Math.min(Math.max(planSpan * 0.006, 2), 16);
  const wallThickness = Math.min(Math.max(planSpan * 0.004, 2), 12);
  const markerRadius = Math.min(Math.max(planSpan * 0.012, 5), 24);
  const levelCenters: Point2D[] = [
    { ...structInfo.wCenter[0] },
    ...structInfo.wCenter.map((point, index) => copyPoint(point, `wCenter[${index}]`))
  ];

  const floors: FloorPrimitive[] = model.floors.map((floor, index) => {
    const level = floor.layer - 1;
    if (!Number.isInteger(level) || level < 0 || level > storyCount) {
      throw new Error(`floors[${index}].layer is outside 1..${storyCount + 1}.`);
    }
    return {
      id: `floor-${index}`,
      category: "floors",
      story: level,
      level,
      z: zLevels[level],
      polygon: floor.pos.map((point, pointIndex) => copyPoint(point, `floors[${index}].pos[${pointIndex}]`))
    };
  });

  const columns: SegmentPrimitive[] = model.columns.map((column, index) => {
    const story = column.layer;
    if (!Number.isInteger(story) || story < 1 || story > storyCount) {
      throw new Error(`columns[${index}].layer is outside 1..${storyCount}.`);
    }
    const point = copyPoint(column.pos, `columns[${index}].pos`);
    return {
      id: `column-${index}`,
      category: "columns",
      story,
      start: attached(point, zLevels[story - 1], story - 1),
      end: attached(point, zLevels[story], story),
      radius: memberRadius
    };
  });

  const wallChara = new Map(model.wallCharaDB.map((entry) => [entry.name, entry]));
  const walls: WallPrimitive[] = [];
  for (const [index, wall] of model.walls.entries()) {
    if (!wall.isVisible) continue;
    const story = wall.layer;
    if (!Number.isInteger(story) || story < 1 || story > storyCount) {
      throw new Error(`walls[${index}].layer is outside 1..${storyCount}.`);
    }
    const chara = wallChara.get(wall.name);
    if (!chara) throw new Error(`walls[${index}] references unknown wallChara "${wall.name}".`);
    const start = copyPoint(wall.pos[0], `walls[${index}].pos[0]`);
    const end = copyPoint(wall.pos[1], `walls[${index}].pos[1]`);
    const category = chara.isEigenEffectK ? "structuralWalls" : "nonStructuralWalls";
    walls.push({
      id: `wall-${index}`,
      category,
      story,
      lowerStart: attached(start, zLevels[story - 1], story - 1),
      lowerEnd: attached(end, zLevels[story - 1], story - 1),
      upperStart: attached(start, zLevels[story], story),
      upperEnd: attached(end, zLevels[story], story),
      thickness: wallThickness
    });
  }

  const braces: SegmentPrimitive[] = [];
  for (const [index, brace] of model.braceDampers.entries()) {
    const story = brace.layer;
    if (!Number.isInteger(story) || story < 1 || story > storyCount) {
      throw new Error(`braceDampers[${index}].layer is outside 1..${storyCount}.`);
    }
    const heightAvailable = storyHeight(zLevels, story);
    const height = Math.min(Math.abs(brace.height) || heightAvailable, heightAvailable);
    const levelRatio = heightAvailable > EPSILON ? height / heightAvailable : 1;
    const width = Math.abs(brace.width);
    const directionSign = brace.isLightPos ? 1 : -1;
    const axis = brace.direct === "X" ? { x: 1, y: 0 } : { x: 0, y: 1 };
    const first = copyPoint(brace.pos, `braceDampers[${index}].pos`);
    const second = {
      x: first.x + axis.x * width * directionSign,
      y: first.y + axis.y * width * directionSign
    };
    const lowerLevel = story - 1;
    const upperLevel = lowerLevel + levelRatio;
    const lowerZ = zLevels[story - 1];
    const upperZ = lowerZ + height;
    braces.push(
      {
        id: `brace-${index}-a`,
        category: "braceDampers",
        story,
        start: attached(first, lowerZ, lowerLevel),
        end: attached(second, upperZ, upperLevel),
        radius: memberRadius * 0.65
      },
      {
        id: `brace-${index}-b`,
        category: "braceDampers",
        story,
        start: attached(second, lowerZ, lowerLevel),
        end: attached(first, upperZ, upperLevel),
        radius: memberRadius * 0.65
      }
    );
  }

  const massDampers: MassDamperPrimitive[] = model.massDampers.map((damper, index) => {
    const story = damper.layer;
    if (!Number.isInteger(story) || story < 1 || story > storyCount) {
      throw new Error(`massDampers[${index}].layer is outside 1..${storyCount}.`);
    }
    const anchor = copyPoint(damper.pos, `massDampers[${index}].pos`);
    const radius = markerRadius * 1.15;
    const floorZ = zLevels[story];
    const sphereZ = floorZ + radius * 2.8;
    return {
      id: `mass-damper-${index}`,
      category: "massDampers",
      story,
      level: story,
      anchor,
      z: sphereZ,
      radius,
      ...createSpring(anchor, floorZ + radius * 0.15, sphereZ - radius, radius)
    };
  });

  const centers: CenterPrimitive[] = structInfo.wCenter.map((point, index) => ({
    id: `mass-center-${index}`,
    category: "massCenters",
    story: index + 1,
    level: index + 1,
    point: copyPoint(point, `wCenter[${index}]`),
    z: zLevels[index + 1] + markerRadius * 0.18,
    radius: markerRadius
  }));
  for (const [index, summary] of storySummaries.entries()) {
    const story = summary.layer;
    const center = summary.stiffnessCenter;
    if (
      !center ||
      center.x === null ||
      center.y === null ||
      !Number.isFinite(center.x) ||
      !Number.isFinite(center.y) ||
      !Number.isInteger(story) ||
      story < 1 ||
      story > storyCount
    ) {
      continue;
    }
    centers.push({
      id: `stiffness-center-${index}`,
      category: "stiffnessCenters",
      story,
      level: story,
      point: copyPoint({ x: center.x, y: center.y }, `storySummaries[${index}].stiffnessCenter`),
      z: zLevels[story] + markerRadius * 0.24,
      radius: markerRadius * 1.1
    });
  }

  return {
    storyCount,
    zLevels,
    levelCenters,
    floors,
    columns,
    walls,
    braces,
    massDampers,
    centers,
    bounds
  };
}
