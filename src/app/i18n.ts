import { APP_VERSION } from "./version";
import type { PeakProfileMetric, PeakProfileSeriesKey } from "./responseCharts";

export type Language = "ja" | "en";

export interface UiText {
  heroTitle: string;
  heroDescription: string;
  parseResultTitle: string;
  fileInputLabel: string;
  note: string;
  languageLabel: string;
  openManual: string;
  closeManual: string;
  manualTitle: string;
  manualIntro: string;
  manualSteps: string[];
  switchToDark: string;
  switchToLight: string;
  unknownFormat: string;
  formatErrorPrefix: string;
  decodeErrorPrefix: string;
  decodeUnsupportedAction: string;
  legacyStructTypeIgnored: string;
  legacyDxPanelsConverted: (count: number) => string;
  editorCardTitle: string;
  editorMassNLabel: string;
  editorBaseZLabel: string;
  editorBuildButton: string;
  editorDownloadButton: string;
  editorImportLabel: string;
  editorHint: string;
  editorPreviewTitle: string;
  editorValid: string;
  editorInvalid: string;
  storyCsvButton: string;
  planTitle: string;
  planLayerLabel: string;
  planCanvasLabel: string;
  planStoryLabel: string;
  massCenterLabel: string;
  stiffnessCenterLabel: string;
  storySummaryTitle: string;
  storySummaryHeaders: readonly string[];
  viewerTitle: string;
  viewerModeLabel: string;
  viewerModeIndexLabel: string;
  viewerSeekLabel: string;
  viewerCanvasLabel: string;
  viewerUnavailable: string;
  viewerModeOptions: Record<"static" | "real" | "complex" | "response", string>;
  viewerCategoryLabels: Record<string, string>;
  storyPrefix: string;
  modePrefix: string;
  viewerPlay: string;
  viewerPause: string;
  viewerScaleLabel: string;
  viewerRotationLabel: string;
  viewerSpeedLabel: string;
  viewerReset: string;
  resultInputLabel: string;
  responseTitle: string;
  responseWaveCanvasLabel: string;
  responseProfileCanvasLabel: string;
  responseProfileMetricLabel: string;
  responseProfileMetricOptions: Record<PeakProfileMetric, string>;
  responseProfileSeriesLabels: Record<PeakProfileSeriesKey, string>;
  responseHeaders: readonly string[];
  chartNoSeries: string;
  chartNoPeak: string;
  chartStory: string;
}

const TEXTS: Record<Language, UiText> = {
  ja: {
    heroTitle: `Twist-Dynamics ${APP_VERSION}`,
    heroDescription:
      "方向・座標・剛性で建物を入力し、偏心・固有モード・時刻歴応答を2D/3Dで確認します。",
    parseResultTitle: "ファイル読込と互換性レポート",
    fileInputLabel: "JSON / XML / DAT / CSV:",
    note: "単位系は kN・cm・s。旧 sType は無視され、旧 DXPanel は等価な剛性要素へ自動変換されます。",
    languageLabel: "表示言語",
    openManual: "簡易マニュアル",
    closeManual: "閉じる",
    manualTitle: `簡易マニュアル (${APP_VERSION})`,
    manualIntro: "モデル入力から結果確認までの基本操作です。",
    manualSteps: [
      "建物概要と各表を編集します。赤いセルは行単位の入力エラーです。各表の一括貼付け欄には Excel 由来の CSV/TSV を貼り付けできます。",
      "モデル更新で JSON、平面プレビュー、剛心・偏心率、3Dモデル、実固有モードを同時に更新します。",
      "旧 JSON/XML の sType は無視し、dxPanels は同じ層剛性を持つ columns へ自動変換します。変換内容は読込レポートに表示されます。",
      "3D画面では要素・階の表示、モード倍率、ねじれ強調、再生速度を調整できます。マウスで回転・パン・ズームできます。",
      "DAT/CSV結果を読み込むと、固有モードまたは時刻歴アニメーションを確認できます。最大応答グラフは変位・層間変形角・ねじれ角・加速度を切り替えられます。"
    ],
    switchToDark: "ダークモード",
    switchToLight: "ライトモード",
    unknownFormat: "対応形式を判定できませんでした。",
    formatErrorPrefix: "形式エラー:",
    decodeErrorPrefix: "文字コードエラー:",
    decodeUnsupportedAction:
      "UTF-8(BOMなし) か Shift_JIS で再保存してから再アップロードしてください。",
    legacyStructTypeIgnored: "旧フィールド structInfo.sType を無視しました。",
    legacyDxPanelsConverted: (count) =>
      `旧 dxPanels ${count}件を等価な剛性要素 columns へ変換しました。`,
    editorCardTitle: "建物概要・モデル操作",
    editorMassNLabel: "階数",
    editorBaseZLabel: "基準レベル z (cm)",
    editorBuildButton: "モデル更新",
    editorDownloadButton: "JSON保存",
    editorImportLabel: "JSON/XML読込:",
    editorHint: "壁の解析寄与は壁特性の「固有値剛性に含む」で指定し、表示可否とは分けて扱います。",
    editorPreviewTitle: "正規化JSONを表示",
    editorValid: "入力は有効です。プレビューと解析結果を更新しました。",
    editorInvalid: "入力を修正してください。",
    storyCsvButton: "偏心・剛性CSV",
    planTitle: "2D 平面プレビュー",
    planLayerLabel: "階:",
    planCanvasLabel: "選択階の2D平面プレビュー",
    planStoryLabel: "階",
    massCenterLabel: "重心",
    stiffnessCenterLabel: "剛心",
    storySummaryTitle: "層剛性・剛心・偏心率",
    storySummaryHeaders: [
      "階",
      "X方向剛性 Kx (kN/cm)",
      "Y方向剛性 Ky (kN/cm)",
      "剛心 X (cm)",
      "剛心 Y (cm)",
      "X方向偏心率 Re (-)",
      "Y方向偏心率 Re (-)",
      "相対比剛性 X（簡易・非法規）(-)",
      "相対比剛性 Y（簡易・非法規）(-)"
    ],
    viewerTitle: "3D モデル・結果アニメーション",
    viewerModeLabel: "表示:",
    viewerModeIndexLabel: "モード:",
    viewerSeekLabel: "再生位置",
    viewerCanvasLabel: "3D構造モデル表示",
    viewerUnavailable: "3Dビューアーを利用できません。",
    viewerModeOptions: {
      static: "静止モデル",
      real: "実固有モード",
      complex: "複素固有モード",
      response: "時刻歴応答"
    },
    viewerCategoryLabels: {
      floors: "床",
      columns: "柱・剛性要素",
      structuralWalls: "構造壁",
      nonStructuralWalls: "非構造壁",
      braceDampers: "ブレースダンパー",
      massDampers: "マスダンパー",
      massCenters: "重心",
      stiffnessCenters: "剛心"
    },
    storyPrefix: "階",
    modePrefix: "モード",
    viewerPlay: "再生",
    viewerPause: "停止",
    viewerScaleLabel: "変形倍率",
    viewerRotationLabel: "ねじれ強調",
    viewerSpeedLabel: "速度",
    viewerReset: "視点リセット",
    resultInputLabel: "結果DAT/CSV:",
    responseTitle: "時刻歴応答グラフ・最大応答",
    responseWaveCanvasLabel: "時刻歴応答波形グラフ",
    responseProfileCanvasLabel: "最大応答の高さ方向分布グラフ",
    responseProfileMetricLabel: "高さ方向表示:",
    responseProfileMetricOptions: {
      displacement: "変位 X / Y (cm)",
      interstoryDrift: "層間変形角 X / Y (-)",
      rotation: "ねじれ角 RZ (rad)",
      acceleration: "加速度 X / Y (cm/s²)"
    },
    responseProfileSeriesLabels: {
      displacementX: "最大 |DX|",
      displacementY: "最大 |DY|",
      interstoryDriftX: "最大層間変形角 X",
      interstoryDriftY: "最大層間変形角 Y",
      rotationZ: "最大ねじれ角 |RZ|",
      accelerationX: "最大 |AX|",
      accelerationY: "最大 |AY|"
    },
    responseHeaders: [
      "階",
      "最大 DX (cm)",
      "最大 DY (cm)",
      "最大 RZ (rad)",
      "最大層間変形角 X (-)",
      "最大層間変形角 Y (-)",
      "最大 AX (cm/s²)",
      "最大 AY (cm/s²)"
    ],
    chartNoSeries: "応答波形はありません",
    chartNoPeak: "最大応答はありません",
    chartStory: "階"
  },
  en: {
    heroTitle: `Twist-Dynamics ${APP_VERSION}`,
    heroDescription:
      "Define the building by direction, position, and stiffness, then inspect eccentricity, modes, and response in 2D/3D.",
    parseResultTitle: "File import and compatibility report",
    fileInputLabel: "JSON / XML / DAT / CSV:",
    note: "Units are kN, cm, and s. Legacy sType is ignored and DXPanel entries are converted to equivalent stiffness elements.",
    languageLabel: "Language",
    openManual: "Quick manual",
    closeManual: "Close",
    manualTitle: `Quick manual (${APP_VERSION})`,
    manualIntro: "Core workflow from model input to result review.",
    manualSteps: [
      "Edit the building summary and tables. Red cells identify row-level errors. Paste CSV/TSV copied from spreadsheets in each table's bulk editor.",
      "Update the model to refresh canonical JSON, plan preview, stiffness center and eccentricity, 3D model, and real modes together.",
      "Legacy sType is ignored. Legacy dxPanels are converted to columns with identical story-stiffness contributions; the import report lists migrations.",
      "The 3D viewer supports category/story visibility, deformation scale, torsion emphasis, playback speed, orbit, pan, and zoom.",
      "Load DAT/CSV results to inspect modal or response animation and waveforms. Switch the peak profile between displacement, interstory drift, torsional rotation, and acceleration."
    ],
    switchToDark: "Dark mode",
    switchToLight: "Light mode",
    unknownFormat: "Could not identify a supported format.",
    formatErrorPrefix: "Format error:",
    decodeErrorPrefix: "Encoding error:",
    decodeUnsupportedAction:
      "Re-save as UTF-8 without BOM or Shift_JIS, then upload again.",
    legacyStructTypeIgnored: "Ignored legacy field structInfo.sType.",
    legacyDxPanelsConverted: (count) =>
      `Converted ${count} legacy dxPanel ${count === 1 ? "entry" : "entries"} to equivalent column stiffness elements.`,
    editorCardTitle: "Building summary and model actions",
    editorMassNLabel: "Stories",
    editorBaseZLabel: "Base level z (cm)",
    editorBuildButton: "Update model",
    editorDownloadButton: "Save JSON",
    editorImportLabel: "Load JSON/XML:",
    editorHint: "A wall's analysis contribution is controlled by its wall-property flag, independently from display visibility.",
    editorPreviewTitle: "Show canonical JSON",
    editorValid: "Input is valid. Previews and analysis results were updated.",
    editorInvalid: "Correct the input errors.",
    storyCsvButton: "Eccentricity/stiffness CSV",
    planTitle: "2D plan preview",
    planLayerLabel: "Story:",
    planCanvasLabel: "2D plan preview for the selected story",
    planStoryLabel: "Story",
    massCenterLabel: "mass center",
    stiffnessCenterLabel: "stiffness center",
    storySummaryTitle: "Story stiffness, center, and eccentricity",
    storySummaryHeaders: [
      "Story",
      "X stiffness Kx (kN/cm)",
      "Y stiffness Ky (kN/cm)",
      "Stiffness center X (cm)",
      "Stiffness center Y (cm)",
      "Eccentricity ratio Re X (-)",
      "Eccentricity ratio Re Y (-)",
      "Relative (K/W) X (simple; non-statutory) (-)",
      "Relative (K/W) Y (simple; non-statutory) (-)"
    ],
    viewerTitle: "3D model and result animation",
    viewerModeLabel: "View:",
    viewerModeIndexLabel: "Mode:",
    viewerSeekLabel: "Playback position",
    viewerCanvasLabel: "3D structural model viewer",
    viewerUnavailable: "3D viewer is unavailable.",
    viewerModeOptions: {
      static: "Static model",
      real: "Real mode",
      complex: "Complex mode",
      response: "Time-history response"
    },
    viewerCategoryLabels: {
      floors: "Floors",
      columns: "Columns / stiffness",
      structuralWalls: "Structural walls",
      nonStructuralWalls: "Non-structural walls",
      braceDampers: "Brace dampers",
      massDampers: "Mass dampers",
      massCenters: "Mass centers",
      stiffnessCenters: "Stiffness centers"
    },
    storyPrefix: "Story",
    modePrefix: "Mode",
    viewerPlay: "Play",
    viewerPause: "Pause",
    viewerScaleLabel: "Deformation scale",
    viewerRotationLabel: "Torsion emphasis",
    viewerSpeedLabel: "Speed",
    viewerReset: "Reset view",
    resultInputLabel: "Result DAT/CSV:",
    responseTitle: "Response waveforms and peak response",
    responseWaveCanvasLabel: "Time-history response waveform chart",
    responseProfileCanvasLabel: "Peak response profile chart",
    responseProfileMetricLabel: "Height profile:",
    responseProfileMetricOptions: {
      displacement: "Displacement X / Y (cm)",
      interstoryDrift: "Interstory drift X / Y (-)",
      rotation: "Torsional rotation RZ (rad)",
      acceleration: "Acceleration X / Y (cm/s²)"
    },
    responseProfileSeriesLabels: {
      displacementX: "max |DX|",
      displacementY: "max |DY|",
      interstoryDriftX: "max interstory drift X",
      interstoryDriftY: "max interstory drift Y",
      rotationZ: "max torsional rotation |RZ|",
      accelerationX: "max |AX|",
      accelerationY: "max |AY|"
    },
    responseHeaders: [
      "Story",
      "max DX (cm)",
      "max DY (cm)",
      "max RZ (rad)",
      "max drift X (-)",
      "max drift Y (-)",
      "max AX (cm/s²)",
      "max AY (cm/s²)"
    ],
    chartNoSeries: "No response series",
    chartNoPeak: "No peak response",
    chartStory: "Story"
  }
};

export function normalizeLanguage(value: string | null): Language {
  return value === "en" ? "en" : "ja";
}

export function getUiText(language: Language): UiText {
  return TEXTS[language];
}
