import { CholeskyDecomposition, EigenvalueDecomposition, Matrix, inverse } from "ml-matrix";
import type { ModalDatFile } from "../types";
import { FormatParseError } from "../../io";
import { assembleAnalysisMatrices } from "./matrixAssembly";
import type { AnalysisMatrices, AnalysisOptions } from "./types";

interface GeneralizedEigenResult {
  eigenValues: number[];
  eigenVectors: number[][];
}

function toMatrix(values: number[][]): Matrix {
  return new Matrix(values);
}

function matrixToArray(matrix: Matrix): number[][] {
  return matrix.to2DArray();
}

function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function matVec(matrix: number[][], vector: number[]): number[] {
  return matrix.map((row) => dot(row, vector));
}

function massNorm(phi: number[], mass: number[][]): number {
  return Math.sqrt(Math.max(dot(phi, matVec(mass, phi)), 1e-18));
}

function solveGeneralizedEigen(mass: number[][], stiffness: number[][]): GeneralizedEigenResult {
  const m = toMatrix(mass);
  const k = toMatrix(stiffness);
  const chol = new CholeskyDecomposition(m);
  const l = chol.lowerTriangularMatrix;
  const invL = inverse(l);

  const transformed = invL.mmul(k).mmul(invL.transpose());
  const evd = new EigenvalueDecomposition(transformed, { assumeSymmetric: true });

  const rawValues = Array.from(evd.realEigenvalues);
  const q = evd.eigenvectorMatrix;

  const indices = rawValues
    .map((value, index) => ({ value, index }))
    .filter((entry) => Number.isFinite(entry.value) && entry.value > 1e-10)
    .sort((a, b) => a.value - b.value)
    .map((entry) => entry.index);

  if (indices.length === 0) {
    throw new FormatParseError("Eigen analysis: no positive eigenvalue was found.");
  }

  const phi = invL.transpose().mmul(q);
  const phiArr = matrixToArray(phi);

  const eigenValues: number[] = [];
  const eigenVectors: number[][] = [];

  for (const index of indices) {
    const vector = phiArr.map((row) => row[index]);
    const norm = massNorm(vector, mass);
    const normalized = vector.map((value) => value / norm);
    eigenValues.push(rawValues[index]);
    eigenVectors.push(normalized);
  }

  return {
    eigenValues,
    eigenVectors
  };
}

function createParticipationVector(storyCount: number, direction: "X" | "Y"): number[] {
  const vector = new Array<number>(storyCount * 3).fill(0);
  for (let i = 0; i < storyCount; i++) {
    vector[i * 3 + (direction === "X" ? 0 : 1)] = 1;
  }
  return vector;
}

function normalizeReadableModes(eigenVectors: number[][]): number[][] {
  return eigenVectors.map((mode) => {
    const maxAbs = mode.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
    if (maxAbs < 1e-12) return mode.slice();

    const signAnchor = mode.find((value) => Math.abs(value) > 1e-10) ?? 1;
    const sign = signAnchor >= 0 ? 1 : -1;
    return mode.map((value) => (value / maxAbs) * sign);
  });
}

function buildEigenRows(storyCount: number, normalizedModes: number[][]): Array<{ label: string; values: number[] }> {
  const modeCount = normalizedModes.length;
  const rows: Array<{ label: string; values: number[] }> = [];

  const valuesAt = (dofIndex: number): number[] => {
    const values = new Array<number>(modeCount);
    for (let modeIndex = 0; modeIndex < modeCount; modeIndex++) {
      values[modeIndex] = normalizedModes[modeIndex][dofIndex] ?? 0;
    }
    return values;
  };

  for (let layer = storyCount; layer >= 1; layer--) {
    const base = (layer - 1) * 3;
    rows.push({ label: `M${layer}-δx`, values: valuesAt(base) });
    rows.push({ label: `M${layer}-δy`, values: valuesAt(base + 1) });
    rows.push({ label: `M${layer}-θz`, values: valuesAt(base + 2) });
  }

  return rows;
}

function addRayleighDamping(
  matrices: AnalysisMatrices,
  modeOmega: number[],
  defaultDampingRatio: number
): number[][] {
  const dof = matrices.dofCount;
  const c = matrices.damping.map((row) => row.slice());
  if (defaultDampingRatio <= 0) return c;

  const omega = modeOmega.filter((value) => Number.isFinite(value) && value > 1e-12);
  if (omega.length === 0) return c;

  let alpha = 0;
  let beta = 0;

  if (omega.length === 1) {
    alpha = 2 * defaultDampingRatio * omega[0];
  } else {
    const w1 = omega[0];
    const w2 = omega[1];
    alpha = (2 * defaultDampingRatio * w1 * w2) / (w1 + w2);
    beta = (2 * defaultDampingRatio) / (w1 + w2);
  }

  for (let i = 0; i < dof; i++) {
    for (let j = 0; j < dof; j++) {
      c[i][j] += alpha * matrices.mass[i][j] + beta * matrices.stiffness[i][j];
    }
  }

  return c;
}

export function analyzeRealEigen(
  model: AnalysisMatrices["model"],
  options: AnalysisOptions = {}
): { modal: ModalDatFile; matrices: AnalysisMatrices } {
  const matrices = assembleAnalysisMatrices(model, options);
  const eigen = solveGeneralizedEigen(matrices.mass, matrices.stiffness);
  const storyCount = matrices.storyCount;

  const frequenciesHz = eigen.eigenValues.map((omega2) => Math.sqrt(omega2) / (2 * Math.PI));
  const omega = frequenciesHz.map((f) => f * 2 * Math.PI);

  const influenceX = createParticipationVector(storyCount, "X");
  const influenceY = createParticipationVector(storyCount, "Y");
  const mRx = dot(influenceX, matVec(matrices.mass, influenceX));
  const mRy = dot(influenceY, matVec(matrices.mass, influenceY));

  const participationFactorX: number[] = [];
  const participationFactorY: number[] = [];
  const effectiveMassRatioX: number[] = [];
  const effectiveMassRatioY: number[] = [];

  for (const mode of eigen.eigenVectors) {
    const gammaX = dot(mode, matVec(matrices.mass, influenceX));
    const gammaY = dot(mode, matVec(matrices.mass, influenceY));

    participationFactorX.push(gammaX);
    participationFactorY.push(gammaY);
    effectiveMassRatioX.push(mRx > 0 ? (gammaX * gammaX) / mRx : 0);
    effectiveMassRatioY.push(mRy > 0 ? (gammaY * gammaY) / mRy : 0);
  }

  const normalizedModes = normalizeReadableModes(eigen.eigenVectors);
  const eigenVectors = buildEigenRows(storyCount, normalizedModes);

  const modal: ModalDatFile = {
    baseShape: matrices.baseShape,
    modal: {
      frequenciesHz,
      participationFactorX,
      participationFactorY,
      effectiveMassRatioX,
      effectiveMassRatioY,
      eigenVectors
    }
  };

  matrices.damping = addRayleighDamping(matrices, omega, options.defaultDampingRatio ?? 0.02);

  return {
    modal,
    matrices
  };
}

export function solveGeneralizedEigenForTesting(
  mass: number[][],
  stiffness: number[][]
): GeneralizedEigenResult {
  return solveGeneralizedEigen(mass, stiffness);
}
