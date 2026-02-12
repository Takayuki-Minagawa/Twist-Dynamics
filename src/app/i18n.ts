export type Language = "ja" | "en";

export interface UiText {
  heroTitle: string;
  heroDescription: string;
  parseCardTitle: string;
  convertCardTitle: string;
  fileInputLabel: string;
  convertButton: string;
  downloadButton: string;
  jsonPlaceholder: string;
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
  convertErrorPrefix: string;
  decodeErrorPrefix: string;
  decodeUnsupportedAction: string;
}

const APP_VERSION = "Ver.Beta02";

const TEXTS: Record<Language, UiText> = {
  ja: {
    heroTitle: `Twist-Dynamics ${APP_VERSION} (Phase 0/1)`,
    heroDescription:
      "既存フォーマットの読込検証と JSON -> BuildingModel(XML) 変換をブラウザ上で実行します。",
    parseCardTitle: "ファイル読込（XML / DAT / CSV / JSON）",
    convertCardTitle: "JSON -> BuildingModel XML 変換",
    fileInputLabel: "対象ファイル:",
    convertButton: "XMLへ変換",
    downloadButton: "XMLを保存",
    jsonPlaceholder: "ここに NICE JSON を貼り付け",
    note: "単位系ルール（kN, cm など）は既存 C# と整合させて扱います。",
    languageLabel: "表示言語",
    openManual: "簡易マニュアル",
    closeManual: "閉じる",
    manualTitle: `簡易マニュアル (${APP_VERSION})`,
    manualIntro: `この画面でできる基本操作です。現在バージョン: ${APP_VERSION}`,
    manualSteps: [
      "左カードで既存データ（XML/DAT/CSV/JSON）を読み込み、判定結果（形式・文字コード・要約）を確認します。",
      "右カードへ NICE JSON を貼り付けて「XMLへ変換」を押すと BuildingModel XML を生成します。",
      "生成された XML は「XMLを保存」でローカル保存できます。",
      "表示言語とライト/ダークモードは上部ボタンからいつでも切り替えできます。",
      "文字コードは UTF-8 / Shift_JIS / UTF-16 を自動判定します。判定不能時は再保存を促すエラーを表示します。"
    ],
    switchToDark: "ダークモード",
    switchToLight: "ライトモード",
    unknownFormat: "既存フォーマットの判定に失敗しました。",
    convertErrorPrefix: "変換エラー:",
    decodeErrorPrefix: "文字コードエラー:",
    decodeUnsupportedAction:
      "UTF-8(BOMなし) か Shift_JIS で再保存してから再アップロードしてください。"
  },
  en: {
    heroTitle: `Twist-Dynamics ${APP_VERSION} (Phase 0/1)`,
    heroDescription:
      "Validate legacy file formats and run JSON -> BuildingModel(XML) conversion in the browser.",
    parseCardTitle: "Load files (XML / DAT / CSV / JSON)",
    convertCardTitle: "JSON -> BuildingModel XML Conversion",
    fileInputLabel: "Target files:",
    convertButton: "Convert to XML",
    downloadButton: "Save XML",
    jsonPlaceholder: "Paste NICE JSON here",
    note: "Unit-system rules (kN, cm, etc.) stay aligned with the legacy C# implementation.",
    languageLabel: "Language",
    openManual: "Quick Manual",
    closeManual: "Close",
    manualTitle: `Quick Manual (${APP_VERSION})`,
    manualIntro: `Basic operations available on this screen. Current version: ${APP_VERSION}`,
    manualSteps: [
      "Load legacy files (XML/DAT/CSV/JSON) in the left card and inspect parse summaries (format/encoding/metrics).",
      "Paste NICE JSON in the right card and click \"Convert to XML\" to generate BuildingModel XML.",
      "Use \"Save XML\" to download the generated XML to your local machine.",
      "Switch language and light/dark mode at any time from the top controls.",
      "Character encoding is auto-detected for UTF-8, Shift_JIS, and UTF-16. If detection fails, an explicit re-save message is shown."
    ],
    switchToDark: "Dark mode",
    switchToLight: "Light mode",
    unknownFormat: "Could not identify this as a supported legacy format.",
    convertErrorPrefix: "Conversion error:",
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
