import { eigs } from "mathjs";
import { Matrix, inverse } from "ml-matrix";
import type { ComplexModalFile, ComplexMode, ComplexModeVector } from "../types";
import { FormatParseError } from "../../io";
import { analyzeRealEigen } from "./modal";
import type { AnalysisOptions, ComplexValue } from "./types";

const EIGEN_EPS = 1e-9;

function toComplexValue(value: unknown): ComplexValue {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new FormatParseError(`Complex analysis: invalid eigen value ${value}`);
    }
    return { re: value, im: 0 };
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "re" in value &&
    "im" in value &&
    typeof (value as { re: unknown }).re === "number" &&
    typeof (value as { im: unknown }).im === "number"
  ) {
    return {
      re: (value as { re: number }).re,
      im: (value as { im: number }).im
    };
  }

  throw new FormatParseError("Complex analysis: unsupported complex number representation.");
}

function buildStateMatrix(mass: number[][], stiffness: number[][], damping: number[][]): number[][] {
  const m = new Matrix(mass);
  const k = new Matrix(stiffness);
  const c = new Matrix(damping);
  const minv = inverse(m);
  const minvK = minv.mmul(k).to2DArray();
  const minvC = minv.mmul(c).to2DArray();

  const dof = mass.length;
  const size = dof * 2;
  const state = Array.from({ length: size }, () => new Array<number>(size).fill(0));

  for (let i = 0; i < dof; i++) {
    state[i][dof + i] = 1;
  }

  for (let i = 0; i < dof; i++) {
    for (let j = 0; j < dof; j++) {
      state[dof + i][j] = -minvK[i][j];
      state[dof + i][dof + j] = -minvC[i][j];
    }
  }

  return state;
}

function complexAbs(value: ComplexValue): number {
  return Math.hypot(value.re, value.im);
}

function normalizeModeVector(values: ComplexValue[]): ComplexValue[] {
  const maxAmp = values.reduce((max, value) => Math.max(max, complexAbs(value)), 0);
  if (maxAmp < 1e-15) {
    return values.map((value) => ({ ...value }));
  }

  let sign = 1;
  const anchor = values.find((value) => complexAbs(value) > 1e-12);
  if (anchor && anchor.re < 0) sign = -1;

  return values.map((value) => ({
    re: (value.re / maxAmp) * sign,
    im: (value.im / maxAmp) * sign
  }));
}

function componentLabel(dofIndex: number): string {
  const story = Math.floor(dofIndex / 3) + 1;
  const axis = dofIndex % 3;
  if (axis === 0) return `DX_${story}`;
  if (axis === 1) return `DY_${story}`;
  return `RZ_${story}`;
}

function formatComplexVectors(displacements: ComplexValue[]): ComplexModeVector[] {
  const normalized = normalizeModeVector(displacements);
  return normalized.map((value, index) => ({
    component: componentLabel(index),
    amplitude: complexAbs(value),
    phaseRad: Math.atan2(value.im, value.re),
    complexReal: value.re,
    complexImag: value.im
  }));
}

function dampingRatioPercent(lambda: ComplexValue): number {
  const magnitude = Math.hypot(lambda.re, lambda.im);
  if (magnitude < EIGEN_EPS) return 0;
  return (-lambda.re / magnitude) * 100;
}

function parseComplexEigsResult(
  result: unknown,
  dof: number,
  modeLimit: number
): ComplexMode[] {
  const eigResult = result as {
    values?: unknown[];
    eigenvectors?: Array<{ value: unknown; vector: unknown[] }>;
  };

  if (!Array.isArray(eigResult.values) || !Array.isArray(eigResult.eigenvectors)) {
    throw new FormatParseError("Complex analysis: eigs result is invalid.");
  }

  const modes: ComplexMode[] = [];

  for (const item of eigResult.eigenvectors) {
    const lambda = toComplexValue(item.value);
    if (lambda.im <= EIGEN_EPS) continue;
    if (!Array.isArray(item.vector) || item.vector.length < dof) continue;

    const displacement = item.vector.slice(0, dof).map(toComplexValue);
    const vectors = formatComplexVectors(displacement);

    const frequencyHz = Math.abs(lambda.im) / (2 * Math.PI);
    if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) continue;

    modes.push({
      mode: 0,
      frequencyHz,
      dampingRatioPercent: dampingRatioPercent(lambda),
      eigenValueReal: lambda.re,
      eigenValueImag: lambda.im,
      vectors
    });
  }

  modes.sort((a, b) => a.frequencyHz - b.frequencyHz);
  const limited = modes.slice(0, modeLimit);
  limited.forEach((mode, index) => {
    mode.mode = index + 1;
  });

  if (limited.length === 0) {
    throw new FormatParseError("Complex analysis: no valid complex mode was found.");
  }

  return limited;
}

export function analyzeComplexEigen(
  model: Parameters<typeof analyzeRealEigen>[0],
  options: AnalysisOptions = {}
): { modal: ReturnType<typeof analyzeRealEigen>["modal"]; complex: ComplexModalFile } {
  const { modal, matrices } = analyzeRealEigen(model, options);
  const stateMatrix = buildStateMatrix(matrices.mass, matrices.stiffness, matrices.damping);

  let eigResult: unknown;
  try {
    eigResult = eigs(stateMatrix, { precision: 1e-6, maxIterations: 1000 } as unknown as object);
  } catch (error) {
    throw new FormatParseError(
      `Complex analysis: eigs failed. ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const modes = parseComplexEigsResult(eigResult, matrices.dofCount, matrices.dofCount);

  return {
    modal,
    complex: {
      baseShape: matrices.baseShape,
      modes
    }
  };
}
