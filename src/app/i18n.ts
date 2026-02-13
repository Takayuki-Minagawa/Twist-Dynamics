export type Language = "ja" | "en";

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
  jsonUnsupported: string;
  decodeErrorPrefix: string;
  decodeUnsupportedAction: string;
}

const APP_VERSION = "Ver.Beta02";

const TEXTS: Record<Language, UiText> = {
  ja: {
    heroTitle: `Twist-Dynamics ${APP_VERSION} (Phase 0/1)`,
    heroDescription: "既存フォーマットの読込検証をブラウザ上で実行します。",
    parseCardTitle: "ファイル読込（XML / DAT / CSV）",
    fileInputLabel: "対象ファイル:",
    note: "単位系ルール（kN, cm など）は既存 C# と整合させて扱います。",
    languageLabel: "表示言語",
    openManual: "簡易マニュアル",
    closeManual: "閉じる",
    manualTitle: `簡易マニュアル (${APP_VERSION})`,
    manualIntro: `この画面でできる基本操作です。現在バージョン: ${APP_VERSION}`,
    manualSteps: [
      "左カードで既存データ（XML/DAT/CSV）を読み込み、判定結果（形式・文字コード・要約）を確認します。",
      "表示言語とライト/ダークモードは上部ボタンからいつでも切り替えできます。",
      "文字コードは UTF-8 / Shift_JIS / UTF-16 を自動判定します。判定不能時は再保存を促すエラーを表示します。"
    ],
    switchToDark: "ダークモード",
    switchToLight: "ライトモード",
    unknownFormat: "既存フォーマットの判定に失敗しました。",
    jsonUnsupported: "JSON 変換機能はこのバージョンでは無効です。",
    decodeErrorPrefix: "文字コードエラー:",
    decodeUnsupportedAction:
      "UTF-8(BOMなし) か Shift_JIS で再保存してから再アップロードしてください。"
  },
  en: {
    heroTitle: `Twist-Dynamics ${APP_VERSION} (Phase 0/1)`,
    heroDescription: "Validate legacy file formats in the browser.",
    parseCardTitle: "Load files (XML / DAT / CSV)",
    fileInputLabel: "Target files:",
    note: "Unit-system rules (kN, cm, etc.) stay aligned with the legacy C# implementation.",
    languageLabel: "Language",
    openManual: "Quick Manual",
    closeManual: "Close",
    manualTitle: `Quick Manual (${APP_VERSION})`,
    manualIntro: `Basic operations available on this screen. Current version: ${APP_VERSION}`,
    manualSteps: [
      "Load legacy files (XML/DAT/CSV) in the left card and inspect parse summaries (format/encoding/metrics).",
      "Switch language and light/dark mode at any time from the top controls.",
      "Character encoding is auto-detected for UTF-8, Shift_JIS, and UTF-16. If detection fails, an explicit re-save message is shown."
    ],
    switchToDark: "Dark mode",
    switchToLight: "Light mode",
    unknownFormat: "Could not identify this as a supported legacy format.",
    jsonUnsupported: "JSON conversion is disabled in this version.",
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
