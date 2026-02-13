export type Language = "ja" | "en";
import { APP_VERSION } from "./version";

export interface UiText {
  heroTitle: string;
  heroDescription: string;
  parseCardTitle: string;
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
  xmlUnsupported: string;
  formatErrorPrefix: string;
  decodeErrorPrefix: string;
  decodeUnsupportedAction: string;
}

const TEXTS: Record<Language, UiText> = {
  ja: {
    heroTitle: `Twist-Dynamics ${APP_VERSION} (Phase 0/1)`,
    heroDescription: "BuildingModel(JSON) と既存結果フォーマット（DAT/CSV）の読込検証をブラウザ上で実行します。",
    parseCardTitle: "ファイル読込（JSON / DAT / CSV）",
    fileInputLabel: "対象ファイル:",
    note: "単位系ルール（kN, cm など）は既存 C# と整合させて扱います。",
    languageLabel: "表示言語",
    openManual: "簡易マニュアル",
    closeManual: "閉じる",
    manualTitle: `簡易マニュアル (${APP_VERSION})`,
    manualIntro: `この画面でできる基本操作です。現在バージョン: ${APP_VERSION}`,
    manualSteps: [
      "左カードで入力データ（JSON）や解析結果（DAT/CSV）を読み込み、判定結果（形式・文字コード・要約）を確認します。",
      "BuildingModel の XML 入力は非対応です。XML ファイルを選択した場合は JSON 変換を促すメッセージを表示します。",
      "表示言語とライト/ダークモードは上部ボタンからいつでも切り替えできます。",
      "文字コードは UTF-8 / Shift_JIS / UTF-16 を自動判定します。判定不能時は再保存を促すエラーを表示します。",
      "入力内容に不整合がある場合は「形式エラー」として項目単位のエラーメッセージを表示します。"
    ],
    switchToDark: "ダークモード",
    switchToLight: "ライトモード",
    unknownFormat: "既存フォーマットの判定に失敗しました。",
    xmlUnsupported: "XML の入力はこのバージョンではサポートしていません。JSON へ変換してください。",
    formatErrorPrefix: "形式エラー:",
    decodeErrorPrefix: "文字コードエラー:",
    decodeUnsupportedAction:
      "UTF-8(BOMなし) か Shift_JIS で再保存してから再アップロードしてください。"
  },
  en: {
    heroTitle: `Twist-Dynamics ${APP_VERSION} (Phase 0/1)`,
    heroDescription:
      "Validate BuildingModel(JSON) and legacy analysis result formats (DAT/CSV) in the browser.",
    parseCardTitle: "Load files (JSON / DAT / CSV)",
    fileInputLabel: "Target files:",
    note: "Unit-system rules (kN, cm, etc.) stay aligned with the legacy C# implementation.",
    languageLabel: "Language",
    openManual: "Quick Manual",
    closeManual: "Close",
    manualTitle: `Quick Manual (${APP_VERSION})`,
    manualIntro: `Basic operations available on this screen. Current version: ${APP_VERSION}`,
    manualSteps: [
      "Load input models (JSON) and analysis result files (DAT/CSV) in the left card and inspect parse summaries (format/encoding/metrics).",
      "BuildingModel XML input is not supported. Selecting XML shows a message to convert it into JSON.",
      "Switch language and light/dark mode at any time from the top controls.",
      "Character encoding is auto-detected for UTF-8, Shift_JIS, and UTF-16. If detection fails, an explicit re-save message is shown.",
      "When input content is inconsistent, the app reports it as a format error with field-level messages."
    ],
    switchToDark: "Dark mode",
    switchToLight: "Light mode",
    unknownFormat: "Could not identify this as a supported legacy format.",
    xmlUnsupported: "XML model input is not supported in this version. Convert it to JSON.",
    formatErrorPrefix: "Format error:",
    decodeErrorPrefix: "Encoding error:",
    decodeUnsupportedAction:
      "Re-save the file as UTF-8 (without BOM) or Shift_JIS, then upload again."
  }
};

export function normalizeLanguage(value: string | null): Language {
  return value === "en" ? "en" : "ja";
}

export function getUiText(language: Language): UiText {
  return TEXTS[language];
}
