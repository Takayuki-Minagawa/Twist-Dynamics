import {
  convertNiceJsonToBuildingModelXml,
  decodeTextWithMeta,
  parseBuildingModelXml,
  parseComplexModalDat,
  parseModalDat,
  parseRespCsv,
  summarizeBuildingModel,
  TextDecodingError,
  type DecodedTextResult
} from "../io";

export type FileType = "xml" | "modal" | "complex" | "resp" | "json" | "unknown";

export interface FileProcessingMessages {
  unknownFormat: string;
  decodeErrorPrefix: string;
  decodeUnsupportedAction: string;
}

export interface FileProcessingResult {
  report: Record<string, unknown>;
  generatedXml?: string;
}

export function detectFileType(fileName: string, text: string): FileType {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".xml")) return "xml";
  if (lowerName.endsWith(".json")) return "json";
  if (lowerName.endsWith(".csv") && text.includes("#Resp_Result")) return "resp";
  if (lowerName.endsWith(".dat") && text.includes("#ComplexModalResult")) return "complex";
  if (lowerName.endsWith(".dat") && text.includes("#ModalResult")) return "modal";
  return "unknown";
}

function createReportBase(fileName: string, decoded: DecodedTextResult): Record<string, unknown> {
  const reportBase: Record<string, unknown> = {
    file: fileName,
    encoding: decoded.encoding
  };
  if (decoded.hasBom) reportBase.bomRemoved = true;
  if (decoded.warnings.length > 0) reportBase.warnings = decoded.warnings;
  return reportBase;
}

export function parseDecodedFile(
  fileName: string,
  decoded: DecodedTextResult,
  messages: FileProcessingMessages
): FileProcessingResult {
  const reportBase = createReportBase(fileName, decoded);
  const text = decoded.text;
  const type = detectFileType(fileName, text);

  switch (type) {
    case "xml": {
      const model = parseBuildingModelXml(text);
      return {
        report: {
          ...reportBase,
          type,
          ...summarizeBuildingModel(model)
        }
      };
    }
    case "modal": {
      const modal = parseModalDat(text);
      return {
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
      const xml = convertNiceJsonToBuildingModelXml(text);
      return {
        report: {
          ...reportBase,
          type,
          convertedXmlLength: xml.length
        },
        generatedXml: xml
      };
    }
    default:
      return {
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
  try {
    const arrayBuffer = await file.arrayBuffer();
    const decoded = decodeTextWithMeta(arrayBuffer, "shift_jis");
    return parseDecodedFile(file.name, decoded, messages);
  } catch (error) {
    if (error instanceof TextDecodingError) {
      return {
        report: {
          file: file.name,
          type: "unknown",
          error: `${messages.decodeErrorPrefix} ${error.message}`,
          action: messages.decodeUnsupportedAction
        }
      };
    }

    return {
      report: {
        file: file.name,
        type: "unknown",
        error: error instanceof Error ? error.message : String(error)
      }
    };
  }
}
