import { describe, expect, it } from "vitest";
import {
  convertNiceJsonToBuildingModel,
  NiceJsonValidationError
} from "../src/io/jsonToBuildingModel";

describe("JSON -> BuildingModel converter", () => {
  it("converts minimal NICE JSON", () => {
    const json = JSON.stringify({
      物件情報: { 建物階数: 1 },
      固有値解析諸元: [
        {
          階: 1,
          層重量: 100,
          重心: [610, 183],
          重量慣性モーメント: 13519633.33
        }
      ],
      床情報: [{ 階: 1, 座標: [0, 0, 0, 366, 1220, 366, 1220, 0] }],
      柱剛性情報: [{ 階: 1, 位置: [0, 0], 通り方向剛性: [10, 10] }],
      壁剛性情報: [{ 名前: "WAL1", 階: 1, 単位剛性: 10.2, 位置: [0, 0, 0, 366] }]
    });

    const model = convertNiceJsonToBuildingModel(json);
    expect(model.structInfo?.massN).toBe(1);
    expect(model.floors.length).toBe(1);
    expect(model.columns.length).toBe(1);
    expect(model.walls.length).toBe(1);
    expect(model.wallCharaDB[0].name).toBe("WAL1_10200");
  });

  it("throws validation error for invalid json text", () => {
    expect(() => convertNiceJsonToBuildingModel("{invalid-json")).toThrow(NiceJsonValidationError);
  });

  it("throws validation error when required object is missing", () => {
    const json = JSON.stringify({
      固有値解析諸元: []
    });
    expect(() => convertNiceJsonToBuildingModel(json)).toThrow(NiceJsonValidationError);
  });

  it("throws validation error when floor coordinates are not x/y pairs", () => {
    const json = JSON.stringify({
      物件情報: { 建物階数: 1 },
      固有値解析諸元: [],
      床情報: [{ 階: 1, 座標: [0, 0, 300] }],
      柱剛性情報: [],
      壁剛性情報: []
    });
    expect(() => convertNiceJsonToBuildingModel(json)).toThrow(NiceJsonValidationError);
  });
});
