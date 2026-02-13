import { describe, expect, it } from "vitest";
import { parseDecodedFile, type FileProcessingMessages } from "../src/app/fileProcessing";
import type { DecodedTextResult } from "../src/io";

describe("File processing", () => {
  it("reports JSON input as unsupported", () => {
    const decoded: DecodedTextResult = {
      text: "{\"物件情報\":{\"建物階数\":1}}",
      encoding: "utf-8",
      hasBom: false,
      warnings: []
    };
    const messages: FileProcessingMessages = {
      unknownFormat: "unknown",
      jsonUnsupported: "disabled",
      decodeErrorPrefix: "decode",
      decodeUnsupportedAction: "resave"
    };

    const result = parseDecodedFile("sample.json", decoded, messages);

    expect(result.report.type).toBe("json");
    expect(result.report.message).toBe("disabled");
  });
});
