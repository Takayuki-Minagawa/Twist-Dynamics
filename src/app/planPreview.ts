import type { BuildingModel, Point2D } from "../core/types";
import type { StorySummary } from "../core/analysis/storySummary";

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface CanvasTransform {
  point(value: Point2D): Point2D;
  scale: number;
}

export interface PlanPreviewLabels {
  story: string;
  massCenter: string;
  stiffnessCenter: string;
}

const DEFAULT_LABELS: PlanPreviewLabels = {
  story: "Story",
  massCenter: "mass center",
  stiffnessCenter: "stiffness center"
};

function collectLayerPoints(
  model: BuildingModel,
  layer: number,
  storySummary?: StorySummary
): Point2D[] {
  const points: Point2D[] = [];
  const floor = model.floors.find((item) => item.layer === layer + 1) ??
    model.floors.find((item) => item.layer === layer);
  if (floor) points.push(...floor.pos);
  for (const column of model.columns) if (column.layer === layer) points.push(column.pos);
  for (const wall of model.walls) if (wall.layer === layer) points.push(...wall.pos);
  for (const brace of model.braceDampers) if (brace.layer === layer) points.push(brace.pos);
  for (const damper of model.massDampers) if (damper.layer === layer) points.push(damper.pos);
  const center = model.structInfo?.wCenter[layer - 1];
  if (center) points.push(center);
  const stiffnessCenter = storySummary?.stiffnessCenter;
  if (stiffnessCenter && stiffnessCenter.x !== null && stiffnessCenter.y !== null) {
    points.push({
      x: stiffnessCenter.x,
      y: stiffnessCenter.y
    });
  }
  return points;
}

function calculateBounds(points: Point2D[]): Bounds {
  if (points.length === 0) return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (maxX - minX < 1e-9) {
    minX -= 1;
    maxX += 1;
  }
  if (maxY - minY < 1e-9) {
    minY -= 1;
    maxY += 1;
  }
  return { minX, maxX, minY, maxY };
}

export function createPlanTransform(
  bounds: Bounds,
  width: number,
  height: number,
  padding = 28
): CanvasTransform {
  const contentWidth = Math.max(width - padding * 2, 1);
  const contentHeight = Math.max(height - padding * 2, 1);
  const scale = Math.min(
    contentWidth / Math.max(bounds.maxX - bounds.minX, 1e-9),
    contentHeight / Math.max(bounds.maxY - bounds.minY, 1e-9)
  );
  const usedWidth = (bounds.maxX - bounds.minX) * scale;
  const usedHeight = (bounds.maxY - bounds.minY) * scale;
  const originX = (width - usedWidth) / 2 - bounds.minX * scale;
  const originY = (height - usedHeight) / 2 + bounds.maxY * scale;
  return {
    scale,
    point: (value) => ({
      x: originX + value.x * scale,
      y: originY - value.y * scale
    })
  };
}

function pathPoints(
  context: CanvasRenderingContext2D,
  points: Point2D[],
  transform: CanvasTransform,
  close: boolean
): void {
  if (points.length === 0) return;
  context.beginPath();
  const first = transform.point(points[0]);
  context.moveTo(first.x, first.y);
  for (const point of points.slice(1)) {
    const transformed = transform.point(point);
    context.lineTo(transformed.x, transformed.y);
  }
  if (close) context.closePath();
}

function drawMarker(
  context: CanvasRenderingContext2D,
  point: Point2D,
  transform: CanvasTransform,
  fill: boolean,
  color: string,
  radius: number
): void {
  const transformed = transform.point(point);
  context.beginPath();
  context.arc(transformed.x, transformed.y, radius, 0, Math.PI * 2);
  context.fillStyle = color;
  context.strokeStyle = color;
  context.lineWidth = 2;
  if (fill) context.fill();
  else context.stroke();
}

export function renderPlanPreview(
  canvas: HTMLCanvasElement,
  model: BuildingModel,
  layer: number,
  storySummary?: StorySummary,
  labels: PlanPreviewLabels = DEFAULT_LABELS
): void {
  const rect = canvas.getBoundingClientRect();
  const cssWidth = Math.max(Math.round(rect.width || canvas.clientWidth || 640), 1);
  const cssHeight = Math.max(Math.round(rect.height || canvas.clientHeight || 420), 1);
  const pixelRatio = Math.max(window.devicePixelRatio || 1, 1);
  canvas.width = Math.round(cssWidth * pixelRatio);
  canvas.height = Math.round(cssHeight * pixelRatio);

  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, cssWidth, cssHeight);

  const style = getComputedStyle(document.documentElement);
  const ink = style.getPropertyValue("--ink").trim() || "#1f252c";
  const muted = style.getPropertyValue("--muted").trim() || "#526174";
  const brand = style.getPropertyValue("--brand").trim() || "#1f6f62";
  const surface = style.getPropertyValue("--surface").trim() || "#ffffff";
  const bounds = calculateBounds(collectLayerPoints(model, layer, storySummary));
  const transform = createPlanTransform(bounds, cssWidth, cssHeight, 36);

  context.fillStyle = surface;
  context.fillRect(0, 0, cssWidth, cssHeight);

  const floor = model.floors.find((item) => item.layer === layer + 1) ??
    model.floors.find((item) => item.layer === layer);
  if (floor) {
    pathPoints(context, floor.pos, transform, true);
    context.fillStyle = "rgba(79, 184, 159, 0.10)";
    context.strokeStyle = muted;
    context.lineWidth = 1.5;
    context.fill();
    context.stroke();
  }

  for (const wall of model.walls.filter((item) => item.layer === layer)) {
    const chara = model.wallCharaDB.find((entry) => entry.name === wall.name);
    pathPoints(context, wall.pos, transform, false);
    context.strokeStyle = chara?.isEigenEffectK === false ? "rgba(120, 130, 145, 0.65)" : "#2f5f86";
    context.lineWidth = wall.isVisible ? (chara?.isEigenEffectK === false ? 4 : 7) : 2;
    if (!wall.isVisible) context.setLineDash([6, 5]);
    context.stroke();
    context.setLineDash([]);
  }

  for (const brace of model.braceDampers.filter((item) => item.layer === layer)) {
    const center = transform.point(brace.pos);
    const size = Math.max(Math.min(10, Math.abs(brace.width) * transform.scale * 0.15), 5);
    context.beginPath();
    context.moveTo(center.x - size, center.y - size);
    context.lineTo(center.x + size, center.y + size);
    context.moveTo(center.x + size, center.y - size);
    context.lineTo(center.x - size, center.y + size);
    context.strokeStyle = "#c2792f";
    context.lineWidth = 2;
    context.stroke();
  }

  for (const column of model.columns.filter((item) => item.layer === layer)) {
    drawMarker(context, column.pos, transform, true, ink, 4.5);
  }

  for (const damper of model.massDampers.filter((item) => item.layer === layer)) {
    drawMarker(context, damper.pos, transform, true, "#b34c69", 7);
  }

  const massCenter = model.structInfo?.wCenter[layer - 1];
  if (massCenter) drawMarker(context, massCenter, transform, true, brand, 6);
  const stiffnessCenter = storySummary?.stiffnessCenter;
  if (stiffnessCenter && stiffnessCenter.x !== null && stiffnessCenter.y !== null) {
    drawMarker(
      context,
      { x: stiffnessCenter.x, y: stiffnessCenter.y },
      transform,
      false,
      "#d3553f",
      7
    );
  }

  context.fillStyle = muted;
  context.font = "12px sans-serif";
  context.fillText(
    `${labels.story} ${layer}  ● ${labels.massCenter}  ○ ${labels.stiffnessCenter}`,
    12,
    20
  );
}
