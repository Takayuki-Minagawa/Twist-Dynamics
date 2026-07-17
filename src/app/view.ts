export interface AppView {
  languageLabel: HTMLLabelElement;
  languageSelect: HTMLSelectElement;
  themeButton: HTMLButtonElement;
  manualButton: HTMLButtonElement;
  heroTitle: HTMLHeadingElement;
  heroDescription: HTMLParagraphElement;
  fileInput: HTMLInputElement;
  fileInputLabel: HTMLLabelElement;
  parseResultTitle: HTMLHeadingElement;
  summary: HTMLElement;
  noteText: HTMLDivElement;
  editorCardTitle: HTMLHeadingElement;
  editorMassNLabel: HTMLLabelElement;
  editorMassN: HTMLInputElement;
  editorBaseZLabel: HTMLLabelElement;
  editorBaseZ: HTMLInputElement;
  storyEditor: HTMLElement;
  floorsEditor: HTMLElement;
  columnsEditor: HTMLElement;
  wallCharasEditor: HTMLElement;
  wallsEditor: HTMLElement;
  massDampersEditor: HTMLElement;
  braceDampersEditor: HTMLElement;
  editorBuildButton: HTMLButtonElement;
  editorDownloadButton: HTMLButtonElement;
  editorImportLabel: HTMLLabelElement;
  editorImportInput: HTMLInputElement;
  editorStatus: HTMLElement;
  editorHint: HTMLParagraphElement;
  editorPreviewTitle: HTMLHeadingElement;
  editorPreview: HTMLElement;
  planTitle: HTMLHeadingElement;
  planLayerLabel: HTMLLabelElement;
  planLayerSelect: HTMLSelectElement;
  planCanvas: HTMLCanvasElement;
  storySummaryTitle: HTMLHeadingElement;
  storySummaryBody: HTMLTableSectionElement;
  storyCsvButton: HTMLButtonElement;
  viewerTitle: HTMLHeadingElement;
  viewerContainer: HTMLElement;
  viewerModeLabel: HTMLLabelElement;
  viewerModeSelect: HTMLSelectElement;
  viewerModeIndexLabel: HTMLLabelElement;
  viewerModeIndexSelect: HTMLSelectElement;
  viewerPlayButton: HTMLButtonElement;
  viewerSeek: HTMLInputElement;
  viewerScaleLabel: HTMLLabelElement;
  viewerScale: HTMLInputElement;
  viewerRotationLabel: HTMLLabelElement;
  viewerRotation: HTMLInputElement;
  viewerSpeedLabel: HTMLLabelElement;
  viewerSpeed: HTMLInputElement;
  viewerResetButton: HTMLButtonElement;
  viewerCategories: HTMLElement;
  viewerStories: HTMLElement;
  resultInputLabel: HTMLLabelElement;
  resultInput: HTMLInputElement;
  responseTitle: HTMLHeadingElement;
  responseProfileMetricLabel: HTMLLabelElement;
  responseProfileMetricSelect: HTMLSelectElement;
  responseWaveCanvas: HTMLCanvasElement;
  responseProfileCanvas: HTMLCanvasElement;
  responseTableBody: HTMLTableSectionElement;
  manualModal: HTMLDivElement;
  manualTitle: HTMLHeadingElement;
  manualIntro: HTMLParagraphElement;
  manualList: HTMLOListElement;
  manualCloseButton: HTMLButtonElement;
}

type ViewId = keyof AppView;

function collectView(root: ParentNode, ids: readonly ViewId[]): AppView {
  const result = {} as Record<ViewId, Element>;
  for (const id of ids) {
    const element = root.querySelector(`#${id}`);
    if (!element) throw new Error(`Missing required element: #${id}`);
    result[id] = element;
  }
  return result as unknown as AppView;
}

const VIEW_IDS = [
  "languageLabel",
  "languageSelect",
  "themeButton",
  "manualButton",
  "heroTitle",
  "heroDescription",
  "fileInput",
  "fileInputLabel",
  "parseResultTitle",
  "summary",
  "noteText",
  "editorCardTitle",
  "editorMassNLabel",
  "editorMassN",
  "editorBaseZLabel",
  "editorBaseZ",
  "storyEditor",
  "floorsEditor",
  "columnsEditor",
  "wallCharasEditor",
  "wallsEditor",
  "massDampersEditor",
  "braceDampersEditor",
  "editorBuildButton",
  "editorDownloadButton",
  "editorImportLabel",
  "editorImportInput",
  "editorStatus",
  "editorHint",
  "editorPreviewTitle",
  "editorPreview",
  "planTitle",
  "planLayerLabel",
  "planLayerSelect",
  "planCanvas",
  "storySummaryTitle",
  "storySummaryBody",
  "storyCsvButton",
  "viewerTitle",
  "viewerContainer",
  "viewerModeLabel",
  "viewerModeSelect",
  "viewerModeIndexLabel",
  "viewerModeIndexSelect",
  "viewerPlayButton",
  "viewerSeek",
  "viewerScaleLabel",
  "viewerScale",
  "viewerRotationLabel",
  "viewerRotation",
  "viewerSpeedLabel",
  "viewerSpeed",
  "viewerResetButton",
  "viewerCategories",
  "viewerStories",
  "resultInputLabel",
  "resultInput",
  "responseTitle",
  "responseProfileMetricLabel",
  "responseProfileMetricSelect",
  "responseWaveCanvas",
  "responseProfileCanvas",
  "responseTableBody",
  "manualModal",
  "manualTitle",
  "manualIntro",
  "manualList",
  "manualCloseButton"
] as const satisfies readonly ViewId[];

export function createAppView(root: HTMLElement): AppView | null {
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

      <section class="workspace-grid workspace-grid--top">
        <article class="card">
          <div class="section-heading">
            <h2 id="parseResultTitle"></h2>
            <label id="fileInputLabel" class="inline-label" for="fileInput"></label>
          </div>
          <input id="fileInput" type="file" multiple accept=".json,.xml,.dat,.csv" />
          <pre id="summary" class="summary-panel"></pre>
          <div id="noteText" class="note"></div>
        </article>

        <article class="card model-overview-card">
          <h2 id="editorCardTitle"></h2>
          <div class="overview-inputs">
            <label id="editorMassNLabel" for="editorMassN"></label>
            <input id="editorMassN" type="number" min="1" step="1" />
            <label id="editorBaseZLabel" for="editorBaseZ"></label>
            <input id="editorBaseZ" type="number" step="any" />
          </div>
          <div class="actions">
            <button id="editorBuildButton" type="button"></button>
            <button id="editorDownloadButton" type="button"></button>
            <button id="storyCsvButton" type="button" class="button-secondary"></button>
            <label id="editorImportLabel" class="inline-label" for="editorImportInput"></label>
            <input id="editorImportInput" type="file" accept=".json,.xml" />
          </div>
          <div id="editorStatus" class="validation-status" aria-live="polite"></div>
          <p id="editorHint" class="note"></p>
        </article>
      </section>

      <section class="card editor-card">
        <div id="storyEditor" class="table-editor-host"></div>
        <div class="editor-sections-grid">
          <div id="floorsEditor" class="table-editor-host"></div>
          <div id="columnsEditor" class="table-editor-host"></div>
          <div id="wallCharasEditor" class="table-editor-host"></div>
          <div id="wallsEditor" class="table-editor-host"></div>
          <div id="massDampersEditor" class="table-editor-host"></div>
          <div id="braceDampersEditor" class="table-editor-host"></div>
        </div>
        <details class="json-preview">
          <summary id="editorPreviewTitle"></summary>
          <pre id="editorPreview"></pre>
        </details>
      </section>

      <section class="workspace-grid">
        <article class="card preview-card">
          <div class="section-heading">
            <h2 id="planTitle"></h2>
            <div class="compact-control">
              <label id="planLayerLabel" for="planLayerSelect"></label>
              <select id="planLayerSelect"></select>
            </div>
          </div>
          <canvas id="planCanvas" class="plan-canvas"></canvas>
        </article>

        <article class="card story-summary-card">
          <h2 id="storySummaryTitle"></h2>
          <div class="table-scroll">
            <table class="data-table summary-table">
              <thead>
                <tr>
                  <th>Story</th><th>Kx</th><th>Ky</th><th>Center X</th><th>Center Y</th>
                  <th>Re X</th><th>Re Y</th><th>(K/W)/avg X</th><th>(K/W)/avg Y</th>
                </tr>
              </thead>
              <tbody id="storySummaryBody"></tbody>
            </table>
          </div>
        </article>
      </section>

      <section class="card viewer-card">
        <div class="section-heading">
          <h2 id="viewerTitle"></h2>
          <div class="viewer-result-input">
            <label id="resultInputLabel" for="resultInput"></label>
            <input id="resultInput" type="file" accept=".dat,.csv" />
          </div>
        </div>
        <div class="viewer-controls">
          <label id="viewerModeLabel" for="viewerModeSelect"></label>
          <select id="viewerModeSelect">
            <option value="static">Static</option>
            <option value="real">Real mode</option>
            <option value="complex">Complex mode</option>
            <option value="response">Response</option>
          </select>
          <label id="viewerModeIndexLabel" for="viewerModeIndexSelect"></label>
          <select id="viewerModeIndexSelect"></select>
          <button id="viewerPlayButton" type="button"></button>
          <input id="viewerSeek" type="range" min="0" max="1" step="0.001" value="0" />
          <label id="viewerScaleLabel" for="viewerScale"></label>
          <input id="viewerScale" type="range" min="0" max="100" step="1" value="20" />
          <label id="viewerRotationLabel" for="viewerRotation"></label>
          <input id="viewerRotation" type="range" min="1" max="20" step="1" value="4" />
          <label id="viewerSpeedLabel" for="viewerSpeed"></label>
          <input id="viewerSpeed" type="range" min="0.25" max="3" step="0.25" value="1" />
          <button id="viewerResetButton" type="button" class="button-secondary"></button>
        </div>
        <div class="visibility-controls">
          <div id="viewerCategories"></div>
          <div id="viewerStories"></div>
        </div>
        <div id="viewerContainer" class="viewer-container"></div>
      </section>

      <section class="card response-card">
        <div class="section-heading">
          <h2 id="responseTitle"></h2>
          <div class="compact-control">
            <label id="responseProfileMetricLabel" for="responseProfileMetricSelect"></label>
            <select id="responseProfileMetricSelect">
              <option value="displacement">Displacement X / Y (cm)</option>
              <option value="interstoryDrift">Interstory drift X / Y (-)</option>
              <option value="rotation">Torsional rotation RZ (rad)</option>
              <option value="acceleration">Acceleration X / Y (cm/s²)</option>
            </select>
          </div>
        </div>
        <div class="chart-grid">
          <canvas id="responseWaveCanvas" class="response-canvas"></canvas>
          <canvas id="responseProfileCanvas" class="response-canvas"></canvas>
        </div>
        <div class="table-scroll">
          <table class="data-table summary-table response-table">
            <thead>
              <tr>
                <th>Story</th><th>max DX (cm)</th><th>max DY (cm)</th><th>max RZ (rad)</th>
                <th>max drift X</th><th>max drift Y</th><th>max AX</th><th>max AY</th>
              </tr>
            </thead>
            <tbody id="responseTableBody"></tbody>
          </table>
        </div>
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

  try {
    return collectView(root, VIEW_IDS);
  } catch {
    return null;
  }
}
