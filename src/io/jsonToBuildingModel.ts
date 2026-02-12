import type { BuildingModel, Point2D, WallCharaDB } from "../core/types";
import { serializeBuildingModelXml } from "./buildingModel";

export interface NiceJsonInput {
  物件情報: {
    建物階数: number;
  };
  固有値解析諸元: Array<{
    階: number;
    層重量: number;
    重心: [number, number];
    重量慣性モーメント: number;
  }>;
  床情報: Array<{
    階: number;
    座標: number[];
  }>;
  柱剛性情報: Array<{
    階: number;
    位置: [number, number];
    通り方向剛性: [number, number];
  }>;
  壁剛性情報: Array<{
    名前: string;
    階: number;
    単位剛性: number;
    位置: [number, number, number, number];
  }>;
}

interface ValidatedNiceJsonInput {
  story: number;
  eigenProps: NiceJsonInput["固有値解析諸元"];
  floors: NiceJsonInput["床情報"];
  columns: NiceJsonInput["柱剛性情報"];
  walls: NiceJsonInput["壁剛性情報"];
}

const UNIT_LABELS = ["(kN)", "(cm)", "(kN･cm2)", "(kN/cm)", "(kN/cm/m)"];

const NICE_CONVERSION_RULES = {
  storyHeightCm: 288.0,
  wallNameScale: 1000.0,
  ignoreWallUnitStiffnessThreshold: 0.001
} as const;

export class NiceJsonValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NiceJsonValidationError";
  }
}

export class NiceJsonConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NiceJsonConversionError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toFiniteNumber(value: unknown, label: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new NiceJsonValidationError(`${label} must be a finite number.`);
  }
  return n;
}

function toNonNegativeInteger(value: unknown, label: string): number {
  const n = toFiniteNumber(value, label);
  if (!Number.isInteger(n) || n < 0) {
    throw new NiceJsonValidationError(`${label} must be a non-negative integer.`);
  }
  return n;
}

function toStringValue(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new NiceJsonValidationError(`${label} must be a non-empty string.`);
  }
  return value;
}

function toNumberArray(value: unknown, label: string): number[] {
  if (!Array.isArray(value)) {
    throw new NiceJsonValidationError(`${label} must be an array.`);
  }
  return value.map((item, idx) => toFiniteNumber(item, `${label}[${idx}]`));
}

function toArrayField<T>(
  root: Record<string, unknown>,
  fieldName: string,
  validateItem: (value: unknown, index: number) => T
): T[] {
  const raw = root[fieldName];
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    throw new NiceJsonValidationError(`${fieldName} must be an array.`);
  }
  return raw.map((item, index) => validateItem(item, index));
}

function validateEigenProp(value: unknown, index: number): NiceJsonInput["固有値解析諸元"][number] {
  if (!isRecord(value)) {
    throw new NiceJsonValidationError(`固有値解析諸元[${index}] must be an object.`);
  }

  const center = toNumberArray(value["重心"], `固有値解析諸元[${index}].重心`);
  if (center.length < 2) {
    throw new NiceJsonValidationError(`固有値解析諸元[${index}].重心 must have at least 2 values.`);
  }

  return {
    階: toNonNegativeInteger(value["階"], `固有値解析諸元[${index}].階`),
    層重量: toFiniteNumber(value["層重量"], `固有値解析諸元[${index}].層重量`),
    重心: [center[0], center[1]],
    重量慣性モーメント: toFiniteNumber(
      value["重量慣性モーメント"],
      `固有値解析諸元[${index}].重量慣性モーメント`
    )
  };
}

function validateFloor(value: unknown, index: number): NiceJsonInput["床情報"][number] {
  if (!isRecord(value)) {
    throw new NiceJsonValidationError(`床情報[${index}] must be an object.`);
  }

  const coords = toNumberArray(value["座標"], `床情報[${index}].座標`);
  if (coords.length % 2 !== 0) {
    throw new NiceJsonValidationError(`床情報[${index}].座標 must contain x/y pairs.`);
  }

  return {
    階: toNonNegativeInteger(value["階"], `床情報[${index}].階`),
    座標: coords
  };
}

function validateColumn(value: unknown, index: number): NiceJsonInput["柱剛性情報"][number] {
  if (!isRecord(value)) {
    throw new NiceJsonValidationError(`柱剛性情報[${index}] must be an object.`);
  }

  const pos = toNumberArray(value["位置"], `柱剛性情報[${index}].位置`);
  const stiffness = toNumberArray(value["通り方向剛性"], `柱剛性情報[${index}].通り方向剛性`);
  if (pos.length < 2) {
    throw new NiceJsonValidationError(`柱剛性情報[${index}].位置 must have at least 2 values.`);
  }
  if (stiffness.length < 2) {
    throw new NiceJsonValidationError(`柱剛性情報[${index}].通り方向剛性 must have at least 2 values.`);
  }

  return {
    階: toNonNegativeInteger(value["階"], `柱剛性情報[${index}].階`),
    位置: [pos[0], pos[1]],
    通り方向剛性: [stiffness[0], stiffness[1]]
  };
}

function validateWall(value: unknown, index: number): NiceJsonInput["壁剛性情報"][number] {
  if (!isRecord(value)) {
    throw new NiceJsonValidationError(`壁剛性情報[${index}] must be an object.`);
  }

  const pos = toNumberArray(value["位置"], `壁剛性情報[${index}].位置`);
  if (pos.length < 4) {
    throw new NiceJsonValidationError(`壁剛性情報[${index}].位置 must have at least 4 values.`);
  }

  return {
    名前: toStringValue(value["名前"], `壁剛性情報[${index}].名前`),
    階: toNonNegativeInteger(value["階"], `壁剛性情報[${index}].階`),
    単位剛性: toFiniteNumber(value["単位剛性"], `壁剛性情報[${index}].単位剛性`),
    位置: [pos[0], pos[1], pos[2], pos[3]]
  };
}

export function cleanJsonUnits(rawJson: string): string {
  let text = rawJson;
  for (const label of UNIT_LABELS) {
    text = text.split(label).join("");
  }
  return text;
}

export function validateNiceJsonInput(rawJson: string): ValidatedNiceJsonInput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanJsonUnits(rawJson));
  } catch {
    throw new NiceJsonValidationError("Input is not valid JSON.");
  }

  if (!isRecord(parsed)) {
    throw new NiceJsonValidationError("Top-level JSON must be an object.");
  }

  const property = parsed["物件情報"];
  if (!isRecord(property)) {
    throw new NiceJsonValidationError("物件情報 is required and must be an object.");
  }
  const story = toNonNegativeInteger(property["建物階数"], "物件情報.建物階数");

  return {
    story,
    eigenProps: toArrayField(parsed, "固有値解析諸元", validateEigenProp),
    floors: toArrayField(parsed, "床情報", validateFloor),
    columns: toArrayField(parsed, "柱剛性情報", validateColumn),
    walls: toArrayField(parsed, "壁剛性情報", validateWall)
  };
}

function wallModelName(name: string, unitStiffness: number): string {
  return `${name}_${Math.trunc(unitStiffness * NICE_CONVERSION_RULES.wallNameScale)}`;
}

function wallModelStiffness(unitStiffness: number): number {
  return (
    Math.trunc(unitStiffness * NICE_CONVERSION_RULES.wallNameScale) /
    NICE_CONVERSION_RULES.wallNameScale
  );
}

function convertValidatedNiceJsonToBuildingModel(input: ValidatedNiceJsonInput): BuildingModel {
  const eigenByStory = new Map<number, NiceJsonInput["固有値解析諸元"][number]>();
  for (const e of input.eigenProps) {
    eigenByStory.set(e.階, e);
  }

  const zLevel: number[] = [0];
  const weight: number[] = [];
  const wMoment: number[] = [];
  const wCenter: Point2D[] = [];
  let z = 0;
  for (let i = 1; i <= input.story; i++) {
    const e = eigenByStory.get(i);
    if (!e) continue;
    z += NICE_CONVERSION_RULES.storyHeightCm;
    zLevel.push(z);
    weight.push(e.層重量);
    wMoment.push(e.重量慣性モーメント);
    wCenter.push({ x: e.重心[0], y: e.重心[1] });
  }

  const wallCharaMap = new Map<string, WallCharaDB>();
  const walls: BuildingModel["walls"] = [];
  for (const wall of input.walls) {
    if (wall.単位剛性 <= NICE_CONVERSION_RULES.ignoreWallUnitStiffnessThreshold) {
      continue;
    }

    const modelName = wallModelName(wall.名前, wall.単位剛性);
    if (!wallCharaMap.has(modelName)) {
      wallCharaMap.set(modelName, {
        name: modelName,
        k: wallModelStiffness(wall.単位剛性),
        h: 0,
        c: 0,
        isEigenEffectK: true,
        isKCUnitChara: true,
        memo: ""
      });
    }
    walls.push({
      name: modelName,
      layer: wall.階,
      pos: [
        { x: wall.位置[0], y: wall.位置[1] },
        { x: wall.位置[2], y: wall.位置[3] }
      ],
      isVisible: false
    });
  }

  return {
    structInfo: {
      massN: input.story,
      sType: "R",
      zLevel,
      weight,
      wMoment,
      wCenter
    },
    floors: input.floors
      .slice()
      .sort((a, b) => a.階 - b.階)
      .map((floor) => {
        const pos: Point2D[] = [];
        for (let i = 0; i < floor.座標.length - 1; i += 2) {
          pos.push({ x: floor.座標[i], y: floor.座標[i + 1] });
        }
        return { layer: floor.階, pos };
      }),
    columns: input.columns
      .slice()
      .sort((a, b) => a.階 - b.階)
      .map((col) => ({
        layer: col.階,
        pos: { x: col.位置[0], y: col.位置[1] },
        kx: col.通り方向剛性[0],
        ky: col.通り方向剛性[1]
      })),
    wallCharaDB: Array.from(wallCharaMap.values()),
    walls,
    massDampers: [],
    braceDampers: [],
    dxPanels: []
  };
}

export function convertNiceJsonToBuildingModel(rawJson: string): BuildingModel {
  const validated = validateNiceJsonInput(rawJson);
  try {
    return convertValidatedNiceJsonToBuildingModel(validated);
  } catch (error) {
    if (error instanceof NiceJsonValidationError || error instanceof NiceJsonConversionError) {
      throw error;
    }
    throw new NiceJsonConversionError(
      `Failed while converting validated NICE JSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export function convertNiceJsonToBuildingModelXml(rawJson: string): string {
  const model = convertNiceJsonToBuildingModel(rawJson);
  return serializeBuildingModelXml(model);
}
