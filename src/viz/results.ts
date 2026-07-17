import type { ComplexModalFile, ModalDatFile, RespFile } from "../core/types";
import { resolveResponseStoryCount } from "../core/analysis/responseSummary";
import type { LevelPose, ResponseSeries } from "./types";

type Component = keyof LevelPose;

const RESPONSE_COMPONENT_COUNT = 3;

interface CompactResponseStorage {
  /** Frame-major DX, DY, RZ values for stories 1..N. */
  values: Float64Array;
  /** Frames materialized only through the legacy/public poses array view. */
  poseCache: LevelPose[][];
}

const compactResponseStorage = new WeakMap<ResponseSeries, CompactResponseStorage>();

function finiteValue(value: number | undefined, label: string): number {
  if (value === undefined || !Number.isFinite(value)) {
    throw new Error(`${label} is missing or not finite.`);
  }
  return value;
}

function storyCountFromBaseShape(story: number | undefined, fallback: number): number {
  const count = story ?? fallback;
  if (!Number.isInteger(count) || count < 1) throw new Error("Result story count must be >= 1.");
  return count;
}

function parseRealComponent(label: string): { story: number; component: Component } | null {
  const compact = label.trim().replace(/\s+/g, "");
  let match = compact.match(/^M(\d+)-δ([xy])$/i);
  if (match) {
    return { story: Number(match[1]), component: match[2].toLowerCase() === "x" ? "dx" : "dy" };
  }
  match = compact.match(/^M(\d+)-(?:θz|rz)$/i);
  if (match) return { story: Number(match[1]), component: "rz" };
  match = compact.match(/^D([XY])_(\d+)$/i);
  if (match) {
    return { story: Number(match[2]), component: match[1].toUpperCase() === "X" ? "dx" : "dy" };
  }
  match = compact.match(/^(?:RZ|DθZ|θZ)_(\d+)$/i);
  return match ? { story: Number(match[1]), component: "rz" } : null;
}

export function extractRealMode(
  data: ModalDatFile,
  modeIndex: number,
  expectedStoryCount?: number
): LevelPose[] {
  const storyCount = storyCountFromBaseShape(
    data.baseShape.story,
    data.baseShape.massCenters.length || Math.floor(data.modal.eigenVectors.length / 3)
  );
  if (expectedStoryCount !== undefined && storyCount !== expectedStoryCount) {
    throw new Error(`Modal result has ${storyCount} stories; model has ${expectedStoryCount}.`);
  }
  if (!Number.isInteger(modeIndex) || modeIndex < 0 || modeIndex >= data.modal.frequenciesHz.length) {
    throw new Error(`modeIndex must be between 0 and ${Math.max(0, data.modal.frequenciesHz.length - 1)}.`);
  }

  const poses = Array.from({ length: storyCount + 1 }, () => ({ dx: 0, dy: 0, rz: 0 }));
  const seen = new Set<string>();
  for (const row of data.modal.eigenVectors) {
    const parsed = parseRealComponent(row.label);
    if (!parsed || parsed.story < 1 || parsed.story > storyCount) continue;
    poses[parsed.story][parsed.component] = finiteValue(
      row.values[modeIndex],
      `eigenVectors.${row.label}[${modeIndex}]`
    );
    seen.add(`${parsed.story}:${parsed.component}`);
  }
  for (let story = 1; story <= storyCount; story++) {
    for (const component of ["dx", "dy", "rz"] as const) {
      if (!seen.has(`${story}:${component}`)) {
        throw new Error(`Modal result is missing ${component} for story ${story}.`);
      }
    }
  }
  return poses;
}

export function sampleRealMode(modeShape: LevelPose[], phaseRad: number): LevelPose[] {
  const factor = Math.sin(phaseRad);
  return modeShape.map((pose, index) =>
    index === 0
      ? { dx: 0, dy: 0, rz: 0 }
      : { dx: pose.dx * factor, dy: pose.dy * factor, rz: pose.rz * factor }
  );
}

interface ComplexStoryPose {
  dx: { re: number; im: number };
  dy: { re: number; im: number };
  rz: { re: number; im: number };
}

export interface ExtractedComplexMode {
  frequencyHz: number;
  stories: ComplexStoryPose[];
}

function parseComplexComponent(component: string): { story: number; component: Component } | null {
  const match = component.trim().replace(/\s+/g, "").match(/^(DX|DY|RZ)_(\d+)$/i);
  if (!match) return null;
  const name = match[1].toUpperCase();
  return {
    story: Number(match[2]),
    component: name === "DX" ? "dx" : name === "DY" ? "dy" : "rz"
  };
}

export function extractComplexMode(
  data: ComplexModalFile,
  modeIndex: number,
  expectedStoryCount?: number
): ExtractedComplexMode {
  const storyCount = storyCountFromBaseShape(
    data.baseShape.story,
    data.baseShape.massCenters.length
  );
  if (expectedStoryCount !== undefined && storyCount !== expectedStoryCount) {
    throw new Error(`Complex result has ${storyCount} stories; model has ${expectedStoryCount}.`);
  }
  if (!Number.isInteger(modeIndex) || modeIndex < 0 || modeIndex >= data.modes.length) {
    throw new Error(`modeIndex must be between 0 and ${Math.max(0, data.modes.length - 1)}.`);
  }
  const mode = data.modes[modeIndex];
  const stories: ComplexStoryPose[] = Array.from({ length: storyCount + 1 }, () => ({
    dx: { re: 0, im: 0 },
    dy: { re: 0, im: 0 },
    rz: { re: 0, im: 0 }
  }));
  const seen = new Set<string>();
  for (const vector of mode.vectors) {
    const parsed = parseComplexComponent(vector.component);
    if (!parsed || parsed.story < 1 || parsed.story > storyCount) continue;
    const hasReal = vector.complexReal !== undefined;
    const hasImaginary = vector.complexImag !== undefined;
    if (hasReal !== hasImaginary) {
      throw new Error(`${vector.component} must provide both complexReal and complexImag, or neither.`);
    }
    const re = hasReal
      ? vector.complexReal
      : vector.amplitude * Math.cos(vector.phaseRad);
    const im = hasImaginary
      ? vector.complexImag
      : vector.amplitude * Math.sin(vector.phaseRad);
    stories[parsed.story][parsed.component] = {
      re: finiteValue(re, `${vector.component}.complexReal`),
      im: finiteValue(im, `${vector.component}.complexImag`)
    };
    seen.add(`${parsed.story}:${parsed.component}`);
  }
  for (let story = 1; story <= storyCount; story++) {
    for (const component of ["dx", "dy", "rz"] as const) {
      if (!seen.has(`${story}:${component}`)) {
        throw new Error(`Complex result is missing ${component} for story ${story}.`);
      }
    }
  }
  return { frequencyHz: finiteValue(mode.frequencyHz, "complex mode frequency"), stories };
}

export function sampleComplexMode(mode: ExtractedComplexMode, phaseRad: number): LevelPose[] {
  const cosine = Math.cos(phaseRad);
  const sine = Math.sin(phaseRad);
  const sample = (value: { re: number; im: number }): number => value.re * cosine - value.im * sine;
  return mode.stories.map((story, index) =>
    index === 0
      ? { dx: 0, dy: 0, rz: 0 }
      : { dx: sample(story.dx), dy: sample(story.dy), rz: sample(story.rz) }
  );
}

function normalizedHeader(value: string): string {
  return value.trim().replace(/\s+/g, "");
}

function findHeaderIndex(header: string[], candidates: string[]): number {
  const normalized = header.map(normalizedHeader);
  for (const candidate of candidates) {
    const index = normalized.indexOf(candidate);
    if (index >= 0) return index;
  }
  return -1;
}

function arrayIndex(property: string | symbol): number | null {
  if (typeof property !== "string" || !/^(0|[1-9]\d*)$/.test(property)) return null;
  const value = Number(property);
  return Number.isSafeInteger(value) ? value : null;
}

function compactValueOffset(
  storyCount: number,
  frameIndex: number,
  story: number,
  componentOffset: number
): number {
  return (frameIndex * storyCount + story - 1) * RESPONSE_COMPONENT_COUNT + componentOffset;
}

function materializeCompactFrame(
  storage: CompactResponseStorage,
  storyCount: number,
  frameIndex: number
): LevelPose[] {
  const cached = storage.poseCache[frameIndex];
  if (cached) return cached;
  const frame = new Array<LevelPose>(storyCount + 1);
  frame[0] = { dx: 0, dy: 0, rz: 0 };
  for (let story = 1; story <= storyCount; story++) {
    const offset = compactValueOffset(storyCount, frameIndex, story, 0);
    frame[story] = {
      dx: storage.values[offset],
      dy: storage.values[offset + 1],
      rz: storage.values[offset + 2]
    };
  }
  storage.poseCache[frameIndex] = frame;
  return frame;
}

function createLazyPoseView(
  storage: CompactResponseStorage,
  storyCount: number,
  frameCount: number
): LevelPose[][] {
  storage.poseCache.length = frameCount;
  return new Proxy(storage.poseCache, {
    get(target, property, receiver) {
      const index = arrayIndex(property);
      if (index !== null && index < frameCount) {
        return materializeCompactFrame(storage, storyCount, index);
      }
      return Reflect.get(target, property, receiver);
    },
    has(target, property) {
      const index = arrayIndex(property);
      if (index !== null && index < frameCount) return true;
      return Reflect.has(target, property);
    }
  });
}

function compactComponent(
  storage: CompactResponseStorage,
  storyCount: number,
  frameIndex: number,
  story: number,
  component: Component
): number {
  const cached = storage.poseCache[frameIndex]?.[story];
  if (cached) return cached[component];
  const componentOffset = component === "dx" ? 0 : component === "dy" ? 1 : 2;
  return storage.values[
    compactValueOffset(storyCount, frameIndex, story, componentOffset)
  ];
}

function cloneCompactFrame(
  storage: CompactResponseStorage,
  storyCount: number,
  frameIndex: number
): LevelPose[] {
  const cached = storage.poseCache[frameIndex];
  if (cached) return cached.map((pose) => ({ ...pose }));
  const frame = new Array<LevelPose>(storyCount + 1);
  frame[0] = { dx: 0, dy: 0, rz: 0 };
  for (let story = 1; story <= storyCount; story++) {
    frame[story] = {
      dx: compactComponent(storage, storyCount, frameIndex, story, "dx"),
      dy: compactComponent(storage, storyCount, frameIndex, story, "dy"),
      rz: compactComponent(storage, storyCount, frameIndex, story, "rz")
    };
  }
  return frame;
}

function interpolateCompactFrames(
  storage: CompactResponseStorage,
  storyCount: number,
  low: number,
  high: number,
  ratio: number
): LevelPose[] {
  const frame = new Array<LevelPose>(storyCount + 1);
  frame[0] = { dx: 0, dy: 0, rz: 0 };
  for (let story = 1; story <= storyCount; story++) {
    const lowDx = compactComponent(storage, storyCount, low, story, "dx");
    const lowDy = compactComponent(storage, storyCount, low, story, "dy");
    const lowRz = compactComponent(storage, storyCount, low, story, "rz");
    frame[story] = {
      dx: lowDx + (compactComponent(storage, storyCount, high, story, "dx") - lowDx) * ratio,
      dy: lowDy + (compactComponent(storage, storyCount, high, story, "dy") - lowDy) * ratio,
      rz: lowRz + (compactComponent(storage, storyCount, high, story, "rz") - lowRz) * ratio
    };
  }
  return frame;
}

export function buildResponseSeries(data: RespFile, expectedStoryCount?: number): ResponseSeries {
  const storyCount = resolveResponseStoryCount(data);
  if (expectedStoryCount !== undefined && storyCount !== expectedStoryCount) {
    throw new Error(`Response result has ${storyCount} stories; model has ${expectedStoryCount}.`);
  }
  if (data.records.length === 0) throw new Error("Response result contains no records.");

  const timeIndex = findHeaderIndex(data.header, ["Time(s)", "Time", "TIME"]);
  if (timeIndex < 0) throw new Error("Response result is missing a Time(s) column.");
  const indices = Array.from({ length: storyCount + 1 }, () => ({ dx: -1, dy: -1, rz: -1 }));
  for (let story = 1; story <= storyCount; story++) {
    indices[story] = {
      dx: findHeaderIndex(data.header, [`DX_${story}`]),
      dy: findHeaderIndex(data.header, [`DY_${story}`]),
      rz: findHeaderIndex(data.header, [`DθZ_${story}`, `θZ_${story}`, `RZ_${story}`, `DRZ_${story}`])
    };
    for (const component of ["dx", "dy", "rz"] as const) {
      if (indices[story][component] < 0) {
        throw new Error(`Response result is missing ${component} for story ${story}.`);
      }
    }
  }

  const times = new Array<number>(data.records.length);
  const values = new Float64Array(
    data.records.length * storyCount * RESPONSE_COMPONENT_COUNT
  );
  let previousTime = Number.NEGATIVE_INFINITY;
  for (let rowIndex = 0; rowIndex < data.records.length; rowIndex++) {
    const row = data.records[rowIndex];
    const time = finiteValue(row[timeIndex], `records[${rowIndex}].time`);
    if (time < previousTime) throw new Error("Response times must be monotonic non-decreasing.");
    previousTime = time;
    times[rowIndex] = time;
    for (let story = 1; story <= storyCount; story++) {
      const offset = compactValueOffset(storyCount, rowIndex, story, 0);
      values[offset] = finiteValue(
        row[indices[story].dx],
        `records[${rowIndex}].DX_${story}`
      );
      values[offset + 1] = finiteValue(
        row[indices[story].dy],
        `records[${rowIndex}].DY_${story}`
      );
      values[offset + 2] = finiteValue(
        row[indices[story].rz],
        `records[${rowIndex}].RZ_${story}`
      );
    }
  }
  const storage: CompactResponseStorage = { values, poseCache: [] };
  const series: ResponseSeries = {
    storyCount,
    times,
    // Keep the existing poses API without eagerly creating a frame array and
    // one LevelPose object for every time-step/story combination.
    poses: createLazyPoseView(storage, storyCount, data.records.length),
    duration: Math.max(0, times[times.length - 1] - times[0])
  };
  compactResponseStorage.set(series, storage);
  return series;
}

function interpolatePose(a: LevelPose, b: LevelPose, ratio: number): LevelPose {
  return {
    dx: a.dx + (b.dx - a.dx) * ratio,
    dy: a.dy + (b.dy - a.dy) * ratio,
    rz: a.rz + (b.rz - a.rz) * ratio
  };
}

export function sampleResponseSeries(series: ResponseSeries, elapsedSeconds: number): LevelPose[] {
  const firstTime = series.times[0];
  const lastTime = series.times[series.times.length - 1];
  const time = Math.min(Math.max(firstTime + elapsedSeconds, firstTime), lastTime);
  const compact = compactResponseStorage.get(series);
  if (time <= firstTime || series.times.length === 1) {
    return compact
      ? cloneCompactFrame(compact, series.storyCount, 0)
      : series.poses[0].map((pose) => ({ ...pose }));
  }
  if (time >= lastTime) {
    const lastIndex = series.times.length - 1;
    return compact
      ? cloneCompactFrame(compact, series.storyCount, lastIndex)
      : series.poses[series.poses.length - 1].map((pose) => ({ ...pose }));
  }

  let low = 0;
  let high = series.times.length - 1;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (series.times[middle] <= time) low = middle;
    else high = middle;
  }
  const delta = series.times[high] - series.times[low];
  const ratio = delta > 0 ? (time - series.times[low]) / delta : 0;
  if (compact) {
    return interpolateCompactFrames(compact, series.storyCount, low, high, ratio);
  }
  return series.poses[low].map((pose, level) =>
    level === 0 ? { dx: 0, dy: 0, rz: 0 } : interpolatePose(pose, series.poses[high][level], ratio)
  );
}
