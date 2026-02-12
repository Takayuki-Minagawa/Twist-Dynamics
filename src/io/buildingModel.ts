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

const XML_CLASSNAME_KEY = "@_classname";

const XML_CLASS = {
  structInfo: "Ebi_Docs.Data.StructInfo",
  floor: "Ebi_Docs.Data.Floor",
  column: "Ebi_Docs.Data.R_Column",
  wallCharaDB: "Ebi_Docs.Data.WallCharaDB",
  wall: "Ebi_Docs.Data.Wall",
  massDamper: "Ebi_Docs.Data.MassDamper",
  braceDamper: "Ebi_Docs.Data.BraceDamper",
  dxPanel: "Ebi_Docs.Data.DX_Panel"
} as const;

const XML_KEY = {
  floorValue: "Floor",
  structInfo: {
    massN: "質点数",
    sType: "躯体タイプ",
    zLevel: "Zレベル",
    weight: "重量",
    wMoment: "重量慣性モーメント",
    wCenter: "重心"
  },
  shared: {
    layer: "層",
    pos: "位置",
    k: "剛性",
    c: "減衰係数",
    direct: "方向",
    weight: "重量"
  },
  wall: {
    name: "種類",
    isVisible: "描画の有無"
  },
  wallCharaDB: {
    name: "名称",
    h: "剛性比例減衰_実数",
    c: "減衰係数",
    isEigenEffectK: "固有値解析に剛性を考慮するか",
    isKCUnitChara: "剛性及び減衰係数を単位長さ値とするか",
    memo: "備考"
  },
  massDamper: {
    name: "タイプ",
    freq: "振動数",
    h: "減衰定数"
  },
  braceDamper: {
    width: "描画用幅",
    height: "描画用高さ",
    isLightPos: "配置方向に対して右側配置か",
    isEigenEffectK: "固有値解析に剛性を評価するか"
  }
} as const;

function isClassName(className: string, expected: string): boolean {
  if (className === expected) return true;
  const parts = expected.split(".");
  const short = parts[parts.length - 1] ?? expected;
  return className.endsWith(short);
}

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
    massN: parseNumber(node[XML_KEY.structInfo.massN], 1),
    sType: String(node[XML_KEY.structInfo.sType] ?? "R") === "DX" ? "DX" : "R",
    zLevel: parseSpaceNumbers(node[XML_KEY.structInfo.zLevel]),
    weight: parseSpaceNumbers(node[XML_KEY.structInfo.weight]),
    wMoment: parseSpaceNumbers(node[XML_KEY.structInfo.wMoment]),
    wCenter: parsePointArray(node[XML_KEY.structInfo.wCenter])
  };
}

function parseWall(node: Record<string, unknown>): Wall {
  const points = parsePointArray(node[XML_KEY.shared.pos]);
  const p1 = points[0] ?? { x: 0, y: 0 };
  const p2 = points[1] ?? { x: 0, y: 0 };
  return {
    name: String(node[XML_KEY.wall.name] ?? ""),
    layer: parseNumber(node[XML_KEY.shared.layer], 1),
    pos: [p1, p2],
    isVisible: parseBool(node[XML_KEY.wall.isVisible], true)
  };
}

function parseWallCharaDB(node: Record<string, unknown>): WallCharaDB {
  return {
    name: String(node[XML_KEY.wallCharaDB.name] ?? ""),
    k: parseNumber(node[XML_KEY.shared.k]),
    h: parseNumber(node[XML_KEY.wallCharaDB.h]),
    c: parseNumber(node[XML_KEY.wallCharaDB.c]),
    isEigenEffectK: parseBool(node[XML_KEY.wallCharaDB.isEigenEffectK], true),
    isKCUnitChara: parseBool(
      node[XML_KEY.wallCharaDB.isKCUnitChara],
      true
    ),
    memo: String(node[XML_KEY.wallCharaDB.memo] ?? "")
  };
}

function parseMassDamper(node: Record<string, unknown>): MassDamper {
  const pos = parsePointArray(node[XML_KEY.shared.pos])[0] ?? { x: 0, y: 0 };
  const freq = parsePointArray(node[XML_KEY.massDamper.freq])[0] ?? { x: 0, y: 0 };
  const h = parsePointArray(node[XML_KEY.massDamper.h])[0] ?? { x: 0, y: 0 };
  return {
    name: String(node[XML_KEY.massDamper.name] ?? "マスダンパー"),
    layer: parseNumber(node[XML_KEY.shared.layer], 1),
    pos,
    weight: parseNumber(node[XML_KEY.shared.weight], 0),
    freq,
    h
  };
}

function parseBraceDamper(node: Record<string, unknown>): BraceDamper {
  const pos = parsePointArray(node[XML_KEY.shared.pos])[0] ?? { x: 0, y: 0 };
  const direct = String(node[XML_KEY.shared.direct] ?? "X") === "Y" ? "Y" : "X";
  return {
    layer: parseNumber(node[XML_KEY.shared.layer], 1),
    pos,
    direct,
    k: parseNumber(node[XML_KEY.shared.k], 0),
    c: parseNumber(node[XML_KEY.shared.c], 0),
    width: parseNumber(node[XML_KEY.braceDamper.width], 0),
    height: parseNumber(node[XML_KEY.braceDamper.height], 0),
    isLightPos: parseBool(node[XML_KEY.braceDamper.isLightPos], true),
    isEigenEffectK: parseBool(node[XML_KEY.braceDamper.isEigenEffectK], false)
  };
}

function parseDXPanel(node: Record<string, unknown>): DXPanel {
  const direct = String(node[XML_KEY.shared.direct] ?? "X") === "Y" ? "Y" : "X";
  return {
    layer: parseNumber(node[XML_KEY.shared.layer], 1),
    direct,
    pos: parsePointArray(node[XML_KEY.shared.pos]),
    k: parseNumber(node[XML_KEY.shared.k], 0)
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
    const className = String(node[XML_CLASSNAME_KEY] ?? "");
    if (isClassName(className, XML_CLASS.structInfo)) {
      model.structInfo = parseStructInfo(node);
      continue;
    }
    if (isClassName(className, XML_CLASS.floor)) {
      const floor = parseFloorValue(node[XML_KEY.floorValue]);
      model.floors.push({
        layer: floor.layer,
        pos: floor.pos
      });
      continue;
    }
    if (isClassName(className, XML_CLASS.column)) {
      const pos = parsePointArray(node[XML_KEY.shared.pos])[0] ?? { x: 0, y: 0 };
      const stiff = parsePointArray(node[XML_KEY.shared.k])[0] ?? { x: 0, y: 0 };
      model.columns.push({
        layer: parseNumber(node[XML_KEY.shared.layer], 1),
        pos,
        kx: stiff.x,
        ky: stiff.y
      });
      continue;
    }
    if (isClassName(className, XML_CLASS.wallCharaDB)) {
      model.wallCharaDB.push(parseWallCharaDB(node));
      continue;
    }
    if (isClassName(className, XML_CLASS.wall)) {
      model.walls.push(parseWall(node));
      continue;
    }
    if (isClassName(className, XML_CLASS.massDamper)) {
      model.massDampers.push(parseMassDamper(node));
      continue;
    }
    if (isClassName(className, XML_CLASS.braceDamper)) {
      model.braceDampers.push(parseBraceDamper(node));
      continue;
    }
    if (isClassName(className, XML_CLASS.dxPanel)) {
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
      [XML_CLASSNAME_KEY]: XML_CLASS.structInfo,
      [XML_KEY.structInfo.massN]: model.structInfo.massN,
      [XML_KEY.structInfo.sType]: model.structInfo.sType,
      [XML_KEY.structInfo.zLevel]: model.structInfo.zLevel.join(" "),
      [XML_KEY.structInfo.weight]: model.structInfo.weight.join(" "),
      [XML_KEY.structInfo.wMoment]: model.structInfo.wMoment.join(" "),
      [XML_KEY.structInfo.wCenter]: pointListToSpaceString(model.structInfo.wCenter)
    });
  }

  for (const floor of model.floors) {
    objects.push({
      [XML_CLASSNAME_KEY]: XML_CLASS.floor,
      [XML_KEY.floorValue]: `${floor.layer} ${pointListToSpaceString(floor.pos)}`
    });
  }

  for (const column of model.columns) {
    objects.push({
      [XML_CLASSNAME_KEY]: XML_CLASS.column,
      [XML_KEY.shared.layer]: column.layer,
      [XML_KEY.shared.pos]: `${column.pos.x} ${column.pos.y}`,
      [XML_KEY.shared.k]: `${column.kx} ${column.ky}`
    });
  }

  for (const db of model.wallCharaDB) {
    objects.push({
      [XML_CLASSNAME_KEY]: XML_CLASS.wallCharaDB,
      [XML_KEY.wallCharaDB.name]: db.name,
      [XML_KEY.shared.k]: db.k,
      [XML_KEY.wallCharaDB.h]: db.h,
      [XML_KEY.shared.c]: db.c,
      [XML_KEY.wallCharaDB.isEigenEffectK]: boolText(db.isEigenEffectK),
      [XML_KEY.wallCharaDB.isKCUnitChara]: boolText(db.isKCUnitChara),
      [XML_KEY.wallCharaDB.memo]: db.memo || " "
    });
  }

  for (const wall of model.walls) {
    objects.push({
      [XML_CLASSNAME_KEY]: XML_CLASS.wall,
      [XML_KEY.wall.name]: wall.name,
      [XML_KEY.shared.layer]: wall.layer,
      [XML_KEY.shared.pos]: pointListToSpaceString(wall.pos),
      [XML_KEY.wall.isVisible]: boolText(wall.isVisible)
    });
  }

  for (const md of model.massDampers) {
    objects.push({
      [XML_CLASSNAME_KEY]: XML_CLASS.massDamper,
      [XML_KEY.massDamper.name]: md.name,
      [XML_KEY.shared.layer]: md.layer,
      [XML_KEY.shared.pos]: `${md.pos.x} ${md.pos.y}`,
      [XML_KEY.shared.weight]: md.weight,
      [XML_KEY.massDamper.freq]: `${md.freq.x} ${md.freq.y}`,
      [XML_KEY.massDamper.h]: `${md.h.x} ${md.h.y}`
    });
  }

  for (const bd of model.braceDampers) {
    objects.push({
      [XML_CLASSNAME_KEY]: XML_CLASS.braceDamper,
      [XML_KEY.shared.layer]: bd.layer,
      [XML_KEY.shared.pos]: `${bd.pos.x} ${bd.pos.y}`,
      [XML_KEY.shared.direct]: bd.direct,
      [XML_KEY.shared.k]: bd.k,
      [XML_KEY.shared.c]: bd.c,
      [XML_KEY.braceDamper.width]: bd.width,
      [XML_KEY.braceDamper.height]: bd.height,
      [XML_KEY.braceDamper.isLightPos]: boolText(bd.isLightPos),
      [XML_KEY.braceDamper.isEigenEffectK]: boolText(bd.isEigenEffectK)
    });
  }

  for (const dx of model.dxPanels) {
    objects.push({
      [XML_CLASSNAME_KEY]: XML_CLASS.dxPanel,
      [XML_KEY.shared.layer]: dx.layer,
      [XML_KEY.shared.direct]: dx.direct,
      [XML_KEY.shared.pos]: pointListToSpaceString(dx.pos),
      [XML_KEY.shared.k]: dx.k
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
