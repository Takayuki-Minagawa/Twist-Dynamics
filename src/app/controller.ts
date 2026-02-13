import {
  decodeTextWithMeta,
  FormatParseError,
  parseBuildingModelJson,
  parseBuildingModelXml,
  TextDecodingError
} from "../io";
import {
  buildModelFromEditorForm,
  createDefaultModelEditorFormData,
  modelEditorFormToJson,
  modelToEditorForm,
  type ModelEditorFormData
} from "./modelEditorState";
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
  generatedJson: string;
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
    formatErrorPrefix: text.formatErrorPrefix,
    decodeErrorPrefix: text.decodeErrorPrefix,
    decodeUnsupportedAction: text.decodeUnsupportedAction
  };
}

function getEditorFormData(view: AppView): ModelEditorFormData {
  return {
    massN: view.editorMassN.value,
    structType: view.editorStructType.value === "DX" ? "DX" : "R",
    zLevel: view.editorZLevel.value,
    weight: view.editorWeight.value,
    wMoment: view.editorWMoment.value,
    wCenter: view.editorWCenter.value,
    floors: view.editorFloors.value,
    columns: view.editorColumns.value,
    wallCharas: view.editorWallCharas.value,
    walls: view.editorWalls.value,
    massDampers: view.editorMassDampers.value,
    braceDampers: view.editorBraceDampers.value,
    dxPanels: view.editorDxPanels.value
  };
}

function setEditorFormData(view: AppView, formData: ModelEditorFormData): void {
  view.editorMassN.value = formData.massN;
  view.editorStructType.value = formData.structType;
  view.editorZLevel.value = formData.zLevel;
  view.editorWeight.value = formData.weight;
  view.editorWMoment.value = formData.wMoment;
  view.editorWCenter.value = formData.wCenter;
  view.editorFloors.value = formData.floors;
  view.editorColumns.value = formData.columns;
  view.editorWallCharas.value = formData.wallCharas;
  view.editorWalls.value = formData.walls;
  view.editorMassDampers.value = formData.massDampers;
  view.editorBraceDampers.value = formData.braceDampers;
  view.editorDxPanels.value = formData.dxPanels;
}

function setEditorPreview(view: AppView, state: AppState, text: string): void {
  state.generatedJson = text;
  view.editorPreview.textContent = text;
}

function applyLocalizedTexts(view: AppView, state: AppState): void {
  const t = getUiText(state.language);

  document.documentElement.lang = state.language;
  view.heroTitle.textContent = t.heroTitle;
  view.heroDescription.textContent = t.heroDescription;
  view.parseCardTitle.textContent = t.parseCardTitle;
  view.parseResultTitle.textContent = t.parseResultTitle;
  view.fileInputLabel.textContent = t.fileInputLabel;
  view.noteText.textContent = t.note;
  view.languageLabel.textContent = t.languageLabel;
  view.manualButton.textContent = t.openManual;
  view.manualCloseButton.textContent = t.closeManual;
  view.manualTitle.textContent = t.manualTitle;
  view.manualIntro.textContent = t.manualIntro;
  view.themeButton.textContent = state.theme === "light" ? t.switchToDark : t.switchToLight;

  view.editorCardTitle.textContent = t.editorCardTitle;
  view.editorMassNLabel.textContent = t.editorMassNLabel;
  view.editorStructTypeLabel.textContent = t.editorStructTypeLabel;
  view.editorZLevelLabel.textContent = t.editorZLevelLabel;
  view.editorWeightLabel.textContent = t.editorWeightLabel;
  view.editorWMomentLabel.textContent = t.editorWMomentLabel;
  view.editorWCenterLabel.textContent = t.editorWCenterLabel;
  view.editorFloorsLabel.textContent = t.editorFloorsLabel;
  view.editorColumnsLabel.textContent = t.editorColumnsLabel;
  view.editorWallCharasLabel.textContent = t.editorWallCharasLabel;
  view.editorWallsLabel.textContent = t.editorWallsLabel;
  view.editorMassDampersLabel.textContent = t.editorMassDampersLabel;
  view.editorBraceDampersLabel.textContent = t.editorBraceDampersLabel;
  view.editorDxPanelsLabel.textContent = t.editorDxPanelsLabel;
  view.editorPreviewTitle.textContent = t.editorPreviewTitle;
  view.editorBuildButton.textContent = t.editorBuildButton;
  view.editorDownloadButton.textContent = t.editorDownloadButton;
  view.editorImportLabel.textContent = t.editorImportLabel;
  view.editorHint.textContent = t.editorHint;

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

async function readFileAsText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const decoded = decodeTextWithMeta(arrayBuffer, "shift_jis");
  return decoded.text;
}

function parseModelText(fileName: string, text: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".xml") || text.trimStart().startsWith("<")) {
    return parseBuildingModelXml(text);
  }
  return parseBuildingModelJson(text);
}

async function importModelToEditor(
  file: File,
  view: AppView,
  state: AppState,
  silent = false
): Promise<void> {
  try {
    const text = await readFileAsText(file);
    const model = parseModelText(file.name, text);
    setEditorFormData(view, modelToEditorForm(model));
    setEditorPreview(view, state, modelEditorFormToJson(getEditorFormData(view)));
  } catch (error) {
    if (!silent) {
      const prefix = getUiText(state.language).formatErrorPrefix;
      const message = error instanceof Error ? error.message : String(error);
      view.editorPreview.textContent = `${prefix} ${message}`;
    }
  }
}

function downloadJson(fileName: string, content: string): void {
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

function bindEditor(view: AppView, state: AppState): void {
  setEditorFormData(view, createDefaultModelEditorFormData());

  view.editorBuildButton.addEventListener("click", () => {
    try {
      setEditorPreview(view, state, modelEditorFormToJson(getEditorFormData(view)));
    } catch (error) {
      const prefix = getUiText(state.language).formatErrorPrefix;
      const message = error instanceof Error ? error.message : String(error);
      view.editorPreview.textContent = `${prefix} ${message}`;
    }
  });

  view.editorDownloadButton.addEventListener("click", () => {
    try {
      const json = state.generatedJson || modelEditorFormToJson(getEditorFormData(view));
      setEditorPreview(view, state, json);
      downloadJson("building-model.json", json);
    } catch (error) {
      const prefix = getUiText(state.language).formatErrorPrefix;
      const message = error instanceof Error ? error.message : String(error);
      view.editorPreview.textContent = `${prefix} ${message}`;
    }
  });

  view.editorImportInput.addEventListener("change", async () => {
    const file = view.editorImportInput.files?.[0];
    if (!file) return;
    await importModelToEditor(file, view, state);
  });

  try {
    setEditorPreview(view, state, modelEditorFormToJson(getEditorFormData(view)));
  } catch {
    setEditorPreview(view, state, "");
  }
}

function bindFileProcessing(view: AppView, state: AppState): void {
  view.fileInput.addEventListener("change", async () => {
    const files = Array.from(view.fileInput.files ?? []);
    const reports: FileProcessingReport[] = [];
    const t = getUiText(state.language);

    for (const file of files) {
      const result = await processInputFile(file, createFileMessages(t));
      reports.push(result.report);

      if (result.kind === "success" && (result.report.type === "json" || result.report.type === "xml")) {
        await importModelToEditor(file, view, state, true);
      }
    }

    view.summary.textContent = JSON.stringify(reports, null, 2);
  });
}

export function bootstrapApp(root: HTMLElement): void {
  const view = createAppView(root);
  if (!view) return;

  const state: AppState = {
    language: loadLanguage(),
    theme: loadTheme(),
    generatedJson: ""
  };

  applyTheme(state.theme);
  applyLocalizedTexts(view, state);

  bindManualModal(view);
  bindThemeAndLanguage(view, state);
  bindEditor(view, state);
  bindFileProcessing(view, state);
}
