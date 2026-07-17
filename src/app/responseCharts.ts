import type {
  ResponseSeries,
  StoryPeakResponse
} from "../core/analysis/responseSummary";

interface ChartContext {
  context: CanvasRenderingContext2D;
  width: number;
  height: number;
  ink: string;
  muted: string;
  line: string;
  surface: string;
}

const SERIES_COLORS = ["#2b7a78", "#d26a3d", "#7665a8", "#b34c69"];

export interface ResponseChartLabels {
  noSeries: string;
  noPeak: string;
  story: string;
}

export const PEAK_PROFILE_METRICS = [
  "displacement",
  "interstoryDrift",
  "rotation",
  "acceleration"
] as const;

export type PeakProfileMetric = (typeof PEAK_PROFILE_METRICS)[number];

export type PeakProfileSeriesKey =
  | "displacementX"
  | "displacementY"
  | "interstoryDriftX"
  | "interstoryDriftY"
  | "rotationZ"
  | "accelerationX"
  | "accelerationY";

export interface PeakProfilePoint {
  layer: number;
  value: number | null;
}

export interface PeakProfileSeries {
  key: PeakProfileSeriesKey;
  label: string;
  unit: string;
  points: PeakProfilePoint[];
}

export interface PeakProfileChartOptions {
  metric?: PeakProfileMetric;
  seriesLabels?: Partial<Record<PeakProfileSeriesKey, string>>;
}

type PeakValueKey = Exclude<keyof StoryPeakResponse, "layer" | "zLevel">;

interface PeakProfileSeriesDefinition {
  key: PeakProfileSeriesKey;
  valueKey: PeakValueKey;
  defaultLabel: string;
}

const PEAK_PROFILE_DEFINITIONS: Record<
  PeakProfileMetric,
  { unit: string; series: readonly PeakProfileSeriesDefinition[] }
> = {
  displacement: {
    unit: "cm",
    series: [
      { key: "displacementX", valueKey: "maxDisplacementX", defaultLabel: "max |DX|" },
      { key: "displacementY", valueKey: "maxDisplacementY", defaultLabel: "max |DY|" }
    ]
  },
  interstoryDrift: {
    unit: "-",
    series: [
      {
        key: "interstoryDriftX",
        valueKey: "maxInterstoryDriftX",
        defaultLabel: "max drift X"
      },
      {
        key: "interstoryDriftY",
        valueKey: "maxInterstoryDriftY",
        defaultLabel: "max drift Y"
      }
    ]
  },
  rotation: {
    unit: "rad",
    series: [
      { key: "rotationZ", valueKey: "maxRotationZ", defaultLabel: "max |RZ|" }
    ]
  },
  acceleration: {
    unit: "cm/s²",
    series: [
      { key: "accelerationX", valueKey: "maxAccelerationX", defaultLabel: "max |AX|" },
      { key: "accelerationY", valueKey: "maxAccelerationY", defaultLabel: "max |AY|" }
    ]
  }
};

const DEFAULT_CHART_LABELS: ResponseChartLabels = {
  noSeries: "No response series",
  noPeak: "No peak response",
  story: "Story"
};

export function normalizePeakProfileMetric(value: string): PeakProfileMetric {
  return PEAK_PROFILE_METRICS.includes(value as PeakProfileMetric)
    ? value as PeakProfileMetric
    : "displacement";
}

export function createPeakProfileSeries(
  profile: readonly StoryPeakResponse[],
  metric: PeakProfileMetric,
  labels: Partial<Record<PeakProfileSeriesKey, string>> = {}
): PeakProfileSeries[] {
  const definition = PEAK_PROFILE_DEFINITIONS[metric];
  return definition.series.map((series) => ({
    key: series.key,
    label: labels[series.key] ?? series.defaultLabel,
    unit: definition.unit,
    points: profile.map((item) => ({
      layer: item.layer,
      value: item[series.valueKey]
    }))
  }));
}

function prepareCanvas(canvas: HTMLCanvasElement): ChartContext | null {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(Math.round(rect.width || canvas.clientWidth || 640), 1);
  const height = Math.max(Math.round(rect.height || canvas.clientHeight || 320), 1);
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const style = getComputedStyle(document.documentElement);
  const result = {
    context,
    width,
    height,
    ink: style.getPropertyValue("--ink").trim() || "#1f252c",
    muted: style.getPropertyValue("--muted").trim() || "#526174",
    line: style.getPropertyValue("--line").trim() || "#d8cdb7",
    surface: style.getPropertyValue("--surface").trim() || "#ffffff"
  };
  context.fillStyle = result.surface;
  context.fillRect(0, 0, width, height);
  return result;
}

function extent(values: Iterable<number>): [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [-1, 1];
  if (Math.abs(max - min) < 1e-12) {
    const padding = Math.max(Math.abs(max) * 0.1, 1);
    min -= padding;
    max += padding;
  }
  return [min, max];
}

export function decimateSeriesForCanvas(
  time: readonly number[],
  values: readonly number[],
  maxBuckets: number
): Array<{ time: number; value: number }> {
  const count = Math.min(time.length, values.length);
  if (count === 0) return [];
  const bucketCount = Math.max(Math.floor(maxBuckets), 1);
  if (count <= bucketCount * 2) {
    return Array.from({ length: count }, (_, index) => ({
      time: time[index],
      value: values[index]
    }));
  }

  const bucketSize = Math.ceil(count / bucketCount);
  const output: Array<{ time: number; value: number }> = [];
  let lastPushedIndex = -1;
  const pushIndex = (index: number): void => {
    if (index === lastPushedIndex) return;
    output.push({ time: time[index], value: values[index] });
    lastPushedIndex = index;
  };
  // Always anchor the polyline at the true first sample so the drawn line
  // starts at t0 even when index 0 is not its bucket's extremum.
  pushIndex(0);
  for (let start = 0; start < count; start += bucketSize) {
    const end = Math.min(start + bucketSize, count);
    let minIndex = start;
    let maxIndex = start;
    for (let index = start + 1; index < end; index++) {
      if (values[index] < values[minIndex]) minIndex = index;
      if (values[index] > values[maxIndex]) maxIndex = index;
    }
    const indices = minIndex === maxIndex
      ? [minIndex]
      : minIndex < maxIndex
        ? [minIndex, maxIndex]
        : [maxIndex, minIndex];
    for (const index of indices) pushIndex(index);
  }
  // Always anchor the final sample so a terminal peak/trough is never dropped.
  const lastIndex = count - 1;
  pushIndex(lastIndex);
  return output;
}

function drawAxes(chart: ChartContext, left: number, top: number, right: number, bottom: number): void {
  const { context } = chart;
  context.strokeStyle = chart.line;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(left, top);
  context.lineTo(left, bottom);
  context.lineTo(right, bottom);
  context.stroke();
}

export function renderTimeSeriesChart(
  canvas: HTMLCanvasElement,
  series: ResponseSeries[],
  labels: ResponseChartLabels = DEFAULT_CHART_LABELS
): void {
  const chart = prepareCanvas(canvas);
  if (!chart) return;
  const { context, width, height } = chart;
  const left = 54;
  const right = width - 18;
  const top = 34;
  const bottom = height - 38;
  drawAxes(chart, left, top, right, bottom);

  if (series.length === 0) {
    context.fillStyle = chart.muted;
    context.fillText(labels.noSeries, left + 8, top + 20);
    return;
  }

  function* allTimes(): Iterable<number> {
    for (const item of series) yield* item.time;
  }
  function* allValues(): Iterable<number> {
    for (const item of series) yield* item.values;
  }
  const [minTime, maxTime] = extent(allTimes());
  const [rawMinValue, rawMaxValue] = extent(allValues());
  const maxAbsValue = Math.max(Math.abs(rawMinValue), Math.abs(rawMaxValue), 1e-12);
  const minValue = -maxAbsValue;
  const maxValue = maxAbsValue;
  const x = (value: number) => left + ((value - minTime) / (maxTime - minTime)) * (right - left);
  const y = (value: number) => bottom - ((value - minValue) / (maxValue - minValue)) * (bottom - top);

  context.strokeStyle = chart.line;
  context.setLineDash([4, 4]);
  context.beginPath();
  context.moveTo(left, y(0));
  context.lineTo(right, y(0));
  context.stroke();
  context.setLineDash([]);

  series.forEach((item, seriesIndex) => {
    const points = decimateSeriesForCanvas(item.time, item.values, Math.max(right - left, 1));
    context.beginPath();
    points.forEach((point, index) => {
      const px = x(point.time);
      const py = y(point.value);
      if (index === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    });
    context.strokeStyle = SERIES_COLORS[seriesIndex % SERIES_COLORS.length];
    context.lineWidth = 1.5;
    context.stroke();
  });

  context.fillStyle = chart.muted;
  context.font = "11px sans-serif";
  context.fillText(`${minTime.toPrecision(3)} s`, left, bottom + 18);
  const maxTimeText = `${maxTime.toPrecision(3)} s`;
  context.fillText(maxTimeText, right - context.measureText(maxTimeText).width, bottom + 18);
  context.fillText(maxValue.toExponential(2), 4, top + 4);
  context.fillText(minValue.toExponential(2), 4, bottom);

  let legendX = left;
  let legendY = 17;
  for (const [index, item] of series.entries()) {
    context.fillStyle = SERIES_COLORS[index % SERIES_COLORS.length];
    const label = `${item.label}${item.unit ? ` (${item.unit})` : ""}`;
    const entryWidth = 17 + context.measureText(label).width + 21;
    // Wrap to the next legend row when the entry would overrun the right edge,
    // so long localized labels stay inside the plot instead of clipping.
    if (legendX > left && legendX + entryWidth > right && legendY + 14 <= top) {
      legendX = left;
      legendY += 14;
    }
    context.fillStyle = SERIES_COLORS[index % SERIES_COLORS.length];
    context.fillRect(legendX, legendY - 5, 12, 3);
    context.fillStyle = chart.ink;
    context.fillText(label, legendX + 17, legendY);
    legendX += entryWidth;
  }
}

export function renderPeakProfileChart(
  canvas: HTMLCanvasElement,
  profile: StoryPeakResponse[],
  labels: ResponseChartLabels = DEFAULT_CHART_LABELS,
  options: PeakProfileChartOptions = {}
): void {
  const chart = prepareCanvas(canvas);
  if (!chart) return;
  const { context, width, height } = chart;
  const left = 60;
  const right = width - 22;
  const top = 32;
  const bottom = height - 42;
  drawAxes(chart, left, top, right, bottom);

  const series = createPeakProfileSeries(
    profile,
    options.metric ?? "displacement",
    options.seriesLabels
  );
  const hasValues = series.some((item) =>
    item.points.some((point) => point.value !== null && Number.isFinite(point.value))
  );
  if (profile.length === 0 || !hasValues) {
    context.fillStyle = chart.muted;
    context.fillText(labels.noPeak, left + 8, top + 20);
    return;
  }

  let maxObserved = 0;
  let maxLayer = 1;
  for (const item of profile) maxLayer = Math.max(maxLayer, item.layer);
  for (const item of series) {
    for (const point of item.points) {
      if (point.value !== null && Number.isFinite(point.value)) {
        maxObserved = Math.max(maxObserved, Math.abs(point.value));
      }
    }
  }
  const axisMaximum = Math.max(maxObserved, 1e-12);
  const x = (value: number) => left + (value / axisMaximum) * (right - left);
  const y = (layer: number) => bottom - (layer / maxLayer) * (bottom - top);

  const drawProfile = (item: PeakProfileSeries, color: string): void => {
    context.beginPath();
    context.moveTo(x(0), y(0));
    for (const point of item.points) {
      if (point.value !== null && Number.isFinite(point.value)) {
        context.lineTo(x(point.value), y(point.layer));
      }
    }
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.stroke();
    for (const point of item.points) {
      if (point.value === null || !Number.isFinite(point.value)) continue;
      context.beginPath();
      context.arc(x(point.value), y(point.layer), 3, 0, Math.PI * 2);
      context.fillStyle = color;
      context.fill();
    }
  };
  series.forEach((item, index) => drawProfile(item, SERIES_COLORS[index % SERIES_COLORS.length]));

  context.fillStyle = chart.muted;
  context.font = "11px sans-serif";
  for (const item of profile) context.fillText(String(item.layer), 38, y(item.layer) + 4);
  context.fillText(labels.story, 6, top - 10);
  context.fillText("0", left, bottom + 18);
  const unit = series[0]?.unit ?? "";
  const maxText = `${maxObserved.toExponential(2)}${unit === "-" ? " (-)" : ` ${unit}`}`;
  context.fillText(maxText, right - context.measureText(maxText).width, bottom + 18);
  let legendX = left;
  let legendY = 17;
  for (const [index, item] of series.entries()) {
    const entryWidth = context.measureText(item.label).width + 24;
    // Wrap onto a second legend row rather than overflowing the right edge.
    if (legendX > left && legendX + entryWidth > right && legendY + 14 <= top) {
      legendX = left;
      legendY += 14;
    }
    context.fillStyle = SERIES_COLORS[index % SERIES_COLORS.length];
    context.fillText(item.label, legendX, legendY);
    legendX += entryWidth;
  }
}
