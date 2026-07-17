import type { Point2D } from "../core/types";
import type { AttachedPoint, LevelPose, Vec3 } from "./types";

export const ZERO_LEVEL_POSE: Readonly<LevelPose> = Object.freeze({ dx: 0, dy: 0, rz: 0 });

export function createZeroLevelPoses(storyCount: number): LevelPose[] {
  if (!Number.isInteger(storyCount) || storyCount < 0) {
    throw new Error("storyCount must be a non-negative integer.");
  }
  return Array.from({ length: storyCount + 1 }, () => ({ dx: 0, dy: 0, rz: 0 }));
}

export function modelPointToWorld(point: Point2D, z: number): Vec3 {
  return { x: point.x, y: z, z: -point.y };
}

export function applyRigidFloorPose(point: Point2D, pivot: Point2D, pose: LevelPose): Point2D {
  const cosine = Math.cos(pose.rz);
  const sine = Math.sin(pose.rz);
  const localX = point.x - pivot.x;
  const localY = point.y - pivot.y;

  return {
    x: pivot.x + cosine * localX - sine * localY + pose.dx,
    y: pivot.y + sine * localX + cosine * localY + pose.dy
  };
}

function poseAtLevel(
  point: Point2D,
  level: number,
  levelCenters: Point2D[],
  levelPoses: LevelPose[]
): Point2D {
  const maxLevel = Math.min(levelCenters.length, levelPoses.length) - 1;
  if (maxLevel < 0) return { ...point };

  const clamped = Math.min(Math.max(level, 0), maxLevel);
  const lower = Math.floor(clamped);
  const upper = Math.ceil(clamped);
  const lowerPoint = applyRigidFloorPose(
    point,
    levelCenters[lower] ?? { x: 0, y: 0 },
    levelPoses[lower] ?? ZERO_LEVEL_POSE
  );
  if (upper === lower) return lowerPoint;

  const upperPoint = applyRigidFloorPose(
    point,
    levelCenters[upper] ?? levelCenters[lower] ?? { x: 0, y: 0 },
    levelPoses[upper] ?? ZERO_LEVEL_POSE
  );
  const ratio = clamped - lower;
  return {
    x: lowerPoint.x + (upperPoint.x - lowerPoint.x) * ratio,
    y: lowerPoint.y + (upperPoint.y - lowerPoint.y) * ratio
  };
}

export function deformAttachedPoint(
  point: AttachedPoint,
  levelCenters: Point2D[],
  levelPoses: LevelPose[]
): Vec3 {
  return modelPointToWorld(poseAtLevel(point.plan, point.level, levelCenters, levelPoses), point.z);
}

export function scaledLevelPoses(
  poses: LevelPose[],
  translationScale: number,
  rotationScale: number
): LevelPose[] {
  return poses.map((pose, index) =>
    index === 0
      ? { dx: 0, dy: 0, rz: 0 }
      : {
          dx: pose.dx * translationScale,
          dy: pose.dy * translationScale,
          rz: pose.rz * rotationScale
        }
  );
}

/** Scale mixed-unit modal vectors without applying a length unit to the radian DOF. */
export function scaledModalLevelPoses(
  poses: LevelPose[],
  characteristicLength: number,
  deformationScale: number,
  rotationEmphasis: number
): LevelPose[] {
  return scaledLevelPoses(
    poses,
    characteristicLength * 0.04 * deformationScale,
    0.02 * deformationScale * rotationEmphasis
  );
}
