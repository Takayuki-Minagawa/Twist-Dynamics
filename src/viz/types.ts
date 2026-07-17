import type { Point2D } from "../core/types";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** A rigid in-plane floor pose in model coordinates (cm, cm, rad). */
export interface LevelPose {
  dx: number;
  dy: number;
  rz: number;
}

/**
 * A point attached to a building level. Fractional levels interpolate the
 * rigid poses of the floors immediately below and above the point.
 */
export interface AttachedPoint {
  plan: Point2D;
  z: number;
  level: number;
}

export const VISUALIZATION_CATEGORIES = [
  "floors",
  "columns",
  "structuralWalls",
  "nonStructuralWalls",
  "braceDampers",
  "massDampers",
  "massCenters",
  "stiffnessCenters"
] as const;

export type VisualizationCategory = (typeof VISUALIZATION_CATEGORIES)[number];

export interface FloorPrimitive {
  id: string;
  category: "floors";
  /** 0 is the base; 1..N are the moving upper floor levels. */
  story: number;
  level: number;
  z: number;
  polygon: Point2D[];
}

export interface SegmentPrimitive {
  id: string;
  category: "columns" | "braceDampers";
  story: number;
  start: AttachedPoint;
  end: AttachedPoint;
  radius: number;
}

export interface WallPrimitive {
  id: string;
  category: "structuralWalls" | "nonStructuralWalls";
  story: number;
  lowerStart: AttachedPoint;
  lowerEnd: AttachedPoint;
  upperStart: AttachedPoint;
  upperEnd: AttachedPoint;
  thickness: number;
}

export interface MassDamperPrimitive {
  id: string;
  category: "massDampers";
  story: number;
  level: number;
  anchor: Point2D;
  z: number;
  radius: number;
  spring: Point2D[];
  springZ: number[];
}

export interface CenterPrimitive {
  id: string;
  category: "massCenters" | "stiffnessCenters";
  story: number;
  level: number;
  point: Point2D;
  z: number;
  radius: number;
}

export interface ModelGeometryBounds {
  min: Vec3;
  max: Vec3;
  center: Vec3;
  size: Vec3;
  characteristicLength: number;
}

export interface ModelGeometry {
  storyCount: number;
  zLevels: number[];
  /** Rotation pivots for levels 0..N. Level 0 is fixed. */
  levelCenters: Point2D[];
  floors: FloorPrimitive[];
  columns: SegmentPrimitive[];
  walls: WallPrimitive[];
  braces: SegmentPrimitive[];
  massDampers: MassDamperPrimitive[];
  centers: CenterPrimitive[];
  bounds: ModelGeometryBounds;
}

export interface StoryCenterSummary {
  layer: number;
  stiffnessCenter: { x: number | null; y: number | null } | null;
}

export interface ResponseSeries {
  storyCount: number;
  times: number[];
  duration: number;
  poses: LevelPose[][];
}

export interface ViewerPlaybackState {
  playing: boolean;
  currentTime: number;
  duration: number;
  speed: number;
  loop: boolean;
  kind: "static" | "realMode" | "complexMode" | "response";
}

export interface ThreeViewerOptions {
  background?: number | string;
  maxPixelRatio?: number;
  columnColor?: number | string;
  structuralWallColor?: number | string;
  nonStructuralWallColor?: number | string;
  braceColor?: number | string;
  floorColor?: number | string;
  massDamperColor?: number | string;
}
