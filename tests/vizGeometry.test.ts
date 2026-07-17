import { describe, expect, it } from "vitest";
import type { BuildingModel } from "../src/core/types";
import {
  buildModelGeometry,
  createZeroLevelPoses,
  deformAttachedPoint,
  modelPointToWorld,
  scaledLevelPoses,
  scaledModalLevelPoses
} from "../src/viz";

function createModel(): BuildingModel {
  return {
    structInfo: {
      massN: 2,
      zLevel: [0, 300, 650],
      weight: [100, 90],
      wMoment: [1000, 900],
      wCenter: [
        { x: 10, y: 20 },
        { x: 15, y: 25 }
      ]
    },
    floors: [
      {
        layer: 1,
        pos: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 80 },
          { x: 0, y: 80 }
        ]
      },
      {
        layer: 3,
        pos: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 80 },
          { x: 0, y: 80 }
        ]
      }
    ],
    columns: [{ layer: 2, pos: { x: 30, y: 40 }, kx: 10, ky: 10 }],
    wallCharaDB: [
      { name: "S", k: 10, h: 0, c: 0, isEigenEffectK: true, isKCUnitChara: false, memo: "" },
      { name: "N", k: 0, h: 0, c: 0, isEigenEffectK: false, isKCUnitChara: false, memo: "" }
    ],
    walls: [
      { name: "S", layer: 1, pos: [{ x: 0, y: 0 }, { x: 100, y: 0 }], isVisible: true },
      { name: "N", layer: 2, pos: [{ x: 0, y: 80 }, { x: 100, y: 80 }], isVisible: true },
      { name: "S", layer: 2, pos: [{ x: 0, y: 20 }, { x: 100, y: 20 }], isVisible: false }
    ],
    massDampers: [
      { name: "TMD", layer: 2, pos: { x: 50, y: 40 }, weight: 1, freq: { x: 1, y: 1 }, h: { x: 0.05, y: 0.05 } }
    ],
    braceDampers: [
      { layer: 1, pos: { x: 0, y: 0 }, direct: "X", k: 0, c: 1, width: 100, height: 150, isLightPos: true, isEigenEffectK: false }
    ]
  };
}

describe("visualization geometry mapping", () => {
  it("maps floor levels and story elements without the common off-by-one error", () => {
    const geometry = buildModelGeometry(createModel(), [
      { layer: 1, stiffnessCenter: { x: 12, y: 24 } },
      { layer: 2, stiffnessCenter: { x: null, y: 30 } }
    ]);

    expect(geometry.storyCount).toBe(2);
    expect(geometry.floors.map((floor) => [floor.story, floor.z])).toEqual([
      [0, 0],
      [2, 650]
    ]);
    expect(geometry.columns[0].start).toMatchObject({ level: 1, z: 300 });
    expect(geometry.columns[0].end).toMatchObject({ level: 2, z: 650 });
    expect(geometry.massDampers[0].level).toBe(2);
    expect(geometry.massDampers[0].z).toBeGreaterThan(650);
    expect(geometry.centers.filter((center) => center.category === "stiffnessCenters")).toHaveLength(1);
  });

  it("classifies visible walls and uses brace width, height, and handed position", () => {
    const geometry = buildModelGeometry(createModel());

    expect(geometry.walls).toHaveLength(2);
    expect(geometry.walls.map((wall) => wall.category)).toEqual([
      "structuralWalls",
      "nonStructuralWalls"
    ]);
    expect(geometry.braces).toHaveLength(2);
    expect(geometry.braces[0].start).toMatchObject({ plan: { x: 0, y: 0 }, level: 0, z: 0 });
    expect(geometry.braces[0].end).toMatchObject({ plan: { x: 100, y: 0 }, level: 0.5, z: 150 });
  });

  it("creates mass and stiffness center markers on the moving upper level", () => {
    const geometry = buildModelGeometry(createModel(), [
      { layer: 1, stiffnessCenter: { x: 150, y: 24 } }
    ]);

    expect(geometry.centers.filter((center) => center.category === "massCenters")).toHaveLength(2);
    expect(geometry.centers.find((center) => center.category === "stiffnessCenters")).toMatchObject({
      story: 1,
      level: 1,
      point: { x: 150, y: 24 }
    });
    expect(geometry.bounds.max.x).toBe(150);

    const invalidLayer = buildModelGeometry(createModel(), [
      { layer: 1.5, stiffnessCenter: { x: 50, y: 40 } }
    ]);
    expect(invalidLayer.centers.filter((center) => center.category === "stiffnessCenters")).toHaveLength(0);
  });
});

describe("visualization deformation math", () => {
  it("uses a right-handed X/Z/-Y world mapping", () => {
    expect(modelPointToWorld({ x: 3, y: 4 }, 5)).toEqual({ x: 3, y: 5, z: -4 });
  });

  it("rotates about the mass center and interpolates intermediate-story points", () => {
    const centers = [
      { x: 10, y: 20 },
      { x: 10, y: 20 }
    ];
    const poses = [
      { dx: 0, dy: 0, rz: 0 },
      { dx: 5, dy: -3, rz: Math.PI / 2 }
    ];
    const upper = deformAttachedPoint(
      { plan: { x: 20, y: 20 }, z: 300, level: 1 },
      centers,
      poses
    );
    expect(upper.x).toBeCloseTo(15);
    expect(upper.y).toBe(300);
    expect(upper.z).toBeCloseTo(-27);

    const middle = deformAttachedPoint(
      { plan: { x: 20, y: 20 }, z: 150, level: 0.5 },
      centers,
      poses
    );
    expect(middle.x).toBeCloseTo(17.5);
    expect(middle.z).toBeCloseTo(-23.5);
  });

  it("keeps the base fixed when exaggeration is applied", () => {
    const poses = createZeroLevelPoses(1);
    poses[0] = { dx: 4, dy: 5, rz: 6 };
    poses[1] = { dx: 2, dy: 3, rz: 0.1 };
    expect(scaledLevelPoses(poses, 10, 20)).toEqual([
      { dx: 0, dy: 0, rz: 0 },
      { dx: 20, dy: 30, rz: 2 }
    ]);
  });

  it("keeps modal rotation scaling dimensionless", () => {
    const poses = [
      { dx: 0, dy: 0, rz: 0 },
      { dx: 1, dy: 0, rz: 1 }
    ];

    expect(scaledModalLevelPoses(poses, 1_000, 1, 4)[1]).toEqual({
      dx: 40,
      dy: 0,
      rz: 0.08
    });
    expect(scaledModalLevelPoses(poses, 10_000, 1, 4)[1].rz).toBe(0.08);
  });
});
