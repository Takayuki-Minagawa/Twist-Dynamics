export interface AppView {
  fileInput: HTMLInputElement;
  summary: HTMLElement;
  parseResultTitle: HTMLHeadingElement;
  languageLabel: HTMLLabelElement;
  languageSelect: HTMLSelectElement;
  themeButton: HTMLButtonElement;
  manualButton: HTMLButtonElement;
  heroTitle: HTMLHeadingElement;
  heroDescription: HTMLParagraphElement;
  parseCardTitle: HTMLHeadingElement;
  fileInputLabel: HTMLLabelElement;
  noteText: HTMLDivElement;
  editorCardTitle: HTMLHeadingElement;
  editorMassNLabel: HTMLLabelElement;
  editorMassN: HTMLInputElement;
  editorStructTypeLabel: HTMLLabelElement;
  editorStructType: HTMLSelectElement;
  editorZLevelLabel: HTMLLabelElement;
  editorZLevel: HTMLTextAreaElement;
  editorWeightLabel: HTMLLabelElement;
  editorWeight: HTMLTextAreaElement;
  editorWMomentLabel: HTMLLabelElement;
  editorWMoment: HTMLTextAreaElement;
  editorWCenterLabel: HTMLLabelElement;
  editorWCenter: HTMLTextAreaElement;
  editorFloorsLabel: HTMLLabelElement;
  editorFloors: HTMLTextAreaElement;
  editorColumnsLabel: HTMLLabelElement;
  editorColumns: HTMLTextAreaElement;
  editorWallCharasLabel: HTMLLabelElement;
  editorWallCharas: HTMLTextAreaElement;
  editorWallsLabel: HTMLLabelElement;
  editorWalls: HTMLTextAreaElement;
  editorMassDampersLabel: HTMLLabelElement;
  editorMassDampers: HTMLTextAreaElement;
  editorBraceDampersLabel: HTMLLabelElement;
  editorBraceDampers: HTMLTextAreaElement;
  editorDxPanelsLabel: HTMLLabelElement;
  editorDxPanels: HTMLTextAreaElement;
  editorPreviewTitle: HTMLHeadingElement;
  editorPreview: HTMLElement;
  editorBuildButton: HTMLButtonElement;
  editorDownloadButton: HTMLButtonElement;
  editorImportLabel: HTMLLabelElement;
  editorImportInput: HTMLInputElement;
  editorHint: HTMLParagraphElement;
  manualModal: HTMLDivElement;
  manualTitle: HTMLHeadingElement;
  manualIntro: HTMLParagraphElement;
  manualList: HTMLOListElement;
  manualCloseButton: HTMLButtonElement;
}

function queryRequired<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

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
      <section class="grid">
        <article class="card">
          <h2 id="parseCardTitle"></h2>
          <div class="actions">
            <label id="fileInputLabel" class="inline-label" for="fileInput"></label>
            <input id="fileInput" type="file" multiple />
          </div>
          <h3 id="parseResultTitle" class="sub-title"></h3>
          <pre id="summary"></pre>
          <div id="noteText" class="note"></div>
        </article>
        <article class="card">
          <h2 id="editorCardTitle"></h2>
          <div class="editor-grid">
            <label id="editorMassNLabel" for="editorMassN" class="inline-label"></label>
            <input id="editorMassN" type="number" min="1" />

            <label id="editorStructTypeLabel" for="editorStructType" class="inline-label"></label>
            <select id="editorStructType">
              <option value="R">R</option>
              <option value="DX">DX</option>
            </select>

            <label id="editorZLevelLabel" for="editorZLevel" class="inline-label"></label>
            <textarea id="editorZLevel"></textarea>

            <label id="editorWeightLabel" for="editorWeight" class="inline-label"></label>
            <textarea id="editorWeight"></textarea>

            <label id="editorWMomentLabel" for="editorWMoment" class="inline-label"></label>
            <textarea id="editorWMoment"></textarea>

            <label id="editorWCenterLabel" for="editorWCenter" class="inline-label"></label>
            <textarea id="editorWCenter"></textarea>

            <label id="editorFloorsLabel" for="editorFloors" class="inline-label"></label>
            <textarea id="editorFloors"></textarea>

            <label id="editorColumnsLabel" for="editorColumns" class="inline-label"></label>
            <textarea id="editorColumns"></textarea>

            <label id="editorWallCharasLabel" for="editorWallCharas" class="inline-label"></label>
            <textarea id="editorWallCharas"></textarea>

            <label id="editorWallsLabel" for="editorWalls" class="inline-label"></label>
            <textarea id="editorWalls"></textarea>

            <label id="editorMassDampersLabel" for="editorMassDampers" class="inline-label"></label>
            <textarea id="editorMassDampers"></textarea>

            <label id="editorBraceDampersLabel" for="editorBraceDampers" class="inline-label"></label>
            <textarea id="editorBraceDampers"></textarea>

            <label id="editorDxPanelsLabel" for="editorDxPanels" class="inline-label"></label>
            <textarea id="editorDxPanels"></textarea>
          </div>
          <div class="actions">
            <button id="editorBuildButton" type="button"></button>
            <button id="editorDownloadButton" type="button"></button>
            <label id="editorImportLabel" class="inline-label" for="editorImportInput"></label>
            <input id="editorImportInput" type="file" accept=".json,.xml" />
          </div>
          <p id="editorHint" class="note"></p>
          <h3 id="editorPreviewTitle" class="sub-title"></h3>
          <pre id="editorPreview"></pre>
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

  try {
    return {
      fileInput: queryRequired<HTMLInputElement>(root, "#fileInput"),
      summary: queryRequired<HTMLElement>(root, "#summary"),
      parseResultTitle: queryRequired<HTMLHeadingElement>(root, "#parseResultTitle"),
      languageLabel: queryRequired<HTMLLabelElement>(root, "#languageLabel"),
      languageSelect: queryRequired<HTMLSelectElement>(root, "#languageSelect"),
      themeButton: queryRequired<HTMLButtonElement>(root, "#themeButton"),
      manualButton: queryRequired<HTMLButtonElement>(root, "#manualButton"),
      heroTitle: queryRequired<HTMLHeadingElement>(root, "#heroTitle"),
      heroDescription: queryRequired<HTMLParagraphElement>(root, "#heroDescription"),
      parseCardTitle: queryRequired<HTMLHeadingElement>(root, "#parseCardTitle"),
      fileInputLabel: queryRequired<HTMLLabelElement>(root, "#fileInputLabel"),
      noteText: queryRequired<HTMLDivElement>(root, "#noteText"),
      editorCardTitle: queryRequired<HTMLHeadingElement>(root, "#editorCardTitle"),
      editorMassNLabel: queryRequired<HTMLLabelElement>(root, "#editorMassNLabel"),
      editorMassN: queryRequired<HTMLInputElement>(root, "#editorMassN"),
      editorStructTypeLabel: queryRequired<HTMLLabelElement>(root, "#editorStructTypeLabel"),
      editorStructType: queryRequired<HTMLSelectElement>(root, "#editorStructType"),
      editorZLevelLabel: queryRequired<HTMLLabelElement>(root, "#editorZLevelLabel"),
      editorZLevel: queryRequired<HTMLTextAreaElement>(root, "#editorZLevel"),
      editorWeightLabel: queryRequired<HTMLLabelElement>(root, "#editorWeightLabel"),
      editorWeight: queryRequired<HTMLTextAreaElement>(root, "#editorWeight"),
      editorWMomentLabel: queryRequired<HTMLLabelElement>(root, "#editorWMomentLabel"),
      editorWMoment: queryRequired<HTMLTextAreaElement>(root, "#editorWMoment"),
      editorWCenterLabel: queryRequired<HTMLLabelElement>(root, "#editorWCenterLabel"),
      editorWCenter: queryRequired<HTMLTextAreaElement>(root, "#editorWCenter"),
      editorFloorsLabel: queryRequired<HTMLLabelElement>(root, "#editorFloorsLabel"),
      editorFloors: queryRequired<HTMLTextAreaElement>(root, "#editorFloors"),
      editorColumnsLabel: queryRequired<HTMLLabelElement>(root, "#editorColumnsLabel"),
      editorColumns: queryRequired<HTMLTextAreaElement>(root, "#editorColumns"),
      editorWallCharasLabel: queryRequired<HTMLLabelElement>(root, "#editorWallCharasLabel"),
      editorWallCharas: queryRequired<HTMLTextAreaElement>(root, "#editorWallCharas"),
      editorWallsLabel: queryRequired<HTMLLabelElement>(root, "#editorWallsLabel"),
      editorWalls: queryRequired<HTMLTextAreaElement>(root, "#editorWalls"),
      editorMassDampersLabel: queryRequired<HTMLLabelElement>(root, "#editorMassDampersLabel"),
      editorMassDampers: queryRequired<HTMLTextAreaElement>(root, "#editorMassDampers"),
      editorBraceDampersLabel: queryRequired<HTMLLabelElement>(root, "#editorBraceDampersLabel"),
      editorBraceDampers: queryRequired<HTMLTextAreaElement>(root, "#editorBraceDampers"),
      editorDxPanelsLabel: queryRequired<HTMLLabelElement>(root, "#editorDxPanelsLabel"),
      editorDxPanels: queryRequired<HTMLTextAreaElement>(root, "#editorDxPanels"),
      editorPreviewTitle: queryRequired<HTMLHeadingElement>(root, "#editorPreviewTitle"),
      editorPreview: queryRequired<HTMLElement>(root, "#editorPreview"),
      editorBuildButton: queryRequired<HTMLButtonElement>(root, "#editorBuildButton"),
      editorDownloadButton: queryRequired<HTMLButtonElement>(root, "#editorDownloadButton"),
      editorImportLabel: queryRequired<HTMLLabelElement>(root, "#editorImportLabel"),
      editorImportInput: queryRequired<HTMLInputElement>(root, "#editorImportInput"),
      editorHint: queryRequired<HTMLParagraphElement>(root, "#editorHint"),
      manualModal: queryRequired<HTMLDivElement>(root, "#manualModal"),
      manualTitle: queryRequired<HTMLHeadingElement>(root, "#manualTitle"),
      manualIntro: queryRequired<HTMLParagraphElement>(root, "#manualIntro"),
      manualList: queryRequired<HTMLOListElement>(root, "#manualList"),
      manualCloseButton: queryRequired<HTMLButtonElement>(root, "#manualCloseButton")
    };
  } catch {
    return null;
  }
}
