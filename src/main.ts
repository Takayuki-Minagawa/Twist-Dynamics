import "./style.css";
import {
  convertNiceJsonToBuildingModelXml,
  decodeText,
  parseBuildingModelXml,
  parseComplexModalDat,
  parseModalDat,
  parseRespCsv,
  summarizeBuildingModel
} from "./io";

type FileType = "xml" | "modal" | "complex" | "resp" | "json" | "unknown";
type Language = "ja" | "en";
type Theme = "light" | "dark";

interface UiText {
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
}

const LANGUAGE_KEY = "twist-dynamics-language";
const THEME_KEY = "twist-dynamics-theme";

const TEXTS: Record<Language, UiText> = {
  ja: {
    heroTitle: "Twist-Dynamics (Phase 0/1)",
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
    manualTitle: "簡易マニュアル",
    manualIntro: "この画面でできる基本操作です。",
    manualSteps: [
      "左カードで既存データ（XML/DAT/CSV/JSON）を読み込み、判定結果を確認します。",
      "右カードへ NICE JSON を貼り付けて「XMLへ変換」を押すと BuildingModel XML を生成します。",
      "生成された XML は「XMLを保存」でローカル保存できます。",
      "表示言語とライト/ダークモードは上部ボタンからいつでも切り替えできます。"
    ],
    switchToDark: "ダークモード",
    switchToLight: "ライトモード",
    unknownFormat: "既存フォーマットの判定に失敗しました。",
    convertErrorPrefix: "変換エラー:"
  },
  en: {
    heroTitle: "Twist-Dynamics (Phase 0/1)",
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
    manualTitle: "Quick Manual",
    manualIntro: "Basic operations available on this screen:",
    manualSteps: [
      "Load legacy files (XML/DAT/CSV/JSON) in the left card and inspect parse summaries.",
      "Paste NICE JSON in the right card and click \"Convert to XML\" to generate BuildingModel XML.",
      "Use \"Save XML\" to download the generated XML to your local machine.",
      "Switch language and light/dark mode at any time from the top controls."
    ],
    switchToDark: "Dark mode",
    switchToLight: "Light mode",
    unknownFormat: "Could not identify this as a supported legacy format.",
    convertErrorPrefix: "Conversion error:"
  }
};

function detectType(fileName: string, text: string): FileType {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".xml")) return "xml";
  if (lowerName.endsWith(".json")) return "json";
  if (lowerName.endsWith(".csv") && text.includes("#Resp_Result")) return "resp";
  if (lowerName.endsWith(".dat") && text.includes("#ComplexModalResult")) return "complex";
  if (lowerName.endsWith(".dat") && text.includes("#ModalResult")) return "modal";
  return "unknown";
}

function downloadText(name: string, text: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function loadLanguage(): Language {
  const saved = window.localStorage.getItem(LANGUAGE_KEY);
  return saved === "en" ? "en" : "ja";
}

function loadTheme(): Theme {
  const saved = window.localStorage.getItem(THEME_KEY);
  return saved === "dark" ? "dark" : "light";
}

function bootstrap(): void {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) return;

  let currentLanguage = loadLanguage();
  let currentTheme = loadTheme();
  let latestXml = "";

  root.innerHTML = `
    <div class="app">
      <section class="toolbar">
        <div class="toolbar-group">
          <label id="languageLabel" for="languageSelect"></label>
          <select id="languageSelect">
            <option value="ja">日本語</option>
            <option value="en">English</option>
          </select>
        </div>
        <div class="toolbar-actions">
          <button id="themeButton" type="button" class="button-secondary"></button>
          <button id="manualButton" type="button" class="button-secondary"></button>
        </div>
      </section>
      <section class="hero">
        <h1 id="heroTitle"></h1>
        <p id="heroDescription"></p>
      </section>
      <section class="grid">
        <article class="card">
          <h2 id="parseCardTitle"></h2>
          <div class="actions">
            <label id="fileInputLabel" class="inline-label" for="fileInput"></label>
            <input id="fileInput" type="file" multiple />
          </div>
          <pre id="summary"></pre>
        </article>
        <article class="card">
          <h2 id="convertCardTitle"></h2>
          <textarea id="jsonInput"></textarea>
          <div class="actions">
            <button id="convertButton" type="button"></button>
            <button id="downloadButton" type="button"></button>
          </div>
          <pre id="xmlOutput"></pre>
          <div id="noteText" class="note"></div>
        </article>
      </section>
    </div>
    <div id="manualModal" class="manual-modal hidden" role="dialog" aria-modal="true" aria-labelledby="manualTitle">
      <div class="manual-panel">
        <h2 id="manualTitle"></h2>
        <p id="manualIntro"></p>
        <ol id="manualList"></ol>
        <div class="manual-actions">
          <button id="manualCloseButton" type="button"></button>
        </div>
      </div>
    </div>
  `;

  const fileInput = root.querySelector<HTMLInputElement>("#fileInput");
  const summary = root.querySelector<HTMLElement>("#summary");
  const jsonInput = root.querySelector<HTMLTextAreaElement>("#jsonInput");
  const xmlOutput = root.querySelector<HTMLElement>("#xmlOutput");
  const convertButton = root.querySelector<HTMLButtonElement>("#convertButton");
  const downloadButton = root.querySelector<HTMLButtonElement>("#downloadButton");
  const languageLabel = root.querySelector<HTMLLabelElement>("#languageLabel");
  const languageSelect = root.querySelector<HTMLSelectElement>("#languageSelect");
  const themeButton = root.querySelector<HTMLButtonElement>("#themeButton");
  const manualButton = root.querySelector<HTMLButtonElement>("#manualButton");
  const heroTitle = root.querySelector<HTMLHeadingElement>("#heroTitle");
  const heroDescription = root.querySelector<HTMLParagraphElement>("#heroDescription");
  const parseCardTitle = root.querySelector<HTMLHeadingElement>("#parseCardTitle");
  const convertCardTitle = root.querySelector<HTMLHeadingElement>("#convertCardTitle");
  const fileInputLabel = root.querySelector<HTMLLabelElement>("#fileInputLabel");
  const noteText = root.querySelector<HTMLDivElement>("#noteText");
  const manualModal = root.querySelector<HTMLDivElement>("#manualModal");
  const manualTitle = root.querySelector<HTMLHeadingElement>("#manualTitle");
  const manualIntro = root.querySelector<HTMLParagraphElement>("#manualIntro");
  const manualList = root.querySelector<HTMLOListElement>("#manualList");
  const manualCloseButton = root.querySelector<HTMLButtonElement>("#manualCloseButton");

  if (
    !fileInput ||
    !summary ||
    !jsonInput ||
    !xmlOutput ||
    !convertButton ||
    !downloadButton ||
    !languageLabel ||
    !languageSelect ||
    !themeButton ||
    !manualButton ||
    !heroTitle ||
    !heroDescription ||
    !parseCardTitle ||
    !convertCardTitle ||
    !fileInputLabel ||
    !noteText ||
    !manualModal ||
    !manualTitle ||
    !manualIntro ||
    !manualList ||
    !manualCloseButton
  ) {
    return;
  }

  const applyTheme = (): void => {
    document.documentElement.dataset.theme = currentTheme;
  };

  const closeManual = (): void => {
    manualModal.classList.add("hidden");
  };

  const openManual = (): void => {
    manualModal.classList.remove("hidden");
  };

  const updateTexts = (): void => {
    const t = TEXTS[currentLanguage];

    document.documentElement.lang = currentLanguage;
    heroTitle.textContent = t.heroTitle;
    heroDescription.textContent = t.heroDescription;
    parseCardTitle.textContent = t.parseCardTitle;
    convertCardTitle.textContent = t.convertCardTitle;
    fileInputLabel.textContent = t.fileInputLabel;
    convertButton.textContent = t.convertButton;
    downloadButton.textContent = t.downloadButton;
    jsonInput.placeholder = t.jsonPlaceholder;
    noteText.textContent = t.note;
    languageLabel.textContent = t.languageLabel;
    manualButton.textContent = t.openManual;
    manualCloseButton.textContent = t.closeManual;
    manualTitle.textContent = t.manualTitle;
    manualIntro.textContent = t.manualIntro;
    themeButton.textContent = currentTheme === "light" ? t.switchToDark : t.switchToLight;

    manualList.innerHTML = "";
    for (const step of t.manualSteps) {
      const li = document.createElement("li");
      li.textContent = step;
      manualList.append(li);
    }
  };

  const setLanguage = (language: Language): void => {
    currentLanguage = language;
    languageSelect.value = language;
    window.localStorage.setItem(LANGUAGE_KEY, language);
    updateTexts();
  };

  const setTheme = (theme: Theme): void => {
    currentTheme = theme;
    window.localStorage.setItem(THEME_KEY, theme);
    applyTheme();
    updateTexts();
  };

  languageSelect.value = currentLanguage;
  applyTheme();
  updateTexts();

  fileInput.addEventListener("change", async () => {
    const files = Array.from(fileInput.files ?? []);
    const reports: Array<Record<string, unknown>> = [];

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const text = decodeText(arrayBuffer, "shift_jis");
      const type = detectType(file.name, text);

      try {
        switch (type) {
          case "xml": {
            const model = parseBuildingModelXml(text);
            reports.push({
              file: file.name,
              type,
              ...summarizeBuildingModel(model)
            });
            break;
          }
          case "modal": {
            const modal = parseModalDat(text);
            reports.push({
              file: file.name,
              type,
              story: modal.baseShape.story ?? null,
              modeCount: modal.modal.frequenciesHz.length,
              firstFrequencyHz: modal.modal.frequenciesHz[0] ?? null
            });
            break;
          }
          case "complex": {
            const complex = parseComplexModalDat(text);
            reports.push({
              file: file.name,
              type,
              story: complex.baseShape.story ?? null,
              modeCount: complex.modes.length,
              firstFrequencyHz: complex.modes[0]?.frequencyHz ?? null
            });
            break;
          }
          case "resp": {
            const resp = parseRespCsv(text);
            reports.push({
              file: file.name,
              type,
              rows: resp.records.length,
              columns: resp.header.length,
              dt: resp.meta.dt
            });
            break;
          }
          case "json": {
            const xml = convertNiceJsonToBuildingModelXml(text);
            reports.push({
              file: file.name,
              type,
              convertedXmlLength: xml.length
            });
            latestXml = xml;
            xmlOutput.textContent = xml;
            break;
          }
          default:
            reports.push({
              file: file.name,
              type: "unknown",
              message: TEXTS[currentLanguage].unknownFormat
            });
            break;
        }
      } catch (error) {
        reports.push({
          file: file.name,
          type,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    summary.textContent = JSON.stringify(reports, null, 2);
  });

  convertButton.addEventListener("click", () => {
    try {
      latestXml = convertNiceJsonToBuildingModelXml(jsonInput.value);
      xmlOutput.textContent = latestXml;
    } catch (error) {
      xmlOutput.textContent = `${TEXTS[currentLanguage].convertErrorPrefix} ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  });

  downloadButton.addEventListener("click", () => {
    if (!latestXml) return;
    downloadText("converted_building_model.xml", latestXml);
  });

  languageSelect.addEventListener("change", () => {
    const nextLanguage: Language = languageSelect.value === "en" ? "en" : "ja";
    setLanguage(nextLanguage);
  });

  themeButton.addEventListener("click", () => {
    setTheme(currentTheme === "light" ? "dark" : "light");
  });

  manualButton.addEventListener("click", openManual);
  manualCloseButton.addEventListener("click", closeManual);

  manualModal.addEventListener("click", (event) => {
    if (event.target === manualModal) closeManual();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeManual();
  });
}

bootstrap();
