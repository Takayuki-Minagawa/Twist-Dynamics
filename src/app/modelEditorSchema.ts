export type EditorLocale = "ja" | "en";

export type EditorSectionId =
  | "stories"
  | "floors"
  | "columns"
  | "wallCharas"
  | "walls"
  | "massDampers"
  | "braceDampers";

export type EditorInputKind =
  | "text"
  | "number"
  | "integer"
  | "boolean"
  | "select"
  | "points";

export type EditorOptionSource = "wallCharaNames";

export interface LocalizedText {
  ja: string;
  en: string;
}

export interface EditorSelectOption {
  value: string;
  label: LocalizedText;
}

export interface EditorColumnDefinition {
  key: string;
  label: LocalizedText;
  input: EditorInputKind;
  unit?: string;
  required?: boolean;
  min?: number;
  max?: number;
  options?: readonly EditorSelectOption[];
  optionSource?: EditorOptionSource;
  defaultValue?: string | ((rowIndex: number) => string);
  csv?: {
    /** Consume all remaining legacy CSV fields into this final table cell. */
    rest?: boolean;
    /** Expand the cell back to multiple comma-separated legacy CSV fields. */
    splitOnSerialize?: boolean;
  };
  points?: {
    minCount: number;
  };
}

export interface EditorTableSchema {
  id: EditorSectionId;
  label: LocalizedText;
  columns: readonly EditorColumnDefinition[];
  minRows?: number;
}

/**
 * Draft rows intentionally keep strings. This lets a table retain an incomplete
 * number (or invalid pasted value) long enough to display an inline error.
 */
export type EditorRow = Record<string, string>;

export interface EditorValidationContext {
  storyCount?: number;
  wallCharaNames?: ReadonlySet<string> | readonly string[];
  optionValues?: Partial<Record<EditorOptionSource, readonly string[]>>;
}

export type EditorValidationCode =
  | "csv.syntax"
  | "csv.columnCount"
  | "cell.required"
  | "cell.number"
  | "cell.integer"
  | "cell.boolean"
  | "cell.option"
  | "cell.min"
  | "cell.max"
  | "cell.pointCount"
  | "cell.pointNumber"
  | "row.layerRange"
  | "row.wallAxis"
  | "row.wallLength"
  | "table.duplicate"
  | "table.storySequence"
  | "table.zLevelOrder";

export interface EditorValidationIssue {
  section: EditorSectionId;
  rowIndex: number | null;
  columnKey?: string;
  code: EditorValidationCode;
  message: string;
}

export function getLocalizedValidationMessage(
  validationIssue: EditorValidationIssue,
  locale: EditorLocale
): string {
  if (locale === "en") return validationIssue.message;
  const messages: Record<EditorValidationCode, string> = {
    "csv.syntax": "CSV の引用符または区切りが正しくありません。",
    "csv.columnCount": "CSV の列数が定義と一致しません。",
    "cell.required": "必須項目です。",
    "cell.number": "有限の数値を入力してください。",
    "cell.integer": "整数を入力してください。",
    "cell.boolean": "true/false または 1/0 を入力してください。",
    "cell.option": "候補から選択してください。",
    "cell.min": "値が最小値を下回っています。",
    "cell.max": "値が最大値を上回っています。",
    "cell.pointCount": "必要数以上の x,y 座標ペアを入力してください。",
    "cell.pointNumber": "すべての座標を数値で入力してください。",
    "row.layerRange": "階番号が建物の階数範囲外です。",
    "row.wallAxis": "壁は X または Y 軸に平行に配置してください。",
    "row.wallLength": "壁の始点と終点を異なる座標にしてください。",
    "table.duplicate": "同じ値が別の行でも使われています。",
    "table.storySequence": "階情報は 1 階から順番に並べてください。",
    "table.zLevelOrder": "Z レベルは下階から単調増加にしてください。"
  };
  return messages[validationIssue.code];
}

export interface ParseEditorTableOptions {
  delimiter?: "," | "\t" | "auto";
  hasHeader?: boolean;
  validate?: boolean;
  context?: EditorValidationContext;
}

export interface ParseEditorTableResult {
  rows: EditorRow[];
  issues: EditorValidationIssue[];
  delimiter: "," | "\t";
}

export interface SerializeEditorTableOptions {
  delimiter?: "," | "\t";
  includeHeader?: boolean;
}

const BOOLEAN_OPTIONS: readonly EditorSelectOption[] = [
  { value: "true", label: { ja: "はい", en: "True" } },
  { value: "false", label: { ja: "いいえ", en: "False" } }
];

const DIRECTION_OPTIONS: readonly EditorSelectOption[] = [
  { value: "X", label: { ja: "X", en: "X" } },
  { value: "Y", label: { ja: "Y", en: "Y" } }
];

const storyColumns: readonly EditorColumnDefinition[] = [
  {
    key: "layer",
    label: { ja: "階", en: "Story" },
    input: "integer",
    required: true,
    min: 1,
    defaultValue: (rowIndex) => String(rowIndex + 1)
  },
  {
    key: "zLevel",
    label: { ja: "上端 Z レベル", en: "Top Z level" },
    input: "number",
    unit: "cm",
    required: true
  },
  {
    key: "weight",
    label: { ja: "重量 W", en: "Weight W" },
    input: "number",
    unit: "kN",
    required: true
  },
  {
    key: "wMoment",
    label: { ja: "重量慣性モーメント", en: "Weight moment of inertia" },
    input: "number",
    unit: "kN·cm²",
    required: true
  },
  {
    key: "centerX",
    label: { ja: "重心 X", en: "Mass center X" },
    input: "number",
    unit: "cm",
    required: true
  },
  {
    key: "centerY",
    label: { ja: "重心 Y", en: "Mass center Y" },
    input: "number",
    unit: "cm",
    required: true
  }
];

const floorColumns: readonly EditorColumnDefinition[] = [
  {
    key: "layer",
    label: { ja: "床レベル", en: "Floor level" },
    input: "integer",
    required: true,
    min: 1,
    defaultValue: (rowIndex) => String(rowIndex + 1)
  },
  {
    key: "points",
    label: { ja: "外形頂点 (x,y; …)", en: "Outline points (x,y; …)" },
    input: "points",
    unit: "cm",
    required: true,
    csv: { rest: true, splitOnSerialize: true },
    points: { minCount: 3 }
  }
];

const columnColumns: readonly EditorColumnDefinition[] = [
  {
    key: "layer",
    label: { ja: "階", en: "Story" },
    input: "integer",
    required: true,
    min: 1,
    defaultValue: "1"
  },
  { key: "x", label: { ja: "X", en: "X" }, input: "number", unit: "cm", required: true },
  { key: "y", label: { ja: "Y", en: "Y" }, input: "number", unit: "cm", required: true },
  {
    key: "kx",
    label: { ja: "X 方向剛性 kx", en: "X stiffness kx" },
    input: "number",
    unit: "kN/cm",
    required: true
  },
  {
    key: "ky",
    label: { ja: "Y 方向剛性 ky", en: "Y stiffness ky" },
    input: "number",
    unit: "kN/cm",
    required: true
  }
];

const wallCharaColumns: readonly EditorColumnDefinition[] = [
  { key: "name", label: { ja: "名前", en: "Name" }, input: "text", required: true },
  {
    key: "k",
    label: { ja: "剛性 k", en: "Stiffness k" },
    input: "number",
    unit: "kN/cm or kN/cm²",
    required: true
  },
  { key: "h", label: { ja: "減衰定数 h", en: "Damping ratio h" }, input: "number", unit: "-", required: true },
  {
    key: "c",
    label: { ja: "減衰係数 c", en: "Damping c" },
    input: "number",
    unit: "kN·s/cm or kN·s/cm²",
    required: true
  },
  {
    key: "isEigenEffectK",
    label: { ja: "固有値剛性に算入", en: "Include in eigen stiffness" },
    input: "boolean",
    required: true,
    options: BOOLEAN_OPTIONS,
    defaultValue: "true"
  },
  {
    key: "isKCUnitChara",
    label: { ja: "単位長さ特性", en: "Per-unit-length property" },
    input: "boolean",
    required: true,
    options: BOOLEAN_OPTIONS,
    defaultValue: "false"
  },
  {
    key: "memo",
    label: { ja: "メモ", en: "Memo" },
    input: "text",
    csv: { rest: true }
  }
];

const wallColumns: readonly EditorColumnDefinition[] = [
  {
    key: "layer",
    label: { ja: "階", en: "Story" },
    input: "integer",
    required: true,
    min: 1,
    defaultValue: "1"
  },
  {
    key: "name",
    label: { ja: "壁特性", en: "Wall property" },
    input: "select",
    required: true,
    optionSource: "wallCharaNames"
  },
  { key: "x1", label: { ja: "始点 X", en: "Start X" }, input: "number", unit: "cm", required: true },
  { key: "y1", label: { ja: "始点 Y", en: "Start Y" }, input: "number", unit: "cm", required: true },
  { key: "x2", label: { ja: "終点 X", en: "End X" }, input: "number", unit: "cm", required: true },
  { key: "y2", label: { ja: "終点 Y", en: "End Y" }, input: "number", unit: "cm", required: true },
  {
    key: "isVisible",
    label: { ja: "表示する", en: "Visible" },
    input: "boolean",
    required: true,
    options: BOOLEAN_OPTIONS,
    defaultValue: "true"
  }
];

const massDamperColumns: readonly EditorColumnDefinition[] = [
  { key: "name", label: { ja: "名前", en: "Name" }, input: "text", required: true },
  {
    key: "layer",
    label: { ja: "階", en: "Story" },
    input: "integer",
    required: true,
    min: 1,
    defaultValue: "1"
  },
  { key: "x", label: { ja: "X", en: "X" }, input: "number", unit: "cm", required: true },
  { key: "y", label: { ja: "Y", en: "Y" }, input: "number", unit: "cm", required: true },
  { key: "weight", label: { ja: "重量", en: "Weight" }, input: "number", unit: "kN", required: true },
  { key: "freqX", label: { ja: "X 固有振動数", en: "X frequency" }, input: "number", unit: "Hz", required: true },
  { key: "freqY", label: { ja: "Y 固有振動数", en: "Y frequency" }, input: "number", unit: "Hz", required: true },
  { key: "hX", label: { ja: "X 減衰定数", en: "X damping ratio" }, input: "number", unit: "-", required: true },
  { key: "hY", label: { ja: "Y 減衰定数", en: "Y damping ratio" }, input: "number", unit: "-", required: true }
];

const braceDamperColumns: readonly EditorColumnDefinition[] = [
  {
    key: "layer",
    label: { ja: "階", en: "Story" },
    input: "integer",
    required: true,
    min: 1,
    defaultValue: "1"
  },
  { key: "x", label: { ja: "X", en: "X" }, input: "number", unit: "cm", required: true },
  { key: "y", label: { ja: "Y", en: "Y" }, input: "number", unit: "cm", required: true },
  {
    key: "direct",
    label: { ja: "方向", en: "Direction" },
    input: "select",
    required: true,
    options: DIRECTION_OPTIONS,
    defaultValue: "X"
  },
  { key: "k", label: { ja: "剛性 k", en: "Stiffness k" }, input: "number", unit: "kN/cm", required: true },
  { key: "c", label: { ja: "減衰係数 c", en: "Damping c" }, input: "number", unit: "kN·s/cm", required: true },
  { key: "width", label: { ja: "幅", en: "Width" }, input: "number", unit: "cm", required: true },
  { key: "height", label: { ja: "高さ", en: "Height" }, input: "number", unit: "cm", required: true },
  {
    key: "isLightPos",
    label: { ja: "正側配置", en: "Positive-side placement" },
    input: "boolean",
    required: true,
    options: BOOLEAN_OPTIONS,
    defaultValue: "true"
  },
  {
    key: "isEigenEffectK",
    label: { ja: "固有値剛性に算入", en: "Include in eigen stiffness" },
    input: "boolean",
    required: true,
    options: BOOLEAN_OPTIONS,
    defaultValue: "false"
  }
];

export const MODEL_EDITOR_SCHEMAS: Readonly<Record<EditorSectionId, EditorTableSchema>> = {
  stories: {
    id: "stories",
    label: { ja: "階情報", en: "Story data" },
    columns: storyColumns,
    minRows: 1
  },
  floors: {
    id: "floors",
    label: { ja: "床外形", en: "Floor outlines" },
    columns: floorColumns
  },
  columns: {
    id: "columns",
    label: { ja: "剛性要素", en: "Stiffness elements" },
    columns: columnColumns
  },
  wallCharas: {
    id: "wallCharas",
    label: { ja: "壁特性", en: "Wall properties" },
    columns: wallCharaColumns
  },
  walls: {
    id: "walls",
    label: { ja: "壁配置", en: "Wall placement" },
    columns: wallColumns
  },
  massDampers: {
    id: "massDampers",
    label: { ja: "マスダンパー", en: "Mass dampers" },
    columns: massDamperColumns
  },
  braceDampers: {
    id: "braceDampers",
    label: { ja: "ブレースダンパー", en: "Brace dampers" },
    columns: braceDamperColumns
  }
};

export const MODEL_EDITOR_SECTION_IDS = Object.freeze(
  Object.keys(MODEL_EDITOR_SCHEMAS) as EditorSectionId[]
);

export function getEditorTableSchema(section: EditorSectionId): EditorTableSchema {
  return MODEL_EDITOR_SCHEMAS[section];
}

export function getLocalizedText(text: LocalizedText, locale: EditorLocale): string {
  return text[locale];
}

export function createEmptyEditorRow(section: EditorSectionId, rowIndex = 0): EditorRow {
  const row: EditorRow = {};
  for (const column of getEditorTableSchema(section).columns) {
    const value = column.defaultValue;
    row[column.key] = typeof value === "function" ? value(rowIndex) : value ?? "";
  }
  return row;
}

export function cloneEditorRows(rows: readonly EditorRow[]): EditorRow[] {
  return rows.map((row) => ({ ...row }));
}

function normalizeBoolean(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return "true";
  if (normalized === "false" || normalized === "0") return "false";
  return null;
}

function pointTokens(value: string): string[] {
  return value
    .trim()
    .split(/[\s,;]+/)
    .filter((token) => token.length > 0);
}

function valuesForSource(
  source: EditorOptionSource,
  context: EditorValidationContext
): readonly string[] | undefined {
  const explicit = context.optionValues?.[source];
  if (explicit) return explicit;
  if (source === "wallCharaNames" && context.wallCharaNames !== undefined) {
    return Array.isArray(context.wallCharaNames)
      ? context.wallCharaNames
      : Array.from(context.wallCharaNames);
  }
  return undefined;
}

export function getEditorColumnOptions(
  column: EditorColumnDefinition,
  context: EditorValidationContext = {}
): readonly EditorSelectOption[] {
  if (column.options) return column.options;
  if (!column.optionSource) return [];
  return (valuesForSource(column.optionSource, context) ?? []).map((value) => ({
    value,
    label: { ja: value, en: value }
  }));
}

function issue(
  section: EditorSectionId,
  rowIndex: number | null,
  code: EditorValidationCode,
  message: string,
  columnKey?: string
): EditorValidationIssue {
  return { section, rowIndex, columnKey, code, message };
}

function finiteNumber(value: string): number | null {
  if (value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validateEditorRow(
  section: EditorSectionId,
  row: EditorRow,
  rowIndex = 0,
  context: EditorValidationContext = {}
): EditorValidationIssue[] {
  const schema = getEditorTableSchema(section);
  const issues: EditorValidationIssue[] = [];

  for (const column of schema.columns) {
    const raw = row[column.key] ?? "";
    const value = raw.trim();
    if (column.required && value.length === 0) {
      issues.push(issue(section, rowIndex, "cell.required", "A value is required.", column.key));
      continue;
    }
    if (value.length === 0) continue;

    if (column.input === "number" || column.input === "integer") {
      const parsed = finiteNumber(value);
      if (parsed === null) {
        issues.push(issue(section, rowIndex, "cell.number", "Enter a finite number.", column.key));
        continue;
      }
      if (column.input === "integer" && !Number.isInteger(parsed)) {
        issues.push(issue(section, rowIndex, "cell.integer", "Enter an integer.", column.key));
        continue;
      }
      if (column.min !== undefined && parsed < column.min) {
        issues.push(
          issue(section, rowIndex, "cell.min", `Value must be at least ${column.min}.`, column.key)
        );
      }
      if (column.max !== undefined && parsed > column.max) {
        issues.push(
          issue(section, rowIndex, "cell.max", `Value must be at most ${column.max}.`, column.key)
        );
      }
    } else if (column.input === "boolean") {
      if (normalizeBoolean(value) === null) {
        issues.push(
          issue(section, rowIndex, "cell.boolean", "Use true/false or 1/0.", column.key)
        );
      }
    } else if (column.input === "select") {
      const allowed = column.options?.map((option) => option.value) ??
        (column.optionSource ? valuesForSource(column.optionSource, context) : undefined);
      if (allowed !== undefined && !allowed.includes(value)) {
        issues.push(
          issue(section, rowIndex, "cell.option", "Select one of the available values.", column.key)
        );
      }
    } else if (column.input === "points") {
      const tokens = pointTokens(value);
      const minCount = column.points?.minCount ?? 1;
      if (tokens.length % 2 !== 0 || tokens.length / 2 < minCount) {
        issues.push(
          issue(
            section,
            rowIndex,
            "cell.pointCount",
            `Enter at least ${minCount} x,y point pairs.`,
            column.key
          )
        );
      } else if (tokens.some((token) => finiteNumber(token) === null)) {
        issues.push(
          issue(section, rowIndex, "cell.pointNumber", "Every point coordinate must be numeric.", column.key)
        );
      }
    }
  }

  const layer = finiteNumber(row.layer ?? "");
  if (layer !== null && Number.isInteger(layer) && context.storyCount !== undefined) {
    const maxLayer = section === "floors" ? context.storyCount + 1 : context.storyCount;
    if (layer < 1 || layer > maxLayer) {
      issues.push(
        issue(section, rowIndex, "row.layerRange", `Layer must be between 1 and ${maxLayer}.`, "layer")
      );
    }
  }

  if (section === "walls") {
    const x1 = finiteNumber(row.x1 ?? "");
    const y1 = finiteNumber(row.y1 ?? "");
    const x2 = finiteNumber(row.x2 ?? "");
    const y2 = finiteNumber(row.y2 ?? "");
    if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
      if (x1 === x2 && y1 === y2) {
        issues.push(
          issue(section, rowIndex, "row.wallLength", "Wall endpoints must be different.")
        );
      } else if (x1 !== x2 && y1 !== y2) {
        issues.push(
          issue(section, rowIndex, "row.wallAxis", "Wall must be aligned to the X or Y axis.")
        );
      }
    }
  }

  return issues;
}

function duplicateIssues(
  section: EditorSectionId,
  rows: readonly EditorRow[],
  key: string
): EditorValidationIssue[] {
  const firstIndex = new Map<string, number>();
  const issues: EditorValidationIssue[] = [];
  rows.forEach((row, rowIndex) => {
    const value = (row[key] ?? "").trim();
    if (value.length === 0) return;
    const prior = firstIndex.get(value);
    if (prior === undefined) {
      firstIndex.set(value, rowIndex);
      return;
    }
    issues.push(
      issue(
        section,
        rowIndex,
        "table.duplicate",
        `Value duplicates row ${prior + 1}.`,
        key
      )
    );
  });
  return issues;
}

export function validateEditorRows(
  section: EditorSectionId,
  rows: readonly EditorRow[],
  context: EditorValidationContext = {}
): EditorValidationIssue[] {
  const effectiveContext: EditorValidationContext = {
    ...context,
    storyCount: context.storyCount ?? (section === "stories" ? rows.length : undefined)
  };
  const issues = rows.flatMap((row, rowIndex) =>
    validateEditorRow(section, row, rowIndex, effectiveContext)
  );

  if (section === "stories") {
    issues.push(...duplicateIssues(section, rows, "layer"));
    let previousZ: number | null = null;
    rows.forEach((row, rowIndex) => {
      const layer = finiteNumber(row.layer ?? "");
      if (layer !== null && Number.isInteger(layer) && layer !== rowIndex + 1) {
        issues.push(
          issue(
            section,
            rowIndex,
            "table.storySequence",
            `Story rows must be ordered 1 through ${rows.length}.`,
            "layer"
          )
        );
      }
      const z = finiteNumber(row.zLevel ?? "");
      if (z !== null) {
        if (previousZ !== null && z < previousZ) {
          issues.push(
            issue(
              section,
              rowIndex,
              "table.zLevelOrder",
              "Z levels must be monotonic non-decreasing.",
              "zLevel"
            )
          );
        }
        previousZ = z;
      }
    });
  } else if (section === "wallCharas") {
    issues.push(...duplicateIssues(section, rows, "name"));
  }

  return issues;
}

function detectDelimiter(text: string): "," | "\t" {
  let commaCount = 0;
  let tabCount = 0;
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && (char === "\n" || char === "\r")) {
      break;
    } else if (!quoted && char === ",") {
      commaCount++;
    } else if (!quoted && char === "\t") {
      tabCount++;
    }
  }
  return tabCount > commaCount ? "\t" : ",";
}

interface DelimitedRecordsResult {
  records: string[][];
  syntaxError?: string;
}

function parseDelimitedRecords(text: string, delimiter: "," | "\t"): DelimitedRecordsResult {
  const source = text.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  const finishRecord = (): void => {
    record.push(field.trim());
    field = "";
    if (record.some((value) => value.length > 0)) records.push(record);
    record = [];
  };

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === delimiter) {
      record.push(field.trim());
      field = "";
    } else if (char === "\n" || char === "\r") {
      finishRecord();
      if (char === "\r" && source[i + 1] === "\n") i++;
    } else {
      field += char;
    }
  }

  if (quoted) {
    return { records, syntaxError: "CSV contains an unterminated quoted field." };
  }
  if (field.length > 0 || record.length > 0) finishRecord();
  return { records };
}

function normalizeParsedCell(column: EditorColumnDefinition, value: string): string {
  if (column.input === "boolean") return normalizeBoolean(value) ?? value.trim();
  if (column.input === "points") return pointTokens(value).join(",");
  return value.trim();
}

function fieldsToRow(
  section: EditorSectionId,
  fields: readonly string[],
  rowIndex: number
): { row: EditorRow; issues: EditorValidationIssue[] } {
  const schema = getEditorTableSchema(section);
  const row = createEmptyEditorRow(section, rowIndex);
  const issues: EditorValidationIssue[] = [];
  const restIndex = schema.columns.findIndex((column) => column.csv?.rest);
  const minimumCount = schema.columns.reduce(
    (last, column, index) => (column.required ? index + 1 : last),
    0
  );

  if (fields.length < minimumCount || (restIndex < 0 && fields.length > schema.columns.length)) {
    const expected = restIndex < 0
      ? `${minimumCount}-${schema.columns.length}`
      : `at least ${minimumCount}`;
    issues.push(
      issue(
        section,
        rowIndex,
        "csv.columnCount",
        `CSV row has ${fields.length} fields; expected ${expected}.`
      )
    );
  }

  schema.columns.forEach((column, columnIndex) => {
    const raw = column.csv?.rest
      ? fields.slice(columnIndex).join(",")
      : fields[columnIndex] ?? row[column.key] ?? "";
    row[column.key] = normalizeParsedCell(column, raw);
  });

  return { row, issues };
}

export function parseEditorTableText(
  section: EditorSectionId,
  text: string,
  options: ParseEditorTableOptions = {}
): ParseEditorTableResult {
  const delimiter = options.delimiter === undefined || options.delimiter === "auto"
    ? detectDelimiter(text)
    : options.delimiter;
  const parsed = parseDelimitedRecords(text, delimiter);
  const records = options.hasHeader ? parsed.records.slice(1) : parsed.records;
  const rows: EditorRow[] = [];
  const issues: EditorValidationIssue[] = [];

  if (parsed.syntaxError) {
    issues.push(issue(section, null, "csv.syntax", parsed.syntaxError));
  }

  records.forEach((fields, rowIndex) => {
    const converted = fieldsToRow(section, fields, rowIndex);
    rows.push(converted.row);
    issues.push(...converted.issues);
  });

  if (options.validate !== false) {
    issues.push(...validateEditorRows(section, rows, options.context));
  }

  return { rows, issues, delimiter };
}

function escapeDelimitedField(value: string, delimiter: "," | "\t"): string {
  if (
    value.includes(delimiter) ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r") ||
    value.trim() !== value
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowToFields(
  schema: EditorTableSchema,
  row: EditorRow,
  delimiter: "," | "\t"
): string[] {
  const fields: string[] = [];
  for (const column of schema.columns) {
    let value = row[column.key] ?? "";
    if (column.input === "boolean") value = normalizeBoolean(value) ?? value;
    if (column.input === "points") value = pointTokens(value).join(",");

    if (column.csv?.splitOnSerialize && delimiter === ",") {
      fields.push(...pointTokens(value));
    } else {
      fields.push(value);
    }
  }
  return fields;
}

export function serializeEditorTableText(
  section: EditorSectionId,
  rows: readonly EditorRow[],
  options: SerializeEditorTableOptions = {}
): string {
  const schema = getEditorTableSchema(section);
  const delimiter = options.delimiter ?? ",";
  const lines: string[] = [];
  if (options.includeHeader) {
    lines.push(schema.columns.map((column) => escapeDelimitedField(column.key, delimiter)).join(delimiter));
  }
  for (const row of rows) {
    const fields = rowToFields(schema, row, delimiter);
    lines.push(fields.map((value) => escapeDelimitedField(value, delimiter)).join(delimiter));
  }
  return lines.join("\n");
}
