export type Language = "ja" | "en";
import { APP_VERSION } from "./version";

export interface UiText {
  heroTitle: string;
  heroDescription: string;
  parseCardTitle: string;
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
  editorCardTitle: string;
  editorMassNLabel: string;
  editorStructTypeLabel: string;
  editorZLevelLabel: string;
  editorWeightLabel: string;
  editorWMomentLabel: string;
  editorWCenterLabel: string;
  editorFloorsLabel: string;
  editorColumnsLabel: string;
  editorWallCharasLabel: string;
  editorWallsLabel: string;
  editorMassDampersLabel: string;
  editorBraceDampersLabel: string;
  editorDxPanelsLabel: string;
  editorPreviewTitle: string;
  editorBuildButton: string;
  editorDownloadButton: string;
  editorImportLabel: string;
  editorHint: string;
}

const TEXTS: Record<Language, UiText> = {
  ja: {
    heroTitle: `Twist-Dynamics ${APP_VERSION} (Phase 0/1)`,
    heroDescription: "BuildingModel(JSON/XML) と既存結果フォーマット（DAT/CSV）の読込検証をブラウザ上で実行します。",
    parseCardTitle: "ファイル読込（JSON / XML / DAT / CSV）",
    parseResultTitle: "読込結果サマリ",
    fileInputLabel: "対象ファイル:",
    note: "単位系ルール（kN, cm など）は既存 C# と整合させて扱います。",
    languageLabel: "表示言語",
    openManual: "簡易マニュアル",
    closeManual: "閉じる",
    manualTitle: `簡易マニュアル (${APP_VERSION})`,
    manualIntro: `この画面でできる基本操作です。現在バージョン: ${APP_VERSION}`,
    manualSteps: [
      "左カードで入力データ（JSON/XML）や解析結果（DAT/CSV）を読み込み、判定結果（形式・文字コード・要約）を確認します。",
      "右カードで主要な建物データ（階数、Zレベル、重量/重心、柱、壁特性、壁など）を編集し、JSON を生成できます。",
      "表示言語とライト/ダークモードは上部ボタンからいつでも切り替えできます。",
      "文字コードは UTF-8 / Shift_JIS / UTF-16 を自動判定します。判定不能時は再保存を促すエラーを表示します。",
      "入力内容に不整合がある場合は「形式エラー」として項目単位のエラーメッセージを表示します。"
    ],
    switchToDark: "ダークモード",
    switchToLight: "ライトモード",
    unknownFormat: "既存フォーマットの判定に失敗しました。",
    formatErrorPrefix: "形式エラー:",
    decodeErrorPrefix: "文字コードエラー:",
    decodeUnsupportedAction:
      "UTF-8(BOMなし) か Shift_JIS で再保存してから再アップロードしてください。",
    editorCardTitle: "入力モデル作成（BuildingModel）",
    editorMassNLabel: "階数 (massN)",
    editorStructTypeLabel: "構造種別 (R / DX)",
    editorZLevelLabel: "Zレベル (CSV, massN+1個)",
    editorWeightLabel: "重量 (CSV, massN個)",
    editorWMomentLabel: "重量慣性モーメント (CSV, massN個)",
    editorWCenterLabel: "重心座標 (1行1点: x,y)",
    editorFloorsLabel: "床ポリゴン (1行: layer,x1,y1,x2,y2,...)",
    editorColumnsLabel: "柱 (1行: layer,x,y,kx,ky)",
    editorWallCharasLabel:
      "壁特性 (1行: name,k,h,c,isEigenEffectK,isKCUnitChara[,memo])",
    editorWallsLabel: "壁 (1行: layer,name,x1,y1,x2,y2,isVisible)",
    editorMassDampersLabel: "マスダンパー (1行: name,layer,x,y,weight,freqX,freqY,hX,hY)",
    editorBraceDampersLabel:
      "ブレースダンパー (1行: layer,x,y,direct,k,c,width,height,isLightPos,isEigenEffectK)",
    editorDxPanelsLabel: "DXパネル (1行: layer,direct,k,x1,y1,x2,y2,...)",
    editorPreviewTitle: "生成JSONプレビュー",
    editorBuildButton: "JSON生成",
    editorDownloadButton: "JSON保存",
    editorImportLabel: "JSON/XML読込:",
    editorHint: "形式エラーが出る場合は行フォーマットと列数を確認してください。"
  },
  en: {
    heroTitle: `Twist-Dynamics ${APP_VERSION} (Phase 0/1)`,
    heroDescription:
      "Validate BuildingModel (JSON/XML) and legacy analysis result formats (DAT/CSV) in the browser.",
    parseCardTitle: "Load files (JSON / XML / DAT / CSV)",
    parseResultTitle: "Parse summary",
    fileInputLabel: "Target files:",
    note: "Unit-system rules (kN, cm, etc.) stay aligned with the legacy C# implementation.",
    languageLabel: "Language",
    openManual: "Quick Manual",
    closeManual: "Close",
    manualTitle: `Quick Manual (${APP_VERSION})`,
    manualIntro: `Basic operations available on this screen. Current version: ${APP_VERSION}`,
    manualSteps: [
      "Load model files (JSON/XML) and analysis result files (DAT/CSV) on the left, then inspect format/encoding/summary reports.",
      "Use the right editor to input key model data (stories, z-levels, mass centers, columns, wall properties, walls) and generate JSON.",
      "Switch language and light/dark mode at any time from the top controls.",
      "Character encoding is auto-detected for UTF-8, Shift_JIS, and UTF-16. If detection fails, an explicit re-save message is shown.",
      "When input content is inconsistent, the app reports it as a format error with field-level messages."
    ],
    switchToDark: "Dark mode",
    switchToLight: "Light mode",
    unknownFormat: "Could not identify this as a supported legacy format.",
    formatErrorPrefix: "Format error:",
    decodeErrorPrefix: "Encoding error:",
    decodeUnsupportedAction:
      "Re-save the file as UTF-8 (without BOM) or Shift_JIS, then upload again.",
    editorCardTitle: "Model editor (BuildingModel)",
    editorMassNLabel: "Stories (massN)",
    editorStructTypeLabel: "Structure type (R / DX)",
    editorZLevelLabel: "Z levels (CSV, massN+1 values)",
    editorWeightLabel: "Weights (CSV, massN values)",
    editorWMomentLabel: "Weight moments of inertia (CSV, massN values)",
    editorWCenterLabel: "Mass centers (x,y per line)",
    editorFloorsLabel: "Floor polygons (line: layer,x1,y1,x2,y2,...)",
    editorColumnsLabel: "Columns (line: layer,x,y,kx,ky)",
    editorWallCharasLabel:
      "Wall properties (line: name,k,h,c,isEigenEffectK,isKCUnitChara[,memo])",
    editorWallsLabel: "Walls (line: layer,name,x1,y1,x2,y2,isVisible)",
    editorMassDampersLabel:
      "Mass dampers (line: name,layer,x,y,weight,freqX,freqY,hX,hY)",
    editorBraceDampersLabel:
      "Brace dampers (line: layer,x,y,direct,k,c,width,height,isLightPos,isEigenEffectK)",
    editorDxPanelsLabel: "DX panels (line: layer,direct,k,x1,y1,x2,y2,...)",
    editorPreviewTitle: "Generated JSON preview",
    editorBuildButton: "Generate JSON",
    editorDownloadButton: "Save JSON",
    editorImportLabel: "Load JSON/XML:",
    editorHint: "If a format error appears, verify line formats and column counts."
  }
};

export function normalizeLanguage(value: string | null): Language {
  return value === "en" ? "en" : "ja";
}

export function getUiText(language: Language): UiText {
  return TEXTS[language];
}
