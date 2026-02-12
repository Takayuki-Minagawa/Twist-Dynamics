import { parseComplexModalDat, parseModalDat, parseRespCsv } from "../io";

export type CompareType = "modal" | "complex" | "resp";

export interface CompareTolerance {
  rtol: number;
  atol: number;
}

export type CompareIssueKind = "length_mismatch" | "value_mismatch";

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
  return [
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
    )
  ];
}

function compareComplex(
  referenceText: string,
  targetText: string,
  tolerance: CompareTolerance
): CompareIssue[] {
  const ref = parseComplexModalDat(referenceText);
  const tgt = parseComplexModalDat(targetText);
  const refFreq = ref.modes.map((m) => m.frequencyHz);
  const tgtFreq = tgt.modes.map((m) => m.frequencyHz);
  const refDamp = ref.modes.map((m) => m.dampingRatioPercent);
  const tgtDamp = tgt.modes.map((m) => m.dampingRatioPercent);

  return [
    ...compareNumberArrays("complex.frequenciesHz", refFreq, tgtFreq, tolerance),
    ...compareNumberArrays("complex.dampingRatio", refDamp, tgtDamp, tolerance)
  ];
}

function compareResp(
  referenceText: string,
  targetText: string,
  tolerance: CompareTolerance
): CompareIssue[] {
  const ref = parseRespCsv(referenceText);
  const tgt = parseRespCsv(targetText);
  return [
    ...compareNumberArrays("resp.columnMaxAbs", ref.columnMaxAbs, tgt.columnMaxAbs, tolerance),
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
