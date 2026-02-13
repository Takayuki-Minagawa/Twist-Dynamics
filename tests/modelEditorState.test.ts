import { describe, expect, it } from "vitest";
import { parseBuildingModelJson } from "../src/io";
import {
  buildModelFromEditorForm,
  createDefaultModelEditorFormData,
  modelEditorFormToJson,
  modelToEditorForm
} from "../src/app/modelEditorState";
import { readFixture } from "./helpers";

describe("model editor form state", () => {
  it("generates valid BuildingModel JSON from default form", () => {
    const json = modelEditorFormToJson(createDefaultModelEditorFormData());
    const model = parseBuildingModelJson(json);
    expect(model.structInfo?.massN).toBe(1);
    expect(model.floors.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps model shape across model -> form -> model", () => {
    const source = parseBuildingModelJson(readFixture("reference/building-model/Test_simple.json"));
    const form = modelToEditorForm(source);
    const rebuilt = buildModelFromEditorForm(form);

    expect(rebuilt.structInfo?.massN).toBe(source.structInfo?.massN);
    expect(rebuilt.structInfo?.sType).toBe(source.structInfo?.sType);
    expect(rebuilt.floors.length).toBe(source.floors.length);
    expect(rebuilt.columns.length).toBe(source.columns.length);
    expect(rebuilt.wallCharaDB.length).toBe(source.wallCharaDB.length);
    expect(rebuilt.walls.length).toBe(source.walls.length);
  });

  it("rejects invalid wall direction in editor form", () => {
    const form = createDefaultModelEditorFormData();
    form.walls = "1,WAL1,0,0,100,100,true";
    expect(() => buildModelFromEditorForm(form)).toThrow("diagonal is not allowed");
  });
});
