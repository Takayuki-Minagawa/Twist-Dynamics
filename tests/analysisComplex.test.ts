import { describe, expect, it } from "vitest";
import { analyzeComplexEigen } from "../src/core/analysis";
import { parseComplexModalDat, serializeComplexModalDat } from "../src/io";
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
      { layer: 1, pos: { x: 0, y: 1 }, kx: 12, ky: 10 },
      { layer: 1, pos: { x: 0, y: -1 }, kx: 8, ky: 10 }
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

describe("complex eigen analysis", () => {
  it("computes complex modes with normalized vectors", () => {
    const { complex } = analyzeComplexEigen(createSimpleModel(), { defaultDampingRatio: 0.03 });

    expect(complex.modes.length).toBeGreaterThan(0);
    expect(complex.modes[0].frequencyHz).toBeGreaterThan(0);

    for (const mode of complex.modes) {
      const maxAmp = Math.max(...mode.vectors.map((vector) => vector.amplitude));
      expect(maxAmp).toBeCloseTo(1, 8);
      expect(mode.vectors.length).toBe(3);
    }
  });

  it("keeps key complex values across serialize -> parse", () => {
    const { complex } = analyzeComplexEigen(createSimpleModel(), { defaultDampingRatio: 0.02 });
    const text = serializeComplexModalDat(complex);
    const parsed = parseComplexModalDat(text);

    expect(parsed.modes.length).toBe(complex.modes.length);
    expect(parsed.modes[0].frequencyHz).toBeCloseTo(complex.modes[0].frequencyHz, 4);
    expect(parsed.modes[0].vectors.length).toBe(complex.modes[0].vectors.length);
  });
});
