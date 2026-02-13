import type { BuildingModel } from "../../core/types";
import { FormatParseError } from "../text";

function checkLayerRange(
  itemName: string,
  layer: number,
  maxLayer: number | null
): void {
  if (!Number.isInteger(layer) || layer < 1) {
    throw new FormatParseError(`BuildingModel JSON: ${itemName}.layer must be an integer >= 1.`);
  }

  if (maxLayer !== null && layer > maxLayer) {
    throw new FormatParseError(
      `BuildingModel JSON: ${itemName}.layer must be <= ${maxLayer}, got ${layer}.`
    );
  }
}

function validateStructInfo(model: BuildingModel): void {
  const struct = model.structInfo;
  if (!struct) {
    throw new FormatParseError("BuildingModel JSON: structInfo is required.");
  }

  if (!Number.isInteger(struct.massN) || struct.massN < 1) {
    throw new FormatParseError("BuildingModel JSON: structInfo.massN must be an integer >= 1.");
  }

  if (struct.zLevel.length !== struct.massN + 1) {
    throw new FormatParseError(
      "BuildingModel JSON: structInfo.zLevel length must be massN + 1."
    );
  }
  if (struct.weight.length !== struct.massN) {
    throw new FormatParseError("BuildingModel JSON: structInfo.weight length must equal massN.");
  }
  if (struct.wMoment.length !== struct.massN) {
    throw new FormatParseError("BuildingModel JSON: structInfo.wMoment length must equal massN.");
  }
  if (struct.wCenter.length !== struct.massN) {
    throw new FormatParseError("BuildingModel JSON: structInfo.wCenter length must equal massN.");
  }

  for (let i = 1; i < struct.zLevel.length; i++) {
    if (struct.zLevel[i] < struct.zLevel[i - 1]) {
      throw new FormatParseError(
        "BuildingModel JSON: structInfo.zLevel must be monotonic non-decreasing."
      );
    }
  }
}

function validateGeometryRules(model: BuildingModel): void {
  for (const [index, floor] of model.floors.entries()) {
    if (floor.pos.length < 3) {
      throw new FormatParseError(
        `BuildingModel JSON: floors[${index}].pos must contain at least 3 points.`
      );
    }
  }

  for (const [index, panel] of model.dxPanels.entries()) {
    if (panel.pos.length < 2) {
      throw new FormatParseError(
        `BuildingModel JSON: dxPanels[${index}].pos must contain at least 2 points.`
      );
    }
  }

  for (const [index, wall] of model.walls.entries()) {
    const [start, end] = wall.pos;
    if (start.x !== end.x && start.y !== end.y) {
      throw new FormatParseError(
        `BuildingModel JSON: walls[${index}] must be aligned to X or Y axis (diagonal is not allowed).`
      );
    }
    if (start.x === end.x && start.y === end.y) {
      throw new FormatParseError(
        `BuildingModel JSON: walls[${index}] must have non-zero length.`
      );
    }
  }
}

function validateWallReferences(model: BuildingModel): void {
  const names = new Set<string>();
  for (const [index, wallChara] of model.wallCharaDB.entries()) {
    if (names.has(wallChara.name)) {
      throw new FormatParseError(
        `BuildingModel JSON: wallCharaDB[${index}].name is duplicated: "${wallChara.name}".`
      );
    }
    names.add(wallChara.name);
  }

  for (const [index, wall] of model.walls.entries()) {
    if (!names.has(wall.name)) {
      throw new FormatParseError(
        `BuildingModel JSON: walls[${index}].name "${wall.name}" is not found in wallCharaDB.`
      );
    }
  }
}

function validateLayerRules(model: BuildingModel): void {
  const massN = model.structInfo?.massN ?? null;
  const floorMaxLayer = massN === null ? null : massN + 1;
  const defaultMaxLayer = massN;

  for (const [index, floor] of model.floors.entries()) {
    checkLayerRange(`floors[${index}]`, floor.layer, floorMaxLayer);
  }
  for (const [index, column] of model.columns.entries()) {
    checkLayerRange(`columns[${index}]`, column.layer, defaultMaxLayer);
  }
  for (const [index, wall] of model.walls.entries()) {
    checkLayerRange(`walls[${index}]`, wall.layer, defaultMaxLayer);
  }
  for (const [index, md] of model.massDampers.entries()) {
    checkLayerRange(`massDampers[${index}]`, md.layer, defaultMaxLayer);
  }
  for (const [index, bd] of model.braceDampers.entries()) {
    checkLayerRange(`braceDampers[${index}]`, bd.layer, defaultMaxLayer);
  }
  for (const [index, panel] of model.dxPanels.entries()) {
    checkLayerRange(`dxPanels[${index}]`, panel.layer, defaultMaxLayer);
  }
}

export function normalizeBuildingModel(model: BuildingModel): BuildingModel {
  const normalized: BuildingModel = {
    structInfo: model.structInfo,
    floors: model.floors.slice().sort((a, b) => a.layer - b.layer),
    columns: model.columns.slice().sort((a, b) => a.layer - b.layer),
    wallCharaDB: model.wallCharaDB.slice(),
    walls: model.walls.slice().sort((a, b) => a.layer - b.layer),
    massDampers: model.massDampers.slice().sort((a, b) => a.layer - b.layer),
    braceDampers: model.braceDampers.slice().sort((a, b) => a.layer - b.layer),
    dxPanels: model.dxPanels.slice().sort((a, b) => a.layer - b.layer)
  };

  validateStructInfo(normalized);
  validateLayerRules(normalized);
  validateGeometryRules(normalized);
  validateWallReferences(normalized);

  return normalized;
}
