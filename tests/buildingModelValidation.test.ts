import { describe, expect, it } from "vitest";
import { FormatParseError, parseBuildingModelJson } from "../src/io";

function createValidDocument() {
  return {
    format: "twist-dynamics/building-model",
    version: 1,
    model: {
      structInfo: {
        massN: 2,
        sType: "R",
        zLevel: [0, 300, 600],
        weight: [100, 120],
        wMoment: [10, 12],
        wCenter: [
          { x: 0, y: 0 },
          { x: 0, y: 0 }
        ]
      },
      floors: [
        {
          layer: 1,
          pos: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 }
          ]
        },
        {
          layer: 2,
          pos: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 }
          ]
        },
        {
          layer: 3,
          pos: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 }
          ]
        }
      ],
      columns: [
        { layer: 1, pos: { x: 0, y: 0 }, kx: 10, ky: 10 },
        { layer: 2, pos: { x: 0, y: 0 }, kx: 10, ky: 10 }
      ],
      wallCharaDB: [{ name: "W1", k: 10, h: 0, c: 0, isEigenEffectK: true, isKCUnitChara: false, memo: "" }],
      walls: [
        {
          name: "W1",
          layer: 1,
          pos: [
            { x: 0, y: 0 },
            { x: 0, y: 100 }
          ],
          isVisible: true
        }
      ],
      massDampers: [],
      braceDampers: [],
      dxPanels: []
    }
  };
}

describe("BuildingModel JSON validation", () => {
  it("parses valid envelope document", () => {
    const doc = createValidDocument();
    const parsed = parseBuildingModelJson(JSON.stringify(doc));

    expect(parsed.structInfo?.massN).toBe(2);
    expect(parsed.floors.length).toBe(3);
  });

  const invalidCases: Array<{
    name: string;
    buildText: () => string;
    expectedMessage: string;
  }> = [
    {
      name: "rejects missing envelope",
      buildText: () => JSON.stringify(createValidDocument().model),
      expectedMessage: "must include format, version, and model"
    },
    {
      name: "rejects wrong format",
      buildText: () => {
        const doc = createValidDocument();
        doc.format = "other/format";
        return JSON.stringify(doc);
      },
      expectedMessage: "format must be"
    },
    {
      name: "rejects wrong version",
      buildText: () => {
        const doc = createValidDocument();
        doc.version = 2;
        return JSON.stringify(doc);
      },
      expectedMessage: "version must be 1"
    },
    {
      name: "rejects missing structInfo",
      buildText: () => {
        const doc = createValidDocument();
        delete (doc.model as { structInfo?: unknown }).structInfo;
        return JSON.stringify(doc);
      },
      expectedMessage: "structInfo is required"
    },
    {
      name: "rejects zLevel mismatch",
      buildText: () => {
        const doc = createValidDocument();
        doc.model.structInfo.zLevel = [0, 300];
        return JSON.stringify(doc);
      },
      expectedMessage: "zLevel length must be massN + 1"
    },
    {
      name: "rejects weight mismatch",
      buildText: () => {
        const doc = createValidDocument();
        doc.model.structInfo.weight = [100];
        return JSON.stringify(doc);
      },
      expectedMessage: "weight length must equal massN"
    },
    {
      name: "rejects out-of-range floor layer",
      buildText: () => {
        const doc = createValidDocument();
        doc.model.floors[0].layer = 4;
        return JSON.stringify(doc);
      },
      expectedMessage: "layer must be <= 3"
    },
    {
      name: "rejects invalid wall point count",
      buildText: () => {
        const doc = createValidDocument();
        doc.model.walls[0].pos = [{ x: 0, y: 0 }];
        return JSON.stringify(doc);
      },
      expectedMessage: "must contain exactly 2 points"
    },
    {
      name: "rejects floor polygon with fewer than 3 points",
      buildText: () => {
        const doc = createValidDocument();
        doc.model.floors[0].pos = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
        return JSON.stringify(doc);
      },
      expectedMessage: "must contain at least 3 points"
    }
  ];

  for (const testCase of invalidCases) {
    it(testCase.name, () => {
      expect(() => parseBuildingModelJson(testCase.buildText())).toThrow(FormatParseError);
      expect(() => parseBuildingModelJson(testCase.buildText())).toThrow(testCase.expectedMessage);
    });
  }
});
