import "./style.css";
import { convertNiceJsonToBuildingModelXml } from "./io";
import { getUiText, normalizeLanguage, type Language, type UiText } from "./app/i18n";
import { processInputFile, type FileProcessingMessages } from "./app/fileProcessing";
import { createAppView } from "./app/view";

type Theme = "light" | "dark";

const LANGUAGE_KEY = "twist-dynamics-language";
const THEME_KEY = "twist-dynamics-theme";

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
  return normalizeLanguage(window.localStorage.getItem(LANGUAGE_KEY));
}

function loadTheme(): Theme {
  const saved = window.localStorage.getItem(THEME_KEY);
  return saved === "dark" ? "dark" : "light";
}

function bootstrap(): void {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) return;
  const view = createAppView(root);
  if (!view) return;

  let currentLanguage = loadLanguage();
  let currentTheme = loadTheme();
  let latestXml = "";

  const applyTheme = (): void => {
    document.documentElement.dataset.theme = currentTheme;
  };

  const closeManual = (): void => {
    view.manualModal.classList.add("hidden");
  };

  const openManual = (): void => {
    view.manualModal.classList.remove("hidden");
  };

  const getFileMessages = (text: UiText): FileProcessingMessages => {
    return {
      unknownFormat: text.unknownFormat,
      decodeErrorPrefix: text.decodeErrorPrefix,
      decodeUnsupportedAction: text.decodeUnsupportedAction
    };
  };

  const updateTexts = (): void => {
    const t = getUiText(currentLanguage);

    document.documentElement.lang = currentLanguage;
    view.heroTitle.textContent = t.heroTitle;
    view.heroDescription.textContent = t.heroDescription;
    view.parseCardTitle.textContent = t.parseCardTitle;
    view.convertCardTitle.textContent = t.convertCardTitle;
    view.fileInputLabel.textContent = t.fileInputLabel;
    view.convertButton.textContent = t.convertButton;
    view.downloadButton.textContent = t.downloadButton;
    view.jsonInput.placeholder = t.jsonPlaceholder;
    view.noteText.textContent = t.note;
    view.languageLabel.textContent = t.languageLabel;
    view.manualButton.textContent = t.openManual;
    view.manualCloseButton.textContent = t.closeManual;
    view.manualTitle.textContent = t.manualTitle;
    view.manualIntro.textContent = t.manualIntro;
    view.themeButton.textContent = currentTheme === "light" ? t.switchToDark : t.switchToLight;

    view.manualList.innerHTML = "";
    for (const step of t.manualSteps) {
      const li = document.createElement("li");
      li.textContent = step;
      view.manualList.append(li);
    }
  };

  const setLanguage = (language: Language): void => {
    currentLanguage = language;
    view.languageSelect.value = language;
    window.localStorage.setItem(LANGUAGE_KEY, language);
    updateTexts();
  };

  const setTheme = (theme: Theme): void => {
    currentTheme = theme;
    window.localStorage.setItem(THEME_KEY, theme);
    applyTheme();
    updateTexts();
  };

  view.languageSelect.value = currentLanguage;
  applyTheme();
  updateTexts();

  view.fileInput.addEventListener("change", async () => {
    const files = Array.from(view.fileInput.files ?? []);
    const reports: Array<Record<string, unknown>> = [];
    const t = getUiText(currentLanguage);

    for (const file of files) {
      const result = await processInputFile(file, getFileMessages(t));
      reports.push(result.report);
      if (result.generatedXml) {
        latestXml = result.generatedXml;
        view.xmlOutput.textContent = latestXml;
      }
    }

    view.summary.textContent = JSON.stringify(reports, null, 2);
  });

  view.convertButton.addEventListener("click", () => {
    const t = getUiText(currentLanguage);
    try {
      latestXml = convertNiceJsonToBuildingModelXml(view.jsonInput.value);
      view.xmlOutput.textContent = latestXml;
    } catch (error) {
      view.xmlOutput.textContent = `${t.convertErrorPrefix} ${error instanceof Error ? error.message : String(error)}`;
    }
  });

  view.downloadButton.addEventListener("click", () => {
    if (!latestXml) return;
    downloadText("converted_building_model.xml", latestXml);
  });

  view.languageSelect.addEventListener("change", () => {
    const nextLanguage: Language = view.languageSelect.value === "en" ? "en" : "ja";
    setLanguage(nextLanguage);
  });

  view.themeButton.addEventListener("click", () => {
    setTheme(currentTheme === "light" ? "dark" : "light");
  });

  view.manualButton.addEventListener("click", openManual);
  view.manualCloseButton.addEventListener("click", closeManual);

  view.manualModal.addEventListener("click", (event) => {
    if (event.target === view.manualModal) closeManual();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeManual();
  });
}

bootstrap();
