import { XMLBuilder, XMLParser } from "fast-xml-parser";
import type {
  BraceDamper,
  BuildingModel,
  DXPanel,
  MassDamper,
  Point2D,
  StructInfo,
  Wall,
  WallCharaDB
} from "../core/types";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true
});

const xmlBuilder = new XMLBuilder({
  ignoreAttributes: false,
  format: true,
  indentBy: "  "
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function parseBool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return fallback;
  const v = value.trim().toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  return fallback;
}

function parseNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseSpaceNumbers(value: unknown): number[] {
  if (typeof value !== "string") return [];
  return value
    .split(" ")
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
}

function parsePointArray(value: unknown): Point2D[] {
  const points: Point2D[] = [];
  const numbers = parseSpaceNumbers(value);
  for (let i = 0; i < numbers.length - 1; i += 2) {
    points.push({ x: numbers[i], y: numbers[i + 1] });
  }
  return points;
}

function parseFloorValue(value: unknown): { layer: number; pos: Point2D[] } {
  const numbers = parseSpaceNumbers(value);
  if (numbers.length < 3) {
    return { layer: 1, pos: [] };
  }
  const layer = numbers[0];
  const pos: Point2D[] = [];
  for (let i = 1; i < numbers.length - 1; i += 2) {
    pos.push({ x: numbers[i], y: numbers[i + 1] });
  }
  return { layer, pos };
}

function parseStructInfo(node: Record<string, unknown>): StructInfo {
  return {
    massN: parseNumber(node["質点数"], 1),
    sType: String(node["躯体タイプ"] ?? "R") === "DX" ? "DX" : "R",
    zLevel: parseSpaceNumbers(node["Zレベル"]),
    weight: parseSpaceNumbers(node["重量"]),
    wMoment: parseSpaceNumbers(node["重量慣性モーメント"]),
    wCenter: parsePointArray(node["重心"])
  };
}

function parseWall(node: Record<string, unknown>): Wall {
  const points = parsePointArray(node["位置"]);
  const p1 = points[0] ?? { x: 0, y: 0 };
  const p2 = points[1] ?? { x: 0, y: 0 };
  return {
    name: String(node["種類"] ?? ""),
    layer: parseNumber(node["層"], 1),
    pos: [p1, p2],
    isVisible: parseBool(node["描画の有無"], true)
  };
}

function parseWallCharaDB(node: Record<string, unknown>): WallCharaDB {
  return {
    name: String(node["名称"] ?? ""),
    k: parseNumber(node["剛性"]),
    h: parseNumber(node["剛性比例減衰_実数"]),
    c: parseNumber(node["減衰係数"]),
    isEigenEffectK: parseBool(node["固有値解析に剛性を考慮するか"], true),
    isKCUnitChara: parseBool(
      node["剛性及び減衰係数を単位長さ値とするか"],
      true
    ),
    memo: String(node["備考"] ?? "")
  };
}

function parseMassDamper(node: Record<string, unknown>): MassDamper {
  const pos = parsePointArray(node["位置"])[0] ?? { x: 0, y: 0 };
  const freq = parsePointArray(node["振動数"])[0] ?? { x: 0, y: 0 };
  const h = parsePointArray(node["減衰定数"])[0] ?? { x: 0, y: 0 };
  return {
    name: String(node["タイプ"] ?? "マスダンパー"),
    layer: parseNumber(node["層"], 1),
    pos,
    weight: parseNumber(node["重量"], 0),
    freq,
    h
  };
}

function parseBraceDamper(node: Record<string, unknown>): BraceDamper {
  const pos = parsePointArray(node["位置"])[0] ?? { x: 0, y: 0 };
  const direct = String(node["方向"] ?? "X") === "Y" ? "Y" : "X";
  return {
    layer: parseNumber(node["層"], 1),
    pos,
    direct,
    k: parseNumber(node["剛性"], 0),
    c: parseNumber(node["減衰係数"], 0),
    width: parseNumber(node["描画用幅"], 0),
    height: parseNumber(node["描画用高さ"], 0),
    isLightPos: parseBool(node["配置方向に対して右側配置か"], true),
    isEigenEffectK: parseBool(node["固有値解析に剛性を評価するか"], false)
  };
}

function parseDXPanel(node: Record<string, unknown>): DXPanel {
  const direct = String(node["方向"] ?? "X") === "Y" ? "Y" : "X";
  return {
    layer: parseNumber(node["層"], 1),
    direct,
    pos: parsePointArray(node["位置"]),
    k: parseNumber(node["剛性"], 0)
  };
}

export function parseBuildingModelXml(xmlText: string): BuildingModel {
  const parsed = xmlParser.parse(xmlText);
  const nodes = asArray<Record<string, unknown>>(parsed?.ATV?.object);

  const model: BuildingModel = {
    floors: [],
    columns: [],
    wallCharaDB: [],
    walls: [],
    massDampers: [],
    braceDampers: [],
    dxPanels: []
  };

  for (const node of nodes) {
    const className = String(node["@_classname"] ?? "");
    if (className.endsWith("StructInfo")) {
      model.structInfo = parseStructInfo(node);
      continue;
    }
    if (className.endsWith("Floor")) {
      const floor = parseFloorValue(node["Floor"]);
      model.floors.push({
        layer: floor.layer,
        pos: floor.pos
      });
      continue;
    }
    if (className.endsWith("R_Column")) {
      const pos = parsePointArray(node["位置"])[0] ?? { x: 0, y: 0 };
      const stiff = parsePointArray(node["剛性"])[0] ?? { x: 0, y: 0 };
      model.columns.push({
        layer: parseNumber(node["層"], 1),
        pos,
        kx: stiff.x,
        ky: stiff.y
      });
      continue;
    }
    if (className.endsWith("WallCharaDB")) {
      model.wallCharaDB.push(parseWallCharaDB(node));
      continue;
    }
    if (className.endsWith("Wall")) {
      model.walls.push(parseWall(node));
      continue;
    }
    if (className.endsWith("MassDamper")) {
      model.massDampers.push(parseMassDamper(node));
      continue;
    }
    if (className.endsWith("BraceDamper")) {
      model.braceDampers.push(parseBraceDamper(node));
      continue;
    }
    if (className.endsWith("DX_Panel")) {
      model.dxPanels.push(parseDXPanel(node));
      continue;
    }
  }

  model.floors.sort((a, b) => a.layer - b.layer);
  model.columns.sort((a, b) => a.layer - b.layer);
  model.walls.sort((a, b) => a.layer - b.layer);
  model.massDampers.sort((a, b) => a.layer - b.layer);
  model.braceDampers.sort((a, b) => a.layer - b.layer);
  model.dxPanels.sort((a, b) => a.layer - b.layer);

  return model;
}

function pointListToSpaceString(points: Point2D[]): string {
  return points.map((p) => `${p.x} ${p.y}`).join(" ");
}

function boolText(value: boolean): "True" | "False" {
  return value ? "True" : "False";
}

export function serializeBuildingModelXml(model: BuildingModel): string {
  const objects: Record<string, unknown>[] = [];

  if (model.structInfo) {
    objects.push({
      "@_classname": "Ebi_Docs.Data.StructInfo",
      質点数: model.structInfo.massN,
      躯体タイプ: model.structInfo.sType,
      Zレベル: model.structInfo.zLevel.join(" "),
      重量: model.structInfo.weight.join(" "),
      重量慣性モーメント: model.structInfo.wMoment.join(" "),
      重心: pointListToSpaceString(model.structInfo.wCenter)
    });
  }

  for (const floor of model.floors) {
    objects.push({
      "@_classname": "Ebi_Docs.Data.Floor",
      Floor: `${floor.layer} ${pointListToSpaceString(floor.pos)}`
    });
  }

  for (const column of model.columns) {
    objects.push({
      "@_classname": "Ebi_Docs.Data.R_Column",
      層: column.layer,
      位置: `${column.pos.x} ${column.pos.y}`,
      剛性: `${column.kx} ${column.ky}`
    });
  }

  for (const db of model.wallCharaDB) {
    objects.push({
      "@_classname": "Ebi_Docs.Data.WallCharaDB",
      名称: db.name,
      剛性: db.k,
      剛性比例減衰_実数: db.h,
      減衰係数: db.c,
      固有値解析に剛性を考慮するか: boolText(db.isEigenEffectK),
      剛性及び減衰係数を単位長さ値とするか: boolText(db.isKCUnitChara),
      備考: db.memo || " "
    });
  }

  for (const wall of model.walls) {
    objects.push({
      "@_classname": "Ebi_Docs.Data.Wall",
      種類: wall.name,
      層: wall.layer,
      位置: pointListToSpaceString(wall.pos),
      描画の有無: boolText(wall.isVisible)
    });
  }

  for (const md of model.massDampers) {
    objects.push({
      "@_classname": "Ebi_Docs.Data.MassDamper",
      タイプ: md.name,
      層: md.layer,
      位置: `${md.pos.x} ${md.pos.y}`,
      重量: md.weight,
      振動数: `${md.freq.x} ${md.freq.y}`,
      減衰定数: `${md.h.x} ${md.h.y}`
    });
  }

  for (const bd of model.braceDampers) {
    objects.push({
      "@_classname": "Ebi_Docs.Data.BraceDamper",
      層: bd.layer,
      位置: `${bd.pos.x} ${bd.pos.y}`,
      方向: bd.direct,
      剛性: bd.k,
      減衰係数: bd.c,
      描画用幅: bd.width,
      描画用高さ: bd.height,
      配置方向に対して右側配置か: boolText(bd.isLightPos),
      固有値解析に剛性を評価するか: boolText(bd.isEigenEffectK)
    });
  }

  for (const dx of model.dxPanels) {
    objects.push({
      "@_classname": "Ebi_Docs.Data.DX_Panel",
      層: dx.layer,
      方向: dx.direct,
      位置: pointListToSpaceString(dx.pos),
      剛性: dx.k
    });
  }

  const body = xmlBuilder.build({ ATV: { object: objects } });
  return `<?xml version="1.0" encoding="UTF-8"?>\n${body}`;
}

export function summarizeBuildingModel(model: BuildingModel): Record<string, unknown> {
  return {
    story: model.structInfo?.massN ?? null,
    structType: model.structInfo?.sType ?? null,
    floorCount: model.floors.length,
    columnCount: model.columns.length,
    wallCount: model.walls.length,
    wallCharaCount: model.wallCharaDB.length,
    massDamperCount: model.massDampers.length,
    braceDamperCount: model.braceDampers.length,
    dxPanelCount: model.dxPanels.length
  };
}
