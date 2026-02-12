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

function detectType(fileName: string, text: string): "xml" | "modal" | "complex" | "resp" | "json" | "unknown" {
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

function bootstrap(): void {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) return;

  root.innerHTML = `
    <div class="app">
      <section class="hero">
        <h1>Twist-Dynamics (Phase 0/1)</h1>
        <p>既存フォーマットの読込検証と JSON -> BuildingModel(XML) 変換をブラウザ上で実行します。</p>
      </section>
      <section class="grid">
        <article class="card">
          <h2>ファイル読込（XML / DAT / CSV / JSON）</h2>
          <div class="actions">
            <input id="fileInput" type="file" multiple />
          </div>
          <pre id="summary"></pre>
        </article>
        <article class="card">
          <h2>JSON -> BuildingModel XML 変換</h2>
          <textarea id="jsonInput" placeholder="ここに NICE JSON を貼り付け"></textarea>
          <div class="actions">
            <button id="convertButton">XMLへ変換</button>
            <button id="downloadButton">XMLを保存</button>
          </div>
          <pre id="xmlOutput"></pre>
          <div class="note">単位ラベル (kN, cm など) は既存 C# と同様に除去して処理します。</div>
        </article>
      </section>
    </div>
  `;

  const fileInput = document.querySelector<HTMLInputElement>("#fileInput");
  const summary = document.querySelector<HTMLElement>("#summary");
  const jsonInput = document.querySelector<HTMLTextAreaElement>("#jsonInput");
  const xmlOutput = document.querySelector<HTMLElement>("#xmlOutput");
  const convertButton = document.querySelector<HTMLButtonElement>("#convertButton");
  const downloadButton = document.querySelector<HTMLButtonElement>("#downloadButton");

  if (!fileInput || !summary || !jsonInput || !xmlOutput || !convertButton || !downloadButton) {
    return;
  }

  let latestXml = "";

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
              message: "既知フォーマット判定に失敗しました。"
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
      xmlOutput.textContent = `変換失敗: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  });

  downloadButton.addEventListener("click", () => {
    if (!latestXml) return;
    downloadText("converted_building_model.xml", latestXml);
  });
}

bootstrap();
