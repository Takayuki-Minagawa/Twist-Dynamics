// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from "vitest";
import { getUiText } from "../src/app/i18n";
import { createAppView } from "../src/app/view";

afterEach(() => {
  document.body.replaceChildren();
});

describe("peak response profile controls", () => {
  it("exposes every supported height-profile metric through one labelled selector", () => {
    const root = document.createElement("div");
    document.body.append(root);
    const view = createAppView(root);

    expect(view).not.toBeNull();
    if (!view) return;
    expect(view.responseProfileMetricLabel.htmlFor).toBe("responseProfileMetricSelect");
    expect(Array.from(view.responseProfileMetricSelect.options, (option) => option.value)).toEqual([
      "displacement",
      "interstoryDrift",
      "rotation",
      "acceleration"
    ]);
    expect(view.responseProfileMetricSelect.value).toBe("displacement");
  });

  it("labels the Japanese response table as interstory drift angle", () => {
    expect(getUiText("ja").responseHeaders).toContain("最大層間変形角 X (-)");
    expect(getUiText("ja").responseHeaders).toContain("最大層間変形角 Y (-)");
  });
});
