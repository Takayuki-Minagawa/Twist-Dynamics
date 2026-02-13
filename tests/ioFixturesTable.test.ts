import { describe, expect, it } from "vitest";
import {
  parseBuildingModelJson,
  parseComplexModalDat,
  parseModalDat,
  parseRespCsv,
  serializeBuildingModelJson
} from "../src/io";
import { readFixture } from "./helpers";

interface ParserFixtureCase {
  name: string;
  fixturePath: string;
  verify: (text: string) => void;
}

const parserCases: ParserFixtureCase[] = [
  {
    name: "parses BuildingModel JSON fixture",
    fixturePath: "reference/building-model/Test_simple.json",
    verify: (text) => {
      const model = parseBuildingModelJson(text);
      expect(model.structInfo?.massN).toBe(1);
      expect(model.structInfo?.sType).toBe("R");
      expect(model.floors.length).toBeGreaterThanOrEqual(2);
      expect(model.columns.length).toBeGreaterThanOrEqual(4);
      expect(model.walls.length).toBeGreaterThanOrEqual(1);
      expect(model.wallCharaDB.length).toBeGreaterThanOrEqual(1);
    }
  },
  {
    name: "parses modal DAT fixture",
    fixturePath: "reference/modal/test_01_eig.dat",
    verify: (text) => {
      const data = parseModalDat(text);
      expect(data.baseShape.story).toBe(3);
      expect(data.modal.frequenciesHz.length).toBe(9);
      expect(data.modal.frequenciesHz[0]).toBeGreaterThan(2.0);
      expect(data.modal.eigenVectors.length).toBeGreaterThan(0);
    }
  },
  {
    name: "parses complex modal DAT fixture",
    fixturePath: "reference/complex/Test_simple_ceig.dat",
    verify: (text) => {
      const data = parseComplexModalDat(text);
      expect(data.baseShape.story).toBe(1);
      expect(data.modes.length).toBe(3);
      expect(data.modes[0].frequencyHz).toBeGreaterThan(3.0);
      expect(data.modes[0].vectors.length).toBeGreaterThan(0);
    }
  },
  {
    name: "parses response CSV fixture",
    fixturePath: "reference/resp/test.csv",
    verify: (text) => {
      const data = parseRespCsv(text);
      expect(data.baseShape.story).toBe(3);
      expect(data.meta.massCount).toBe(3);
      expect(data.records.length).toBeGreaterThan(100);
      expect(data.header.length).toBeGreaterThan(10);
    }
  }
];

describe("I/O fixture parser table", () => {
  for (const testCase of parserCases) {
    it(testCase.name, () => {
      const text = readFixture(testCase.fixturePath);
      testCase.verify(text);
    });
  }

  it("keeps key BuildingModel values across parse -> serialize -> parse", () => {
    const json = readFixture("reference/building-model/Test_simple.json");
    const first = parseBuildingModelJson(json);
    const serialized = serializeBuildingModelJson(first);
    const second = parseBuildingModelJson(serialized);

    expect(second.structInfo?.massN).toBe(first.structInfo?.massN);
    expect(second.structInfo?.sType).toBe(first.structInfo?.sType);
    expect(second.structInfo?.zLevel).toEqual(first.structInfo?.zLevel);
    expect(second.columns.length).toBe(first.columns.length);
    expect(second.walls.length).toBe(first.walls.length);
    expect(second.wallCharaDB.length).toBe(first.wallCharaDB.length);
  });
});
