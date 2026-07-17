import { describe, expect, it } from "vitest";
import {
  parseBuildingModelJson,
  parseBuildingModelJsonWithMeta,
  parseBuildingModelXml,
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
      expect(model.floors.length).toBeGreaterThanOrEqual(2);
      expect(model.columns.length).toBeGreaterThanOrEqual(4);
      expect(model.walls.length).toBeGreaterThanOrEqual(1);
      expect(model.wallCharaDB.length).toBeGreaterThanOrEqual(1);
    }
  },
  {
    name: "parses BuildingModel XML fixture",
    fixturePath: "reference/building-model/Test_simple.xml",
    verify: (text) => {
      const model = parseBuildingModelXml(text);
      expect(model.structInfo?.massN).toBe(1);
      expect(model.columns.length).toBeGreaterThanOrEqual(4);
      expect(model.massDampers.length).toBeGreaterThanOrEqual(1);
    }
  },
  {
    name: "parses BuildingModel no-tmd fixture",
    fixturePath: "reference/building-model/no_tmd.json",
    verify: (text) => {
      const model = parseBuildingModelJson(text);
      expect(model.massDampers.length).toBe(0);
    }
  },
  {
    name: "parses BuildingModel with-tmd fixture",
    fixturePath: "reference/building-model/with_tmd.json",
    verify: (text) => {
      const model = parseBuildingModelJson(text);
      expect(model.massDampers.length).toBeGreaterThanOrEqual(1);
      expect(model.columns).toContainEqual({
        layer: 1,
        pos: { x: 350, y: 100 },
        kx: 6.5,
        ky: 0
      });
    }
  },
  {
    name: "migrates legacy BuildingModel DX fixture",
    fixturePath: "reference/building-model/DX_with_tmd.json",
    verify: (text) => {
      const result = parseBuildingModelJsonWithMeta(text);
      expect(result.warnings.map((warning) => warning.code)).toEqual([
        "legacy-struct-type-ignored",
        "legacy-dx-panels-converted"
      ]);
      expect(result.model.columns).toContainEqual({
        layer: 1,
        pos: { x: 350, y: 100 },
        kx: 6.5,
        ky: 0
      });
    }
  },
  {
    name: "ignores sType in the legacy no-tmd fixture",
    fixturePath: "reference/building-model/R_no_tmd.json",
    verify: (text) => {
      const result = parseBuildingModelJsonWithMeta(text);
      expect(result.warnings.map((warning) => warning.code)).toEqual([
        "legacy-struct-type-ignored"
      ]);
      expect(result.model.massDampers.length).toBe(0);
    }
  },
  {
    name: "parses BuildingModel boundary minimal fixture",
    fixturePath: "reference/building-model/Boundary_minimal.json",
    verify: (text) => {
      const model = parseBuildingModelJson(text);
      expect(model.structInfo?.massN).toBe(1);
      expect(model.floors.length).toBe(2);
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
    expect(second.structInfo?.zLevel).toEqual(first.structInfo?.zLevel);
    expect(second.columns.length).toBe(first.columns.length);
    expect(second.walls.length).toBe(first.walls.length);
    expect(second.wallCharaDB.length).toBe(first.wallCharaDB.length);
    expect(serialized).not.toContain('"sType"');
    expect(serialized).not.toContain('"dxPanels"');
  });
});
