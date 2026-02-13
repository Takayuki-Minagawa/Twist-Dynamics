import { parseComplexModalDat, parseModalDat, parseRespCsv } from "../io";

export type CompareType = "modal" | "complex" | "resp";

export interface CompareTolerance {
  rtol: number;
  atol: number;
}

export type CompareIssueKind = "length_mismatch" | "value_mismatch" | "label_mismatch";

export interface CompareIssue {
  kind: CompareIssueKind;
  metric: string;
  index?: number;
  reference?: number;
  target?: number;
  abs?: number;
  rel?: number;
  message: string;
}

export interface CompareResult {
  type: CompareType;
  tolerance: CompareTolerance;
  issues: CompareIssue[];
}

const DEFAULT_TOLERANCE: CompareTolerance = {
  rtol: 0.01,
  atol: 1e-6
};

function relDiff(a: number, b: number): number {
  const scale = Math.max(Math.abs(a), Math.abs(b), 1e-12);
  return Math.abs(a - b) / scale;
}

function compareLabelArrays(metric: string, reference: string[], target: string[]): CompareIssue[] {
  if (reference.length !== target.length) {
    return [
      {
        kind: "length_mismatch",
        metric,
        message: `${metric}: length mismatch ${reference.length} != ${target.length}`
      }
    ];
  }

  const issues: CompareIssue[] = [];
  for (let i = 0; i < reference.length; i++) {
    if (reference[i] !== target[i]) {
      issues.push({
        kind: "label_mismatch",
        metric,
        index: i,
        message: `${metric}[${i}] mismatch ref=${reference[i]} target=${target[i]}`
      });
    }
  }
  return issues;
}

export function compareNumberArrays(
  metric: string,
  reference: number[],
  target: number[],
  tolerance: CompareTolerance
): CompareIssue[] {
  if (reference.length !== target.length) {
    return [
      {
        kind: "length_mismatch",
        metric,
        message: `${metric}: length mismatch ${reference.length} != ${target.length}`
      }
    ];
  }

  const issues: CompareIssue[] = [];
  for (let i = 0; i < reference.length; i++) {
    const abs = Math.abs(reference[i] - target[i]);
    const rel = relDiff(reference[i], target[i]);
    if (abs > tolerance.atol && rel > tolerance.rtol) {
      issues.push({
        kind: "value_mismatch",
        metric,
        index: i,
        reference: reference[i],
        target: target[i],
        abs,
        rel,
        message: `${metric}[${i}] mismatch ref=${reference[i]} target=${target[i]} abs=${abs} rel=${rel}`
      });
    }
  }
  return issues;
}

function compareModal(
  referenceText: string,
  targetText: string,
  tolerance: CompareTolerance
): CompareIssue[] {
  const ref = parseModalDat(referenceText).modal;
  const tgt = parseModalDat(targetText).modal;
  const issues: CompareIssue[] = [
    ...compareNumberArrays("frequenciesHz", ref.frequenciesHz, tgt.frequenciesHz, tolerance),
    ...compareNumberArrays(
      "participationFactorX",
      ref.participationFactorX,
      tgt.participationFactorX,
      tolerance
    ),
    ...compareNumberArrays(
      "participationFactorY",
      ref.participationFactorY,
      tgt.participationFactorY,
      tolerance
    ),
    ...compareNumberArrays(
      "effectiveMassRatioX",
      ref.effectiveMassRatioX,
      tgt.effectiveMassRatioX,
      tolerance
    ),
    ...compareNumberArrays(
      "effectiveMassRatioY",
      ref.effectiveMassRatioY,
      tgt.effectiveMassRatioY,
      tolerance
    ),
    ...compareLabelArrays(
      "eigenVectors.labels",
      ref.eigenVectors.map((row) => row.label),
      tgt.eigenVectors.map((row) => row.label)
    )
  ];

  const minRows = Math.min(ref.eigenVectors.length, tgt.eigenVectors.length);
  for (let rowIndex = 0; rowIndex < minRows; rowIndex++) {
    issues.push(
      ...compareNumberArrays(
        `eigenVectors.${ref.eigenVectors[rowIndex].label}`,
        ref.eigenVectors[rowIndex].values,
        tgt.eigenVectors[rowIndex].values,
        tolerance
      )
    );
  }

  return issues;
}

function compareComplex(
  referenceText: string,
  targetText: string,
  tolerance: CompareTolerance
): CompareIssue[] {
  const ref = parseComplexModalDat(referenceText);
  const tgt = parseComplexModalDat(targetText);
  const refModeNo = ref.modes.map((m) => m.mode);
  const tgtModeNo = tgt.modes.map((m) => m.mode);
  const refFreq = ref.modes.map((m) => m.frequencyHz);
  const tgtFreq = tgt.modes.map((m) => m.frequencyHz);
  const refDamp = ref.modes.map((m) => m.dampingRatioPercent);
  const tgtDamp = tgt.modes.map((m) => m.dampingRatioPercent);
  const refEigenReal = ref.modes.map((m) => m.eigenValueReal ?? 0);
  const tgtEigenReal = tgt.modes.map((m) => m.eigenValueReal ?? 0);
  const refEigenImag = ref.modes.map((m) => m.eigenValueImag ?? 0);
  const tgtEigenImag = tgt.modes.map((m) => m.eigenValueImag ?? 0);

  const issues: CompareIssue[] = [
    ...compareNumberArrays("complex.modeNumber", refModeNo, tgtModeNo, {
      rtol: 0,
      atol: 0
    }),
    ...compareNumberArrays("complex.frequenciesHz", refFreq, tgtFreq, tolerance),
    ...compareNumberArrays("complex.dampingRatio", refDamp, tgtDamp, tolerance)
    ,
    ...compareNumberArrays("complex.eigenValueReal", refEigenReal, tgtEigenReal, tolerance),
    ...compareNumberArrays("complex.eigenValueImag", refEigenImag, tgtEigenImag, tolerance)
  ];

  const modeCount = Math.min(ref.modes.length, tgt.modes.length);
  for (let modeIndex = 0; modeIndex < modeCount; modeIndex++) {
    const refMode = ref.modes[modeIndex];
    const tgtMode = tgt.modes[modeIndex];
    issues.push(
      ...compareLabelArrays(
        `complex.mode${refMode.mode}.vector.component`,
        refMode.vectors.map((vector) => vector.component),
        tgtMode.vectors.map((vector) => vector.component)
      )
    );

    const minVectors = Math.min(refMode.vectors.length, tgtMode.vectors.length);
    for (let vectorIndex = 0; vectorIndex < minVectors; vectorIndex++) {
      const refVector = refMode.vectors[vectorIndex];
      const tgtVector = tgtMode.vectors[vectorIndex];
      issues.push(
        ...compareNumberArrays(
          `complex.mode${refMode.mode}.${refVector.component}.amplitude`,
          [refVector.amplitude],
          [tgtVector.amplitude],
          tolerance
        ),
        ...compareNumberArrays(
          `complex.mode${refMode.mode}.${refVector.component}.phaseRad`,
          [refVector.phaseRad],
          [tgtVector.phaseRad],
          tolerance
        ),
        ...compareNumberArrays(
          `complex.mode${refMode.mode}.${refVector.component}.complexReal`,
          [refVector.complexReal ?? 0],
          [tgtVector.complexReal ?? 0],
          tolerance
        ),
        ...compareNumberArrays(
          `complex.mode${refMode.mode}.${refVector.component}.complexImag`,
          [refVector.complexImag ?? 0],
          [tgtVector.complexImag ?? 0],
          tolerance
        )
      );
    }
  }

  return issues;
}

function compareResp(
  referenceText: string,
  targetText: string,
  tolerance: CompareTolerance
): CompareIssue[] {
  const ref = parseRespCsv(referenceText);
  const tgt = parseRespCsv(targetText);
  const refMeta = [ref.meta.massCount, ref.meta.dt, ref.meta.damperCount];
  const tgtMeta = [tgt.meta.massCount, tgt.meta.dt, tgt.meta.damperCount];
  const refFirstResponseMax = ref.columnMaxAbs[1] ?? 0;
  const tgtFirstResponseMax = tgt.columnMaxAbs[1] ?? 0;
  const refLastResponseMax =
    ref.columnMaxAbs.length > 0 ? ref.columnMaxAbs[ref.columnMaxAbs.length - 1] : 0;
  const tgtLastResponseMax =
    tgt.columnMaxAbs.length > 0 ? tgt.columnMaxAbs[tgt.columnMaxAbs.length - 1] : 0;

  return [
    ...compareNumberArrays("resp.meta", refMeta, tgtMeta, tolerance),
    ...compareLabelArrays("resp.header", ref.header, tgt.header),
    ...compareNumberArrays("resp.columnMaxAbs", ref.columnMaxAbs, tgt.columnMaxAbs, tolerance),
    ...compareNumberArrays(
      "resp.firstResponseColumn.maxAbs",
      [refFirstResponseMax],
      [tgtFirstResponseMax],
      tolerance
    ),
    ...compareNumberArrays(
      "resp.lastResponseColumn.maxAbs",
      [refLastResponseMax],
      [tgtLastResponseMax],
      tolerance
    ),
    ...compareNumberArrays(
      "resp.timeColumn",
      ref.records.map((row) => row[0]),
      tgt.records.map((row) => row[0]),
      tolerance
    )
  ];
}

export function compareByType(
  type: CompareType,
  referenceText: string,
  targetText: string,
  tolerance: Partial<CompareTolerance> = {}
): CompareResult {
  const resolvedTolerance: CompareTolerance = {
    rtol: tolerance.rtol ?? DEFAULT_TOLERANCE.rtol,
    atol: tolerance.atol ?? DEFAULT_TOLERANCE.atol
  };

  let issues: CompareIssue[] = [];
  if (type === "modal") issues = compareModal(referenceText, targetText, resolvedTolerance);
  if (type === "complex") issues = compareComplex(referenceText, targetText, resolvedTolerance);
  if (type === "resp") issues = compareResp(referenceText, targetText, resolvedTolerance);

  return {
    type,
    tolerance: resolvedTolerance,
    issues
  };
}
