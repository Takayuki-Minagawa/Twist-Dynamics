import { describe, expect, it } from "vitest";
import { analyzeTimeHistory, type GroundWave } from "../src/core/analysis";
import { parseRespCsv, serializeRespCsv } from "../src/io";
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

function createSineWave(steps = 200, dt = 0.01): GroundWave {
  const time = Array.from({ length: steps }, (_, index) => index * dt);
  const accX = time.map((t) => 50 * Math.sin(2 * Math.PI * 1.2 * t));
  const accY = time.map((t) => 20 * Math.sin(2 * Math.PI * 0.8 * t));
  return { dt, time, accX, accY };
}

describe("time history response analysis", () => {
  it("produces non-zero response with compatible Resp format", () => {
    const resp = analyzeTimeHistory(createSimpleModel(), createSineWave(), {
      defaultDampingRatio: 0.02
    });

    expect(resp.meta.massCount).toBe(1);
    expect(resp.records.length).toBe(200);
    expect(resp.header[0]).toBe("Time(s)");
    expect(resp.header.includes("DX_1")).toBe(true);
    expect(resp.header.includes("AX_R")).toBe(true);
    expect(resp.columnMaxAbs.some((value) => value > 0)).toBe(true);
  });

  it("keeps key response values across serialize -> parse", () => {
    const resp = analyzeTimeHistory(createSimpleModel(), createSineWave(120, 0.02));
    const text = serializeRespCsv(resp);
    const parsed = parseRespCsv(text);

    expect(parsed.records.length).toBe(resp.records.length);
    expect(parsed.meta.dt).toBeCloseTo(resp.meta.dt, 8);
    expect(parsed.header.length).toBe(resp.header.length);
    expect(parsed.columnMaxAbs[1]).toBeCloseTo(resp.columnMaxAbs[1], 5);
  });
});
