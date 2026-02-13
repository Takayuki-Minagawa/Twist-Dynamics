import { XMLParser } from "fast-xml-parser";
import type {
  BraceDamper,
  BuildingModel,
  DXPanel,
  Floor,
  MassDamper,
  Point2D,
  RColumn,
  StructType,
  Wall,
  WallCharaDB
} from "../../core/types";
import { FormatParseError } from "../text";
import { normalizeBuildingModel } from "./normalize";
import {
  BUILDING_MODEL_JSON_FORMAT,
  BUILDING_MODEL_JSON_VERSION
} from "./constants";

interface XmlEnvelope {
  format?: string;
  version?: number;
  modelNode: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unboxSingleRecord(value: unknown): unknown {
  let current = value;
  for (let i = 0; i < 6; i++) {
    if (!isRecord(current)) return current;
    const keys = Object.keys(current).filter((key) => !key.startsWith("@_"));
    if (keys.length !== 1) return current;
    current = current[keys[0]];
  }
  return current;
}

function findValue(record: Record<string, unknown>, names: string[]): unknown {
  for (const [key, value] of Object.entries(record)) {
    const normalized = key.replace(/^@_/, "").toLowerCase();
    if (names.includes(normalized)) return value;
  }
  return undefined;
}

function toValueArray(value: unknown): unknown[] {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

function toNumber(value: unknown, label: string): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.trim());
    if (Number.isFinite(n)) return n;
  }
  throw new FormatParseError(`BuildingModel XML: ${label} must be a finite number.`);
}

function toInteger(value: unknown, label: string): number {
  const n = toNumber(value, label);
  if (!Number.isInteger(n)) {
    throw new FormatParseError(`BuildingModel XML: ${label} must be an integer.`);
  }
  return n;
}

function toStringValue(value: unknown, label: string): string {
  if (typeof value === "string") {
    const text = value.trim();
    if (text.length > 0) return text;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  throw new FormatParseError(`BuildingModel XML: ${label} must be a non-empty string.`);
}

function toBooleanValue(value: unknown, label: string): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 0) return false;
    if (value === 1) return true;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  throw new FormatParseError(`BuildingModel XML: ${label} must be a boolean.`);
}

function toStructType(value: unknown, label: string): StructType {
  const text = toStringValue(value, label);
  if (text === "R" || text === "DX") return text;
  throw new FormatParseError(`BuildingModel XML: ${label} must be "R" or "DX".`);
}

function toDirection(value: unknown, label: string): "X" | "Y" {
  const text = toStringValue(value, label);
  if (text === "X" || text === "Y") return text;
  throw new FormatParseError(`BuildingModel XML: ${label} must be "X" or "Y".`);
}

function toNonEmptyNumberArray(value: unknown, label: string): number[] {
  const values = toNumberArray(value, label);
  if (values.length === 0) {
    throw new FormatParseError(`BuildingModel XML: ${label} must not be empty.`);
  }
  return values;
}

function toNumberArray(value: unknown, label: string): number[] {
  if (value === undefined) return [];

  if (typeof value === "string") {
    const tokens = value
      .split(",")
      .map((token) => token.trim())
      .filter((token) => token.length > 0);
    return tokens.map((token, index) => toNumber(token, `${label}[${index}]`));
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => toNumber(item, `${label}[${index}]`));
  }

  if (isRecord(value)) {
    const fromValue = findValue(value, ["value", "item", "n"]);
    if (fromValue !== undefined) return toNumberArray(fromValue, label);

    const entries = Object.entries(value).filter(([key]) => !key.startsWith("@_"));
    if (entries.length > 0) {
      return entries.map(([key, item]) => toNumber(item, `${label}.${key}`));
    }
  }

  return [toNumber(value, `${label}[0]`)];
}

function parsePoint(value: unknown, label: string): Point2D {
  if (!isRecord(value)) {
    throw new FormatParseError(`BuildingModel XML: ${label} must be an object.`);
  }
  const x = findValue(value, ["x"]);
  const y = findValue(value, ["y"]);
  if (x !== undefined && y !== undefined) {
    return {
      x: toNumber(x, `${label}.x`),
      y: toNumber(y, `${label}.y`)
    };
  }

  const values = Object.entries(value)
    .filter(([key]) => !key.startsWith("@_"))
    .map(([, entryValue]) => entryValue);
  if (values.length >= 2) {
    return {
      x: toNumber(values[0], `${label}.x`),
      y: toNumber(values[1], `${label}.y`)
    };
  }

  throw new FormatParseError(`BuildingModel XML: ${label} must have x and y.`);
}

function parsePointArray(value: unknown, label: string): Point2D[] {
  if (value === undefined) return [];
  if (Array.isArray(value)) {
    return value.map((item, index) => parsePoint(item, `${label}[${index}]`));
  }
  if (isRecord(value)) {
    const points =
      findValue(value, ["point", "pos", "position", "item", "value", "p"]) ?? value;
    if (points === value) {
      const x = findValue(value, ["x"]);
      const y = findValue(value, ["y"]);
      if (x !== undefined && y !== undefined) {
        return [parsePoint(value, `${label}[0]`)];
      }
    }
    return parsePointArray(points, label);
  }
  return [parsePoint(value, `${label}[0]`)];
}

function readCollection(
  parent: Record<string, unknown>,
  containerKeys: string[],
  itemKeys: string[]
): unknown[] {
  const container = findValue(parent, containerKeys);
  if (container === undefined) return [];
  if (container === null) return [];
  if (typeof container === "string" && container.trim().length === 0) return [];

  if (Array.isArray(container)) return container;
  if (isRecord(container)) {
    const itemValue = findValue(container, itemKeys);
    if (itemValue !== undefined) return toValueArray(itemValue);
    return [container];
  }
  return [container];
}

function parseStructInfo(modelNode: Record<string, unknown>): BuildingModel["structInfo"] {
  const structRaw = findValue(modelNode, ["structinfo", "struct"]);
  if (!isRecord(structRaw)) {
    throw new FormatParseError("BuildingModel XML: structInfo is required.");
  }

  const massN = toInteger(findValue(structRaw, ["massn"]), "structInfo.massN");
  const sType = toStructType(findValue(structRaw, ["stype"]), "structInfo.sType");
  const zLevel = toNonEmptyNumberArray(findValue(structRaw, ["zlevel"]), "structInfo.zLevel");
  const weight = toNonEmptyNumberArray(findValue(structRaw, ["weight"]), "structInfo.weight");
  const wMoment = toNonEmptyNumberArray(findValue(structRaw, ["wmoment"]), "structInfo.wMoment");
  const wCenter = parsePointArray(findValue(structRaw, ["wcenter"]), "structInfo.wCenter");

  return {
    massN,
    sType,
    zLevel,
    weight,
    wMoment,
    wCenter
  };
}

function parseFloors(modelNode: Record<string, unknown>): Floor[] {
  return readCollection(modelNode, ["floors", "floorlist"], ["floor", "item"]).map(
    (item, index) => {
      if (!isRecord(item)) {
        throw new FormatParseError(`BuildingModel XML: floors[${index}] must be an object.`);
      }
      return {
        layer: toInteger(findValue(item, ["layer"]), `floors[${index}].layer`),
        pos: parsePointArray(findValue(item, ["pos", "points", "polygon"]), `floors[${index}].pos`)
      };
    }
  );
}

function parseColumns(modelNode: Record<string, unknown>): RColumn[] {
  return readCollection(modelNode, ["columns", "columnlist"], ["column", "item"]).map(
    (item, index) => {
      if (!isRecord(item)) {
        throw new FormatParseError(`BuildingModel XML: columns[${index}] must be an object.`);
      }
      return {
        layer: toInteger(findValue(item, ["layer"]), `columns[${index}].layer`),
        pos: parsePoint(findValue(item, ["pos", "point", "position"]), `columns[${index}].pos`),
        kx: toNumber(findValue(item, ["kx"]), `columns[${index}].kx`),
        ky: toNumber(findValue(item, ["ky"]), `columns[${index}].ky`)
      };
    }
  );
}

function parseWallCharas(modelNode: Record<string, unknown>): WallCharaDB[] {
  return readCollection(modelNode, ["wallcharadb", "wallcharas"], ["wallchara", "item"]).map(
    (item, index) => {
      if (!isRecord(item)) {
        throw new FormatParseError(`BuildingModel XML: wallCharaDB[${index}] must be an object.`);
      }
      return {
        name: toStringValue(findValue(item, ["name"]), `wallCharaDB[${index}].name`),
        k: toNumber(findValue(item, ["k"]), `wallCharaDB[${index}].k`),
        h: toNumber(findValue(item, ["h"]), `wallCharaDB[${index}].h`),
        c: toNumber(findValue(item, ["c"]), `wallCharaDB[${index}].c`),
        isEigenEffectK: toBooleanValue(
          findValue(item, ["iseigeneffectk"]),
          `wallCharaDB[${index}].isEigenEffectK`
        ),
        isKCUnitChara: toBooleanValue(
          findValue(item, ["iskcunitchara"]),
          `wallCharaDB[${index}].isKCUnitChara`
        ),
        memo:
          findValue(item, ["memo"]) === undefined
            ? ""
            : toStringValue(findValue(item, ["memo"]), `wallCharaDB[${index}].memo`)
      };
    }
  );
}

function parseWalls(modelNode: Record<string, unknown>): Wall[] {
  return readCollection(modelNode, ["walls", "walllist"], ["wall", "item"]).map((item, index) => {
    if (!isRecord(item)) {
      throw new FormatParseError(`BuildingModel XML: walls[${index}] must be an object.`);
    }
    const points = parsePointArray(findValue(item, ["pos", "points"]), `walls[${index}].pos`);
    if (points.length !== 2) {
      throw new FormatParseError(`BuildingModel XML: walls[${index}].pos must contain exactly 2 points.`);
    }
    return {
      name: toStringValue(findValue(item, ["name"]), `walls[${index}].name`),
      layer: toInteger(findValue(item, ["layer"]), `walls[${index}].layer`),
      pos: [points[0], points[1]],
      isVisible: toBooleanValue(findValue(item, ["isvisible"]), `walls[${index}].isVisible`)
    };
  });
}

function parseMassDampers(modelNode: Record<string, unknown>): MassDamper[] {
  return readCollection(modelNode, ["massdampers", "massdamperlist"], ["massdamper", "item"]).map(
    (item, index) => {
      if (!isRecord(item)) {
        throw new FormatParseError(`BuildingModel XML: massDampers[${index}] must be an object.`);
      }
      return {
        name: toStringValue(findValue(item, ["name"]), `massDampers[${index}].name`),
        layer: toInteger(findValue(item, ["layer"]), `massDampers[${index}].layer`),
        pos: parsePoint(findValue(item, ["pos", "point"]), `massDampers[${index}].pos`),
        weight: toNumber(findValue(item, ["weight"]), `massDampers[${index}].weight`),
        freq: parsePoint(findValue(item, ["freq"]), `massDampers[${index}].freq`),
        h: parsePoint(findValue(item, ["h"]), `massDampers[${index}].h`)
      };
    }
  );
}

function parseBraceDampers(modelNode: Record<string, unknown>): BraceDamper[] {
  return readCollection(
    modelNode,
    ["bracedampers", "bracedamperlist"],
    ["bracedamper", "item"]
  ).map((item, index) => {
    if (!isRecord(item)) {
      throw new FormatParseError(`BuildingModel XML: braceDampers[${index}] must be an object.`);
    }
    return {
      layer: toInteger(findValue(item, ["layer"]), `braceDampers[${index}].layer`),
      pos: parsePoint(findValue(item, ["pos", "point"]), `braceDampers[${index}].pos`),
      direct: toDirection(findValue(item, ["direct", "direction"]), `braceDampers[${index}].direct`),
      k: toNumber(findValue(item, ["k"]), `braceDampers[${index}].k`),
      c: toNumber(findValue(item, ["c"]), `braceDampers[${index}].c`),
      width: toNumber(findValue(item, ["width"]), `braceDampers[${index}].width`),
      height: toNumber(findValue(item, ["height"]), `braceDampers[${index}].height`),
      isLightPos: toBooleanValue(findValue(item, ["islightpos"]), `braceDampers[${index}].isLightPos`),
      isEigenEffectK: toBooleanValue(
        findValue(item, ["iseigeneffectk"]),
        `braceDampers[${index}].isEigenEffectK`
      )
    };
  });
}

function parseDXPanels(modelNode: Record<string, unknown>): DXPanel[] {
  return readCollection(modelNode, ["dxpanels", "dxpanellist"], ["dxpanel", "item"]).map(
    (item, index) => {
      if (!isRecord(item)) {
        throw new FormatParseError(`BuildingModel XML: dxPanels[${index}] must be an object.`);
      }
      return {
        layer: toInteger(findValue(item, ["layer"]), `dxPanels[${index}].layer`),
        direct: toDirection(findValue(item, ["direct", "direction"]), `dxPanels[${index}].direct`),
        pos: parsePointArray(findValue(item, ["pos", "points"]), `dxPanels[${index}].pos`),
        k: toNumber(findValue(item, ["k"]), `dxPanels[${index}].k`)
      };
    }
  );
}

function findModelLikeNode(value: unknown): Record<string, unknown> | null {
  const visited = new Set<unknown>();

  const walk = (node: unknown): Record<string, unknown> | null => {
    if (!isRecord(node) || visited.has(node)) return null;
    visited.add(node);

    const keys = Object.keys(node).map((key) => key.replace(/^@_/, "").toLowerCase());
    const modelLikeKeys = [
      "structinfo",
      "floors",
      "columns",
      "wallcharadb",
      "walls",
      "massdampers",
      "bracedampers",
      "dxpanels"
    ];
    if (keys.some((key) => modelLikeKeys.includes(key))) {
      return node;
    }

    for (const child of Object.values(node)) {
      if (Array.isArray(child)) {
        for (const element of child) {
          const found = walk(element);
          if (found) return found;
        }
      } else {
        const found = walk(child);
        if (found) return found;
      }
    }

    return null;
  };

  return walk(value);
}

function parseEnvelope(rawRoot: unknown): XmlEnvelope {
  const unboxed = unboxSingleRecord(rawRoot);
  const root = isRecord(unboxed) ? unboxed : rawRoot;
  if (!isRecord(root)) {
    throw new FormatParseError("BuildingModel XML: root must be an object.");
  }

  const format = findValue(root, ["format"]);
  const version = findValue(root, ["version"]);
  const explicitModel = findValue(root, ["model"]);

  let modelNode: unknown = explicitModel;
  if (modelNode === undefined) {
    modelNode = findModelLikeNode(root);
  }

  if (!modelNode) {
    throw new FormatParseError("BuildingModel XML: model section was not found.");
  }

  return {
    format: format === undefined ? undefined : toStringValue(format, "format"),
    version: version === undefined ? undefined : toInteger(version, "version"),
    modelNode
  };
}

function parseModel(modelNode: unknown): BuildingModel {
  const unboxed = unboxSingleRecord(modelNode);
  if (!isRecord(unboxed)) {
    throw new FormatParseError("BuildingModel XML: model must be an object.");
  }

  return {
    structInfo: parseStructInfo(unboxed),
    floors: parseFloors(unboxed),
    columns: parseColumns(unboxed),
    wallCharaDB: parseWallCharas(unboxed),
    walls: parseWalls(unboxed),
    massDampers: parseMassDampers(unboxed),
    braceDampers: parseBraceDampers(unboxed),
    dxPanels: parseDXPanels(unboxed)
  };
}

export function parseBuildingModelXml(xmlText: string): BuildingModel {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
    parseTagValue: false
  });

  let parsed: unknown;
  try {
    parsed = parser.parse(xmlText);
  } catch (error) {
    throw new FormatParseError(
      `BuildingModel XML: invalid XML. ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const envelope = parseEnvelope(parsed);
  if (envelope.format !== undefined && envelope.format !== BUILDING_MODEL_JSON_FORMAT) {
    throw new FormatParseError(
      `BuildingModel XML: format must be "${BUILDING_MODEL_JSON_FORMAT}".`
    );
  }
  if (envelope.version !== undefined && envelope.version !== BUILDING_MODEL_JSON_VERSION) {
    throw new FormatParseError(
      `BuildingModel XML: version must be ${BUILDING_MODEL_JSON_VERSION}.`
    );
  }

  return normalizeBuildingModel(parseModel(envelope.modelNode));
}
