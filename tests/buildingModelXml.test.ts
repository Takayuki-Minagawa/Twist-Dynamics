import { describe, expect, it } from "vitest";
import { parseBuildingModelJson, parseBuildingModelXml } from "../src/io";
import { readFixture } from "./helpers";

describe("BuildingModel XML parser", () => {
  it("parses XML fixture and matches key JSON metrics", () => {
    const xmlModel = parseBuildingModelXml(readFixture("reference/building-model/Test_simple.xml"));
    const jsonModel = parseBuildingModelJson(readFixture("reference/building-model/Test_simple.json"));

    expect(xmlModel.structInfo?.massN).toBe(jsonModel.structInfo?.massN);
    expect(xmlModel.structInfo?.sType).toBe(jsonModel.structInfo?.sType);
    expect(xmlModel.floors.length).toBe(jsonModel.floors.length);
    expect(xmlModel.columns.length).toBe(jsonModel.columns.length);
    expect(xmlModel.walls.length).toBe(jsonModel.walls.length);
  });

  it("throws format error when model node is missing", () => {
    const invalid = "<Root><Message>invalid</Message></Root>";
    expect(() => parseBuildingModelXml(invalid)).toThrow("model section was not found");
  });
});
