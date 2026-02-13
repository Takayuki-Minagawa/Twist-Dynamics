import { CholeskyDecomposition, Matrix } from "ml-matrix";
import type { RespFile } from "../types";
import { FormatParseError } from "../../io";
import { analyzeRealEigen } from "./modal";
import type { AnalysisOptions } from "./types";

export interface GroundWave {
  dt: number;
  time: number[];
  accX: number[];
  accY: number[];
}

export interface TimeHistoryOptions extends AnalysisOptions {
  beta?: number;
  gamma?: number;
}

function toColumnMatrix(values: number[]): Matrix {
  return Matrix.columnVector(values);
}

function fromColumnMatrix(matrix: Matrix): number[] {
  const rows = matrix.rows;
  const result = new Array<number>(rows);
  for (let i = 0; i < rows; i++) {
    result[i] = matrix.get(i, 0);
  }
  return result;
}

function createInfluenceVectors(storyCount: number): { rx: number[]; ry: number[] } {
  const dof = storyCount * 3;
  const rx = new Array<number>(dof).fill(0);
  const ry = new Array<number>(dof).fill(0);

  for (let i = 0; i < storyCount; i++) {
    rx[i * 3] = 1;
    ry[i * 3 + 1] = 1;
  }

  return { rx, ry };
}

function validateWave(wave: GroundWave): void {
  const n = wave.time.length;
  if (!Number.isFinite(wave.dt) || wave.dt <= 0) {
    throw new FormatParseError("Resp analysis: wave.dt must be a positive number.");
  }
  if (n < 2) {
    throw new FormatParseError("Resp analysis: wave must include at least 2 time points.");
  }
  if (wave.accX.length !== n || wave.accY.length !== n) {
    throw new FormatParseError("Resp analysis: wave arrays must have the same length.");
  }
}

function computeLoadVector(
  massMatrix: Matrix,
  rx: number[],
  ry: number[],
  agx: number,
  agy: number
): number[] {
  const r = rx.map((value, index) => value * agx + ry[index] * agy);
  const load = massMatrix.mmul(toColumnMatrix(r));
  const values = fromColumnMatrix(load);
  for (let i = 0; i < values.length; i++) values[i] = -values[i];
  return values;
}

function addVectors(a: number[], b: number[]): number[] {
  return a.map((value, index) => value + b[index]);
}

function scaleVector(a: number[], factor: number): number[] {
  return a.map((value) => value * factor);
}

function matVec(matrix: number[][], vector: number[]): number[] {
  const out = new Array<number>(matrix.length).fill(0);
  for (let i = 0; i < matrix.length; i++) {
    let sum = 0;
    for (let j = 0; j < vector.length; j++) {
      sum += matrix[i][j] * vector[j];
    }
    out[i] = sum;
  }
  return out;
}

function absMax(values: number[]): number {
  return values.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
}

function buildHeader(storyCount: number): string[] {
  const header = ["Time(s)"];
  if (storyCount >= 1) {
    header.push("DX_1");
    header.push("DY_1");
    header.push("θZ_1");
    header.push("AX_1");
    header.push("AY_1");
  }

  for (let i = 2; i <= storyCount; i++) {
    header.push(`AX_${i}`);
    header.push(`DX_${i}`);
    header.push(`AY_${i}`);
    header.push(`DY_${i}`);
    header.push(`AθZ_${i}`);
    header.push(`DθZ_${i}`);
  }
  header.push("AX_R");
  header.push("DX_R");
  header.push("AY_R");
  header.push("DY_R");
  header.push("AθZ_R");
  header.push("DθZ_R");
  return header;
}

function buildRecordRow(
  time: number,
  storyCount: number,
  displacement: number[],
  absoluteAcc: number[]
): number[] {
  const row = [time];

  if (storyCount >= 1) {
    const base1 = 0;
    row.push(displacement[base1]);
    row.push(displacement[base1 + 1]);
    row.push(displacement[base1 + 2]);
    row.push(absoluteAcc[base1]);
    row.push(absoluteAcc[base1 + 1]);
  }

  for (let i = 1; i < storyCount; i++) {
    const base = i * 3;
    row.push(absoluteAcc[base]);
    row.push(displacement[base]);
    row.push(absoluteAcc[base + 1]);
    row.push(displacement[base + 1]);
    row.push(absoluteAcc[base + 2]);
    row.push(displacement[base + 2]);
  }

  const roof = (storyCount - 1) * 3;
  row.push(absoluteAcc[roof]);
  row.push(displacement[roof]);
  row.push(absoluteAcc[roof + 1]);
  row.push(displacement[roof + 1]);
  row.push(absoluteAcc[roof + 2]);
  row.push(displacement[roof + 2]);

  return row;
}

export function analyzeTimeHistory(
  model: Parameters<typeof analyzeRealEigen>[0],
  wave: GroundWave,
  options: TimeHistoryOptions = {}
): RespFile {
  validateWave(wave);

  const beta = options.beta ?? 0.25;
  const gamma = options.gamma ?? 0.5;
  if (!(beta > 0 && gamma > 0)) {
    throw new FormatParseError("Resp analysis: beta and gamma must be > 0.");
  }

  const { matrices } = analyzeRealEigen(model, {
    defaultDampingRatio: options.defaultDampingRatio ?? 0.02
  });

  const dof = matrices.dofCount;
  const storyCount = matrices.storyCount;
  const dt = wave.dt;

  const mass = matrices.mass;
  const damping = matrices.damping;
  const stiffness = matrices.stiffness;
  const mMat = new Matrix(mass);

  const a0 = 1 / (beta * dt * dt);
  const a1 = gamma / (beta * dt);
  const a2 = 1 / (beta * dt);
  const a3 = 1 / (2 * beta) - 1;
  const a4 = gamma / beta - 1;
  const a5 = dt * (gamma / (2 * beta) - 1);

  const kEff = Matrix.zeros(dof, dof);
  for (let i = 0; i < dof; i++) {
    for (let j = 0; j < dof; j++) {
      kEff.set(i, j, stiffness[i][j] + a1 * damping[i][j] + a0 * mass[i][j]);
    }
  }
  const kSolver = new CholeskyDecomposition(kEff);

  const { rx, ry } = createInfluenceVectors(storyCount);

  let u = new Array<number>(dof).fill(0);
  let v = new Array<number>(dof).fill(0);

  const p0 = computeLoadVector(mMat, rx, ry, wave.accX[0], wave.accY[0]);
  const cV0 = matVec(damping, v);
  const kU0 = matVec(stiffness, u);

  let accRel = new Array<number>(dof).fill(0);
  for (let i = 0; i < dof; i++) {
    const mii = mass[i][i];
    if (Math.abs(mii) < 1e-12) {
      throw new FormatParseError("Resp analysis: mass matrix diagonal includes zero value.");
    }
    accRel[i] = (p0[i] - cV0[i] - kU0[i]) / mii;
  }

  const records: number[][] = [];

  for (let step = 0; step < wave.time.length; step++) {
    const time = wave.time[step];
    const p = computeLoadVector(mMat, rx, ry, wave.accX[step], wave.accY[step]);

    if (step > 0) {
      const termM = addVectors(scaleVector(u, a0), addVectors(scaleVector(v, a2), scaleVector(accRel, a3)));
      const termC = addVectors(scaleVector(u, a1), addVectors(scaleVector(v, a4), scaleVector(accRel, a5)));
      const rhs = addVectors(p, addVectors(matVec(mass, termM), matVec(damping, termC)));

      const uNext = fromColumnMatrix(kSolver.solve(toColumnMatrix(rhs)));
      const accNext = addVectors(
        scaleVector(addVectors(uNext, scaleVector(u, -1)), a0),
        addVectors(scaleVector(v, -a2), scaleVector(accRel, -a3))
      );
      const vNext = addVectors(v, scaleVector(addVectors(scaleVector(accRel, 1 - gamma), scaleVector(accNext, gamma)), dt));

      u = uNext;
      v = vNext;
      accRel = accNext;
    }

    const absoluteAcc = new Array<number>(dof).fill(0);
    for (let i = 0; i < storyCount; i++) {
      const base = i * 3;
      absoluteAcc[base] = accRel[base] + wave.accX[step];
      absoluteAcc[base + 1] = accRel[base + 1] + wave.accY[step];
      absoluteAcc[base + 2] = accRel[base + 2];
    }

    records.push(buildRecordRow(time, storyCount, u, absoluteAcc));
  }

  const header = buildHeader(storyCount);
  const colCount = header.length;
  const columnMaxAbs = new Array<number>(colCount).fill(0);
  for (const row of records) {
    if (row.length !== colCount) {
      throw new FormatParseError("Resp analysis: internal row length mismatch.");
    }
    for (let i = 0; i < row.length; i++) {
      columnMaxAbs[i] = Math.max(columnMaxAbs[i], Math.abs(row[i]));
    }
  }

  if (absMax(columnMaxAbs) < 0) {
    throw new FormatParseError("Resp analysis: invalid output values.");
  }

  return {
    baseShape: matrices.baseShape,
    meta: {
      massCount: storyCount,
      dt,
      damperCount: model.massDampers.length + model.braceDampers.length
    },
    header,
    records,
    columnMaxAbs
  };
}
