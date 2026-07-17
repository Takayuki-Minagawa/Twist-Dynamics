import { describe, expect, it } from "vitest";
import type { RespFile } from "../src/core/types";
import {
  calculatePeakResponseProfile,
  createDefaultResponseSeries,
  extractResponseSeries,
  resolveResponseStoryCount
} from "../src/core/analysis/responseSummary";

function createResponse(): RespFile {
  return {
    baseShape: {
      story: 2,
      zLevel: [0, 300, 600],
      massCenters: []
    },
    meta: { massCount: 2, dt: 0.1, damperCount: 0 },
    header: [
      "Time(s)",
      "DX_1",
      "DY_1",
      "θZ_1",
      "AX_1",
      "AY_1",
      "AX_2",
      "DX_2",
      "AY_2",
      "DY_2",
      "AθZ_2",
      "DθZ_2",
      "AX_R",
      "DX_R",
      "AY_R",
      "DY_R",
      "AθZ_R",
      "DθZ_R"
    ],
    records: [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0.1, 3, -6, 0.01, 10, 20, 30, 9, 40, -3, 0.2, 0.03, 30, 9, 40, -3, 0.2, 0.03],
      [0.2, -6, 3, -0.02, -20, -10, -60, -3, 10, 12, -0.3, -0.04, -60, -3, 10, 12, -0.3, -0.04]
    ],
    columnMaxAbs: []
  };
}

describe("response chart summaries", () => {
  it("extracts named waveforms", () => {
    const series = extractResponseSeries(createResponse(), "DX_R", "cm");
    expect(series?.time).toEqual([0, 0.1, 0.2]);
    expect(series?.values).toEqual([0, 9, -3]);
    expect(createDefaultResponseSeries(createResponse())).toHaveLength(2);
  });

  it("falls back to the top-story columns when roof aliases are absent", () => {
    const response = createResponse();
    const indices = response.header
      .map((label, index) => ({ label, index }))
      .filter(({ label }) => !label.endsWith("_R"))
      .map(({ index }) => index);
    response.header = indices.map((index) => response.header[index]);
    response.records = response.records.map((row) => indices.map((index) => row[index]));

    expect(createDefaultResponseSeries(response).map((series) => series.label)).toEqual([
      "DX_2",
      "DY_2"
    ]);
  });

  it("takes interstory differences at each time before finding the peak", () => {
    const profile = calculatePeakResponseProfile(createResponse());

    expect(profile[0].maxInterstoryDriftX).toBeCloseTo(6 / 300);
    expect(profile[1].maxInterstoryDriftX).toBeCloseTo(6 / 300);
    expect(profile[1].maxInterstoryDriftY).toBeCloseTo(9 / 300);
    expect(profile[1].maxRotationZ).toBeCloseTo(0.04);
    expect(profile[1].maxAccelerationX).toBe(60);
  });

  it("reads each response channel once per record while accumulating all story peaks", () => {
    const response = createResponse();
    const reads = new Map<number, number>();
    response.records = response.records.map(
      (row) => new Proxy(row, {
        get(target, property, receiver) {
          if (typeof property === "string" && /^\d+$/.test(property)) {
            const index = Number(property);
            reads.set(index, (reads.get(index) ?? 0) + 1);
          }
          return Reflect.get(target, property, receiver);
        }
      })
    );

    const profile = calculatePeakResponseProfile(response);

    expect(profile[1].maxInterstoryDriftY).toBeCloseTo(9 / 300);
    for (const label of [
      "DX_1",
      "DY_1",
      "θZ_1",
      "AX_1",
      "AY_1",
      "DX_2",
      "DY_2",
      "DθZ_2",
      "AX_2",
      "AY_2"
    ]) {
      expect(reads.get(response.header.indexOf(label)), label).toBe(response.records.length);
    }
  });

  it("rejects conflicting BaseShape and metadata story counts", () => {
    const response = createResponse();
    response.meta.massCount = 1;

    expect(() => resolveResponseStoryCount(response)).toThrow(
      "Response story count mismatch: BaseShape has 2, metadata has 1."
    );
    expect(() => createDefaultResponseSeries(response)).toThrow(/story count mismatch/);
    expect(() => calculatePeakResponseProfile(response)).toThrow(/story count mismatch/);
  });

  it("rejects explicit zero counts while allowing one genuinely missing source", () => {
    const zeroBaseShape = createResponse();
    zeroBaseShape.baseShape.story = 0;
    expect(() => resolveResponseStoryCount(zeroBaseShape)).toThrow(
      "Response BaseShape story count must be a positive integer."
    );

    const zeroMetadata = createResponse();
    zeroMetadata.meta.massCount = 0;
    expect(() => resolveResponseStoryCount(zeroMetadata)).toThrow(
      "Response mass count must be a positive integer."
    );

    const missingBaseShape = createResponse();
    delete missingBaseShape.baseShape.story;
    expect(resolveResponseStoryCount(missingBaseShape)).toBe(2);

    const missingMetadata = createResponse();
    delete (missingMetadata.meta as { massCount?: number }).massCount;
    expect(resolveResponseStoryCount(missingMetadata)).toBe(2);

    delete (missingBaseShape.meta as { massCount?: number }).massCount;
    expect(() => resolveResponseStoryCount(missingBaseShape)).toThrow(
      "Response story count is missing."
    );
  });
});
