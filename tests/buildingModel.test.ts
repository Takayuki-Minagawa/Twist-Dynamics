import { describe, expect, it } from "vitest";
import { parseBuildingModelXml, serializeBuildingModelXml } from "../src/io/buildingModel";
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

  it("keeps key values across parse -> serialize -> parse", () => {
    const xml = readFixture("reference/building-model/Test_simple.xml");
    const first = parseBuildingModelXml(xml);
    const serialized = serializeBuildingModelXml(first);
    const second = parseBuildingModelXml(serialized);

    expect(second.structInfo?.massN).toBe(first.structInfo?.massN);
    expect(second.structInfo?.sType).toBe(first.structInfo?.sType);
    expect(second.structInfo?.zLevel).toEqual(first.structInfo?.zLevel);
    expect(second.columns.length).toBe(first.columns.length);
    expect(second.walls.length).toBe(first.walls.length);
    expect(second.wallCharaDB.length).toBe(first.wallCharaDB.length);
  });
});
