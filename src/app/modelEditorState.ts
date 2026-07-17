import type { BraceDamper, BuildingModel, Point2D } from "../core/types";
import {
  FormatParseError,
  parseBuildingModelJson,
  parseNumberToken,
  serializeBuildingModelJson
} from "../io";
import {
  MODEL_EDITOR_SECTION_IDS,
  cloneEditorRows,
  parseEditorTableText,
  serializeEditorTableText,
  validateEditorRows,
  type EditorRow,
  type EditorSectionId,
  type EditorValidationIssue
} from "./modelEditorSchema";

export type ModelEditorRows = Record<EditorSectionId, EditorRow[]>;

export interface ModelEditorDraft {
  baseZ: string;
  rows: ModelEditorRows;
}

/** Serializable bulk-paste representation retained for tests and programmatic use. */
export interface ModelEditorFormData {
  massN: string;
  baseZ: string;
  stories: string;
  floors: string;
  columns: string;
  wallCharas: string;
  walls: string;
  massDampers: string;
  braceDampers: string;
}

export interface ModelEditorValidationResult {
  issues: EditorValidationIssue[];
  generalIssues: string[];
}

function numberValue(value: string, label: string): number {
  return parseNumberToken(value, label);
}

function integerValue(value: string, label: string): number {
  const parsed = numberValue(value, label);
  if (!Number.isInteger(parsed)) throw new FormatParseError(`${label} must be an integer.`);
  return parsed;
}

function booleanValue(value: string, label: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw new FormatParseError(`${label} must be true/false or 1/0.`);
}

function pointsValue(value: string, label: string): Point2D[] {
  const tokens = value
    .trim()
    .split(/[\s,;]+/)
    .filter((token) => token.length > 0);
  if (tokens.length < 6 || tokens.length % 2 !== 0) {
    throw new FormatParseError(`${label} must contain at least 3 x,y pairs.`);
  }
  const points: Point2D[] = [];
  for (let index = 0; index < tokens.length; index += 2) {
    points.push({
      x: numberValue(tokens[index], `${label}[${index / 2}].x`),
      y: numberValue(tokens[index + 1], `${label}[${index / 2}].y`)
    });
  }
  return points;
}

function rowText(row: EditorRow, key: string): string {
  return row[key] ?? "";
}

function emptyRows(): ModelEditorRows {
  return {
    stories: [],
    floors: [],
    columns: [],
    wallCharas: [],
    walls: [],
    massDampers: [],
    braceDampers: []
  };
}

export function cloneModelEditorDraft(draft: ModelEditorDraft): ModelEditorDraft {
  const rows = emptyRows();
  for (const section of MODEL_EDITOR_SECTION_IDS) rows[section] = cloneEditorRows(draft.rows[section]);
  return { baseZ: draft.baseZ, rows };
}

export function validateModelEditorDraft(draft: ModelEditorDraft): ModelEditorValidationResult {
  const issues: EditorValidationIssue[] = [];
  const generalIssues: string[] = [];
  const storyCount = draft.rows.stories.length;
  const wallCharaNames = draft.rows.wallCharas.map((row) => rowText(row, "name").trim());

  for (const section of MODEL_EDITOR_SECTION_IDS) {
    issues.push(
      ...validateEditorRows(section, draft.rows[section], {
        storyCount,
        wallCharaNames
      })
    );
  }

  const baseZ = Number(draft.baseZ);
  if (!Number.isFinite(baseZ)) {
    generalIssues.push("Base Z level must be a finite number.");
  } else {
    const firstTop = Number(draft.rows.stories[0]?.zLevel);
    if (Number.isFinite(firstTop) && firstTop < baseZ) {
      generalIssues.push("The first story top Z level must be greater than or equal to base Z.");
    }
  }

  if (storyCount < 1) generalIssues.push("At least one story row is required.");
  return { issues, generalIssues };
}

export function buildModelFromEditorDraft(draft: ModelEditorDraft): BuildingModel {
  const validation = validateModelEditorDraft(draft);
  if (validation.generalIssues.length > 0 || validation.issues.length > 0) {
    const first = validation.generalIssues[0] ?? validation.issues[0]?.message ?? "Invalid editor input.";
    throw new FormatParseError(first);
  }

  const stories = draft.rows.stories;
  const model: BuildingModel = {
    structInfo: {
      massN: stories.length,
      zLevel: [
        numberValue(draft.baseZ, "structInfo.zLevel[0]"),
        ...stories.map((row, index) => numberValue(rowText(row, "zLevel"), `stories[${index}].zLevel`))
      ],
      weight: stories.map((row, index) => numberValue(rowText(row, "weight"), `stories[${index}].weight`)),
      wMoment: stories.map((row, index) =>
        numberValue(rowText(row, "wMoment"), `stories[${index}].wMoment`)
      ),
      wCenter: stories.map((row, index) => ({
        x: numberValue(rowText(row, "centerX"), `stories[${index}].centerX`),
        y: numberValue(rowText(row, "centerY"), `stories[${index}].centerY`)
      }))
    },
    floors: draft.rows.floors.map((row, index) => ({
      layer: integerValue(rowText(row, "layer"), `floors[${index}].layer`),
      pos: pointsValue(rowText(row, "points"), `floors[${index}].points`)
    })),
    columns: draft.rows.columns.map((row, index) => ({
      layer: integerValue(rowText(row, "layer"), `columns[${index}].layer`),
      pos: {
        x: numberValue(rowText(row, "x"), `columns[${index}].x`),
        y: numberValue(rowText(row, "y"), `columns[${index}].y`)
      },
      kx: numberValue(rowText(row, "kx"), `columns[${index}].kx`),
      ky: numberValue(rowText(row, "ky"), `columns[${index}].ky`)
    })),
    wallCharaDB: draft.rows.wallCharas.map((row, index) => ({
      name: rowText(row, "name").trim(),
      k: numberValue(rowText(row, "k"), `wallCharas[${index}].k`),
      h: numberValue(rowText(row, "h"), `wallCharas[${index}].h`),
      c: numberValue(rowText(row, "c"), `wallCharas[${index}].c`),
      isEigenEffectK: booleanValue(
        rowText(row, "isEigenEffectK"),
        `wallCharas[${index}].isEigenEffectK`
      ),
      isKCUnitChara: booleanValue(
        rowText(row, "isKCUnitChara"),
        `wallCharas[${index}].isKCUnitChara`
      ),
      memo: rowText(row, "memo")
    })),
    walls: draft.rows.walls.map((row, index) => ({
      layer: integerValue(rowText(row, "layer"), `walls[${index}].layer`),
      name: rowText(row, "name").trim(),
      pos: [
        {
          x: numberValue(rowText(row, "x1"), `walls[${index}].x1`),
          y: numberValue(rowText(row, "y1"), `walls[${index}].y1`)
        },
        {
          x: numberValue(rowText(row, "x2"), `walls[${index}].x2`),
          y: numberValue(rowText(row, "y2"), `walls[${index}].y2`)
        }
      ],
      isVisible: booleanValue(rowText(row, "isVisible"), `walls[${index}].isVisible`)
    })),
    massDampers: draft.rows.massDampers.map((row, index) => ({
      name: rowText(row, "name").trim(),
      layer: integerValue(rowText(row, "layer"), `massDampers[${index}].layer`),
      pos: {
        x: numberValue(rowText(row, "x"), `massDampers[${index}].x`),
        y: numberValue(rowText(row, "y"), `massDampers[${index}].y`)
      },
      weight: numberValue(rowText(row, "weight"), `massDampers[${index}].weight`),
      freq: {
        x: numberValue(rowText(row, "freqX"), `massDampers[${index}].freqX`),
        y: numberValue(rowText(row, "freqY"), `massDampers[${index}].freqY`)
      },
      h: {
        x: numberValue(rowText(row, "hX"), `massDampers[${index}].hX`),
        y: numberValue(rowText(row, "hY"), `massDampers[${index}].hY`)
      }
    })),
    braceDampers: draft.rows.braceDampers.map((row, index): BraceDamper => {
      const direct = rowText(row, "direct");
      if (direct !== "X" && direct !== "Y") {
        throw new FormatParseError(`braceDampers[${index}].direct must be X or Y.`);
      }
      return {
        layer: integerValue(rowText(row, "layer"), `braceDampers[${index}].layer`),
        pos: {
          x: numberValue(rowText(row, "x"), `braceDampers[${index}].x`),
          y: numberValue(rowText(row, "y"), `braceDampers[${index}].y`)
        },
        direct,
        k: numberValue(rowText(row, "k"), `braceDampers[${index}].k`),
        c: numberValue(rowText(row, "c"), `braceDampers[${index}].c`),
        width: numberValue(rowText(row, "width"), `braceDampers[${index}].width`),
        height: numberValue(rowText(row, "height"), `braceDampers[${index}].height`),
        isLightPos: booleanValue(rowText(row, "isLightPos"), `braceDampers[${index}].isLightPos`),
        isEigenEffectK: booleanValue(
          rowText(row, "isEigenEffectK"),
          `braceDampers[${index}].isEigenEffectK`
        )
      };
    })
  };

  return parseBuildingModelJson(serializeBuildingModelJson(model));
}

export function modelToEditorDraft(model: BuildingModel): ModelEditorDraft {
  const structInfo = model.structInfo;
  const rows = emptyRows();
  rows.stories = Array.from({ length: structInfo?.massN ?? 0 }, (_, index) => ({
    layer: String(index + 1),
    zLevel: String(structInfo?.zLevel[index + 1] ?? ""),
    weight: String(structInfo?.weight[index] ?? ""),
    wMoment: String(structInfo?.wMoment[index] ?? ""),
    centerX: String(structInfo?.wCenter[index]?.x ?? ""),
    centerY: String(structInfo?.wCenter[index]?.y ?? "")
  }));
  rows.floors = model.floors.map((floor) => ({
    layer: String(floor.layer),
    points: floor.pos.flatMap((point) => [point.x, point.y]).join(",")
  }));
  rows.columns = model.columns.map((column) => ({
    layer: String(column.layer),
    x: String(column.pos.x),
    y: String(column.pos.y),
    kx: String(column.kx),
    ky: String(column.ky)
  }));
  rows.wallCharas = model.wallCharaDB.map((wall) => ({
    name: wall.name,
    k: String(wall.k),
    h: String(wall.h),
    c: String(wall.c),
    isEigenEffectK: String(wall.isEigenEffectK),
    isKCUnitChara: String(wall.isKCUnitChara),
    memo: wall.memo
  }));
  rows.walls = model.walls.map((wall) => ({
    layer: String(wall.layer),
    name: wall.name,
    x1: String(wall.pos[0].x),
    y1: String(wall.pos[0].y),
    x2: String(wall.pos[1].x),
    y2: String(wall.pos[1].y),
    isVisible: String(wall.isVisible)
  }));
  rows.massDampers = model.massDampers.map((damper) => ({
    name: damper.name,
    layer: String(damper.layer),
    x: String(damper.pos.x),
    y: String(damper.pos.y),
    weight: String(damper.weight),
    freqX: String(damper.freq.x),
    freqY: String(damper.freq.y),
    hX: String(damper.h.x),
    hY: String(damper.h.y)
  }));
  rows.braceDampers = model.braceDampers.map((damper) => ({
    layer: String(damper.layer),
    x: String(damper.pos.x),
    y: String(damper.pos.y),
    direct: damper.direct,
    k: String(damper.k),
    c: String(damper.c),
    width: String(damper.width),
    height: String(damper.height),
    isLightPos: String(damper.isLightPos),
    isEigenEffectK: String(damper.isEigenEffectK)
  }));
  return { baseZ: String(structInfo?.zLevel[0] ?? 0), rows };
}

export function createDefaultModelEditorDraft(): ModelEditorDraft {
  const model: BuildingModel = {
    structInfo: {
      massN: 1,
      zLevel: [0, 300],
      weight: [100],
      wMoment: [13_519_633.33],
      wCenter: [{ x: 610, y: 183 }]
    },
    floors: [
      { layer: 1, pos: [{ x: 0, y: 0 }, { x: 0, y: 366 }, { x: 1220, y: 366 }, { x: 1220, y: 0 }] },
      { layer: 2, pos: [{ x: 0, y: 0 }, { x: 0, y: 366 }, { x: 1220, y: 366 }, { x: 1220, y: 0 }] }
    ],
    columns: [
      { layer: 1, pos: { x: 0, y: 0 }, kx: 10, ky: 10 },
      { layer: 1, pos: { x: 0, y: 366 }, kx: 10, ky: 10 },
      { layer: 1, pos: { x: 1220, y: 0 }, kx: 10, ky: 10 },
      { layer: 1, pos: { x: 1220, y: 366 }, kx: 10, ky: 10 }
    ],
    wallCharaDB: [
      { name: "WAL1", k: 10.2, h: 0, c: 0, isEigenEffectK: true, isKCUnitChara: false, memo: "外壁" }
    ],
    walls: [
      { name: "WAL1", layer: 1, pos: [{ x: 0, y: 0 }, { x: 0, y: 366 }], isVisible: true }
    ],
    massDampers: [],
    braceDampers: []
  };
  return modelToEditorDraft(model);
}

export function draftToEditorForm(draft: ModelEditorDraft): ModelEditorFormData {
  return {
    massN: String(draft.rows.stories.length),
    baseZ: draft.baseZ,
    stories: serializeEditorTableText("stories", draft.rows.stories),
    floors: serializeEditorTableText("floors", draft.rows.floors),
    columns: serializeEditorTableText("columns", draft.rows.columns),
    wallCharas: serializeEditorTableText("wallCharas", draft.rows.wallCharas),
    walls: serializeEditorTableText("walls", draft.rows.walls),
    massDampers: serializeEditorTableText("massDampers", draft.rows.massDampers),
    braceDampers: serializeEditorTableText("braceDampers", draft.rows.braceDampers)
  };
}

export function editorFormToDraft(formData: ModelEditorFormData): ModelEditorDraft {
  const storyCount = integerValue(formData.massN, "massN");
  const rows = emptyRows();
  const texts: Record<EditorSectionId, string> = {
    stories: formData.stories,
    floors: formData.floors,
    columns: formData.columns,
    wallCharas: formData.wallCharas,
    walls: formData.walls,
    massDampers: formData.massDampers,
    braceDampers: formData.braceDampers
  };
  for (const section of MODEL_EDITOR_SECTION_IDS) {
    rows[section] = parseEditorTableText(section, texts[section], {
      context: { storyCount }
    }).rows;
  }
  return { baseZ: formData.baseZ, rows };
}

export function createDefaultModelEditorFormData(): ModelEditorFormData {
  return draftToEditorForm(createDefaultModelEditorDraft());
}

export function buildModelFromEditorForm(formData: ModelEditorFormData): BuildingModel {
  return buildModelFromEditorDraft(editorFormToDraft(formData));
}

export function modelToEditorForm(model: BuildingModel): ModelEditorFormData {
  return draftToEditorForm(modelToEditorDraft(model));
}

export function modelEditorFormToJson(formData: ModelEditorFormData): string {
  return serializeBuildingModelJson(buildModelFromEditorForm(formData));
}
