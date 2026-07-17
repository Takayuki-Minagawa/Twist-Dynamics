import {
  BUILDING_MODEL_JSON_FORMAT,
  decodeTextWithMeta,
  FormatParseError,
  parseBuildingModelJsonWithMeta,
  parseBuildingModelXmlWithMeta,
  parseComplexModalDat,
  parseModalDat,
  parseRespCsv,
  summarizeBuildingModel,
  TextDecodingError,
  type DecodedTextResult,
  type BuildingModelWarning,
  type SupportedTextEncoding
} from "../io";

export type FileType = "xml" | "modal" | "complex" | "resp" | "json" | "unknown";

export interface FileProcessingMessages {
  unknownFormat: string;
  formatErrorPrefix: string;
  decodeErrorPrefix: string;
  decodeUnsupportedAction: string;
  legacyStructTypeIgnored?: string;
  legacyDxPanelsConverted?: (count: number) => string;
}

interface ReportBase {
  file: string;
  encoding: SupportedTextEncoding;
  bomRemoved?: true;
  warnings?: string[];
}

export interface XmlReport extends ReportBase {
  type: "xml";
  story: number | null;
  floorCount: number;
  columnCount: number;
  wallCount: number;
  wallCharaCount: number;
  massDamperCount: number;
  braceDamperCount: number;
}

export interface ModalReport extends ReportBase {
  type: "modal";
  story: number | null;
  modeCount: number;
  firstFrequencyHz: number | null;
}

export interface ComplexReport extends ReportBase {
  type: "complex";
  story: number | null;
  modeCount: number;
  firstFrequencyHz: number | null;
}

export interface RespReport extends ReportBase {
  type: "resp";
  rows: number;
  columns: number;
  dt: number;
}

export interface JsonReport extends ReportBase {
  type: "json";
  story: number | null;
  floorCount: number;
  columnCount: number;
  wallCount: number;
  wallCharaCount: number;
  massDamperCount: number;
  braceDamperCount: number;
}

export interface UnknownReport extends ReportBase {
  type: "unknown";
  message: string;
}

export type FileProcessingSuccessReport =
  | XmlReport
  | ModalReport
  | ComplexReport
  | RespReport
  | JsonReport
  | UnknownReport;

export interface DecodeErrorReport {
  file: string;
  type: "unknown";
  errorType: "decode";
  error: string;
  action: string;
}

export interface FormatErrorReport {
  file: string;
  type: FileType;
  errorType: "format";
  error: string;
}

export interface UnexpectedErrorReport {
  file: string;
  type: "unknown";
  errorType: "unexpected";
  error: string;
}

export type FileProcessingErrorReport = DecodeErrorReport | FormatErrorReport | UnexpectedErrorReport;

export type FileProcessingReport = FileProcessingSuccessReport | FileProcessingErrorReport;

export type FileProcessingResult =
  | {
      kind: "success";
      report: FileProcessingSuccessReport;
    }
  | {
      kind: "error";
      report: FileProcessingErrorReport;
    };

function looksLikeJson(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function looksLikeXml(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith("<");
}

function hasBuildingModelJsonSignature(text: string): boolean {
  const head = text.slice(0, 4096);
  return (
    head.includes(`\"format\"`) &&
    head.includes(BUILDING_MODEL_JSON_FORMAT) &&
    head.includes(`\"version\"`) &&
    head.includes(`\"model\"`)
  );
}

export function detectFileType(fileName: string, text: string): FileType {
  const lowerName = fileName.toLowerCase();

  if (text.includes("#Resp_Result")) return "resp";
  if (text.includes("#ComplexModalResult")) return "complex";
  if (text.includes("#ModalResult")) return "modal";

  if (hasBuildingModelJsonSignature(text)) return "json";

  if (lowerName.endsWith(".json") && looksLikeJson(text)) return "json";
  if (lowerName.endsWith(".xml") && looksLikeXml(text)) return "xml";

  if (lowerName.endsWith(".json")) return "json";
  if (lowerName.endsWith(".xml")) return "xml";

  if (looksLikeXml(text)) return "xml";

  return "unknown";
}

function createReportBase(fileName: string, decoded: DecodedTextResult): ReportBase {
  const reportBase: ReportBase = {
    file: fileName,
    encoding: decoded.encoding
  };
  if (decoded.hasBom) reportBase.bomRemoved = true;
  if (decoded.warnings.length > 0) reportBase.warnings = decoded.warnings;
  return reportBase;
}

export function localizeBuildingModelWarning(
  warning: BuildingModelWarning,
  messages: FileProcessingMessages
): string {
  if (warning.code === "legacy-struct-type-ignored") {
    return messages.legacyStructTypeIgnored ?? warning.message;
  }
  if (warning.code === "legacy-dx-panels-converted") {
    return messages.legacyDxPanelsConverted?.(warning.count ?? 0) ?? warning.message;
  }
  return warning.message;
}

function appendBuildingModelWarnings(
  reportBase: ReportBase,
  warnings: BuildingModelWarning[],
  messages: FileProcessingMessages
): ReportBase {
  if (warnings.length === 0) return reportBase;
  return {
    ...reportBase,
    warnings: [
      ...(reportBase.warnings ?? []),
      ...warnings.map((warning) => localizeBuildingModelWarning(warning, messages))
    ]
  };
}

export function parseDecodedFile(
  fileName: string,
  decoded: DecodedTextResult,
  messages: FileProcessingMessages
): { kind: "success"; report: FileProcessingSuccessReport } {
  const reportBase = createReportBase(fileName, decoded);
  const text = decoded.text;
  const type = detectFileType(fileName, text);

  switch (type) {
    case "xml": {
      const parsed = parseBuildingModelXmlWithMeta(text);
      const modelReportBase = appendBuildingModelWarnings(reportBase, parsed.warnings, messages);
      return {
        kind: "success",
        report: {
          ...modelReportBase,
          type,
          ...summarizeBuildingModel(parsed.model)
        }
      };
    }
    case "modal": {
      const modal = parseModalDat(text);
      return {
        kind: "success",
        report: {
          ...reportBase,
          type,
          story: modal.baseShape.story ?? null,
          modeCount: modal.modal.frequenciesHz.length,
          firstFrequencyHz: modal.modal.frequenciesHz[0] ?? null
        }
      };
    }
    case "complex": {
      const complex = parseComplexModalDat(text);
      return {
        kind: "success",
        report: {
          ...reportBase,
          type,
          story: complex.baseShape.story ?? null,
          modeCount: complex.modes.length,
          firstFrequencyHz: complex.modes[0]?.frequencyHz ?? null
        }
      };
    }
    case "resp": {
      const resp = parseRespCsv(text);
      return {
        kind: "success",
        report: {
          ...reportBase,
          type,
          rows: resp.records.length,
          columns: resp.header.length,
          dt: resp.meta.dt
        }
      };
    }
    case "json": {
      const parsed = parseBuildingModelJsonWithMeta(text);
      const modelReportBase = appendBuildingModelWarnings(reportBase, parsed.warnings, messages);
      return {
        kind: "success",
        report: {
          ...modelReportBase,
          type,
          ...summarizeBuildingModel(parsed.model)
        }
      };
    }
    default:
      return {
        kind: "success",
        report: {
          ...reportBase,
          type: "unknown",
          message: messages.unknownFormat
        }
      };
  }
}

export async function processInputFile(
  file: File,
  messages: FileProcessingMessages
): Promise<FileProcessingResult> {
  let decoded: DecodedTextResult;

  try {
    const arrayBuffer = await file.arrayBuffer();
    decoded = decodeTextWithMeta(arrayBuffer, "shift_jis");
  } catch (error) {
    if (error instanceof TextDecodingError) {
      return {
        kind: "error",
        report: {
          file: file.name,
          type: "unknown",
          errorType: "decode",
          error: `${messages.decodeErrorPrefix} ${error.message}`,
          action: messages.decodeUnsupportedAction
        }
      };
    }

    return {
      kind: "error",
      report: {
        file: file.name,
        type: "unknown",
        errorType: "unexpected",
        error: error instanceof Error ? error.message : String(error)
      }
    };
  }

  const type = detectFileType(file.name, decoded.text);

  try {
    return parseDecodedFile(file.name, decoded, messages);
  } catch (error) {
    if (error instanceof FormatParseError) {
      return {
        kind: "error",
        report: {
          file: file.name,
          type,
          errorType: "format",
          error: `${messages.formatErrorPrefix} ${error.message}`
        }
      };
    }

    return {
      kind: "error",
      report: {
        file: file.name,
        type: "unknown",
        errorType: "unexpected",
        error: error instanceof Error ? error.message : String(error)
      }
    };
  }
}
