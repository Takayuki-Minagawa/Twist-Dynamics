import type { BraceDamper, BuildingModel, DXPanel, Point2D, StructType } from "../core/types";
import {
  FormatParseError,
  parseBuildingModelJson,
  parseNumberToken,
  serializeBuildingModelJson
} from "../io";

export interface ModelEditorFormData {
  massN: string;
  structType: StructType;
  zLevel: string;
  weight: string;
  wMoment: string;
  wCenter: string;
  floors: string;
  columns: string;
  wallCharas: string;
  walls: string;
  massDampers: string;
  braceDampers: string;
  dxPanels: string;
}

function toLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function toCsvTokens(line: string): string[] {
  return line.split(",").map((token) => token.trim());
}

function parseBooleanToken(token: string, label: string): boolean {
  const normalized = token.toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw new FormatParseError(`${label}: boolean value must be true/false or 1/0.`);
}

function parsePointPair(tokens: string[], startIndex: number, label: string): Point2D {
  return {
    x: parseNumberToken(tokens[startIndex], `${label}.x`),
    y: parseNumberToken(tokens[startIndex + 1], `${label}.y`)
  };
}

function parseNumberListText(text: string, label: string): number[] {
  const tokens = toCsvTokens(text).filter((token) => token.length > 0);
  if (tokens.length === 0) {
    throw new FormatParseError(`${label}: value list is empty.`);
  }
  return tokens.map((token, index) => parseNumberToken(token, `${label}[${index}]`));
}

function parseWCenter(text: string): Point2D[] {
  return toLines(text).map((line, lineIndex) => {
    const tokens = toCsvTokens(line);
    if (tokens.length !== 2) {
      throw new FormatParseError(`wCenter line ${lineIndex + 1}: expected 2 values (x,y).`);
    }
    return {
      x: parseNumberToken(tokens[0], `wCenter[${lineIndex}].x`),
      y: parseNumberToken(tokens[1], `wCenter[${lineIndex}].y`)
    };
  });
}

function parseFloors(text: string): BuildingModel["floors"] {
  return toLines(text).map((line, lineIndex) => {
    const tokens = toCsvTokens(line);
    if (tokens.length < 7 || (tokens.length - 1) % 2 !== 0) {
      throw new FormatParseError(
        `floors line ${lineIndex + 1}: format is layer,x1,y1,x2,y2,x3,y3,...`
      );
    }

    const layer = parseNumberToken(tokens[0], `floors[${lineIndex}].layer`);
    if (!Number.isInteger(layer)) {
      throw new FormatParseError(`floors[${lineIndex}].layer must be an integer.`);
    }

    const pos: Point2D[] = [];
    for (let i = 1; i < tokens.length; i += 2) {
      pos.push(parsePointPair(tokens, i, `floors[${lineIndex}].pos[${(i - 1) / 2}]`));
    }

    return {
      layer,
      pos
    };
  });
}

function parseColumns(text: string): BuildingModel["columns"] {
  return toLines(text).map((line, lineIndex) => {
    const tokens = toCsvTokens(line);
    if (tokens.length !== 5) {
      throw new FormatParseError(`columns line ${lineIndex + 1}: format is layer,x,y,kx,ky`);
    }

    const layer = parseNumberToken(tokens[0], `columns[${lineIndex}].layer`);
    if (!Number.isInteger(layer)) {
      throw new FormatParseError(`columns[${lineIndex}].layer must be an integer.`);
    }

    return {
      layer,
      pos: parsePointPair(tokens, 1, `columns[${lineIndex}].pos`),
      kx: parseNumberToken(tokens[3], `columns[${lineIndex}].kx`),
      ky: parseNumberToken(tokens[4], `columns[${lineIndex}].ky`)
    };
  });
}

function parseWallCharas(text: string): BuildingModel["wallCharaDB"] {
  return toLines(text).map((line, lineIndex) => {
    const tokens = toCsvTokens(line);
    if (tokens.length < 6) {
      throw new FormatParseError(
        `wallCharas line ${lineIndex + 1}: format is name,k,h,c,isEigenEffectK,isKCUnitChara[,memo]`
      );
    }

    return {
      name: tokens[0],
      k: parseNumberToken(tokens[1], `wallCharaDB[${lineIndex}].k`),
      h: parseNumberToken(tokens[2], `wallCharaDB[${lineIndex}].h`),
      c: parseNumberToken(tokens[3], `wallCharaDB[${lineIndex}].c`),
      isEigenEffectK: parseBooleanToken(tokens[4], `wallCharaDB[${lineIndex}].isEigenEffectK`),
      isKCUnitChara: parseBooleanToken(tokens[5], `wallCharaDB[${lineIndex}].isKCUnitChara`),
      memo: tokens.slice(6).join(",")
    };
  });
}

function parseWalls(text: string): BuildingModel["walls"] {
  return toLines(text).map((line, lineIndex) => {
    const tokens = toCsvTokens(line);
    if (tokens.length !== 7) {
      throw new FormatParseError(
        `walls line ${lineIndex + 1}: format is layer,name,x1,y1,x2,y2,isVisible`
      );
    }

    const layer = parseNumberToken(tokens[0], `walls[${lineIndex}].layer`);
    if (!Number.isInteger(layer)) {
      throw new FormatParseError(`walls[${lineIndex}].layer must be an integer.`);
    }

    return {
      layer,
      name: tokens[1],
      pos: [
        parsePointPair(tokens, 2, `walls[${lineIndex}].start`),
        parsePointPair(tokens, 4, `walls[${lineIndex}].end`)
      ],
      isVisible: parseBooleanToken(tokens[6], `walls[${lineIndex}].isVisible`)
    };
  });
}

function parseMassDampers(text: string): BuildingModel["massDampers"] {
  return toLines(text).map((line, lineIndex) => {
    const tokens = toCsvTokens(line);
    if (tokens.length !== 9) {
      throw new FormatParseError(
        `massDampers line ${lineIndex + 1}: format is name,layer,x,y,weight,freqX,freqY,hX,hY`
      );
    }

    const layer = parseNumberToken(tokens[1], `massDampers[${lineIndex}].layer`);
    if (!Number.isInteger(layer)) {
      throw new FormatParseError(`massDampers[${lineIndex}].layer must be an integer.`);
    }

    return {
      name: tokens[0],
      layer,
      pos: parsePointPair(tokens, 2, `massDampers[${lineIndex}].pos`),
      weight: parseNumberToken(tokens[4], `massDampers[${lineIndex}].weight`),
      freq: parsePointPair(tokens, 5, `massDampers[${lineIndex}].freq`),
      h: parsePointPair(tokens, 7, `massDampers[${lineIndex}].h`)
    };
  });
}

function parseBraceDampers(text: string): BraceDamper[] {
  return toLines(text).map((line, lineIndex) => {
    const tokens = toCsvTokens(line);
    if (tokens.length !== 10) {
      throw new FormatParseError(
        `braceDampers line ${lineIndex + 1}: format is layer,x,y,direct,k,c,width,height,isLightPos,isEigenEffectK`
      );
    }

    const layer = parseNumberToken(tokens[0], `braceDampers[${lineIndex}].layer`);
    if (!Number.isInteger(layer)) {
      throw new FormatParseError(`braceDampers[${lineIndex}].layer must be an integer.`);
    }

    const direct = tokens[3];
    if (direct !== "X" && direct !== "Y") {
      throw new FormatParseError(`braceDampers[${lineIndex}].direct must be X or Y.`);
    }

    return {
      layer,
      pos: parsePointPair(tokens, 1, `braceDampers[${lineIndex}].pos`),
      direct,
      k: parseNumberToken(tokens[4], `braceDampers[${lineIndex}].k`),
      c: parseNumberToken(tokens[5], `braceDampers[${lineIndex}].c`),
      width: parseNumberToken(tokens[6], `braceDampers[${lineIndex}].width`),
      height: parseNumberToken(tokens[7], `braceDampers[${lineIndex}].height`),
      isLightPos: parseBooleanToken(tokens[8], `braceDampers[${lineIndex}].isLightPos`),
      isEigenEffectK: parseBooleanToken(tokens[9], `braceDampers[${lineIndex}].isEigenEffectK`)
    };
  });
}

function parseDXPanels(text: string): DXPanel[] {
  return toLines(text).map((line, lineIndex) => {
    const tokens = toCsvTokens(line);
    if (tokens.length < 8 || (tokens.length - 3) % 2 !== 0) {
      throw new FormatParseError(
        `dxPanels line ${lineIndex + 1}: format is layer,direct,k,x1,y1,x2,y2,...`
      );
    }

    const layer = parseNumberToken(tokens[0], `dxPanels[${lineIndex}].layer`);
    if (!Number.isInteger(layer)) {
      throw new FormatParseError(`dxPanels[${lineIndex}].layer must be an integer.`);
    }

    const direct = tokens[1];
    if (direct !== "X" && direct !== "Y") {
      throw new FormatParseError(`dxPanels[${lineIndex}].direct must be X or Y.`);
    }

    const pos: Point2D[] = [];
    for (let i = 3; i < tokens.length; i += 2) {
      pos.push(parsePointPair(tokens, i, `dxPanels[${lineIndex}].pos[${(i - 3) / 2}]`));
    }

    return {
      layer,
      direct,
      k: parseNumberToken(tokens[2], `dxPanels[${lineIndex}].k`),
      pos
    };
  });
}

function linesFromPoints(points: Point2D[]): string {
  return points.map((point) => `${point.x},${point.y}`).join("\n");
}

export function createDefaultModelEditorFormData(): ModelEditorFormData {
  return {
    massN: "1",
    structType: "R",
    zLevel: "0,300",
    weight: "100",
    wMoment: "1000",
    wCenter: "0,0",
    floors: "1,0,0,0,366,1220,366,1220,0\n2,0,0,0,366,1220,366,1220,0",
    columns: "1,0,0,10,10\n1,0,366,10,10\n1,1220,0,10,10\n1,1220,366,10,10",
    wallCharas: "WAL1,10,0,0,true,false,外壁",
    walls: "1,WAL1,0,0,0,366,true",
    massDampers: "",
    braceDampers: "",
    dxPanels: ""
  };
}

export function buildModelFromEditorForm(formData: ModelEditorFormData): BuildingModel {
  const massN = parseNumberToken(formData.massN, "structInfo.massN");
  if (!Number.isInteger(massN) || massN < 1) {
    throw new FormatParseError("structInfo.massN must be an integer >= 1.");
  }

  const rawModel: BuildingModel = {
    structInfo: {
      massN,
      sType: formData.structType,
      zLevel: parseNumberListText(formData.zLevel, "structInfo.zLevel"),
      weight: parseNumberListText(formData.weight, "structInfo.weight"),
      wMoment: parseNumberListText(formData.wMoment, "structInfo.wMoment"),
      wCenter: parseWCenter(formData.wCenter)
    },
    floors: parseFloors(formData.floors),
    columns: parseColumns(formData.columns),
    wallCharaDB: parseWallCharas(formData.wallCharas),
    walls: parseWalls(formData.walls),
    massDampers: parseMassDampers(formData.massDampers),
    braceDampers: parseBraceDampers(formData.braceDampers),
    dxPanels: parseDXPanels(formData.dxPanels)
  };

  const normalized = parseBuildingModelJson(serializeBuildingModelJson(rawModel));
  return normalized;
}

export function modelToEditorForm(model: BuildingModel): ModelEditorFormData {
  const structInfo = model.structInfo;
  return {
    massN: String(structInfo?.massN ?? 1),
    structType: structInfo?.sType ?? "R",
    zLevel: (structInfo?.zLevel ?? []).join(","),
    weight: (structInfo?.weight ?? []).join(","),
    wMoment: (structInfo?.wMoment ?? []).join(","),
    wCenter: linesFromPoints(structInfo?.wCenter ?? []),
    floors: model.floors
      .map((floor) => {
        const coords = floor.pos.flatMap((point) => [point.x, point.y]);
        return [floor.layer, ...coords].join(",");
      })
      .join("\n"),
    columns: model.columns
      .map((column) => [column.layer, column.pos.x, column.pos.y, column.kx, column.ky].join(","))
      .join("\n"),
    wallCharas: model.wallCharaDB
      .map((wall) =>
        [wall.name, wall.k, wall.h, wall.c, wall.isEigenEffectK, wall.isKCUnitChara, wall.memo].join(",")
      )
      .join("\n"),
    walls: model.walls
      .map((wall) =>
        [
          wall.layer,
          wall.name,
          wall.pos[0].x,
          wall.pos[0].y,
          wall.pos[1].x,
          wall.pos[1].y,
          wall.isVisible
        ].join(",")
      )
      .join("\n"),
    massDampers: model.massDampers
      .map((md) => [md.name, md.layer, md.pos.x, md.pos.y, md.weight, md.freq.x, md.freq.y, md.h.x, md.h.y].join(","))
      .join("\n"),
    braceDampers: model.braceDampers
      .map((bd) =>
        [
          bd.layer,
          bd.pos.x,
          bd.pos.y,
          bd.direct,
          bd.k,
          bd.c,
          bd.width,
          bd.height,
          bd.isLightPos,
          bd.isEigenEffectK
        ].join(",")
      )
      .join("\n"),
    dxPanels: model.dxPanels
      .map((panel) => {
        const coords = panel.pos.flatMap((point) => [point.x, point.y]);
        return [panel.layer, panel.direct, panel.k, ...coords].join(",");
      })
      .join("\n")
  };
}

export function modelEditorFormToJson(formData: ModelEditorFormData): string {
  const model = buildModelFromEditorForm(formData);
  return serializeBuildingModelJson(model);
}
