// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fakeViewerState = vi.hoisted(() => ({
  throwOnConstruct: false,
  instances: [] as Array<{
    kind: "static" | "realMode" | "complexMode" | "response";
    disposed: boolean;
    storyCount: number;
    realModeFrequency: number | null;
    background: number | string | null;
  }>
}));

vi.mock("../src/viz", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/viz")>();

  class FakeThreeViewer {
    readonly renderer = { domElement: document.createElement("canvas") };
    kind: "static" | "realMode" | "complexMode" | "response" = "static";
    disposed = false;
    storyCount = 0;
    realModeFrequency: number | null = null;
    background: number | string | null = null;
    private listeners = new Set<(state: ReturnType<FakeThreeViewer["getPlaybackState"]>) => void>();

    constructor(container: HTMLElement, options?: { background?: number | string }) {
      if (fakeViewerState.throwOnConstruct) throw new Error("WebGL unavailable");
      this.background = options?.background ?? null;
      container.append(this.renderer.domElement);
      fakeViewerState.instances.push(this);
    }

    private emit(): void {
      const state = this.getPlaybackState();
      for (const listener of this.listeners) listener(state);
    }

    setModel(model: { structInfo?: { massN: number } }): void {
      this.storyCount = model.structInfo?.massN ?? 0;
      this.setStatic();
    }

    clearModel(): void {
      this.storyCount = 0;
      this.setStatic();
    }

    setStatic(): void {
      this.kind = "static";
      this.emit();
    }

    setRealMode(data: { modal: { frequenciesHz: number[] } }): void {
      this.kind = "realMode";
      this.realModeFrequency = data.modal.frequenciesHz[0] ?? null;
      this.emit();
    }

    setComplexMode(): void {
      this.kind = "complexMode";
      this.emit();
    }

    setResponse(): void {
      this.kind = "response";
      this.emit();
    }

    getPlaybackState() {
      return {
        playing: false,
        currentTime: 0,
        duration: this.kind === "static" ? 0 : 1,
        speed: 1,
        loop: this.kind !== "response",
        kind: this.kind
      };
    }

    onPlaybackChange(listener: (state: ReturnType<FakeThreeViewer["getPlaybackState"]>) => void) {
      this.listeners.add(listener);
      listener(this.getPlaybackState());
      return () => this.listeners.delete(listener);
    }

    getStoryCount(): number {
      return this.storyCount;
    }

    setCategoryVisible(): void {}
    setStoryVisible(): void {}
    setPlaying(): void {}
    seekNormalized(): void {}
    setDeformationScale(): void {}
    setRotationEmphasis(): void {}
    setPlaybackSpeed(): void {}
    resetCamera(): void {}
    setBackground(background: number | string): void {
      this.background = background;
    }

    dispose(): void {
      this.disposed = true;
      this.listeners.clear();
    }
  }

  return { ...actual, ThreeViewer: FakeThreeViewer };
});

import { bootstrapApp } from "../src/app/controller";
import { getUiText } from "../src/app/i18n";
import { serializeModalDat } from "../src/io";

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  disconnected = false;

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  observe(): void {}
  unobserve(): void {}

  disconnect(): void {
    this.disconnected = true;
  }

  trigger(): void {
    this.callback([], this as unknown as ResizeObserver);
  }
}

function fakeCanvasContext(): CanvasRenderingContext2D {
  const methods = new Map<PropertyKey, ReturnType<typeof vi.fn>>();
  return new Proxy(
    {},
    {
      get(_target, property) {
        if (property === "measureText") return () => ({ width: 24 });
        if (!methods.has(property)) methods.set(property, vi.fn());
        return methods.get(property);
      },
      set() {
        return true;
      }
    }
  ) as CanvasRenderingContext2D;
}

function setInputFiles(input: HTMLInputElement, files: File[]): void {
  Object.defineProperty(input, "files", { configurable: true, value: files });
}

function textFile(name: string, text: string): File {
  return new File([new TextEncoder().encode(text)], name, { type: "text/plain" });
}

const RESPONSE_TEXT = [
  "#BaseShapeInfo",
  "Story,1",
  "Zlebe,0,300",
  "#Resp_Result",
  "質点数,1,出力時間刻み(s),0.01,ダンパー数,0,出力単位,cm-rad,基礎変位含まない",
  "Time(s),DX_1,DY_1,DθZ_1,AX_1,AY_1,DX_R,DY_R",
  "0,0,0,0,0,0,0,0",
  "0.01,0.1,-0.2,0.001,1.2,-1.4,0.1,-0.2"
].join("\n");

const EXTERNAL_MODAL_TEXT = serializeModalDat({
  baseShape: {
    story: 1,
    zLevel: [0, 300],
    massCenters: [{ layer: 1, x: 610, y: 183 }]
  },
  modal: {
    frequenciesHz: [99],
    participationFactorX: [1],
    participationFactorY: [0],
    effectiveMassRatioX: [1],
    effectiveMassRatioY: [0],
    eigenVectors: [
      { label: "M1-δx", values: [1] },
      { label: "M1-δy", values: [0] },
      { label: "M1-θz", values: [0] }
    ]
  }
});

beforeEach(() => {
  document.body.replaceChildren();
  document.documentElement.removeAttribute("data-theme");
  window.localStorage.clear();
  fakeViewerState.instances.length = 0;
  fakeViewerState.throwOnConstruct = false;
  FakeResizeObserver.instances.length = 0;
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => fakeCanvasContext()
  );
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callback(0);
    return 1;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("application DOM integration", () => {
  it("keeps story-table changes intact and updates language, theme, and canvases", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const cleanup = bootstrapApp(root);

    const storyCount = root.querySelector<HTMLInputElement>("#editorMassN");
    expect(storyCount).not.toBeNull();
    if (!storyCount) return;
    storyCount.value = "12";
    storyCount.dispatchEvent(new Event("input", { bubbles: true }));
    storyCount.dispatchEvent(new Event("change", { bubbles: true }));
    expect(root.querySelectorAll("#storyEditor tbody tr")).toHaveLength(12);
    storyCount.value = "10";
    storyCount.dispatchEvent(new Event("input", { bubbles: true }));
    storyCount.dispatchEvent(new Event("change", { bubbles: true }));
    expect(root.querySelectorAll("#storyEditor tbody tr")).toHaveLength(10);

    const secondStoryWeight = root.querySelector<HTMLInputElement>(
      '#storyEditor tbody tr[data-row-index="1"] td[data-column-key="weight"] input'
    );
    expect(secondStoryWeight).not.toBeNull();
    if (!secondStoryWeight) return;
    secondStoryWeight.value = "777";
    secondStoryWeight.dispatchEvent(new Event("input", { bubbles: true }));

    storyCount.value = "1";
    storyCount.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((resolveWait) => window.setTimeout(resolveWait, 260));
    expect(root.querySelectorAll("#storyEditor tbody tr")).toHaveLength(10);
    expect(secondStoryWeight.value).toBe("777");

    storyCount.value = "12";
    storyCount.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((resolveWait) => window.setTimeout(resolveWait, 260));
    expect(root.querySelectorAll("#storyEditor tbody tr")).toHaveLength(12);
    expect(
      root.querySelector<HTMLInputElement>(
        '#storyEditor tbody tr[data-row-index="1"] td[data-column-key="weight"] input'
      )?.value
    ).toBe("777");

    storyCount.value = "10";
    storyCount.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((resolveWait) => window.setTimeout(resolveWait, 260));
    expect(root.querySelectorAll("#storyEditor tbody tr")).toHaveLength(12);
    storyCount.dispatchEvent(new Event("change", { bubbles: true }));
    expect(root.querySelectorAll("#storyEditor tbody tr")).toHaveLength(10);

    const language = root.querySelector<HTMLSelectElement>("#languageSelect");
    expect(language).not.toBeNull();
    if (!language) return;
    language.value = "en";
    language.dispatchEvent(new Event("change", { bubbles: true }));
    expect(root.querySelector("#viewerTitle")?.textContent).toBe(getUiText("en").viewerTitle);

    root.querySelector<HTMLButtonElement>("#themeButton")?.click();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(fakeViewerState.instances[0]?.background).toBe(0x0f1720);

    expect(FakeResizeObserver.instances.length).toBeGreaterThan(0);
    FakeResizeObserver.instances.at(-1)?.trigger();
    cleanup();
    expect(root.childElementCount).toBe(0);
    expect(fakeViewerState.instances[0]?.disposed).toBe(true);
    expect(FakeResizeObserver.instances.every((observer) => observer.disconnected)).toBe(true);
  });

  it("switches result types and ignores an older async file read", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const cleanup = bootstrapApp(root);
    const resultInput = root.querySelector<HTMLInputElement>("#resultInput");
    const mode = root.querySelector<HTMLSelectElement>("#viewerModeSelect");
    expect(resultInput).not.toBeNull();
    expect(mode).not.toBeNull();
    if (!resultInput || !mode) return;

    const complexText = readFileSync(
      resolve(process.cwd(), "reference/complex/Test_simple_ceig.dat"),
      "utf8"
    );
    let resolveSlow: ((value: ArrayBuffer) => void) | undefined;
    const slowBuffer = new Promise<ArrayBuffer>((resolveBuffer) => {
      resolveSlow = resolveBuffer;
    });
    const slowFile = {
      name: "older-complex.dat",
      arrayBuffer: () => slowBuffer
    } as File;

    setInputFiles(resultInput, [slowFile]);
    resultInput.dispatchEvent(new Event("change", { bubbles: true }));
    setInputFiles(resultInput, [textFile("latest-response.csv", RESPONSE_TEXT)]);
    resultInput.dispatchEvent(new Event("change", { bubbles: true }));

    await vi.waitFor(() => {
      expect(mode.value).toBe("response");
      expect(fakeViewerState.instances[0]?.kind).toBe("response");
    });
    resolveSlow?.(new TextEncoder().encode(complexText).buffer as ArrayBuffer);
    await new Promise((resolveWait) => window.setTimeout(resolveWait, 0));
    expect(mode.value).toBe("response");
    expect(fakeViewerState.instances[0]?.kind).toBe("response");

    setInputFiles(resultInput, [
      textFile("invalid-response.csv", RESPONSE_TEXT.replace("質点数,1", "質点数,2"))
    ]);
    resultInput.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => {
      expect(root.querySelector("#editorStatus")?.textContent).toContain(
        "時刻歴応答の階数が一致しません"
      );
    });
    expect(mode.value).toBe("real");
    expect(root.querySelectorAll("#responseTableBody tr")).toHaveLength(0);

    const language = root.querySelector<HTMLSelectElement>("#languageSelect");
    expect(language).not.toBeNull();
    if (!language) return;
    language.value = "en";
    language.dispatchEvent(new Event("change", { bubbles: true }));
    expect(root.querySelector("#editorStatus")?.textContent).toContain(
      "Response story count mismatch"
    );

    cleanup();
  });

  it("keeps an external real-mode result across unchanged builds and restores generated modes after an invalid replacement", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const cleanup = bootstrapApp(root);
    const resultInput = root.querySelector<HTMLInputElement>("#resultInput");
    const mode = root.querySelector<HTMLSelectElement>("#viewerModeSelect");
    expect(resultInput).not.toBeNull();
    expect(mode).not.toBeNull();
    if (!resultInput || !mode) return;

    mode.value = "real";
    mode.dispatchEvent(new Event("change", { bubbles: true }));

    const generatedFrequency = fakeViewerState.instances[0]?.realModeFrequency;
    expect(generatedFrequency).not.toBeNull();
    expect(generatedFrequency).not.toBe(99);

    setInputFiles(resultInput, [textFile("external-modal.dat", EXTERNAL_MODAL_TEXT)]);
    resultInput.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => {
      expect(fakeViewerState.instances[0]?.realModeFrequency).toBe(99);
    });

    root.querySelector<HTMLButtonElement>("#editorBuildButton")?.click();
    expect(fakeViewerState.instances[0]?.realModeFrequency).toBe(99);

    setInputFiles(resultInput, [textFile("invalid-modal.dat", "#ModalResult\ninvalid")]);
    resultInput.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => {
      expect(root.querySelector("#editorStatus")?.classList.contains("is-invalid")).toBe(true);
    });
    expect(fakeViewerState.instances[0]?.realModeFrequency).toBe(generatedFrequency);

    cleanup();
  });

  it("invalidates a pending result read as soon as story-count input begins", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const cleanup = bootstrapApp(root);
    const resultInput = root.querySelector<HTMLInputElement>("#resultInput");
    const storyCount = root.querySelector<HTMLInputElement>("#editorMassN");
    const mode = root.querySelector<HTMLSelectElement>("#viewerModeSelect");
    expect(resultInput).not.toBeNull();
    expect(storyCount).not.toBeNull();
    expect(mode).not.toBeNull();
    if (!resultInput || !storyCount || !mode) return;

    let resolveRead: ((value: ArrayBuffer) => void) | undefined;
    const read = new Promise<ArrayBuffer>((resolveBuffer) => {
      resolveRead = resolveBuffer;
    });
    setInputFiles(resultInput, [{ name: "pending-response.csv", arrayBuffer: () => read } as File]);
    resultInput.dispatchEvent(new Event("change", { bubbles: true }));

    storyCount.value = "";
    storyCount.dispatchEvent(new Event("input", { bubbles: true }));
    resolveRead?.(new TextEncoder().encode(RESPONSE_TEXT).buffer as ArrayBuffer);
    await new Promise((resolveWait) => window.setTimeout(resolveWait, 0));

    expect(mode.value).not.toBe("response");
    expect(root.querySelectorAll("#responseTableBody tr")).toHaveLength(0);
    cleanup();
  });

  it("keeps the editor usable and localizes the WebGL-unavailable fallback", () => {
    fakeViewerState.throwOnConstruct = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const root = document.createElement("div");
    document.body.append(root);

    const cleanup = bootstrapApp(root);
    const fallback = root.querySelector<HTMLElement>("#viewerContainer");
    expect(fallback?.dataset.viewerUnavailable).toBe("true");
    expect(fallback?.getAttribute("role")).toBe("status");
    expect(fallback?.textContent).toBe(getUiText("ja").viewerUnavailable);
    expect(root.querySelector("#editorStatus")?.classList.contains("is-valid")).toBe(true);
    for (const id of [
      "viewerModeSelect",
      "viewerModeIndexSelect",
      "viewerPlayButton",
      "viewerSeek",
      "viewerScale",
      "viewerRotation",
      "viewerSpeed",
      "viewerResetButton"
    ]) {
      expect(root.querySelector<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>(`#${id}`)?.disabled)
        .toBe(true);
    }
    expect(root.querySelector<HTMLInputElement>("#resultInput")?.disabled).toBe(false);
    expect(root.querySelector<HTMLSelectElement>("#responseProfileMetricSelect")?.disabled).toBe(
      false
    );

    const language = root.querySelector<HTMLSelectElement>("#languageSelect");
    expect(language).not.toBeNull();
    if (!language) return;
    language.value = "en";
    language.dispatchEvent(new Event("change", { bubbles: true }));
    expect(fallback?.textContent).toBe(getUiText("en").viewerUnavailable);
    expect(warn).toHaveBeenCalledOnce();

    cleanup();
  });
});
