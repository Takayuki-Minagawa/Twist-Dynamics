import { describe, expect, it } from "vitest";
import type { BuildingModel } from "../src/core/types";
import { assembleAnalysisMatrices } from "../src/core/analysis";
import {
  parseBuildingModelJson,
  parseBuildingModelJsonWithMeta,
  parseBuildingModelXmlWithMeta,
  serializeBuildingModelJson
} from "../src/io";
import { readFixture } from "./helpers";

function createCanonicalDocument() {
  return {
    format: "twist-dynamics/building-model",
    version: 1,
    model: {
      structInfo: {
        massN: 1,
        zLevel: [0, 300],
        weight: [100],
        wMoment: [1000],
        wCenter: [{ x: 10, y: 20 }]
      },
      floors: [],
      columns: [],
      wallCharaDB: [],
      walls: [],
      massDampers: [],
      braceDampers: []
    }
  };
}

describe("BuildingModel legacy migration", () => {
  it("ignores sType and converts X/Y dxPanels to stiffness-equivalent columns", () => {
    const doc = createCanonicalDocument();
    Object.assign(doc.model.structInfo, { sType: { obsolete: true } });
    Object.assign(doc.model, {
      dxPanels: [
        {
          layer: 1,
          direct: "X",
          pos: [
            { x: 2, y: 4 },
            { x: 6, y: 8 },
            { x: 10, y: 12 }
          ],
          k: 3
        },
        {
          layer: 1,
          direct: "Y",
          pos: [
            { x: 12, y: 18 },
            { x: 16, y: 22 }
          ],
          k: 5
        }
      ]
    });

    const result = parseBuildingModelJsonWithMeta(JSON.stringify(doc));

    expect(result.warnings.map((warning) => warning.code)).toEqual([
      "legacy-struct-type-ignored",
      "legacy-dx-panels-converted"
    ]);
    expect(result.warnings[1].count).toBe(2);
    expect(result.model.columns).toEqual([
      { layer: 1, pos: { x: 6, y: 8 }, kx: 3, ky: 0 },
      { layer: 1, pos: { x: 14, y: 20 }, kx: 0, ky: 5 }
    ]);

    const matrices = assembleAnalysisMatrices(result.model);
    expect(matrices.stiffness).toEqual([
      [3, 0, 36],
      [0, 5, 20],
      [36, 20, 512]
    ]);
  });

  it("accepts canonical JSON without legacy fields and keeps the regular parser API", () => {
    const text = JSON.stringify(createCanonicalDocument());
    const result = parseBuildingModelJsonWithMeta(text);

    expect(result.warnings).toEqual([]);
    expect(parseBuildingModelJson(text)).toEqual(result.model);
  });

  it("rejects a legacy dxPanel that cannot be converted safely", () => {
    const doc = createCanonicalDocument();
    Object.assign(doc.model, {
      dxPanels: [{ layer: 1, direct: "X", pos: [{ x: 0, y: 0 }], k: 1 }]
    });

    expect(() => parseBuildingModelJson(JSON.stringify(doc))).toThrow(
      "dxPanels[0].pos must contain at least 2 points"
    );
  });

  it("writes canonical JSON even when a runtime object still contains legacy fields", () => {
    const canonical = parseBuildingModelJson(JSON.stringify(createCanonicalDocument()));
    const legacyRuntimeModel = {
      ...canonical,
      structInfo: { ...canonical.structInfo, sType: "R" },
      dxPanels: [
        {
          layer: 1,
          direct: "X",
          pos: [
            { x: 0, y: 0 },
            { x: 1, y: 0 }
          ],
          k: 1
        }
      ]
    } as unknown as BuildingModel;

    const serialized = serializeBuildingModelJson(legacyRuntimeModel);
    const serializedDocument = JSON.parse(serialized) as {
      model: { structInfo: Record<string, unknown>; dxPanels?: unknown };
    };

    expect(serializedDocument.model.structInfo).not.toHaveProperty("sType");
    expect(serializedDocument.model).not.toHaveProperty("dxPanels");
  });

  it("migrates legacy XML and exposes the same warnings", () => {
    const result = parseBuildingModelXmlWithMeta(
      readFixture("reference/building-model/legacy_dx_panel.xml")
    );

    expect(result.warnings.map((warning) => warning.code)).toEqual([
      "legacy-struct-type-ignored",
      "legacy-dx-panels-converted"
    ]);
    expect(result.model.columns).toEqual([
      { layer: 1, pos: { x: 4, y: 6 }, kx: 3, ky: 0 }
    ]);
  });

  it("keeps analysis matrices equal to the canonical migrated fixture", () => {
    const legacy = parseBuildingModelJson(
      readFixture("reference/building-model/DX_with_tmd.json")
    );
    const canonical = parseBuildingModelJson(
      readFixture("reference/building-model/with_tmd.json")
    );

    const legacyMatrices = assembleAnalysisMatrices(legacy);
    const canonicalMatrices = assembleAnalysisMatrices(canonical);

    expect(legacyMatrices.mass).toEqual(canonicalMatrices.mass);
    expect(legacyMatrices.stiffness).toEqual(canonicalMatrices.stiffness);
    expect(legacyMatrices.damping).toEqual(canonicalMatrices.damping);
  });
});
