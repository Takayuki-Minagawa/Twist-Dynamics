export interface AppView {
  fileInput: HTMLInputElement;
  summary: HTMLElement;
  languageLabel: HTMLLabelElement;
  languageSelect: HTMLSelectElement;
  themeButton: HTMLButtonElement;
  manualButton: HTMLButtonElement;
  heroTitle: HTMLHeadingElement;
  heroDescription: HTMLParagraphElement;
  parseCardTitle: HTMLHeadingElement;
  fileInputLabel: HTMLLabelElement;
  noteText: HTMLDivElement;
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
          <pre id="summary"></pre>
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

  try {
    return {
      fileInput: queryRequired<HTMLInputElement>(root, "#fileInput"),
      summary: queryRequired<HTMLElement>(root, "#summary"),
      languageLabel: queryRequired<HTMLLabelElement>(root, "#languageLabel"),
      languageSelect: queryRequired<HTMLSelectElement>(root, "#languageSelect"),
      themeButton: queryRequired<HTMLButtonElement>(root, "#themeButton"),
      manualButton: queryRequired<HTMLButtonElement>(root, "#manualButton"),
      heroTitle: queryRequired<HTMLHeadingElement>(root, "#heroTitle"),
      heroDescription: queryRequired<HTMLParagraphElement>(root, "#heroDescription"),
      parseCardTitle: queryRequired<HTMLHeadingElement>(root, "#parseCardTitle"),
      fileInputLabel: queryRequired<HTMLLabelElement>(root, "#fileInputLabel"),
      noteText: queryRequired<HTMLDivElement>(root, "#noteText"),
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
