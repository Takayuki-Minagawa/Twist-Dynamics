import { describe, expect, it } from "vitest";
import type { ComplexModalFile, ModalDatFile, RespFile } from "../src/core/types";
import {
  buildResponseSeries,
  extractComplexMode,
  extractRealMode,
  sampleComplexMode,
  sampleRealMode,
  sampleResponseSeries
} from "../src/viz";

const baseShape = {
  story: 2,
  zLevel: [0, 300, 600],
  massCenters: [
    { layer: 1, x: 0, y: 0 },
    { layer: 2, x: 0, y: 0 }
  ]
};

describe("real modal visualization adapter", () => {
  it("maps unordered M-layer rows to level poses and samples a sine cycle", () => {
    const data: ModalDatFile = {
      baseShape,
      modal: {
        frequenciesHz: [2],
        participationFactorX: [],
        participationFactorY: [],
        effectiveMassRatioX: [],
        effectiveMassRatioY: [],
        eigenVectors: [
          { label: "M2-θz", values: [0.02] },
          { label: "M1-δy", values: [-0.5] },
          { label: "M2-δx", values: [1] },
          { label: "M1-δx", values: [0.25] },
          { label: "M2-δy", values: [0] },
          { label: "M1-θz", values: [0.01] }
        ]
      }
    };

    const shape = extractRealMode(data, 0, 2);
    expect(shape[0]).toEqual({ dx: 0, dy: 0, rz: 0 });
    expect(shape[1]).toEqual({ dx: 0.25, dy: -0.5, rz: 0.01 });
    expect(shape[2]).toEqual({ dx: 1, dy: 0, rz: 0.02 });
    expect(sampleRealMode(shape, Math.PI / 2)[2]).toEqual({ dx: 1, dy: 0, rz: 0.02 });
    expect(() => extractRealMode(data, 0, 3)).toThrow("model has 3");

    data.modal.eigenVectors = data.modal.eigenVectors.filter((row) => row.label !== "M1-θz");
    expect(() => extractRealMode(data, 0)).toThrow("missing rz for story 1");
  });
});

describe("complex modal visualization adapter", () => {
  it("reconstructs real motion from amplitude/phase or explicit complex values", () => {
    const data: ComplexModalFile = {
      baseShape,
      modes: [
        {
          mode: 1,
          frequencyHz: 1.5,
          dampingRatioPercent: 2,
          vectors: [
            { component: "DX_1", amplitude: 2, phaseRad: Math.PI / 2 },
            { component: "DY_1", amplitude: 0, phaseRad: 0 },
            { component: "RZ_1", amplitude: 0, phaseRad: 0 },
            { component: "DX_2", amplitude: 1, phaseRad: 0, complexReal: 0.5, complexImag: -0.5 },
            { component: "DY_2", amplitude: 0, phaseRad: 0 },
            { component: "RZ_2", amplitude: 0.1, phaseRad: 0 }
          ]
        }
      ]
    };

    const mode = extractComplexMode(data, 0, 2);
    expect(mode.frequencyHz).toBe(1.5);
    expect(sampleComplexMode(mode, 0)[1].dx).toBeCloseTo(0);
    expect(sampleComplexMode(mode, Math.PI / 2)[1].dx).toBeCloseTo(-2);
    expect(sampleComplexMode(mode, 0)[2].dx).toBeCloseTo(0.5);

    data.modes[0].vectors.find((vector) => vector.component === "DX_2")!.complexImag = undefined;
    expect(() => extractComplexMode(data, 0)).toThrow("both complexReal and complexImag");
  });
});

describe("time-history visualization adapter", () => {
  function response(): RespFile {
    return {
      baseShape,
      meta: { massCount: 2, dt: 2, damperCount: 0 },
      header: [
        "Time(s)",
        "DX_1",
        "DY_1",
        "θZ_1",
        "DX_2",
        "DY_2",
        "DθZ_2",
        "DX_R",
        "DY_R",
        "DθZ_R"
      ],
      records: [
        [10, 0, 0, 0, 2, 4, 0.2, 200, 400, 20],
        [12, 2, 4, 0.1, 6, 8, 0.4, 600, 800, 40]
      ],
      columnMaxAbs: []
    };
  }

  it("handles first-story θZ, upper-story DθZ, and ignores roof aliases", () => {
    const series = buildResponseSeries(response(), 2);
    expect(series.duration).toBe(2);
    expect(Object.prototype.hasOwnProperty.call(series.poses, 0)).toBe(false);
    expect(series.poses[0][2]).toEqual({ dx: 2, dy: 4, rz: 0.2 });
    expect(Object.prototype.hasOwnProperty.call(series.poses, 0)).toBe(true);

    const middle = sampleResponseSeries(series, 1);
    expect(middle[1]).toEqual({ dx: 1, dy: 2, rz: 0.05 });
    expect(middle[2].dx).toBe(4);
    expect(middle[2].dy).toBe(6);
    expect(middle[2].rz).toBeCloseTo(0.3);
  });

  it("keeps compact samples independent from source records and preserves lazy pose mutations", () => {
    const data = response();
    const series = buildResponseSeries(data, 2);
    data.records[1][4] = 6000;

    expect(sampleResponseSeries(series, 2)[2].dx).toBe(6);
    series.poses[0][2].dx = 10;
    expect(sampleResponseSeries(series, 0)[2].dx).toBe(10);
    expect(sampleResponseSeries(series, 1)[2].dx).toBe(8);
  });

  it("rejects an incomplete displacement channel set", () => {
    const data = response();
    data.header[5] = "AY_2";
    expect(() => buildResponseSeries(data)).toThrow("missing dy for story 2");
  });

  it("retains strict validation for every compacted value and monotonic time", () => {
    const invalidValue = response();
    invalidValue.records[1][6] = Number.NaN;
    expect(() => buildResponseSeries(invalidValue)).toThrow("records[1].RZ_2");

    const reversed = response();
    reversed.records[1][0] = 9;
    expect(() => buildResponseSeries(reversed)).toThrow("monotonic non-decreasing");
  });
});
