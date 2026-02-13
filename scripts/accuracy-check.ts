import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  decodeText,
  parseBuildingModelJson,
  parseComplexModalDat,
  parseModalDat,
  parseRespCsv,
  serializeComplexModalDat,
  serializeModalDat,
  serializeRespCsv
} from "../src/io";
import { analyzeComplexEigen } from "../src/core/analysis";
import type { RespFile } from "../src/core/types";

type MetricStatus = "PASS" | "FAIL" | "SKIP";
type CaseType = "analysis" | "roundtrip";

interface MetricReport {
  name: string;
  thresholdRel: number | null;
  status: MetricStatus;
  maxRel: number | null;
  maxAbs: number | null;
  referenceCount: number;
  targetCount: number;
  comparedCount: number;
  note: string;
}

interface CaseReport {
  id: string;
  title: string;
  type: CaseType;
  referencePath: string;
  targetPath: string;
  status: Exclude<MetricStatus, "SKIP">;
  metrics: MetricReport[];
  notes: string[];
}

interface AccuracyReport {
  generatedAt: string;
  summary: {
    totalCases: number;
    passCases: number;
    failCases: number;
    overall: "PASS" | "FAIL";
  };
  cases: CaseReport[];
  outOfToleranceAnalysis: string[];
  improvementPlan: string[];
}

interface NumberMetricOptions {
  thresholdRel: number;
  requireSameLength?: boolean;
}

const OUT_DIR = "reference/accuracy";
const GENERATED_DIR = `${OUT_DIR}/generated`;
const REPORT_JSON = `${OUT_DIR}/accuracy-report.json`;
const REPORT_MD = `${OUT_DIR}/accuracy-report.md`;

function readText(pathLike: string): string {
  const raw = readFileSync(resolve(pathLike));
  const source = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  return decodeText(source, "shift_jis");
}

function writeText(pathLike: string, text: string): void {
  const abs = resolve(pathLike);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, text, { encoding: "utf-8" });
}

function relDiff(reference: number, target: number): number {
  const scale = Math.max(Math.abs(reference), Math.abs(target), 1e-12);
  return Math.abs(reference - target) / scale;
}

function numberMetric(
  name: string,
  reference: number[],
  target: number[],
  options: NumberMetricOptions
): MetricReport {
  const requireSameLength = options.requireSameLength ?? true;
  const minLength = Math.min(reference.length, target.length);

  if (reference.length === 0 && target.length === 0) {
    return {
      name,
      thresholdRel: options.thresholdRel,
      status: "SKIP",
      maxRel: null,
      maxAbs: null,
      referenceCount: 0,
      targetCount: 0,
      comparedCount: 0,
      note: "比較対象データなし"
    };
  }

  if (minLength === 0) {
    return {
      name,
      thresholdRel: options.thresholdRel,
      status: "FAIL",
      maxRel: null,
      maxAbs: null,
      referenceCount: reference.length,
      targetCount: target.length,
      comparedCount: 0,
      note: "片側データのみ存在"
    };
  }

  let maxRel = 0;
  let maxAbs = 0;
  for (let i = 0; i < minLength; i++) {
    const abs = Math.abs(reference[i] - target[i]);
    const rel = relDiff(reference[i], target[i]);
    if (abs > maxAbs) maxAbs = abs;
    if (rel > maxRel) maxRel = rel;
  }

  const sameLength = reference.length === target.length;
  const lengthOk = requireSameLength ? sameLength : true;
  const pass = lengthOk && maxRel <= options.thresholdRel;

  const notes: string[] = [];
  if (!sameLength) {
    notes.push(`長さ不一致 ref=${reference.length}, target=${target.length}`);
  }
  if (maxRel > options.thresholdRel) {
    notes.push(`最大相対誤差 ${maxRel.toExponential(3)} > ${options.thresholdRel.toExponential(3)}`);
  }
  if (notes.length === 0) notes.push("許容範囲内");

  return {
    name,
    thresholdRel: options.thresholdRel,
    status: pass ? "PASS" : "FAIL",
    maxRel,
    maxAbs,
    referenceCount: reference.length,
    targetCount: target.length,
    comparedCount: minLength,
    note: notes.join(" / ")
  };
}

function labelMetric(name: string, reference: string[], target: string[]): MetricReport {
  const minLength = Math.min(reference.length, target.length);
  const mismatches: number[] = [];
  for (let i = 0; i < minLength; i++) {
    if (reference[i] !== target[i]) mismatches.push(i);
  }

  const sameLength = reference.length === target.length;
  const pass = sameLength && mismatches.length === 0;

  const noteParts: string[] = [];
  if (!sameLength) {
    noteParts.push(`長さ不一致 ref=${reference.length}, target=${target.length}`);
  }
  if (mismatches.length > 0) {
    noteParts.push(`ラベル不一致 index=${mismatches.slice(0, 5).join(",")}`);
  }
  if (noteParts.length === 0) noteParts.push("一致");

  return {
    name,
    thresholdRel: null,
    status: pass ? "PASS" : "FAIL",
    maxRel: null,
    maxAbs: null,
    referenceCount: reference.length,
    targetCount: target.length,
    comparedCount: minLength,
    note: noteParts.join(" / ")
  };
}

function decideCaseStatus(metrics: MetricReport[]): Exclude<MetricStatus, "SKIP"> {
  return metrics.some((metric) => metric.status === "FAIL") ? "FAIL" : "PASS";
}

function collectModalEigenValues(modalText: string): {
  labels: string[];
  values: number[];
  modeCount: number;
} {
  const parsed = parseModalDat(modalText);
  const labels = parsed.modal.eigenVectors.map((row) => row.label);
  const values: number[] = [];
  const modeCount = parsed.modal.frequenciesHz.length;

  for (const row of parsed.modal.eigenVectors) {
    for (const value of row.values.slice(0, modeCount)) {
      values.push(value);
    }
  }

  return { labels, values, modeCount };
}

function createModalRoundtripCase(): CaseReport {
  const referencePath = "reference/modal/test_01_eig.dat";
  const targetPath = `${GENERATED_DIR}/modal_roundtrip_web.dat`;

  const referenceText = readText(referencePath);
  const parsed = parseModalDat(referenceText);
  const targetText = serializeModalDat(parsed);
  writeText(targetPath, targetText);

  const targetParsed = parseModalDat(targetText);
  const targetReSerialized = serializeModalDat(targetParsed);

  const refEigen = collectModalEigenValues(referenceText);
  const tgtEigen = collectModalEigenValues(targetReSerialized);

  const metrics: MetricReport[] = [
    numberMetric("実固有値: 固有振動数(Hz)", parsed.modal.frequenciesHz, targetParsed.modal.frequenciesHz, {
      thresholdRel: 0.01
    }),
    numberMetric(
      "実固有値: 刺激係数X",
      parsed.modal.participationFactorX,
      targetParsed.modal.participationFactorX,
      { thresholdRel: 0.03 }
    ),
    numberMetric(
      "実固有値: 刺激係数Y",
      parsed.modal.participationFactorY,
      targetParsed.modal.participationFactorY,
      { thresholdRel: 0.03 }
    ),
    numberMetric(
      "実固有値: 有効質量比X",
      parsed.modal.effectiveMassRatioX,
      targetParsed.modal.effectiveMassRatioX,
      { thresholdRel: 0.03 }
    ),
    numberMetric(
      "実固有値: 有効質量比Y",
      parsed.modal.effectiveMassRatioY,
      targetParsed.modal.effectiveMassRatioY,
      { thresholdRel: 0.03 }
    ),
    labelMetric("実固有値: 固有ベクトルラベル", refEigen.labels, tgtEigen.labels),
    numberMetric("実固有値: 固有ベクトル主要成分", refEigen.values, tgtEigen.values, {
      thresholdRel: 0.03
    })
  ];

  return {
    id: "CASE-01",
    title: "実固有値 (C#基準DAT -> Web再読込/再出力)",
    type: "roundtrip",
    referencePath,
    targetPath,
    status: decideCaseStatus(metrics),
    metrics,
    notes: [
      "C#基準DATをWeb I/Oで再読込し、再出力結果と比較。",
      "解析計算ではなく既存フォーマット互換と指標抽出の再現性を確認。"
    ]
  };
}

function collectComplexVectorScalars(complexText: string): {
  modeNumbers: number[];
  componentsByMode: string[][];
  amplitudeValues: number[];
  phaseValues: number[];
} {
  const parsed = parseComplexModalDat(complexText);
  const modeNumbers = parsed.modes.map((mode) => mode.mode);
  const componentsByMode = parsed.modes.map((mode) => mode.vectors.map((vector) => vector.component));
  const amplitudeValues: number[] = [];
  const phaseValues: number[] = [];

  for (const mode of parsed.modes) {
    for (const vector of mode.vectors) {
      amplitudeValues.push(vector.amplitude);
      phaseValues.push(vector.phaseRad);
    }
  }

  return { modeNumbers, componentsByMode, amplitudeValues, phaseValues };
}

function createComplexAnalysisCase(): CaseReport {
  const modelPath = "reference/building-model/Test_simple.json";
  const referencePath = "reference/complex/Test_simple_ceig.dat";
  const targetPath = `${GENERATED_DIR}/complex_analysis_web.dat`;

  const model = parseBuildingModelJson(readText(modelPath));
  const analyzed = analyzeComplexEigen(model, { defaultDampingRatio: 0.02 }).complex;
  const targetText = serializeComplexModalDat(analyzed);
  writeText(targetPath, targetText);

  const reference = parseComplexModalDat(readText(referencePath));
  const target = parseComplexModalDat(targetText);
  const refVectors = collectComplexVectorScalars(readText(referencePath));
  const tgtVectors = collectComplexVectorScalars(targetText);

  const metrics: MetricReport[] = [
    numberMetric(
      "複素固有値: モード番号",
      refVectors.modeNumbers,
      tgtVectors.modeNumbers,
      { thresholdRel: 0 }
    ),
    numberMetric(
      "複素固有値: 固有振動数(Hz)",
      reference.modes.map((mode) => mode.frequencyHz),
      target.modes.map((mode) => mode.frequencyHz),
      { thresholdRel: 0.01 }
    ),
    numberMetric(
      "複素固有値: 減衰比(%)",
      reference.modes.map((mode) => mode.dampingRatioPercent),
      target.modes.map((mode) => mode.dampingRatioPercent),
      { thresholdRel: 0.03 }
    ),
    numberMetric(
      "複素固有値: 固有値実部",
      reference.modes.map((mode) => mode.eigenValueReal ?? 0),
      target.modes.map((mode) => mode.eigenValueReal ?? 0),
      { thresholdRel: 0.03 }
    ),
    numberMetric(
      "複素固有値: 固有値虚部",
      reference.modes.map((mode) => mode.eigenValueImag ?? 0),
      target.modes.map((mode) => mode.eigenValueImag ?? 0),
      { thresholdRel: 0.01 }
    ),
    numberMetric("複素モード: 正規化振幅", refVectors.amplitudeValues, tgtVectors.amplitudeValues, {
      thresholdRel: 0.05
    }),
    numberMetric("複素モード: 位相角(rad)", refVectors.phaseValues, tgtVectors.phaseValues, {
      thresholdRel: 0.05
    })
  ];

  const modeCount = Math.min(reference.modes.length, target.modes.length);
  for (let i = 0; i < modeCount; i++) {
    metrics.push(
      labelMetric(
        `複素モード: ベクトル成分ラベル(Mode ${i + 1})`,
        refVectors.componentsByMode[i],
        tgtVectors.componentsByMode[i]
      )
    );
  }

  return {
    id: "CASE-02",
    title: "複素固有値 (C#基準DAT vs Web解析)",
    type: "analysis",
    referencePath,
    targetPath,
    status: decideCaseStatus(metrics),
    metrics,
    notes: [
      "入力モデル: reference/building-model/Test_simple.json",
      "Web解析は state-space + `mathjs.eigs` 実装を使用。"
    ]
  };
}

function extractColumn(records: number[][], index: number): number[] {
  return records.map((row) => row[index] ?? 0);
}

function pickIndices(headers: string[], prefixes: string[]): number[] {
  const result: number[] = [];
  for (let i = 0; i < headers.length; i++) {
    if (prefixes.some((prefix) => headers[i].startsWith(prefix))) {
      result.push(i);
    }
  }
  return result;
}

function createRespRoundtripCase(): CaseReport {
  const referencePath = "reference/resp/test.csv";
  const targetPath = `${GENERATED_DIR}/resp_roundtrip_web.csv`;

  const referenceText = readText(referencePath);
  const reference = parseRespCsv(referenceText);
  const targetText = serializeRespCsv(reference);
  writeText(targetPath, targetText);
  const target = parseRespCsv(targetText);

  const displacementIdx = pickIndices(reference.header, ["DX_", "DY_", "DθZ_"]);
  const accelerationIdx = pickIndices(reference.header, ["AX_", "AY_", "AθZ_"]);

  const referenceDispMax = displacementIdx.map((index) => reference.columnMaxAbs[index] ?? 0);
  const targetDispMax = displacementIdx.map((index) => target.columnMaxAbs[index] ?? 0);
  const referenceAccMax = accelerationIdx.map((index) => reference.columnMaxAbs[index] ?? 0);
  const targetAccMax = accelerationIdx.map((index) => target.columnMaxAbs[index] ?? 0);

  const representativeHeaders = ["DX_R", "DY_R"];
  const representativeReference: number[] = [];
  const representativeTarget: number[] = [];
  for (const header of representativeHeaders) {
    const refIndex = reference.header.indexOf(header);
    const tgtIndex = target.header.indexOf(header);
    if (refIndex < 0 || tgtIndex < 0) continue;
    representativeReference.push(...extractColumn(reference.records, refIndex));
    representativeTarget.push(...extractColumn(target.records, tgtIndex));
  }

  const metrics: MetricReport[] = [
    numberMetric(
      "時刻歴: 時刻列整合",
      extractColumn(reference.records, 0),
      extractColumn(target.records, 0),
      { thresholdRel: 0 }
    ),
    labelMetric("時刻歴: ヘッダ整合", reference.header, target.header),
    numberMetric("時刻歴: 最大変位(主要点)", referenceDispMax, targetDispMax, {
      thresholdRel: 0.05
    }),
    numberMetric("時刻歴: 最大加速度(主要点)", referenceAccMax, targetAccMax, {
      thresholdRel: 0.05
    }),
    numberMetric("時刻歴: 代表波形(DX_R,DY_R)", representativeReference, representativeTarget, {
      thresholdRel: 0.05
    }),
    numberMetric(
      "時刻歴: メタ情報(質点数,dt,ダンパー数)",
      [reference.meta.massCount, reference.meta.dt, reference.meta.damperCount],
      [target.meta.massCount, target.meta.dt, target.meta.damperCount],
      { thresholdRel: 0 }
    )
  ];

  return {
    id: "CASE-03",
    title: "時刻歴 (C#基準CSV -> Web再読込/再出力)",
    type: "roundtrip",
    referencePath,
    targetPath,
    status: decideCaseStatus(metrics),
    metrics,
    notes: [
      "C#基準CSVをWeb I/Oで再読込し、最大応答・代表波形・時刻列整合を確認。",
      "解析計算での再現比較には基準CSVに対応する入力波データが別途必要。"
    ]
  };
}

function formatThreshold(value: number | null): string {
  if (value === null) return "-";
  return value.toExponential(1);
}

function formatNumber(value: number | null): string {
  if (value === null) return "-";
  return value.toExponential(3);
}

function statusIcon(status: MetricStatus): string {
  if (status === "PASS") return "PASS";
  if (status === "FAIL") return "FAIL";
  return "SKIP";
}

function buildOutOfToleranceAnalysis(cases: CaseReport[]): string[] {
  const lines: string[] = [];
  const failedCases = cases.filter((caseReport) => caseReport.status === "FAIL");
  if (failedCases.length === 0) {
    lines.push("許容外差分は検出されませんでした。");
    return lines;
  }

  for (const caseReport of failedCases) {
    const failedMetrics = caseReport.metrics
      .filter((metric) => metric.status === "FAIL")
      .slice(0, 3)
      .map((metric) => `${metric.name} (${metric.note})`);
    lines.push(`${caseReport.id}: ${failedMetrics.join(" / ")}`);
  }

  const complexCase = failedCases.find((caseReport) => caseReport.id === "CASE-02");
  if (complexCase) {
    lines.push(
      "CASE-02の主要因: C#側の複素モード選別・減衰行列規約と、Web側(state-space + eigs)のモード抽出条件の差が大きい。"
    );
  }

  return lines;
}

function buildImprovementPlan(reportCases: CaseReport[]): string[] {
  const hasComplexFail = reportCases.some(
    (caseReport) => caseReport.id === "CASE-02" && caseReport.status === "FAIL"
  );
  const plan: string[] = [
    "C#基準の入力セットを追加: 実固有値/時刻歴に対し、モデル+波形の対応データを reference 配下へ整備する。",
    "検証自動化: `npm run check:accuracy` をCIに追加し、レポートをアーティファクト化する。"
  ];

  if (hasComplexFail) {
    plan.push(
      "複素固有値の整合改善: モード対応付け(MAC等)と減衰行列の組成規約をC#実装に合わせて調整する。"
    );
  }

  return plan;
}

function renderMarkdown(report: AccuracyReport): string {
  const lines: string[] = [];
  lines.push("# 解析精度チェックレポート (#25)");
  lines.push("");
  lines.push(`- 生成日時: ${report.generatedAt}`);
  lines.push(`- 総ケース数: ${report.summary.totalCases}`);
  lines.push(`- PASS: ${report.summary.passCases}`);
  lines.push(`- FAIL: ${report.summary.failCases}`);
  lines.push(`- 総合判定: ${report.summary.overall}`);
  lines.push("");

  for (const caseReport of report.cases) {
    lines.push(`## ${caseReport.id} ${caseReport.title}`);
    lines.push(`- 種別: ${caseReport.type}`);
    lines.push(`- 判定: ${caseReport.status}`);
    lines.push(`- 参照データ: \`${caseReport.referencePath}\``);
    lines.push(`- 生成データ: \`${caseReport.targetPath}\``);
    for (const note of caseReport.notes) {
      lines.push(`- 補足: ${note}`);
    }
    lines.push("");
    lines.push("| 指標 | 閾値(相対) | 最大相対誤差 | 最大絶対誤差 | 件数(ref/target/比較) | 判定 | 備考 |");
    lines.push("| --- | --- | --- | --- | --- | --- | --- |");
    for (const metric of caseReport.metrics) {
      lines.push(
        `| ${metric.name} | ${formatThreshold(metric.thresholdRel)} | ${formatNumber(metric.maxRel)} | ${formatNumber(metric.maxAbs)} | ${metric.referenceCount}/${metric.targetCount}/${metric.comparedCount} | ${statusIcon(metric.status)} | ${metric.note} |`
      );
    }
    lines.push("");
  }

  lines.push("## 許容外差分の要因");
  for (const line of report.outOfToleranceAnalysis) {
    lines.push(`- ${line}`);
  }
  lines.push("");

  lines.push("## 改善方針");
  for (const line of report.improvementPlan) {
    lines.push(`- ${line}`);
  }
  lines.push("");

  return lines.join("\n");
}

function summarizeCases(cases: CaseReport[]): AccuracyReport["summary"] {
  const passCases = cases.filter((caseReport) => caseReport.status === "PASS").length;
  const failCases = cases.filter((caseReport) => caseReport.status === "FAIL").length;
  return {
    totalCases: cases.length,
    passCases,
    failCases,
    overall: failCases === 0 ? "PASS" : "FAIL"
  };
}

function main(): void {
  const strict = process.argv.includes("--strict");
  mkdirSync(resolve(GENERATED_DIR), { recursive: true });

  const cases: CaseReport[] = [
    createModalRoundtripCase(),
    createComplexAnalysisCase(),
    createRespRoundtripCase()
  ];

  const summary = summarizeCases(cases);
  const report: AccuracyReport = {
    generatedAt: new Date().toISOString(),
    summary,
    cases,
    outOfToleranceAnalysis: buildOutOfToleranceAnalysis(cases),
    improvementPlan: buildImprovementPlan(cases)
  };

  writeText(REPORT_JSON, JSON.stringify(report, null, 2));
  writeText(REPORT_MD, renderMarkdown(report));

  console.log(`Accuracy report JSON: ${REPORT_JSON}`);
  console.log(`Accuracy report Markdown: ${REPORT_MD}`);
  console.log(`Overall status: ${summary.overall}`);

  if (strict && summary.overall === "FAIL") {
    process.exit(1);
  }
}

main();
