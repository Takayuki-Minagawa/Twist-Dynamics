import { describe, expect, it } from "vitest";
import {
  createPeakProfileSeries,
  decimateSeriesForCanvas,
  normalizePeakProfileMetric
} from "../src/app/responseCharts";
import { getUiText } from "../src/app/i18n";
import type { StoryPeakResponse } from "../src/core/analysis/responseSummary";

describe("response chart decimation", () => {
  it("retains bucket extrema in chronological order", () => {
    const time = Array.from({ length: 100 }, (_, index) => index);
    const values = time.map((index) => (index === 24 ? -20 : index === 25 ? 30 : Math.sin(index)));
    const points = decimateSeriesForCanvas(time, values, 10);

    expect(points.length).toBeLessThanOrEqual(22);
    expect(points.some((point) => point.value === -20)).toBe(true);
    expect(points.some((point) => point.value === 30)).toBe(true);
    expect(points.map((point) => point.time)).toEqual(
      points.map((point) => point.time).slice().sort((a, b) => a - b)
    );
  });

  it("anchors the first and last samples so terminal extrema are never dropped", () => {
    // A late spike that is not the global extremum must still survive decimation.
    const time = Array.from({ length: 200 }, (_, index) => index);
    const values = time.map((index) => (index === 199 ? 5 : Math.sin(index)));
    const points = decimateSeriesForCanvas(time, values, 8);

    expect(points[0]).toEqual({ time: 0, value: values[0] });
    expect(points[points.length - 1]).toEqual({ time: 199, value: 5 });
  });
});

describe("peak response profile selection", () => {
  const profile: StoryPeakResponse[] = [
    {
      layer: 1,
      zLevel: 300,
      maxDisplacementX: 1,
      maxDisplacementY: 2,
      maxRotationZ: 0.01,
      maxAccelerationX: 10,
      maxAccelerationY: 20,
      maxInterstoryDriftX: 0.001,
      maxInterstoryDriftY: 0.002
    },
    {
      layer: 2,
      zLevel: 600,
      maxDisplacementX: null,
      maxDisplacementY: 4,
      maxRotationZ: 0.02,
      maxAccelerationX: 30,
      maxAccelerationY: 40,
      maxInterstoryDriftX: 0.003,
      maxInterstoryDriftY: 0.004
    }
  ];

  it("maps every selectable metric to the expected response fields and units", () => {
    const displacement = createPeakProfileSeries(profile, "displacement");
    expect(displacement.map((series) => series.key)).toEqual(["displacementX", "displacementY"]);
    expect(displacement.map((series) => series.unit)).toEqual(["cm", "cm"]);
    expect(displacement[0].points).toEqual([
      { layer: 1, value: 1 },
      { layer: 2, value: null }
    ]);

    const drift = createPeakProfileSeries(profile, "interstoryDrift");
    expect(drift.map((series) => series.key)).toEqual(["interstoryDriftX", "interstoryDriftY"]);
    expect(drift[0].unit).toBe("-");
    expect(drift[1].points[1].value).toBe(0.004);

    const rotation = createPeakProfileSeries(profile, "rotation");
    expect(rotation).toHaveLength(1);
    expect(rotation[0]).toMatchObject({ key: "rotationZ", unit: "rad" });
    expect(rotation[0].points.map((point) => point.value)).toEqual([0.01, 0.02]);

    const acceleration = createPeakProfileSeries(profile, "acceleration");
    expect(acceleration.map((series) => series.key)).toEqual(["accelerationX", "accelerationY"]);
    expect(acceleration[0].unit).toBe("cm/s²");
    expect(acceleration[0].points[1].value).toBe(30);
  });

  it("uses localized series labels and safely normalizes an unknown selector value", () => {
    const series = createPeakProfileSeries(profile, "rotation", { rotationZ: "最大ねじれ角" });
    expect(series[0].label).toBe("最大ねじれ角");
    expect(normalizePeakProfileMetric("interstoryDrift")).toBe("interstoryDrift");
    expect(normalizePeakProfileMetric("unknown")).toBe("displacement");
  });

  it("keeps selectable metrics, legends, and response units localized in Japanese and English", () => {
    const japanese = getUiText("ja");
    const english = getUiText("en");

    expect(Object.keys(japanese.responseProfileMetricOptions)).toEqual([
      "displacement",
      "interstoryDrift",
      "rotation",
      "acceleration"
    ]);
    expect(japanese.responseProfileMetricOptions.interstoryDrift).toContain("層間変形角");
    expect(japanese.responseProfileSeriesLabels.rotationZ).toContain("ねじれ角");
    expect(japanese.responseHeaders.at(-1)).toContain("cm/s²");
    expect(japanese.viewerUnavailable).toContain("3Dビューアー");

    expect(english.responseProfileMetricOptions.rotation).toContain("Torsional rotation");
    expect(english.responseProfileSeriesLabels.interstoryDriftX).toContain("interstory drift X");
    expect(english.responseHeaders.at(-1)).toContain("cm/s²");
    expect(english.viewerUnavailable).toBe("3D viewer is unavailable.");
  });
});
