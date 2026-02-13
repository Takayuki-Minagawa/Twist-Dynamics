import { describe, expect, it } from "vitest";
import {
  detectFileType,
  parseDecodedFile,
  processInputFile,
  type FileProcessingMessages
} from "../src/app/fileProcessing";
import type { DecodedTextResult } from "../src/io";

const messages: FileProcessingMessages = {
  unknownFormat: "unknown",
  formatErrorPrefix: "format",
  decodeErrorPrefix: "decode",
  decodeUnsupportedAction: "resave"
};

describe("File processing", () => {
  it("parses BuildingModel JSON input and summarizes it", () => {
    const decoded: DecodedTextResult = {
      text: JSON.stringify({
        format: "twist-dynamics/building-model",
        version: 1,
        model: {
          structInfo: {
            massN: 1,
            sType: "R",
            zLevel: [0, 300],
            weight: [100],
            wMoment: [10],
            wCenter: [{ x: 0, y: 0 }]
          },
          floors: [
            {
              layer: 1,
              pos: [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
                { x: 1, y: 1 }
              ]
            }
          ],
          columns: [],
          wallCharaDB: [],
          walls: [],
          massDampers: [],
          braceDampers: [],
          dxPanels: []
        }
      }),
      encoding: "utf-8",
      hasBom: false,
      warnings: []
    };

    const result = parseDecodedFile("sample.json", decoded, messages);

    expect(result.kind).toBe("success");
    expect(result.report.type).toBe("json");
    if (result.report.type === "json") {
      expect(result.report.story).toBe(1);
      expect(result.report.structType).toBe("R");
    }
  });

  it("parses XML input and summarizes it", () => {
    const decoded: DecodedTextResult = {
      text: [
        "<BuildingModel format=\"twist-dynamics/building-model\" version=\"1\">",
        "  <model>",
        "    <structInfo>",
        "      <massN>1</massN>",
        "      <sType>R</sType>",
        "      <zLevel><value>0</value><value>300</value></zLevel>",
        "      <weight><value>100</value></weight>",
        "      <wMoment><value>10</value></wMoment>",
        "      <wCenter><point><x>0</x><y>0</y></point></wCenter>",
        "    </structInfo>",
        "    <floors>",
        "      <floor><layer>1</layer><pos><point><x>0</x><y>0</y></point><point><x>1</x><y>0</y></point><point><x>1</x><y>1</y></point></pos></floor>",
        "      <floor><layer>2</layer><pos><point><x>0</x><y>0</y></point><point><x>1</x><y>0</y></point><point><x>1</x><y>1</y></point></pos></floor>",
        "    </floors>",
        "    <columns />",
        "    <wallCharaDB />",
        "    <walls />",
        "    <massDampers />",
        "    <braceDampers />",
        "    <dxPanels />",
        "  </model>",
        "</BuildingModel>"
      ].join("\n"),
      encoding: "utf-8",
      hasBom: false,
      warnings: []
    };

    const result = parseDecodedFile("sample.xml", decoded, messages);

    expect(result.kind).toBe("success");
    expect(result.report.type).toBe("xml");
    if (result.report.type === "xml") {
      expect(result.report.story).toBe(1);
      expect(result.report.floorCount).toBe(2);
    }
  });

  it("detects BuildingModel JSON by signature even without .json extension", () => {
    const text = JSON.stringify({
      format: "twist-dynamics/building-model",
      version: 1,
      model: {}
    });

    expect(detectFileType("model.txt", text)).toBe("json");
  });

  it("returns format error for invalid BuildingModel JSON", async () => {
    const file = new File(["{\"format\":\"twist-dynamics/building-model\",\"version\":1}"], "broken.json");

    const result = await processInputFile(file, messages);

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.report.errorType).toBe("format");
      expect(result.report.type).toBe("json");
    }
  });

  it("returns decode error for undecodable bytes", async () => {
    const file = new File([new Uint8Array([0x80])], "bad.bin");

    const result = await processInputFile(file, messages);

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.report.errorType).toBe("decode");
      expect(result.report.type).toBe("unknown");
    }
  });

  it("returns unexpected error when file read fails", async () => {
    const file = {
      name: "broken.json",
      arrayBuffer: async () => {
        throw new Error("read failed");
      }
    } as unknown as File;

    const result = await processInputFile(file, messages);

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.report.errorType).toBe("unexpected");
      expect(result.report.error).toContain("read failed");
    }
  });
});
