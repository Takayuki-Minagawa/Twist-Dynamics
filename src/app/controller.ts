import { getUiText, normalizeLanguage, type Language, type UiText } from "./i18n";
import {
  processInputFile,
  type FileProcessingMessages,
  type FileProcessingReport
} from "./fileProcessing";
import { createAppView, type AppView } from "./view";

type Theme = "light" | "dark";

const LANGUAGE_KEY = "twist-dynamics-language";
const THEME_KEY = "twist-dynamics-theme";

interface AppState {
  language: Language;
  theme: Theme;
}

function loadLanguage(): Language {
  return normalizeLanguage(window.localStorage.getItem(LANGUAGE_KEY));
}

function loadTheme(): Theme {
  const saved = window.localStorage.getItem(THEME_KEY);
  return saved === "dark" ? "dark" : "light";
}

function saveLanguage(language: Language): void {
  window.localStorage.setItem(LANGUAGE_KEY, language);
}

function saveTheme(theme: Theme): void {
  window.localStorage.setItem(THEME_KEY, theme);
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

function createFileMessages(text: UiText): FileProcessingMessages {
  return {
    unknownFormat: text.unknownFormat,
    xmlUnsupported: text.xmlUnsupported,
    formatErrorPrefix: text.formatErrorPrefix,
    decodeErrorPrefix: text.decodeErrorPrefix,
    decodeUnsupportedAction: text.decodeUnsupportedAction
  };
}

function applyLocalizedTexts(view: AppView, state: AppState): void {
  const t = getUiText(state.language);

  document.documentElement.lang = state.language;
  view.heroTitle.textContent = t.heroTitle;
  view.heroDescription.textContent = t.heroDescription;
  view.parseCardTitle.textContent = t.parseCardTitle;
  view.fileInputLabel.textContent = t.fileInputLabel;
  view.noteText.textContent = t.note;
  view.languageLabel.textContent = t.languageLabel;
  view.manualButton.textContent = t.openManual;
  view.manualCloseButton.textContent = t.closeManual;
  view.manualTitle.textContent = t.manualTitle;
  view.manualIntro.textContent = t.manualIntro;
  view.themeButton.textContent = state.theme === "light" ? t.switchToDark : t.switchToLight;

  view.manualList.innerHTML = "";
  for (const step of t.manualSteps) {
    const li = document.createElement("li");
    li.textContent = step;
    view.manualList.append(li);
  }
}

function bindManualModal(view: AppView): void {
  const closeManual = (): void => {
    view.manualModal.classList.add("hidden");
  };

  const openManual = (): void => {
    view.manualModal.classList.remove("hidden");
  };

  view.manualButton.addEventListener("click", openManual);
  view.manualCloseButton.addEventListener("click", closeManual);

  view.manualModal.addEventListener("click", (event) => {
    if (event.target === view.manualModal) closeManual();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeManual();
  });
}

function bindThemeAndLanguage(view: AppView, state: AppState): void {
  view.languageSelect.value = state.language;

  view.languageSelect.addEventListener("change", () => {
    const nextLanguage: Language = view.languageSelect.value === "en" ? "en" : "ja";
    state.language = nextLanguage;
    saveLanguage(nextLanguage);
    applyLocalizedTexts(view, state);
  });

  view.themeButton.addEventListener("click", () => {
    const nextTheme: Theme = state.theme === "light" ? "dark" : "light";
    state.theme = nextTheme;
    saveTheme(nextTheme);
    applyTheme(nextTheme);
    applyLocalizedTexts(view, state);
  });
}

function bindFileProcessing(view: AppView, state: AppState): void {
  view.fileInput.addEventListener("change", async () => {
    const files = Array.from(view.fileInput.files ?? []);
    const reports: FileProcessingReport[] = [];
    const t = getUiText(state.language);

    for (const file of files) {
      const result = await processInputFile(file, createFileMessages(t));
      reports.push(result.report);
    }

    view.summary.textContent = JSON.stringify(reports, null, 2);
  });
}

export function bootstrapApp(root: HTMLElement): void {
  const view = createAppView(root);
  if (!view) return;

  const state: AppState = {
    language: loadLanguage(),
    theme: loadTheme()
  };

  applyTheme(state.theme);
  applyLocalizedTexts(view, state);

  bindManualModal(view);
  bindThemeAndLanguage(view, state);
  bindFileProcessing(view, state);
}
