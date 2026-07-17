import {
  cloneEditorRows,
  createEmptyEditorRow,
  getEditorColumnOptions,
  getEditorTableSchema,
  getLocalizedText,
  getLocalizedValidationMessage,
  parseEditorTableText,
  serializeEditorTableText,
  validateEditorRows,
  type EditorColumnDefinition,
  type EditorLocale,
  type EditorRow,
  type EditorSectionId,
  type EditorValidationContext,
  type EditorValidationIssue,
  type ParseEditorTableResult
} from "./modelEditorSchema";

export interface TableEditorLabels {
  addRow: string;
  deleteRow: string;
  actions: string;
  bulkSummary: string;
  bulkHint: string;
  applyBulk: string;
  copyFromTable: string;
}

export type TableEditorChangeSource = "cell" | "add" | "delete" | "bulk" | "api";

export interface TableEditorChange {
  section: EditorSectionId;
  rows: EditorRow[];
  issues: EditorValidationIssue[];
  source: TableEditorChangeSource;
}

export interface CreateTableEditorOptions {
  root: HTMLElement;
  section: EditorSectionId;
  rows?: readonly EditorRow[];
  locale?: EditorLocale;
  labels?: Partial<TableEditorLabels>;
  bulkDelimiter?: "," | "\t";
  getValidationContext?: () => EditorValidationContext;
  onChange?: (change: TableEditorChange) => void;
}

export interface TableEditorController {
  getRows(): EditorRow[];
  setRows(rows: readonly EditorRow[], source?: TableEditorChangeSource): void;
  getIssues(): EditorValidationIssue[];
  addRow(): void;
  deleteRow(rowIndex: number): void;
  applyBulkText(text?: string): ParseEditorTableResult;
  syncBulkFromRows(): string;
  refresh(): void;
  setLocale(locale: EditorLocale, labels?: Partial<TableEditorLabels>): void;
  destroy(): void;
}

const DEFAULT_LABELS: TableEditorLabels = {
  addRow: "Add row",
  deleteRow: "Delete",
  actions: "Actions",
  bulkSummary: "Bulk paste",
  bulkHint: "Paste comma-separated rows or tab-separated cells from a spreadsheet.",
  applyBulk: "Apply pasted rows",
  copyFromTable: "Reset text from table"
};

function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className?: string
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  return element;
}

function createButton(label: string, className: string): HTMLButtonElement {
  const button = createElement("button", className);
  button.type = "button";
  button.textContent = label;
  return button;
}

function cloneIssues(issues: readonly EditorValidationIssue[]): EditorValidationIssue[] {
  return issues.map((entry) => ({ ...entry }));
}

function validBoolean(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return null;
}

export function createTableEditor(options: CreateTableEditorOptions): TableEditorController {
  const schema = getEditorTableSchema(options.section);
  let labels: TableEditorLabels = { ...DEFAULT_LABELS, ...options.labels };
  const bulkDelimiter = options.bulkDelimiter ?? ",";
  let locale = options.locale ?? "ja";
  let rows = cloneEditorRows(options.rows ?? []);
  let csvIssues: EditorValidationIssue[] = [];
  let currentIssues: EditorValidationIssue[] = [];
  let destroyed = false;

  const wrapper = createElement("section", "model-table-editor");
  wrapper.dataset.section = schema.id;
  const heading = createElement("h3", "model-table-editor-title");
  const scroll = createElement("div", "model-table-editor-scroll");
  const table = createElement("table", "model-table-editor-table");
  const head = createElement("thead");
  const body = createElement("tbody");
  const footer = createElement("div", "model-table-editor-actions");
  const addButton = createButton(labels.addRow, "model-table-add-row");
  const details = createElement("details", "model-table-editor-bulk");
  const summary = createElement("summary");
  const bulkHint = createElement("p", "model-table-editor-bulk-hint");
  const bulkText = createElement("textarea", "model-table-editor-bulk-text");
  const bulkActions = createElement("div", "model-table-editor-bulk-actions");
  const applyBulkButton = createButton(labels.applyBulk, "model-table-apply-bulk");
  const resetBulkButton = createButton(labels.copyFromTable, "model-table-reset-bulk");
  const bulkError = createElement("div", "model-table-editor-bulk-error");
  bulkError.setAttribute("role", "alert");
  bulkError.id = `model-table-${schema.id}-bulk-error`;
  bulkText.setAttribute("aria-describedby", bulkError.id);

  const cellErrors = new Map<string, HTMLElement>();
  const cellInputs = new Map<string, HTMLElement>();
  const rowErrors = new Map<number, HTMLElement>();

  function validationContext(): EditorValidationContext {
    return options.getValidationContext?.() ?? {};
  }

  function ensureMinimumRows(): void {
    const minimum = schema.minRows ?? 0;
    while (rows.length < minimum) {
      rows.push(createEmptyEditorRow(schema.id, rows.length));
    }
  }

  function keyFor(rowIndex: number, columnKey: string): string {
    return `${rowIndex}:${columnKey}`;
  }

  function emit(source: TableEditorChangeSource): void {
    options.onChange?.({
      section: schema.id,
      rows: cloneEditorRows(rows),
      issues: cloneIssues(currentIssues),
      source
    });
  }

  function updateStaticLabels(): void {
    heading.textContent = getLocalizedText(schema.label, locale);
    summary.textContent = labels.bulkSummary;
    bulkHint.textContent = labels.bulkHint;
    bulkText.setAttribute("aria-label", labels.bulkSummary);
    addButton.textContent = labels.addRow;
    applyBulkButton.textContent = labels.applyBulk;
    resetBulkButton.textContent = labels.copyFromTable;
  }

  function renderHead(): void {
    const row = createElement("tr");
    for (const column of schema.columns) {
      const header = createElement("th");
      header.scope = "col";
      const label = getLocalizedText(column.label, locale);
      header.textContent = column.unit ? `${label} (${column.unit})` : label;
      if (column.required) header.dataset.required = "true";
      row.append(header);
    }
    const actionsHeader = createElement("th");
    actionsHeader.scope = "col";
    actionsHeader.textContent = labels.actions;
    row.append(actionsHeader);
    head.replaceChildren(row);
  }

  function createSelect(
    column: EditorColumnDefinition,
    row: EditorRow,
    rowIndex: number
  ): HTMLSelectElement {
    const select = createElement("select", "model-table-cell-input");
    const value = row[column.key] ?? "";
    const selectOptions = getEditorColumnOptions(column, validationContext());
    if (!column.required) {
      const empty = createElement("option");
      empty.value = "";
      empty.textContent = "";
      select.append(empty);
    }
    if (value.length > 0 && !selectOptions.some((entry) => entry.value === value)) {
      const invalid = createElement("option");
      invalid.value = value;
      invalid.textContent = value;
      invalid.dataset.invalid = "true";
      select.append(invalid);
    }
    for (const entry of selectOptions) {
      const option = createElement("option");
      option.value = entry.value;
      option.textContent = getLocalizedText(entry.label, locale);
      select.append(option);
    }
    select.value = value;
    select.addEventListener("change", () => {
      rows[rowIndex][column.key] = select.value;
      csvIssues = [];
      syncBulkFromRows();
      refreshValidation();
      emit("cell");
    });
    return select;
  }

  function createBooleanInput(
    column: EditorColumnDefinition,
    row: EditorRow,
    rowIndex: number
  ): HTMLInputElement {
    const input = createElement("input", "model-table-cell-input");
    input.type = "checkbox";
    const parsed = validBoolean(row[column.key] ?? "");
    input.checked = parsed ?? false;
    input.indeterminate = parsed === null;
    input.addEventListener("change", () => {
      input.indeterminate = false;
      rows[rowIndex][column.key] = input.checked ? "true" : "false";
      csvIssues = [];
      syncBulkFromRows();
      refreshValidation();
      emit("cell");
    });
    return input;
  }

  function createTextInput(
    column: EditorColumnDefinition,
    row: EditorRow,
    rowIndex: number
  ): HTMLInputElement {
    const input = createElement("input", "model-table-cell-input");
    // Text inputs retain invalid/incomplete pasted numbers so inline errors stay visible.
    input.type = "text";
    input.value = row[column.key] ?? "";
    input.dataset.inputKind = column.input;
    if (column.input === "number") input.inputMode = "decimal";
    if (column.input === "integer") input.inputMode = "numeric";
    input.addEventListener("input", () => {
      rows[rowIndex][column.key] = input.value;
      csvIssues = [];
      syncBulkFromRows();
      refreshValidation();
      emit("cell");
    });
    return input;
  }

  function createCellInput(
    column: EditorColumnDefinition,
    row: EditorRow,
    rowIndex: number
  ): HTMLElement {
    if (column.input === "select") return createSelect(column, row, rowIndex);
    if (column.input === "boolean") return createBooleanInput(column, row, rowIndex);
    return createTextInput(column, row, rowIndex);
  }

  function renderRows(syncBulk = true): void {
    ensureMinimumRows();
    cellErrors.clear();
    cellInputs.clear();
    rowErrors.clear();
    const fragments: HTMLTableRowElement[] = [];

    rows.forEach((row, rowIndex) => {
      const tableRow = createElement("tr");
      tableRow.dataset.rowIndex = String(rowIndex);
      for (const column of schema.columns) {
        const cell = createElement("td");
        cell.dataset.columnKey = column.key;
        const input = createCellInput(column, row, rowIndex);
        const error = createElement("small", "model-table-cell-error");
        error.setAttribute("role", "alert");
        error.id = `model-table-${schema.id}-${rowIndex}-${column.key}-error`;
        input.setAttribute(
          "aria-label",
          `${getLocalizedText(column.label, locale)}, ${locale === "ja" ? `${rowIndex + 1}行目` : `row ${rowIndex + 1}`}`
        );
        input.setAttribute("aria-describedby", error.id);
        cell.append(input, error);
        cellErrors.set(keyFor(rowIndex, column.key), error);
        cellInputs.set(keyFor(rowIndex, column.key), input);
        tableRow.append(cell);
      }

      const actionsCell = createElement("td", "model-table-row-actions");
      const deleteButton = createButton(labels.deleteRow, "model-table-delete-row");
      deleteButton.dataset.rowIndex = String(rowIndex);
      deleteButton.disabled = rows.length <= (schema.minRows ?? 0);
      deleteButton.addEventListener("click", () => deleteRow(rowIndex));
      const rowError = createElement("small", "model-table-row-error");
      rowError.setAttribute("role", "alert");
      rowError.id = `model-table-${schema.id}-${rowIndex}-row-error`;
      deleteButton.setAttribute(
        "aria-label",
        `${labels.deleteRow}, ${locale === "ja" ? `${rowIndex + 1}行目` : `row ${rowIndex + 1}`}`
      );
      for (const input of tableRow.querySelectorAll<HTMLElement>("input, select")) {
        const describedBy = input.getAttribute("aria-describedby");
        input.setAttribute(
          "aria-describedby",
          describedBy ? `${describedBy} ${rowError.id}` : rowError.id
        );
      }
      actionsCell.append(deleteButton, rowError);
      rowErrors.set(rowIndex, rowError);
      tableRow.append(actionsCell);
      fragments.push(tableRow);
    });

    body.replaceChildren(...fragments);
    if (syncBulk) syncBulkFromRows();
    refreshValidation();
  }

  function refreshValidation(): void {
    const validated = validateEditorRows(schema.id, rows, validationContext());
    currentIssues = [...csvIssues, ...validated];
    for (const error of cellErrors.values()) error.textContent = "";
    for (const input of cellInputs.values()) input.removeAttribute("aria-invalid");
    for (const error of rowErrors.values()) error.textContent = "";
    bulkError.textContent = "";

    const messagesByCell = new Map<string, string[]>();
    const messagesByRow = new Map<number, string[]>();
    const bulkMessages: string[] = [];
    for (const entry of currentIssues) {
      if (entry.rowIndex === null) {
        bulkMessages.push(getLocalizedValidationMessage(entry, locale));
      } else if (entry.columnKey) {
        const key = keyFor(entry.rowIndex, entry.columnKey);
        const messages = messagesByCell.get(key) ?? [];
        messages.push(getLocalizedValidationMessage(entry, locale));
        messagesByCell.set(key, messages);
      } else {
        const messages = messagesByRow.get(entry.rowIndex) ?? [];
        messages.push(getLocalizedValidationMessage(entry, locale));
        messagesByRow.set(entry.rowIndex, messages);
      }
    }

    for (const [key, messages] of messagesByCell) {
      const error = cellErrors.get(key);
      const input = cellInputs.get(key);
      if (error) error.textContent = messages.join(" ");
      input?.setAttribute("aria-invalid", "true");
    }
    for (const [rowIndex, messages] of messagesByRow) {
      const error = rowErrors.get(rowIndex);
      if (error) error.textContent = messages.join(" ");
    }
    bulkError.textContent = bulkMessages.join(" ");
  }

  function syncBulkFromRows(force = false): string {
    if (!force && bulkText.dataset.dirty === "true") return bulkText.value;
    const text = serializeEditorTableText(schema.id, rows, { delimiter: bulkDelimiter });
    bulkText.value = text;
    bulkText.dataset.dirty = "false";
    return text;
  }

  function setRows(nextRows: readonly EditorRow[], source: TableEditorChangeSource = "api"): void {
    rows = cloneEditorRows(nextRows);
    csvIssues = [];
    bulkText.dataset.dirty = "false";
    renderRows(true);
    emit(source);
  }

  function addRow(): void {
    rows.push(createEmptyEditorRow(schema.id, rows.length));
    csvIssues = [];
    renderRows(true);
    emit("add");
  }

  function deleteRow(rowIndex: number): void {
    if (rowIndex < 0 || rowIndex >= rows.length) return;
    if (rows.length <= (schema.minRows ?? 0)) return;
    rows.splice(rowIndex, 1);
    csvIssues = [];
    renderRows(true);
    emit("delete");
  }

  function applyBulkText(text = bulkText.value): ParseEditorTableResult {
    const parsed = parseEditorTableText(schema.id, text, {
      delimiter: "auto",
      context: validationContext()
    });
    rows = cloneEditorRows(parsed.rows);
    ensureMinimumRows();
    csvIssues = parsed.issues.filter((entry) => entry.code.startsWith("csv."));
    bulkText.value = text;
    bulkText.dataset.dirty = "false";
    renderRows(false);
    emit("bulk");
    return parsed;
  }

  function refresh(): void {
    updateStaticLabels();
    renderHead();
    renderRows(false);
  }

  function setLocale(nextLocale: EditorLocale, nextLabels?: Partial<TableEditorLabels>): void {
    locale = nextLocale;
    if (nextLabels) labels = { ...DEFAULT_LABELS, ...nextLabels };
    refresh();
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    options.root.replaceChildren();
  }

  updateStaticLabels();
  renderHead();
  scroll.append(table);
  table.append(head, body);
  footer.append(addButton);
  summary.textContent = labels.bulkSummary;
  bulkHint.textContent = labels.bulkHint;
  bulkText.setAttribute("aria-label", labels.bulkSummary);
  bulkActions.append(applyBulkButton, resetBulkButton);
  details.append(summary, bulkHint, bulkText, bulkActions, bulkError);
  wrapper.append(heading, scroll, footer, details);
  options.root.replaceChildren(wrapper);

  addButton.addEventListener("click", addRow);
  applyBulkButton.addEventListener("click", () => applyBulkText());
  resetBulkButton.addEventListener("click", () => {
    csvIssues = [];
    syncBulkFromRows(true);
    refreshValidation();
  });
  bulkText.addEventListener("input", () => {
    bulkText.dataset.dirty = "true";
  });

  renderRows(true);

  return {
    getRows: () => cloneEditorRows(rows),
    setRows,
    getIssues: () => cloneIssues(currentIssues),
    addRow,
    deleteRow,
    applyBulkText,
    syncBulkFromRows,
    refresh,
    setLocale,
    destroy
  };
}
