import type {
  BuildingModel,
  ComplexModalFile,
  ModalDatFile,
  RespFile
} from "../core/types";
import {
  analyzeRealEigen,
  calculatePeakResponseProfile,
  calculateStorySummaries,
  createDefaultResponseSeries,
  serializeStorySummariesCsv,
  type ResponseSeries,
  type StoryPeakResponse,
  type StorySummary
} from "../core/analysis";
import {
  decodeTextWithMeta,
  parseBuildingModelJsonWithMeta,
  parseBuildingModelXmlWithMeta,
  parseComplexModalDat,
  parseModalDat,
  parseRespCsv,
  serializeBuildingModelJson,
  type BuildingModelParseResult
} from "../io";
import {
  buildResponseSeries,
  extractComplexMode,
  extractRealMode,
  ThreeViewer,
  VISUALIZATION_CATEGORIES,
  type VisualizationCategory
} from "../viz";
import {
  buildModelFromEditorDraft,
  cloneModelEditorDraft,
  createDefaultModelEditorDraft,
  modelToEditorDraft,
  validateModelEditorDraft,
  type ModelEditorDraft
} from "./modelEditorState";
import {
  MODEL_EDITOR_SECTION_IDS,
  createEmptyEditorRow,
  getEditorTableSchema,
  getLocalizedText,
  getLocalizedValidationMessage,
  type EditorLocale,
  type EditorSectionId
} from "./modelEditorSchema";
import {
  createTableEditor,
  type TableEditorController,
  type TableEditorLabels
} from "./tableEditor";
import { getUiText, normalizeLanguage, type Language, type UiText } from "./i18n";
import {
  detectFileType,
  localizeBuildingModelWarning,
  processInputFile,
  type FileProcessingMessages,
  type FileProcessingReport
} from "./fileProcessing";
import { renderPlanPreview } from "./planPreview";
import {
  normalizePeakProfileMetric,
  renderPeakProfileChart,
  renderTimeSeriesChart
} from "./responseCharts";
import { createAppView, type AppView } from "./view";

type Theme = "light" | "dark";
type ViewerMode = "static" | "real" | "complex" | "response";

const LANGUAGE_KEY = "twist-dynamics-language";
const THEME_KEY = "twist-dynamics-theme";

interface AppState {
  language: Language;
  theme: Theme;
  draft: ModelEditorDraft;
  model: BuildingModel | null;
  generatedJson: string;
  storySummaries: StorySummary[];
  generatedModal: ModalDatFile | null;
  loadedModal: ModalDatFile | null;
  complex: ComplexModalFile | null;
  response: RespFile | null;
  responseSeries: ResponseSeries[];
  responseProfile: StoryPeakResponse[];
  resultError: unknown | null;
  viewer: ThreeViewer | null;
  editors: Partial<Record<EditorSectionId, TableEditorController>>;
  applyingDraft: boolean;
  refreshTimer: number | null;
  storyResizeTimer: number | null;
  modelInputValid: boolean;
  categoryVisibility: Map<VisualizationCategory, boolean>;
  storyVisibility: Map<number, boolean>;
  fileRequests: {
    general: number;
    model: number;
    result: number;
  };
}

function loadLanguage(): Language {
  return normalizeLanguage(window.localStorage.getItem(LANGUAGE_KEY));
}

function loadTheme(): Theme {
  return window.localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

function createFileMessages(text: UiText): FileProcessingMessages {
  return {
    unknownFormat: text.unknownFormat,
    formatErrorPrefix: text.formatErrorPrefix,
    decodeErrorPrefix: text.decodeErrorPrefix,
    decodeUnsupportedAction: text.decodeUnsupportedAction,
    legacyStructTypeIgnored: text.legacyStructTypeIgnored,
    legacyDxPanelsConverted: text.legacyDxPanelsConverted
  };
}

function editorLabels(locale: EditorLocale): Partial<TableEditorLabels> {
  return locale === "ja"
    ? {
        addRow: "行を追加",
        deleteRow: "削除",
        actions: "操作",
        bulkSummary: "一括貼付け（CSV / Excel TSV）",
        bulkHint: "CSV、または表計算ソフトからコピーしたタブ区切り行を貼り付けます。",
        applyBulk: "貼付けを表へ反映",
        copyFromTable: "表の内容に戻す"
      }
    : {
        addRow: "Add row",
        deleteRow: "Delete",
        actions: "Actions",
        bulkSummary: "Bulk paste (CSV / spreadsheet TSV)",
        bulkHint: "Paste CSV or tab-separated rows copied from a spreadsheet.",
        applyBulk: "Apply pasted rows",
        copyFromTable: "Reset from table"
      };
}

function setEditorStatus(view: AppView, message: string, valid: boolean | null): void {
  view.editorStatus.textContent = message;
  view.editorStatus.classList.toggle("is-valid", valid === true);
  view.editorStatus.classList.toggle("is-invalid", valid === false);
}

function invalidatePendingFileReads(state: AppState): void {
  state.fileRequests.general++;
  state.fileRequests.model++;
  state.fileRequests.result++;
}

function localizeGeneralIssue(message: string, language: Language): string {
  if (language === "en") return message;
  const translations: Record<string, string> = {
    "Base Z level must be a finite number.": "基準レベル Z には有限の数値を入力してください。",
    "The first story top Z level must be greater than or equal to base Z.":
      "1階上端 Z レベルは基準レベル Z 以上にしてください。",
    "At least one story row is required.": "階情報を1行以上入力してください。"
  };
  return translations[message] ?? message;
}

function localizeViewerError(error: unknown, language: Language): string {
  const message = error instanceof Error ? error.message : String(error);
  if (language === "en") return message;
  const storyMismatch = message.match(
    /^(Modal|Complex|Response) result has (\d+) stories; model has (\d+)\.$/
  );
  if (storyMismatch) {
    const resultName = storyMismatch[1] === "Modal"
      ? "実固有値結果"
      : storyMismatch[1] === "Complex"
        ? "複素固有値結果"
        : "時刻歴応答結果";
    return `${resultName}は${storyMismatch[2]}層ですが、モデルは${storyMismatch[3]}層です。`;
  }
  if (message === "Select a Modal/ComplexModal DAT or RespResult CSV file.") {
    return "実固有値・複素固有値 DAT、または時刻歴応答 CSV を選択してください。";
  }
  const exactMessages: Record<string, string> = {
    "Correct the model input before loading an analysis result.":
      "解析結果を読み込む前に、モデル入力のエラーを修正してください。",
    "Modal result contains no modes.": "実固有値結果にモードがありません。",
    "Complex result contains no modes.": "複素固有値結果にモードがありません。",
    "Response story count is missing.": "時刻歴応答結果に階数情報がありません。",
    "Response result contains no records.": "時刻歴応答結果に時刻歴データがありません。",
    "Response result is missing a Time(s) column.":
      "時刻歴応答結果に Time(s) 列がありません。",
    "Response times must be monotonic non-decreasing.":
      "時刻歴応答の時刻列は単調非減少にしてください。",
    "Selected real mode has no positive finite frequency.":
      "選択した実固有モードに正の有限な振動数がありません。",
    "Selected complex mode has no positive frequency.":
      "選択した複素固有モードに正の振動数がありません。"
  };
  if (exactMessages[message]) return exactMessages[message];
  const responseMetadataMismatch = message.match(
    /^Response story count mismatch: BaseShape has (\d+), metadata has (\d+)\.$/
  );
  if (responseMetadataMismatch) {
    return `時刻歴応答の階数が一致しません。BaseShape は${responseMetadataMismatch[1]}層、メタデータは${responseMetadataMismatch[2]}層です。`;
  }
  const invalidStoryCount = message.match(
    /^Response (BaseShape story count|mass count) must be a positive integer\.$/
  );
  if (invalidStoryCount) {
    const label = invalidStoryCount[1] === "mass count" ? "質点数" : "BaseShape の階数";
    return `時刻歴応答の${label}は正の整数にしてください。`;
  }
  const missingComponent = message.match(
    /^(Modal|Complex|Response) result is missing (.+) for story (\d+)\.$/
  );
  if (missingComponent) {
    const resultName = missingComponent[1] === "Modal"
      ? "実固有値結果"
      : missingComponent[1] === "Complex"
        ? "複素固有値結果"
        : "時刻歴応答結果";
    return `${resultName}の${missingComponent[3]}階に ${missingComponent[2]} 成分がありません。`;
  }
  const modeIndex = message.match(/^modeIndex must be between (\d+) and (\d+)\.$/);
  if (modeIndex) {
    return `モード番号は${modeIndex[1]}から${modeIndex[2]}の範囲で指定してください。`;
  }
  return message;
}

function formatNumber(value: number | null, digits = 4): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  if (Math.abs(value) >= 1e5 || Math.abs(value) < 1e-3) return value.toExponential(3);
  const locale = document.documentElement.lang === "ja" ? "ja-JP" : "en-US";
  return value.toLocaleString(locale, { maximumFractionDigits: digits });
}

function applyLocalizedTexts(view: AppView, state: AppState): void {
  const text = getUiText(state.language);
  document.documentElement.lang = state.language;
  view.languageSelect.value = state.language;
  view.languageLabel.textContent = text.languageLabel;
  view.themeButton.textContent = state.theme === "light" ? text.switchToDark : text.switchToLight;
  view.manualButton.textContent = text.openManual;
  view.manualCloseButton.textContent = text.closeManual;
  view.manualTitle.textContent = text.manualTitle;
  view.manualIntro.textContent = text.manualIntro;
  view.heroTitle.textContent = text.heroTitle;
  view.heroDescription.textContent = text.heroDescription;
  view.parseResultTitle.textContent = text.parseResultTitle;
  view.fileInputLabel.textContent = text.fileInputLabel;
  view.noteText.textContent = text.note;
  view.editorCardTitle.textContent = text.editorCardTitle;
  view.editorMassNLabel.textContent = text.editorMassNLabel;
  view.editorBaseZLabel.textContent = text.editorBaseZLabel;
  view.editorBuildButton.textContent = text.editorBuildButton;
  view.editorDownloadButton.textContent = text.editorDownloadButton;
  view.editorImportLabel.textContent = text.editorImportLabel;
  view.editorHint.textContent = text.editorHint;
  view.editorPreviewTitle.textContent = text.editorPreviewTitle;
  view.storyCsvButton.textContent = text.storyCsvButton;
  view.planTitle.textContent = text.planTitle;
  view.planLayerLabel.textContent = text.planLayerLabel;
  view.planCanvas.setAttribute("aria-label", text.planCanvasLabel);
  view.storySummaryTitle.textContent = text.storySummaryTitle;
  view.viewerTitle.textContent = text.viewerTitle;
  view.viewerModeLabel.textContent = text.viewerModeLabel;
  view.viewerModeIndexLabel.textContent = text.viewerModeIndexLabel;
  view.viewerSeek.setAttribute("aria-label", text.viewerSeekLabel);
  state.viewer?.renderer.domElement.setAttribute("aria-label", text.viewerCanvasLabel);
  if (view.viewerContainer.dataset.viewerUnavailable === "true") {
    view.viewerContainer.textContent = text.viewerUnavailable;
    view.viewerContainer.setAttribute("aria-label", text.viewerUnavailable);
  }
  view.viewerScaleLabel.textContent = text.viewerScaleLabel;
  view.viewerRotationLabel.textContent = text.viewerRotationLabel;
  view.viewerSpeedLabel.textContent = text.viewerSpeedLabel;
  view.viewerResetButton.textContent = text.viewerReset;
  view.resultInputLabel.textContent = text.resultInputLabel;
  view.responseTitle.textContent = text.responseTitle;
  view.responseProfileMetricLabel.textContent = text.responseProfileMetricLabel;
  view.responseWaveCanvas.setAttribute("aria-label", text.responseWaveCanvasLabel);
  for (const [value, label] of Object.entries(text.responseProfileMetricOptions)) {
    const option = view.responseProfileMetricSelect.querySelector<HTMLOptionElement>(
      `option[value="${value}"]`
    );
    if (option) option.textContent = label;
  }
  const applyHeaders = (body: HTMLTableSectionElement, labels: readonly string[]): void => {
    const headers = body.closest("table")?.querySelectorAll("thead th") ?? [];
    headers.forEach((header, index) => {
      header.textContent = labels[index] ?? "";
    });
  };
  applyHeaders(view.storySummaryBody, text.storySummaryHeaders);
  applyHeaders(view.responseTableBody, text.responseHeaders);
  for (const [value, label] of Object.entries(text.viewerModeOptions)) {
    const option = view.viewerModeSelect.querySelector<HTMLOptionElement>(`option[value="${value}"]`);
    if (option) option.textContent = label;
  }
  const playback = state.viewer?.getPlaybackState();
  view.viewerPlayButton.textContent = playback?.playing ? text.viewerPause : text.viewerPlay;

  view.manualList.replaceChildren(
    ...text.manualSteps.map((step) => {
      const item = document.createElement("li");
      item.textContent = step;
      return item;
    })
  );
  for (const editor of Object.values(state.editors)) {
    editor?.setLocale(state.language, editorLabels(state.language));
  }
}

function bindManualModal(view: AppView): () => void {
  const appShell = view.manualModal.previousElementSibling as HTMLElement | null;
  let restoreFocus: HTMLElement | null = null;
  const close = (): void => {
    if (view.manualModal.classList.contains("hidden")) return;
    view.manualModal.classList.add("hidden");
    if (appShell) appShell.inert = false;
    restoreFocus?.focus();
    restoreFocus = null;
  };
  const open = (): void => {
    restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    view.manualModal.classList.remove("hidden");
    if (appShell) appShell.inert = true;
    view.manualCloseButton.focus();
  };
  view.manualButton.addEventListener("click", open);
  view.manualCloseButton.addEventListener("click", close);
  view.manualModal.addEventListener("click", (event) => {
    if (event.target === view.manualModal) close();
  });
  const onKeyDown = (event: KeyboardEvent): void => {
    if (view.manualModal.classList.contains("hidden")) return;
    if (event.key === "Escape") close();
    if (event.key === "Tab") {
      event.preventDefault();
      view.manualCloseButton.focus();
    }
  };
  document.addEventListener("keydown", onKeyDown);
  return () => {
    document.removeEventListener("keydown", onKeyDown);
    if (appShell) appShell.inert = false;
  };
}

function downloadText(fileName: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

async function readFileAsText(file: File): Promise<string> {
  const decoded = decodeTextWithMeta(await file.arrayBuffer(), "shift_jis");
  return decoded.text;
}

function parseModelText(fileName: string, text: string): BuildingModelParseResult {
  const isXml = fileName.toLowerCase().endsWith(".xml") || text.trimStart().startsWith("<");
  return isXml ? parseBuildingModelXmlWithMeta(text) : parseBuildingModelJsonWithMeta(text);
}

function tableHost(view: AppView, section: EditorSectionId): HTMLElement {
  const hosts: Record<EditorSectionId, HTMLElement> = {
    stories: view.storyEditor,
    floors: view.floorsEditor,
    columns: view.columnsEditor,
    wallCharas: view.wallCharasEditor,
    walls: view.wallsEditor,
    massDampers: view.massDampersEditor,
    braceDampers: view.braceDampersEditor
  };
  return hosts[section];
}

function refreshWallOptions(state: AppState): void {
  state.editors.walls?.refresh();
}

function syncDraftFromEditors(view: AppView, state: AppState): void {
  state.draft.baseZ = view.editorBaseZ.value;
  for (const section of MODEL_EDITOR_SECTION_IDS) {
    const rows = state.editors[section]?.getRows();
    if (rows) state.draft.rows[section] = rows;
  }
  view.editorMassN.value = String(state.draft.rows.stories.length);
}

function applyDraftToEditors(view: AppView, state: AppState, draft: ModelEditorDraft): void {
  state.applyingDraft = true;
  state.draft = cloneModelEditorDraft(draft);
  view.editorBaseZ.value = state.draft.baseZ;
  view.editorMassN.value = String(state.draft.rows.stories.length);
  for (const section of MODEL_EDITOR_SECTION_IDS) {
    state.editors[section]?.setRows(state.draft.rows[section], "api");
  }
  refreshWallOptions(state);
  state.applyingDraft = false;
}

function resizeStoryDraft(view: AppView, state: AppState, requested: number): void {
  if (!Number.isInteger(requested) || requested < 1) return;
  const stories = state.editors.stories?.getRows() ?? state.draft.rows.stories;
  while (stories.length < requested) {
    const prior = stories[stories.length - 1];
    const row = createEmptyEditorRow("stories", stories.length);
    if (prior) {
      const priorZ = Number(prior.zLevel);
      row.zLevel = Number.isFinite(priorZ) ? String(priorZ + 300) : "";
      row.weight = prior.weight;
      row.wMoment = prior.wMoment;
      row.centerX = prior.centerX;
      row.centerY = prior.centerY;
    }
    stories.push(row);
  }
  stories.splice(requested);
  state.editors.stories?.setRows(stories, "api");

  const floors = state.editors.floors?.getRows() ?? state.draft.rows.floors;
  const desiredFloors = requested + 1;
  while (floors.length < desiredFloors) {
    const prior = floors[floors.length - 1];
    floors.push({
      layer: String(floors.length + 1),
      points: prior?.points ?? "0,0,0,500,1000,500,1000,0"
    });
  }
  for (let index = 0; index < floors.length; index++) floors[index].layer = String(index + 1);
  state.editors.floors?.setRows(floors.slice(0, desiredFloors), "api");
  syncDraftFromEditors(view, state);
}

function populatePlanLayers(view: AppView, storyCount: number): void {
  const previous = Number(view.planLayerSelect.value) || 1;
  view.planLayerSelect.replaceChildren(
    ...Array.from({ length: storyCount }, (_, index) => {
      const option = document.createElement("option");
      option.value = String(index + 1);
      option.textContent = String(index + 1);
      return option;
    })
  );
  view.planLayerSelect.value = String(Math.min(Math.max(previous, 1), storyCount));
}

function renderStorySummary(view: AppView, summaries: StorySummary[]): void {
  view.storySummaryBody.replaceChildren(
    ...summaries.map((summary) => {
      const row = document.createElement("tr");
      const values = [
        String(summary.layer),
        formatNumber(summary.kxx),
        formatNumber(summary.kyy),
        formatNumber(summary.stiffnessCenter.x),
        formatNumber(summary.stiffnessCenter.y),
        formatNumber(summary.eccentricityRatioX),
        formatNumber(summary.eccentricityRatioY),
        formatNumber(summary.relativeSpecificStiffnessX),
        formatNumber(summary.relativeSpecificStiffnessY)
      ];
      row.replaceChildren(
        ...values.map((value) => {
          const cell = document.createElement("td");
          cell.textContent = value;
          return cell;
        })
      );
      return row;
    })
  );
}

function renderPlan(view: AppView, state: AppState): void {
  if (!state.model || !state.modelInputValid) {
    view.planCanvas.getContext("2d")?.clearRect(0, 0, view.planCanvas.width, view.planCanvas.height);
    return;
  }
  const layer = Number(view.planLayerSelect.value) || 1;
  const text = getUiText(state.language);
  renderPlanPreview(
    view.planCanvas,
    state.model,
    layer,
    state.storySummaries.find((summary) => summary.layer === layer),
    {
      story: text.planStoryLabel,
      massCenter: text.massCenterLabel,
      stiffnessCenter: text.stiffnessCenterLabel
    }
  );
}

function setResponseResult(state: AppState, response: RespFile | null): void {
  const series = response ? createDefaultResponseSeries(response) : [];
  const profile = response ? calculatePeakResponseProfile(response) : [];
  state.response = response;
  state.responseSeries = series;
  state.responseProfile = profile;
}

function renderResponse(view: AppView, state: AppState): void {
  const text = getUiText(state.language);
  const profileMetric = normalizePeakProfileMetric(view.responseProfileMetricSelect.value);
  const profileOptions = {
    metric: profileMetric,
    seriesLabels: text.responseProfileSeriesLabels
  };
  view.responseProfileCanvas.setAttribute(
    "aria-label",
    `${text.responseProfileCanvasLabel}: ${text.responseProfileMetricOptions[profileMetric]}`
  );
  const chartLabels = {
    noSeries: text.chartNoSeries,
    noPeak: text.chartNoPeak,
    story: text.chartStory
  };
  if (!state.response || !state.modelInputValid) {
    renderTimeSeriesChart(view.responseWaveCanvas, [], chartLabels);
    renderPeakProfileChart(view.responseProfileCanvas, [], chartLabels, profileOptions);
    view.responseTableBody.replaceChildren();
    return;
  }
  renderTimeSeriesChart(
    view.responseWaveCanvas,
    state.responseSeries,
    chartLabels
  );
  renderPeakProfileChart(
    view.responseProfileCanvas,
    state.responseProfile,
    chartLabels,
    profileOptions
  );
  view.responseTableBody.replaceChildren(
    ...state.responseProfile.map((item) => {
      const row = document.createElement("tr");
      const values = [
        String(item.layer),
        formatNumber(item.maxDisplacementX),
        formatNumber(item.maxDisplacementY),
        formatNumber(item.maxRotationZ),
        formatNumber(item.maxInterstoryDriftX),
        formatNumber(item.maxInterstoryDriftY),
        formatNumber(item.maxAccelerationX),
        formatNumber(item.maxAccelerationY)
      ];
      row.replaceChildren(
        ...values.map((value) => {
          const cell = document.createElement("td");
          cell.textContent = value;
          return cell;
        })
      );
      return row;
    })
  );
}

function rebuildVisibilityControls(view: AppView, state: AppState): void {
  if (!state.viewer || !state.model?.structInfo || !state.modelInputValid) return;
  const text = getUiText(state.language);
  for (const category of VISUALIZATION_CATEGORIES) {
    if (!state.categoryVisibility.has(category)) state.categoryVisibility.set(category, true);
    state.viewer.setCategoryVisible(category, state.categoryVisibility.get(category) ?? true);
  }
  for (const story of Array.from(state.storyVisibility.keys())) {
    if (story > state.model.structInfo.massN) state.storyVisibility.delete(story);
  }
  for (let story = 1; story <= state.model.structInfo.massN; story++) {
    if (!state.storyVisibility.has(story)) state.storyVisibility.set(story, true);
    state.viewer.setStoryVisible(story, state.storyVisibility.get(story) ?? true);
  }
  view.viewerCategories.replaceChildren(
    ...VISUALIZATION_CATEGORIES.map((category) => {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = state.categoryVisibility.get(category) ?? true;
      checkbox.addEventListener("change", () => {
        state.categoryVisibility.set(category, checkbox.checked);
        state.viewer?.setCategoryVisible(category, checkbox.checked);
      });
      label.append(checkbox, document.createTextNode(text.viewerCategoryLabels[category] ?? category));
      return label;
    })
  );
  view.viewerStories.replaceChildren(
    ...Array.from({ length: state.model.structInfo.massN }, (_, index) => {
      const story = index + 1;
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = state.storyVisibility.get(story) ?? true;
      checkbox.addEventListener("change", () => {
        state.storyVisibility.set(story, checkbox.checked);
        state.viewer?.setStoryVisible(story, checkbox.checked);
      });
      label.append(checkbox, document.createTextNode(`${text.storyPrefix} ${story}`));
      return label;
    })
  );
}

function viewerMode(view: AppView): ViewerMode {
  const value = view.viewerModeSelect.value;
  return value === "real" || value === "complex" || value === "response" ? value : "static";
}

function activeRealModal(state: AppState): ModalDatFile | null {
  return state.loadedModal ?? state.generatedModal;
}

function populateModeIndices(view: AppView, state: AppState): void {
  const mode = viewerMode(view);
  const text = getUiText(state.language);
  const realModal = activeRealModal(state);
  const count = mode === "real"
    ? realModal?.modal.frequenciesHz.length ?? 0
    : mode === "complex"
      ? state.complex?.modes.length ?? 0
      : 0;
  const previous = Number(view.viewerModeIndexSelect.value) || 0;
  view.viewerModeIndexSelect.replaceChildren(
    ...Array.from({ length: count }, (_, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      const frequency = mode === "real"
        ? realModal?.modal.frequenciesHz[index]
        : state.complex?.modes[index]?.frequencyHz;
      option.textContent = `${text.modePrefix} ${index + 1}${frequency ? ` — ${frequency.toFixed(3)} Hz` : ""}`;
      return option;
    })
  );
  view.viewerModeIndexSelect.disabled = count === 0;
  if (count > 0) view.viewerModeIndexSelect.value = String(Math.min(previous, count - 1));
}

function applyViewerMode(view: AppView, state: AppState): void {
  const viewer = state.viewer;
  if (!viewer || !state.model) return;
  const mode = viewerMode(view);
  const realModal = activeRealModal(state);
  populateModeIndices(view, state);
  const index = Number(view.viewerModeIndexSelect.value) || 0;
  try {
    if (mode === "real" && realModal) viewer.setRealMode(realModal, index);
    else if (mode === "complex" && state.complex) viewer.setComplexMode(state.complex, index);
    else if (mode === "response" && state.response) viewer.setResponse(state.response);
    else viewer.setStatic();
    view.viewerPlayButton.disabled = viewer.getPlaybackState().kind === "static";
  } catch (error) {
    viewer.setStatic();
    view.viewerPlayButton.disabled = true;
    state.resultError = error;
    setEditorStatus(view, localizeViewerError(error, state.language), false);
  }
}

function updateModelDerivedViews(view: AppView, state: AppState): void {
  if (!state.model?.structInfo) return;
  populatePlanLayers(view, state.model.structInfo.massN);
  renderStorySummary(view, state.storySummaries);
  renderPlan(view, state);
  if (state.viewer) {
    state.viewer.setModel(state.model, state.storySummaries);
    rebuildVisibilityControls(view, state);
    applyViewerMode(view, state);
  }
}

function clearDerivedViewsForInvalidInput(view: AppView, state: AppState): void {
  state.storySummaries = [];
  view.editorPreview.textContent = "";
  view.storySummaryBody.replaceChildren();
  view.planLayerSelect.replaceChildren();
  view.viewerCategories.replaceChildren();
  view.viewerStories.replaceChildren();
  view.viewerModeIndexSelect.replaceChildren();
  view.viewerModeIndexSelect.disabled = true;
  view.viewerPlayButton.disabled = true;
  view.viewerSeek.value = "0";
  state.viewer?.clearModel();
  renderPlan(view, state);
  renderResponse(view, state);
}

function refreshModel(view: AppView, state: AppState, showSuccess = false): boolean {
  state.resultError = null;
  syncDraftFromEditors(view, state);
  const validation = validateModelEditorDraft(state.draft);
  if (validation.issues.length > 0 || validation.generalIssues.length > 0) {
    state.generatedJson = "";
    state.modelInputValid = false;
    state.loadedModal = null;
    state.complex = null;
    setResponseResult(state, null);
    clearDerivedViewsForInvalidInput(view, state);
    const messages = [
      ...validation.generalIssues.map((message) => localizeGeneralIssue(message, state.language)),
      ...validation.issues.slice(0, 6).map((issue) =>
        `${getLocalizedText(getEditorTableSchema(issue.section).label, state.language)}${
          issue.rowIndex === null
            ? ""
            : state.language === "ja"
              ? ` ${issue.rowIndex + 1}行目`
              : ` row ${issue.rowIndex + 1}`
        }: ${getLocalizedValidationMessage(issue, state.language)}`
      )
    ];
    setEditorStatus(view, `${getUiText(state.language).editorInvalid}\n${messages.join("\n")}`, false);
    return false;
  }

  try {
    const model = buildModelFromEditorDraft(state.draft);
    const summaries = calculateStorySummaries(model);
    const analyzed = analyzeRealEigen(model);
    const nextJson = serializeBuildingModelJson(model);
    const previousJson = state.model ? serializeBuildingModelJson(state.model) : "";
    const modelChanged = previousJson.length > 0 && previousJson !== nextJson;
    const shouldShowSuccess = showSuccess || view.editorStatus.classList.contains("is-invalid");
    if (modelChanged) {
      state.loadedModal = null;
      state.complex = null;
      setResponseResult(state, null);
      renderResponse(view, state);
      if (viewerMode(view) === "complex" || viewerMode(view) === "response") {
        view.viewerModeSelect.value = "real";
      }
    }
    state.model = model;
    state.generatedJson = nextJson;
    state.storySummaries = summaries;
    state.generatedModal = analyzed.modal;
    state.modelInputValid = true;
    view.editorPreview.textContent = state.generatedJson;
    if (shouldShowSuccess) setEditorStatus(view, getUiText(state.language).editorValid, true);
    updateModelDerivedViews(view, state);
    return true;
  } catch (error) {
    state.generatedJson = "";
    state.modelInputValid = false;
    state.loadedModal = null;
    state.complex = null;
    setResponseResult(state, null);
    clearDerivedViewsForInvalidInput(view, state);
    const message = error instanceof Error ? error.message : String(error);
    setEditorStatus(view, `${getUiText(state.language).formatErrorPrefix} ${message}`, false);
    return false;
  }
}

function scheduleModelRefresh(view: AppView, state: AppState): void {
  state.generatedJson = "";
  if (state.refreshTimer !== null) window.clearTimeout(state.refreshTimer);
  state.refreshTimer = window.setTimeout(() => {
    state.refreshTimer = null;
    refreshModel(view, state, false);
  }, 180);
}

function createEditors(view: AppView, state: AppState): void {
  for (const section of MODEL_EDITOR_SECTION_IDS) {
    state.editors[section] = createTableEditor({
      root: tableHost(view, section),
      section,
      rows: state.draft.rows[section],
      locale: state.language,
      labels: editorLabels(state.language),
      getValidationContext: () => ({
        storyCount: state.draft.rows.stories.length,
        wallCharaNames: state.draft.rows.wallCharas.map((row) => row.name ?? "")
      }),
      onChange: (change) => {
        state.draft.rows[section] = change.rows;
        view.editorMassN.value = String(state.draft.rows.stories.length);
        if (section === "wallCharas") refreshWallOptions(state);
        if (section === "stories" && change.source !== "cell") {
          for (const editor of Object.values(state.editors)) editor?.refresh();
        }
        if (!state.applyingDraft) {
          state.resultError = null;
          invalidatePendingFileReads(state);
          scheduleModelRefresh(view, state);
        }
      }
    });
  }
}

async function importModelToEditor(
  file: File,
  view: AppView,
  state: AppState,
  requestId: number
): Promise<void> {
  try {
    const text = await readFileAsText(file);
    if (requestId !== state.fileRequests.model) return;
    const result = parseModelText(file.name, text);
    applyDraftToEditors(view, state, modelToEditorDraft(result.model));
    state.loadedModal = null;
    setResponseResult(state, null);
    state.complex = null;
    refreshModel(view, state, true);
    if (result.warnings.length > 0) {
      setEditorStatus(
        view,
        `${getUiText(state.language).editorValid}\n${result.warnings
          .map((warning) =>
            localizeBuildingModelWarning(warning, createFileMessages(getUiText(state.language)))
          )
          .join("\n")}`,
        true
      );
    }
  } catch (error) {
    setEditorStatus(
      view,
      `${getUiText(state.language).formatErrorPrefix} ${error instanceof Error ? error.message : String(error)}`,
      false
    );
  }
}

function loadResultText(fileName: string, text: string, view: AppView, state: AppState): void {
  if (!state.model || !state.modelInputValid) {
    throw new Error("Correct the model input before loading an analysis result.");
  }
  const expectedStoryCount = state.model.structInfo?.massN ?? 0;
  const type = detectFileType(fileName, text);
  if (type === "modal") {
    const parsed = parseModalDat(text);
    if (parsed.modal.frequenciesHz.length === 0) throw new Error("Modal result contains no modes.");
    for (let index = 0; index < parsed.modal.frequenciesHz.length; index++) {
      extractRealMode(parsed, index, expectedStoryCount);
    }
    state.loadedModal = parsed;
    view.viewerModeSelect.value = "real";
  } else if (type === "complex") {
    const parsed = parseComplexModalDat(text);
    if (parsed.modes.length === 0) throw new Error("Complex result contains no modes.");
    for (let index = 0; index < parsed.modes.length; index++) {
      extractComplexMode(parsed, index, expectedStoryCount);
    }
    state.complex = parsed;
    view.viewerModeSelect.value = "complex";
  } else if (type === "resp") {
    const parsed = parseRespCsv(text);
    buildResponseSeries(parsed, expectedStoryCount);
    setResponseResult(state, parsed);
    view.viewerModeSelect.value = "response";
    renderResponse(view, state);
  } else {
    throw new Error("Select a Modal/ComplexModal DAT or RespResult CSV file.");
  }
  state.resultError = null;
  applyViewerMode(view, state);
}

function clearExternalResults(view: AppView, state: AppState): void {
  state.loadedModal = null;
  state.complex = null;
  setResponseResult(state, null);
  state.resultError = null;
  renderResponse(view, state);
  if (viewerMode(view) === "complex" || viewerMode(view) === "response") {
    view.viewerModeSelect.value = "real";
  }
  populateModeIndices(view, state);
  applyViewerMode(view, state);
}

function bindEditor(view: AppView, state: AppState): void {
  createEditors(view, state);
  applyDraftToEditors(view, state, state.draft);

  view.editorBaseZ.addEventListener("input", () => {
    state.draft.baseZ = view.editorBaseZ.value;
    state.resultError = null;
    invalidatePendingFileReads(state);
    scheduleModelRefresh(view, state);
  });
  const commitStoryCount = (allowShrink: boolean): void => {
    if (state.storyResizeTimer !== null) {
      window.clearTimeout(state.storyResizeTimer);
      state.storyResizeTimer = null;
    }
    const requested = Number(view.editorMassN.value);
    if (Number.isInteger(requested) && requested >= 1) {
      const current = state.editors.stories?.getRows().length ?? state.draft.rows.stories.length;
      if (!allowShrink && requested <= current) return;
      state.resultError = null;
      invalidatePendingFileReads(state);
      resizeStoryDraft(view, state, requested);
      scheduleModelRefresh(view, state);
    }
  };
  view.editorMassN.addEventListener("input", () => {
    state.resultError = null;
    invalidatePendingFileReads(state);
    if (state.refreshTimer !== null) {
      window.clearTimeout(state.refreshTimer);
      state.refreshTimer = null;
    }
    if (state.storyResizeTimer !== null) window.clearTimeout(state.storyResizeTimer);
    state.storyResizeTimer = window.setTimeout(() => commitStoryCount(false), 220);
  });
  view.editorMassN.addEventListener("change", () => commitStoryCount(true));
  view.editorBuildButton.addEventListener("click", () => refreshModel(view, state, true));
  view.editorDownloadButton.addEventListener("click", () => {
    if (!refreshModel(view, state, true)) return;
    downloadText("building-model.json", state.generatedJson, "application/json;charset=utf-8");
  });
  view.storyCsvButton.addEventListener("click", () => {
    if (!refreshModel(view, state, true)) return;
    downloadText(
      "story-stiffness-eccentricity.csv",
      serializeStorySummariesCsv(state.storySummaries),
      "text/csv;charset=utf-8"
    );
  });
  view.editorImportInput.addEventListener("change", async () => {
    const file = view.editorImportInput.files?.[0];
    if (!file) return;
    invalidatePendingFileReads(state);
    await importModelToEditor(file, view, state, state.fileRequests.model);
  });
  view.planLayerSelect.addEventListener("change", () => renderPlan(view, state));
}

function bindViewer(view: AppView, state: AppState): () => void {
  view.responseProfileMetricSelect.addEventListener("change", () => renderResponse(view, state));
  view.viewerModeSelect.addEventListener("change", () => applyViewerMode(view, state));
  view.viewerModeIndexSelect.addEventListener("change", () => applyViewerMode(view, state));
  view.viewerPlayButton.addEventListener("click", () => {
    const playback = state.viewer?.getPlaybackState();
    if (playback) state.viewer?.setPlaying(!playback.playing);
  });
  view.viewerSeek.addEventListener("input", () =>
    state.viewer?.seekNormalized(Number(view.viewerSeek.value))
  );
  view.viewerScale.addEventListener("input", () =>
    state.viewer?.setDeformationScale(Number(view.viewerScale.value) / 20)
  );
  view.viewerRotation.addEventListener("input", () =>
    state.viewer?.setRotationEmphasis(Number(view.viewerRotation.value))
  );
  view.viewerSpeed.addEventListener("input", () =>
    state.viewer?.setPlaybackSpeed(Number(view.viewerSpeed.value))
  );
  view.viewerResetButton.addEventListener("click", () => state.viewer?.resetCamera());
  view.resultInput.addEventListener("change", async () => {
    const file = view.resultInput.files?.[0];
    if (!file) return;
    invalidatePendingFileReads(state);
    clearExternalResults(view, state);
    const requestId = state.fileRequests.result;
    try {
      const text = await readFileAsText(file);
      if (requestId !== state.fileRequests.result) return;
      loadResultText(file.name, text, view, state);
    } catch (error) {
      state.resultError = error;
      setEditorStatus(view, localizeViewerError(error, state.language), false);
    }
  });

  const unsubscribePlayback = state.viewer?.onPlaybackChange((playback) => {
    view.viewerSeek.value = playback.duration > 0
      ? String(playback.currentTime / playback.duration)
      : "0";
    view.viewerPlayButton.textContent = playback.playing
      ? getUiText(state.language).viewerPause
      : getUiText(state.language).viewerPlay;
  });
  state.viewer?.setDeformationScale(Number(view.viewerScale.value) / 20);
  state.viewer?.setRotationEmphasis(Number(view.viewerRotation.value));
  state.viewer?.setPlaybackSpeed(Number(view.viewerSpeed.value));
  return unsubscribePlayback ?? (() => {});
}

function bindThemeAndLanguage(view: AppView, state: AppState): void {
  view.languageSelect.addEventListener("change", () => {
    const statusWasValid = view.editorStatus.classList.contains("is-valid");
    const statusWasInvalid = view.editorStatus.classList.contains("is-invalid");
    const resultError = state.resultError;
    state.language = view.languageSelect.value === "en" ? "en" : "ja";
    window.localStorage.setItem(LANGUAGE_KEY, state.language);
    applyLocalizedTexts(view, state);
    if (statusWasValid) setEditorStatus(view, getUiText(state.language).editorValid, true);
    if (statusWasInvalid && resultError !== null) {
      setEditorStatus(view, localizeViewerError(resultError, state.language), false);
    } else if (statusWasInvalid) {
      const validation = validateModelEditorDraft(state.draft);
      if (validation.issues.length > 0 || validation.generalIssues.length > 0) {
        refreshModel(view, state, false);
      } else {
        applyViewerMode(view, state);
      }
    }
    populateModeIndices(view, state);
    rebuildVisibilityControls(view, state);
    renderResponse(view, state);
  });
  view.themeButton.addEventListener("click", () => {
    state.theme = state.theme === "light" ? "dark" : "light";
    window.localStorage.setItem(THEME_KEY, state.theme);
    applyTheme(state.theme);
    state.viewer?.setBackground(state.theme === "dark" ? 0x0f1720 : 0xf1f5f4);
    applyLocalizedTexts(view, state);
    renderPlan(view, state);
    renderResponse(view, state);
  });
}

function bindFileProcessing(view: AppView, state: AppState): void {
  view.fileInput.addEventListener("change", async () => {
    invalidatePendingFileReads(state);
    const requestId = state.fileRequests.general;
    const files = Array.from(view.fileInput.files ?? []);
    const reports: FileProcessingReport[] = [];
    for (const file of files) {
      const result = await processInputFile(file, createFileMessages(getUiText(state.language)));
      if (requestId !== state.fileRequests.general) return;
      reports.push(result.report);
      if (result.kind !== "success") continue;
      try {
        const text = await readFileAsText(file);
        if (requestId !== state.fileRequests.general) return;
        if (result.report.type === "json" || result.report.type === "xml") {
          const parsed = parseModelText(file.name, text);
          applyDraftToEditors(view, state, modelToEditorDraft(parsed.model));
          state.loadedModal = null;
          state.complex = null;
          setResponseResult(state, null);
          renderResponse(view, state);
          refreshModel(view, state, true);
        } else if (["modal", "complex", "resp"].includes(result.report.type)) {
          clearExternalResults(view, state);
          loadResultText(file.name, text, view, state);
        }
      } catch (error) {
        if (["modal", "complex", "resp"].includes(result.report.type)) {
          state.resultError = error;
        }
        setEditorStatus(view, localizeViewerError(error, state.language), false);
      }
    }
    if (requestId === state.fileRequests.general) {
      view.summary.textContent = JSON.stringify(reports, null, 2);
    }
  });
}

function bindResponsiveCanvases(view: AppView, state: AppState): () => void {
  if (typeof ResizeObserver !== "function") return () => {};
  let pending = false;
  const observer = new ResizeObserver(() => {
    if (pending) return;
    pending = true;
    window.requestAnimationFrame(() => {
      pending = false;
      renderPlan(view, state);
      renderResponse(view, state);
    });
  });
  observer.observe(view.planCanvas);
  observer.observe(view.responseWaveCanvas);
  observer.observe(view.responseProfileCanvas);
  return () => observer.disconnect();
}

export function bootstrapApp(root: HTMLElement): () => void {
  const view = createAppView(root);
  if (!view) return () => {};

  const state: AppState = {
    language: loadLanguage(),
    theme: loadTheme(),
    draft: createDefaultModelEditorDraft(),
    model: null,
    generatedJson: "",
    storySummaries: [],
    generatedModal: null,
    loadedModal: null,
    complex: null,
    response: null,
    responseSeries: [],
    responseProfile: [],
    resultError: null,
    viewer: null,
    editors: {},
    applyingDraft: false,
    refreshTimer: null,
    storyResizeTimer: null,
    modelInputValid: false,
    categoryVisibility: new Map(
      VISUALIZATION_CATEGORIES.map((category) => [category, true] as const)
    ),
    storyVisibility: new Map(),
    fileRequests: { general: 0, model: 0, result: 0 }
  };

  applyTheme(state.theme);
  try {
    state.viewer = new ThreeViewer(view.viewerContainer, {
      background: state.theme === "dark" ? 0x0f1720 : 0xf1f5f4
    });
  } catch (error) {
    console.warn("3D viewer initialization failed.", error);
    view.viewerContainer.dataset.viewerUnavailable = "true";
    view.viewerContainer.classList.add("is-unavailable");
    view.viewerContainer.setAttribute("role", "status");
    view.viewerContainer.textContent = getUiText(state.language).viewerUnavailable;
    for (const control of [
      view.viewerModeSelect,
      view.viewerModeIndexSelect,
      view.viewerPlayButton,
      view.viewerSeek,
      view.viewerScale,
      view.viewerRotation,
      view.viewerSpeed,
      view.viewerResetButton
    ]) {
      control.disabled = true;
    }
  }
  applyLocalizedTexts(view, state);
  const unbindManualModal = bindManualModal(view);
  bindThemeAndLanguage(view, state);
  bindEditor(view, state);
  const unsubscribePlayback = bindViewer(view, state);
  bindFileProcessing(view, state);
  const disconnectCanvases = bindResponsiveCanvases(view, state);
  renderResponse(view, state);
  refreshModel(view, state, true);
  return () => {
    invalidatePendingFileReads(state);
    if (state.refreshTimer !== null) window.clearTimeout(state.refreshTimer);
    if (state.storyResizeTimer !== null) window.clearTimeout(state.storyResizeTimer);
    unsubscribePlayback();
    disconnectCanvases();
    unbindManualModal();
    for (const editor of Object.values(state.editors)) editor?.destroy();
    state.viewer?.dispose();
    state.viewer = null;
    root.replaceChildren();
  };
}
