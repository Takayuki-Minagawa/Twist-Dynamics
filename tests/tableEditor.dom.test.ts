// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from "vitest";
import { createTableEditor } from "../src/app/tableEditor";

function createRoot(): HTMLDivElement {
  const root = document.createElement("div");
  document.body.append(root);
  return root;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("table editor DOM integration", () => {
  it("adds and deletes rows while keeping accessible cell associations", () => {
    const root = createRoot();
    const editor = createTableEditor({
      root,
      section: "columns",
      rows: [{ layer: "1", x: "0", y: "0", kx: "100", ky: "120" }],
      getValidationContext: () => ({ storyCount: 2 })
    });

    const firstInput = root.querySelector<HTMLInputElement>("tbody input");
    expect(firstInput?.getAttribute("aria-label")).toContain("1行目");
    expect(firstInput?.getAttribute("aria-describedby")).toContain("-error");

    editor.addRow();
    expect(editor.getRows()).toHaveLength(2);
    expect(root.querySelectorAll("tbody tr")).toHaveLength(2);

    editor.deleteRow(0);
    expect(editor.getRows()).toHaveLength(1);
    expect(root.querySelectorAll("tbody tr")).toHaveLength(1);
    editor.destroy();
  });

  it("applies spreadsheet TSV and preserves a dirty bulk draft during cell edits", () => {
    const root = createRoot();
    const editor = createTableEditor({
      root,
      section: "columns",
      rows: [{ layer: "1", x: "0", y: "0", kx: "100", ky: "120" }],
      getValidationContext: () => ({ storyCount: 2 })
    });

    const parsed = editor.applyBulkText("1\t10\t20\t300\t400\n2\t30\t40\t500\t600");
    expect(parsed.issues).toEqual([]);
    expect(editor.getRows()).toEqual([
      { layer: "1", x: "10", y: "20", kx: "300", ky: "400" },
      { layer: "2", x: "30", y: "40", kx: "500", ky: "600" }
    ]);

    const bulk = root.querySelector<HTMLTextAreaElement>(".model-table-editor-bulk-text");
    expect(bulk).not.toBeNull();
    if (!bulk) return;
    bulk.value = "1,99,88,777,666";
    bulk.dispatchEvent(new Event("input", { bubbles: true }));

    const cell = root.querySelector<HTMLInputElement>('tbody input[aria-label^="階"]');
    expect(cell).not.toBeNull();
    if (!cell) return;
    cell.value = "2";
    cell.dispatchEvent(new Event("input", { bubbles: true }));

    expect(bulk.value).toBe("1,99,88,777,666");
    expect(bulk.dataset.dirty).toBe("true");
  });

  it("refreshes dynamic wall-property options and localized labels", () => {
    const root = createRoot();
    let wallNames = ["structural", "facade"];
    const editor = createTableEditor({
      root,
      section: "walls",
      locale: "ja",
      rows: [
        {
          layer: "1",
          name: "structural",
          x1: "0",
          y1: "0",
          x2: "0",
          y2: "100",
          isVisible: "true"
        }
      ],
      getValidationContext: () => ({ storyCount: 1, wallCharaNames: wallNames })
    });

    const optionValues = () =>
      Array.from(root.querySelectorAll<HTMLSelectElement>("tbody select option"), (option) =>
        option.value
      );
    expect(optionValues()).toEqual(["structural", "facade"]);

    wallNames = ["structural", "facade", "partition"];
    editor.refresh();
    expect(optionValues()).toEqual(["structural", "facade", "partition"]);

    editor.setLocale("en", {
      addRow: "Add row",
      deleteRow: "Delete row",
      actions: "Actions",
      bulkSummary: "Bulk paste",
      bulkHint: "Paste rows",
      applyBulk: "Apply",
      copyFromTable: "Reset"
    });
    expect(root.querySelector("h3")?.textContent).toBe("Wall placement");
    expect(root.querySelector("th:last-child")?.textContent).toBe("Actions");
    expect(
      root.querySelector<HTMLButtonElement>(".model-table-delete-row")?.getAttribute("aria-label")
    ).toContain("row 1");
    expect(
      root.querySelector<HTMLTextAreaElement>("textarea")?.getAttribute("aria-label")
    ).toBe("Bulk paste");
  });

  it("marks an invalid cell and connects it to its inline error", () => {
    const root = createRoot();
    createTableEditor({
      root,
      section: "columns",
      rows: [{ layer: "3", x: "0", y: "0", kx: "bad", ky: "120" }],
      getValidationContext: () => ({ storyCount: 2 })
    });

    const stiffnessInput = Array.from(root.querySelectorAll<HTMLInputElement>("tbody input"))
      .find((input) => input.value === "bad");
    expect(stiffnessInput?.getAttribute("aria-invalid")).toBe("true");
    const errorId = stiffnessInput?.getAttribute("aria-describedby")?.split(" ")[0];
    expect(errorId).toBeTruthy();
    expect(document.getElementById(errorId ?? "")?.textContent).toBe(
      "有限の数値を入力してください。"
    );
  });
});
