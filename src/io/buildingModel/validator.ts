import type {
  BraceDamper,
  BuildingModel,
  DXPanel,
  MassDamper,
  Point2D,
  StructInfo,
  StructType,
  Wall,
  WallCharaDB
} from "../../core/types";
import { FormatParseError } from "../text";
import {
  BUILDING_MODEL_JSON_FORMAT,
  BUILDING_MODEL_JSON_VERSION
} from "./constants";
import type { BuildingModelJsonDocument } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toFiniteNumber(value: unknown, label: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new FormatParseError(`BuildingModel JSON: ${label} must be a finite number.`);
  }
  return n;
}

function toInteger(value: unknown, label: string): number {
  const n = toFiniteNumber(value, label);
  if (!Number.isInteger(n)) {
    throw new FormatParseError(`BuildingModel JSON: ${label} must be an integer.`);
  }
  return n;
}

function toBoolean(value: unknown, label: string): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  throw new FormatParseError(`BuildingModel JSON: ${label} must be a boolean.`);
}

function toNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new FormatParseError(`BuildingModel JSON: ${label} must be a non-empty string.`);
  }
  return value;
}

function toOptionalString(value: unknown, label: string): string {
  if (value === undefined) return "";
  if (typeof value !== "string") {
    throw new FormatParseError(`BuildingModel JSON: ${label} must be a string.`);
  }
  return value;
}

function toStructType(value: unknown, label: string): StructType {
  if (value === "R" || value === "DX") return value;
  throw new FormatParseError(`BuildingModel JSON: ${label} must be "R" or "DX".`);
}

function toDirection(value: unknown, label: string): "X" | "Y" {
  if (value === "X" || value === "Y") return value;
  throw new FormatParseError(`BuildingModel JSON: ${label} must be "X" or "Y".`);
}

function parsePoint(value: unknown, label: string): Point2D {
  if (!isRecord(value)) {
    throw new FormatParseError(`BuildingModel JSON: ${label} must be an object.`);
  }
  return {
    x: toFiniteNumber(value.x, `${label}.x`),
    y: toFiniteNumber(value.y, `${label}.y`)
  };
}

function parseNumberArray(value: unknown, label: string): number[] {
  if (!Array.isArray(value)) {
    throw new FormatParseError(`BuildingModel JSON: ${label} must be an array.`);
  }
  return value.map((item, index) => toFiniteNumber(item, `${label}[${index}]`));
}

function parsePointArray(value: unknown, label: string): Point2D[] {
  if (!Array.isArray(value)) {
    throw new FormatParseError(`BuildingModel JSON: ${label} must be an array.`);
  }
  return value.map((item, index) => parsePoint(item, `${label}[${index}]`));
}

function parseArrayField<T>(
  root: Record<string, unknown>,
  fieldName: string,
  parser: (value: unknown, label: string) => T
): T[] {
  const value = root[fieldName];
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new FormatParseError(`BuildingModel JSON: ${fieldName} must be an array.`);
  }
  return value.map((item, index) => parser(item, `${fieldName}[${index}]`));
}

function parseStructInfo(value: unknown): StructInfo | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw new FormatParseError("BuildingModel JSON: structInfo must be an object.");
  }

  return {
    massN: toInteger(value.massN, "structInfo.massN"),
    sType: toStructType(value.sType, "structInfo.sType"),
    zLevel: parseNumberArray(value.zLevel, "structInfo.zLevel"),
    weight: parseNumberArray(value.weight, "structInfo.weight"),
    wMoment: parseNumberArray(value.wMoment, "structInfo.wMoment"),
    wCenter: parsePointArray(value.wCenter, "structInfo.wCenter")
  };
}

function parseFloor(value: unknown, label: string): { layer: number; pos: Point2D[] } {
  if (!isRecord(value)) {
    throw new FormatParseError(`BuildingModel JSON: ${label} must be an object.`);
  }
  return {
    layer: toInteger(value.layer, `${label}.layer`),
    pos: parsePointArray(value.pos, `${label}.pos`)
  };
}

function parseColumn(value: unknown, label: string): {
  layer: number;
  pos: Point2D;
  kx: number;
  ky: number;
} {
  if (!isRecord(value)) {
    throw new FormatParseError(`BuildingModel JSON: ${label} must be an object.`);
  }
  return {
    layer: toInteger(value.layer, `${label}.layer`),
    pos: parsePoint(value.pos, `${label}.pos`),
    kx: toFiniteNumber(value.kx, `${label}.kx`),
    ky: toFiniteNumber(value.ky, `${label}.ky`)
  };
}

function parseWallChara(value: unknown, label: string): WallCharaDB {
  if (!isRecord(value)) {
    throw new FormatParseError(`BuildingModel JSON: ${label} must be an object.`);
  }
  return {
    name: toNonEmptyString(value.name, `${label}.name`),
    k: toFiniteNumber(value.k, `${label}.k`),
    h: toFiniteNumber(value.h, `${label}.h`),
    c: toFiniteNumber(value.c, `${label}.c`),
    isEigenEffectK: toBoolean(value.isEigenEffectK, `${label}.isEigenEffectK`),
    isKCUnitChara: toBoolean(value.isKCUnitChara, `${label}.isKCUnitChara`),
    memo: toOptionalString(value.memo, `${label}.memo`)
  };
}

function parseWall(value: unknown, label: string): Wall {
  if (!isRecord(value)) {
    throw new FormatParseError(`BuildingModel JSON: ${label} must be an object.`);
  }
  const pos = parsePointArray(value.pos, `${label}.pos`);
  if (pos.length !== 2) {
    throw new FormatParseError(`BuildingModel JSON: ${label}.pos must contain exactly 2 points.`);
  }
  return {
    name: toNonEmptyString(value.name, `${label}.name`),
    layer: toInteger(value.layer, `${label}.layer`),
    pos: [pos[0], pos[1]],
    isVisible: toBoolean(value.isVisible, `${label}.isVisible`)
  };
}

function parseMassDamper(value: unknown, label: string): MassDamper {
  if (!isRecord(value)) {
    throw new FormatParseError(`BuildingModel JSON: ${label} must be an object.`);
  }
  return {
    name: toNonEmptyString(value.name, `${label}.name`),
    layer: toInteger(value.layer, `${label}.layer`),
    pos: parsePoint(value.pos, `${label}.pos`),
    weight: toFiniteNumber(value.weight, `${label}.weight`),
    freq: parsePoint(value.freq, `${label}.freq`),
    h: parsePoint(value.h, `${label}.h`)
  };
}

function parseBraceDamper(value: unknown, label: string): BraceDamper {
  if (!isRecord(value)) {
    throw new FormatParseError(`BuildingModel JSON: ${label} must be an object.`);
  }
  return {
    layer: toInteger(value.layer, `${label}.layer`),
    pos: parsePoint(value.pos, `${label}.pos`),
    direct: toDirection(value.direct, `${label}.direct`),
    k: toFiniteNumber(value.k, `${label}.k`),
    c: toFiniteNumber(value.c, `${label}.c`),
    width: toFiniteNumber(value.width, `${label}.width`),
    height: toFiniteNumber(value.height, `${label}.height`),
    isLightPos: toBoolean(value.isLightPos, `${label}.isLightPos`),
    isEigenEffectK: toBoolean(value.isEigenEffectK, `${label}.isEigenEffectK`)
  };
}

function parseDXPanel(value: unknown, label: string): DXPanel {
  if (!isRecord(value)) {
    throw new FormatParseError(`BuildingModel JSON: ${label} must be an object.`);
  }
  return {
    layer: toInteger(value.layer, `${label}.layer`),
    direct: toDirection(value.direct, `${label}.direct`),
    pos: parsePointArray(value.pos, `${label}.pos`),
    k: toFiniteNumber(value.k, `${label}.k`)
  };
}

function parseModelValue(value: unknown): BuildingModel {
  if (!isRecord(value)) {
    throw new FormatParseError("BuildingModel JSON: model must be an object.");
  }

  return {
    structInfo: parseStructInfo(value.structInfo),
    floors: parseArrayField(value, "floors", parseFloor),
    columns: parseArrayField(value, "columns", parseColumn),
    wallCharaDB: parseArrayField(value, "wallCharaDB", parseWallChara),
    walls: parseArrayField(value, "walls", parseWall),
    massDampers: parseArrayField(value, "massDampers", parseMassDamper),
    braceDampers: parseArrayField(value, "braceDampers", parseBraceDamper),
    dxPanels: parseArrayField(value, "dxPanels", parseDXPanel)
  };
}

function parseJsonDocument(value: unknown): BuildingModelJsonDocument {
  if (!isRecord(value)) {
    throw new FormatParseError("BuildingModel JSON: top-level JSON must be an object.");
  }
  if (
    !Object.prototype.hasOwnProperty.call(value, "format") ||
    !Object.prototype.hasOwnProperty.call(value, "version") ||
    !Object.prototype.hasOwnProperty.call(value, "model")
  ) {
    throw new FormatParseError(
      "BuildingModel JSON: top-level object must include format, version, and model."
    );
  }

  const format = value.format;
  if (format !== BUILDING_MODEL_JSON_FORMAT) {
    throw new FormatParseError(
      `BuildingModel JSON: format must be "${BUILDING_MODEL_JSON_FORMAT}".`
    );
  }

  const version = toInteger(value.version, "version");
  if (version !== BUILDING_MODEL_JSON_VERSION) {
    throw new FormatParseError(
      `BuildingModel JSON: version must be ${BUILDING_MODEL_JSON_VERSION}.`
    );
  }

  return {
    format,
    version,
    model: value.model
  };
}

export function parseBuildingModelDocument(value: unknown): BuildingModel {
  const doc = parseJsonDocument(value);
  return parseModelValue(doc.model);
}
