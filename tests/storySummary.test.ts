import { describe, expect, it } from "vitest";
import type { BuildingModel } from "../src/core/types";
import {
  calculateStoryContributions,
  calculateStorySummaries,
  serializeStorySummariesCsv
} from "../src/core/analysis/storySummary";

function createModel(): BuildingModel {
  return {
    structInfo: {
      massN: 1,
      zLevel: [0, 300],
      weight: [100],
      wMoment: [1_000],
      wCenter: [{ x: 0, y: 0 }]
    },
    floors: [],
    columns: [
      { layer: 1, pos: { x: 3, y: -2 }, kx: 20, ky: 10 },
      { layer: 1, pos: { x: -1, y: 2 }, kx: 10, ky: 20 }
    ],
    wallCharaDB: [],
    walls: [],
    massDampers: [],
    braceDampers: []
  };
}

describe("story stiffness and eccentricity summary", () => {
  it("uses the same directional stiffness terms as matrix assembly", () => {
    const [story] = calculateStoryContributions(createModel());

    expect(story.kxx).toBe(30);
    expect(story.kyy).toBe(30);
    expect(story.kxr).toBe(20);
    expect(story.kyr).toBe(10);
    expect(story.krr).toBe(230);
  });

  it("computes stiffness center, elastic radii, and directional eccentricity ratios", () => {
    const [story] = calculateStorySummaries(createModel());

    expect(story.stiffnessCenter?.x).toBeCloseTo(1 / 3);
    expect(story.stiffnessCenter?.y).toBeCloseTo(-2 / 3);
    expect(story.torsionalStiffnessAtCenter).toBeCloseTo(640 / 3);
    expect(story.elasticRadiusX).toBeCloseTo(Math.sqrt(64 / 9));
    expect(story.elasticRadiusY).toBeCloseTo(Math.sqrt(64 / 9));
    expect(story.eccentricityRatioX).toBeCloseTo(0.25);
    expect(story.eccentricityRatioY).toBeCloseTo(0.125);
    expect(story.relativeSpecificStiffnessX).toBe(1);
    expect(story.relativeSpecificStiffnessY).toBe(1);
  });

  it("serializes auditable units and metrics to CSV", () => {
    const csv = serializeStorySummariesCsv(calculateStorySummaries(createModel()));

    expect(csv).toContain("Kx(kN/cm)");
    expect(csv).toContain("eccentricityRatioX");
    expect(csv.trim().split("\n")).toHaveLength(2);
  });

  it("computes the available eccentricity ratio for one-directional stiffness", () => {
    const model = createModel();
    model.columns = [
      { layer: 1, pos: { x: 0, y: -2 }, kx: 10, ky: 0 },
      { layer: 1, pos: { x: 0, y: 2 }, kx: 20, ky: 0 }
    ];

    const [story] = calculateStorySummaries(model);

    expect(story.stiffnessCenter.x).toBeNull();
    expect(story.stiffnessCenter.y).toBeCloseTo(2 / 3);
    expect(story.torsionalStiffnessAtCenter).toBeCloseTo(320 / 3);
    expect(story.elasticRadiusX).toBeCloseTo(Math.sqrt(32 / 9));
    expect(story.elasticRadiusY).toBeNull();
    expect(story.eccentricityRatioX).toBeCloseTo(1 / (2 * Math.sqrt(2)));
    expect(story.eccentricityRatioY).toBeNull();
  });
});
