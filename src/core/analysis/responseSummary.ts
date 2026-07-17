import type { RespFile } from "../types";

export interface ResponseSeries {
  label: string;
  unit: string;
  time: number[];
  values: number[];
}

export interface StoryPeakResponse {
  layer: number;
  zLevel: number | null;
  maxDisplacementX: number | null;
  maxDisplacementY: number | null;
  maxRotationZ: number | null;
  maxAccelerationX: number | null;
  maxAccelerationY: number | null;
  maxInterstoryDriftX: number | null;
  maxInterstoryDriftY: number | null;
}

function indexOfHeader(resp: RespFile, labels: string[]): number {
  for (const label of labels) {
    const index = resp.header.indexOf(label);
    if (index >= 0) return index;
  }
  return -1;
}

function finiteValue(row: number[], index: number): number | null {
  if (index < 0) return null;
  const value = row[index];
  return Number.isFinite(value) ? value : null;
}

function updateMaxAbs(current: number | null, value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return current;
  return Math.max(current ?? 0, Math.abs(value));
}

function storyColumnIndices(resp: RespFile, layer: number) {
  return {
    dx: indexOfHeader(resp, [`DX_${layer}`]),
    dy: indexOfHeader(resp, [`DY_${layer}`]),
    rz: indexOfHeader(resp, [`DθZ_${layer}`, `θZ_${layer}`, `RZ_${layer}`]),
    ax: indexOfHeader(resp, [`AX_${layer}`]),
    ay: indexOfHeader(resp, [`AY_${layer}`])
  };
}

export function resolveResponseStoryCount(resp: RespFile): number {
  const baseShapeCount = resp.baseShape.story;
  const metaCount = resp.meta.massCount;
  const validate = (value: number | undefined, label: string): number | null => {
    if (value === undefined) return null;
    if (!Number.isInteger(value) || value < 1) {
      throw new Error(`${label} must be a positive integer.`);
    }
    return value;
  };
  const fromBaseShape = validate(baseShapeCount, "Response BaseShape story count");
  const fromMeta = validate(metaCount, "Response mass count");
  if (fromBaseShape !== null && fromMeta !== null && fromBaseShape !== fromMeta) {
    throw new Error(
      `Response story count mismatch: BaseShape has ${fromBaseShape}, metadata has ${fromMeta}.`
    );
  }
  const resolved = fromBaseShape ?? fromMeta;
  if (resolved === null) throw new Error("Response story count is missing.");
  return resolved;
}

export function extractResponseSeries(
  resp: RespFile,
  label: string,
  unit = ""
): ResponseSeries | null {
  const timeIndex = indexOfHeader(resp, ["Time(s)", "Time", "time"]);
  const valueIndex = resp.header.indexOf(label);
  if (timeIndex < 0 || valueIndex < 0) return null;

  const time = new Array<number>(resp.records.length);
  const values = new Array<number>(resp.records.length);
  for (let rowIndex = 0; rowIndex < resp.records.length; rowIndex++) {
    const row = resp.records[rowIndex];
    time[rowIndex] = finiteValue(row, timeIndex) ?? 0;
    values[rowIndex] = finiteValue(row, valueIndex) ?? 0;
  }
  return {
    label,
    unit,
    time,
    values
  };
}

export function createDefaultResponseSeries(resp: RespFile): ResponseSeries[] {
  const roof = resolveResponseStoryCount(resp);
  const candidates: Array<[string[], string]> = [
    [["DX_R", `DX_${roof}`], "cm"],
    [["DY_R", `DY_${roof}`], "cm"]
  ];
  return candidates
    .map(([labels, unit]) => {
      const label = labels.find((candidate) => resp.header.includes(candidate));
      return label ? extractResponseSeries(resp, label, unit) : null;
    })
    .filter((series): series is ResponseSeries => series !== null);
}

export function calculatePeakResponseProfile(resp: RespFile): StoryPeakResponse[] {
  const storyCount = resolveResponseStoryCount(resp);
  const zLevel = resp.baseShape.zLevel;
  const indices = Array.from({ length: storyCount }, (_, storyIndex) =>
    storyColumnIndices(resp, storyIndex + 1)
  );
  const heights = Array.from({ length: storyCount }, (_, storyIndex) => {
    const layer = storyIndex + 1;
    return (
      zLevel.length > layer && Number.isFinite(zLevel[layer] - zLevel[layer - 1])
        ? zLevel[layer] - zLevel[layer - 1]
        : null
    );
  });
  const profile: StoryPeakResponse[] = Array.from(
    { length: storyCount },
    (_, storyIndex) => ({
      layer: storyIndex + 1,
      zLevel: zLevel[storyIndex + 1] ?? null,
      maxDisplacementX: null,
      maxDisplacementY: null,
      maxRotationZ: null,
      maxAccelerationX: null,
      maxAccelerationY: null,
      maxInterstoryDriftX: null,
      maxInterstoryDriftY: null
    })
  );

  // Traverse each record once so all peak quantities use values from the same
  // time step without allocating one temporary array per story and channel.
  for (const row of resp.records) {
    let lowerDx: number | null = 0;
    let lowerDy: number | null = 0;
    for (let storyIndex = 0; storyIndex < storyCount; storyIndex++) {
      const current = indices[storyIndex];
      const peak = profile[storyIndex];
      const dx = finiteValue(row, current.dx);
      const dy = finiteValue(row, current.dy);
      const height = heights[storyIndex];

      peak.maxDisplacementX = updateMaxAbs(peak.maxDisplacementX, dx);
      peak.maxDisplacementY = updateMaxAbs(peak.maxDisplacementY, dy);
      peak.maxRotationZ = updateMaxAbs(peak.maxRotationZ, finiteValue(row, current.rz));
      peak.maxAccelerationX = updateMaxAbs(peak.maxAccelerationX, finiteValue(row, current.ax));
      peak.maxAccelerationY = updateMaxAbs(peak.maxAccelerationY, finiteValue(row, current.ay));
      if (dx !== null && lowerDx !== null && height !== null && height > 0) {
        peak.maxInterstoryDriftX = updateMaxAbs(
          peak.maxInterstoryDriftX,
          (dx - lowerDx) / height
        );
      }
      if (dy !== null && lowerDy !== null && height !== null && height > 0) {
        peak.maxInterstoryDriftY = updateMaxAbs(
          peak.maxInterstoryDriftY,
          (dy - lowerDy) / height
        );
      }
      lowerDx = dx;
      lowerDy = dy;
    }
  }

  return profile;
}
