import { describe, expect, it } from "vitest";
import { parseBuildingModelXml } from "../src/io/buildingModel";
import { readFixture } from "./helpers";

describe("BuildingModel XML parser", () => {
  it("parses Test_simple.xml", () => {
    const xml = readFixture("reference/building-model/Test_simple.xml");
    const model = parseBuildingModelXml(xml);

    expect(model.structInfo?.massN).toBe(1);
    expect(model.structInfo?.sType).toBe("R");
    expect(model.floors.length).toBeGreaterThanOrEqual(2);
    expect(model.columns.length).toBeGreaterThanOrEqual(4);
    expect(model.walls.length).toBeGreaterThanOrEqual(1);
    expect(model.wallCharaDB.length).toBeGreaterThanOrEqual(1);
  });
});
