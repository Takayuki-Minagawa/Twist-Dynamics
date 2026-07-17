import { describe, expect, it } from "vitest";
import {
  MODEL_EDITOR_SECTION_IDS,
  createEmptyEditorRow,
  getEditorColumnOptions,
  getEditorTableSchema,
  parseEditorTableText,
  serializeEditorTableText,
  validateEditorRow,
  validateEditorRows,
  type EditorRow
} from "../src/app/modelEditorSchema";

describe("model editor table schemas", () => {
  it("covers every Phase 2 editor section with reusable column metadata", () => {
    expect(MODEL_EDITOR_SECTION_IDS).toEqual([
      "stories",
      "floors",
      "columns",
      "wallCharas",
      "walls",
      "massDampers",
      "braceDampers"
    ]);

    for (const section of MODEL_EDITOR_SECTION_IDS) {
      const schema = getEditorTableSchema(section);
      expect(schema.columns.length).toBeGreaterThan(0);
      expect(schema.columns.every((column) => column.input.length > 0)).toBe(true);
      expect(schema.columns.filter((column) => column.input === "number").every((column) => column.unit)).toBe(true);
    }

    const wallName = getEditorTableSchema("walls").columns.find((column) => column.key === "name");
    expect(wallName?.input).toBe("select");
    expect(wallName?.optionSource).toBe("wallCharaNames");

    const visible = getEditorTableSchema("walls").columns.find((column) => column.key === "isVisible");
    expect(visible?.label.en).toBe("Visible");
  });

  it("creates section-aware defaults without inventing element story numbers", () => {
    expect(createEmptyEditorRow("stories", 2).layer).toBe("3");
    expect(createEmptyEditorRow("floors", 2).layer).toBe("3");
    expect(createEmptyEditorRow("columns", 8).layer).toBe("1");
    expect(createEmptyEditorRow("walls").isVisible).toBe("true");
    expect(createEmptyEditorRow("braceDampers").direct).toBe("X");
  });

  it("parses and serializes legacy column CSV rows", () => {
    const parsed = parseEditorTableText(
      "columns",
      "1, 0, 0, 10, 20\n2,100,200,30,40",
      { context: { storyCount: 2 } }
    );

    expect(parsed.issues).toEqual([]);
    expect(parsed.rows).toEqual([
      { layer: "1", x: "0", y: "0", kx: "10", ky: "20" },
      { layer: "2", x: "100", y: "200", kx: "30", ky: "40" }
    ]);
    expect(serializeEditorTableText("columns", parsed.rows)).toBe(
      "1,0,0,10,20\n2,100,200,30,40"
    );
  });

  it("round-trips variable floor polygon fields through one points cell", () => {
    const source = "1,0,0,0,500,1000,500,1000,0";
    const parsed = parseEditorTableText("floors", source, { context: { storyCount: 1 } });

    expect(parsed.issues).toEqual([]);
    expect(parsed.rows[0]).toEqual({
      layer: "1",
      points: "0,0,0,500,1000,500,1000,0"
    });
    expect(serializeEditorTableText("floors", parsed.rows)).toBe(source);
  });

  it("preserves commas and quotes in a wall-property memo", () => {
    const source = 'W1,10,0.02,0,true,false,"exterior, \"\"north\"\""';
    const parsed = parseEditorTableText("wallCharas", source);

    expect(parsed.issues).toEqual([]);
    expect(parsed.rows[0].memo).toBe('exterior, "north"');

    const serialized = serializeEditorTableText("wallCharas", parsed.rows);
    expect(parseEditorTableText("wallCharas", serialized).rows).toEqual(parsed.rows);
  });

  it("auto-detects spreadsheet TSV for integrated story rows", () => {
    const text = [
      "1\t300\t120\t22000\t500\t250",
      "2\t600\t110\t21000\t500\t250"
    ].join("\n");
    const parsed = parseEditorTableText("stories", text);

    expect(parsed.delimiter).toBe("\t");
    expect(parsed.issues).toEqual([]);
    expect(parsed.rows[1]).toMatchObject({
      layer: "2",
      zLevel: "600",
      weight: "110",
      centerX: "500",
      centerY: "250"
    });
    expect(serializeEditorTableText("stories", parsed.rows, { delimiter: "\t" })).toBe(text);
  });

  it("reports cell, row, and cross-row validation issues", () => {
    const wall: EditorRow = {
      layer: "3",
      name: "MISSING",
      x1: "0",
      y1: "0",
      x2: "10",
      y2: "10",
      isVisible: "maybe"
    };
    const issues = validateEditorRow("walls", wall, 0, {
      storyCount: 2,
      wallCharaNames: new Set(["W1"])
    });

    expect(issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["cell.option", "cell.boolean", "row.layerRange", "row.wallAxis"])
    );

    const stories = parseEditorTableText(
      "stories",
      "1,300,100,1000,0,0\n1,250,100,1000,0,0",
      { validate: false }
    ).rows;
    expect(validateEditorRows("stories", stories).map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["table.duplicate", "table.storySequence", "table.zLevelOrder"])
    );
  });

  it("resolves dynamic wall-property options from validation context", () => {
    const nameColumn = getEditorTableSchema("walls").columns.find((column) => column.key === "name");
    expect(nameColumn).toBeDefined();
    const options = getEditorColumnOptions(nameColumn!, {
      wallCharaNames: ["W_EXT", "W_INT"]
    });
    expect(options.map((option) => option.value)).toEqual(["W_EXT", "W_INT"]);
  });

  it("keeps invalid pasted cells available for inline correction", () => {
    const parsed = parseEditorTableText("braceDampers", "1,0,0,Z,oops,0,90,150,yes,false", {
      context: { storyCount: 1 }
    });

    expect(parsed.rows[0].direct).toBe("Z");
    expect(parsed.rows[0].k).toBe("oops");
    expect(parsed.rows[0].isLightPos).toBe("yes");
    expect(parsed.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["cell.option", "cell.number", "cell.boolean"])
    );
  });
});
