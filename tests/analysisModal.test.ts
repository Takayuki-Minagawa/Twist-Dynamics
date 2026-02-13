import { describe, expect, it } from "vitest";
import { analyzeRealEigen } from "../src/core/analysis";
import { parseModalDat, serializeModalDat } from "../src/io";
import type { BuildingModel } from "../src/core/types";

function createSimpleModel(): BuildingModel {
  return {
    structInfo: {
      massN: 1,
      sType: "R",
      zLevel: [0, 300],
      weight: [100],
      wMoment: [1000],
      wCenter: [{ x: 0, y: 0 }]
    },
    floors: [
      {
        layer: 1,
        pos: [
          { x: -100, y: -100 },
          { x: -100, y: 100 },
          { x: 100, y: 100 },
          { x: 100, y: -100 }
        ]
      },
      {
        layer: 2,
        pos: [
          { x: -100, y: -100 },
          { x: -100, y: 100 },
          { x: 100, y: 100 },
          { x: 100, y: -100 }
        ]
      }
    ],
    columns: [
      { layer: 1, pos: { x: 0, y: 1 }, kx: 10, ky: 10 },
      { layer: 1, pos: { x: 0, y: -1 }, kx: 10, ky: 10 }
    ],
    wallCharaDB: [
      {
        name: "W1",
        k: 0,
        h: 0,
        c: 0,
        isEigenEffectK: true,
        isKCUnitChara: false,
        memo: ""
      }
    ],
    walls: [
      {
        name: "W1",
        layer: 1,
        pos: [{ x: 0, y: 0 }, { x: 0, y: 10 }],
        isVisible: true
      }
    ],
    massDampers: [],
    braceDampers: [],
    dxPanels: []
  };
}

describe("real eigen analysis", () => {
  it("computes frequencies and readable mode vectors", () => {
    const { modal } = analyzeRealEigen(createSimpleModel(), { defaultDampingRatio: 0.02 });

    expect(modal.modal.frequenciesHz.length).toBe(3);
    expect(modal.modal.frequenciesHz[0]).toBeGreaterThan(0.6);
    expect(modal.modal.frequenciesHz[0]).toBeLessThan(0.8);
    expect(modal.modal.frequenciesHz[1]).toBeGreaterThan(2.1);
    expect(modal.modal.frequenciesHz[1]).toBeLessThan(2.4);

    expect(modal.modal.eigenVectors.map((row) => row.label)).toEqual([
      "M1-δx",
      "M1-δy",
      "M1-θz"
    ]);

    for (let modeIndex = 0; modeIndex < modal.modal.frequenciesHz.length; modeIndex++) {
      const maxAbs = Math.max(
        ...modal.modal.eigenVectors.map((row) => Math.abs(row.values[modeIndex] ?? 0))
      );
      expect(maxAbs).toBeCloseTo(1, 8);
    }
  });

  it("keeps key modal values across serialize -> parse", () => {
    const { modal } = analyzeRealEigen(createSimpleModel());
    const text = serializeModalDat(modal);
    const parsed = parseModalDat(text);

    expect(parsed.modal.frequenciesHz.length).toBe(modal.modal.frequenciesHz.length);
    expect(parsed.modal.eigenVectors.length).toBe(modal.modal.eigenVectors.length);
    expect(parsed.modal.frequenciesHz[0]).toBeCloseTo(modal.modal.frequenciesHz[0], 6);
  });
});
