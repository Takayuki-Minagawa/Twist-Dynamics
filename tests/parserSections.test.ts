import { describe, expect, it } from "vitest";
import { parseComplexModalDat } from "../src/io/complexModal";
import { parseModalDat } from "../src/io/modal";
import { parseRespCsv } from "../src/io/resp";
import { FormatParseError } from "../src/io/text";

describe("Parser section validation", () => {
  it("throws FormatParseError when ModalResult section is missing", () => {
    expect(() => parseModalDat("Story,3\nZlebe,0,300")).toThrow(FormatParseError);
  });

  it("throws FormatParseError when ComplexModalResult section is missing", () => {
    expect(() => parseComplexModalDat("Story,1\n#BaseShapeInfo")).toThrow(FormatParseError);
  });

  it("throws FormatParseError when Resp_Result section is missing", () => {
    expect(() => parseRespCsv("Story,1\ntime,acc")).toThrow(FormatParseError);
  });

  it("throws FormatParseError when Resp_Result metadata lines are missing", () => {
    expect(() => parseRespCsv("#Resp_Result\nmeta_only")).toThrow(FormatParseError);
  });

  it("throws FormatParseError for invalid numeric row in modal eigen vectors", () => {
    const broken = [
      "#BaseShapeInfo",
      "Story,1",
      "Zlebe,0,300",
      "#ModalResult",
      "〇固有振動数",
      ",1次",
      ",3.0",
      "刺激係数X,1.0",
      "刺激係数Y,1.0",
      "〇固有ベクトル",
      "層,1次",
      "M1-δx,abc",
      "#End_ModalResult"
    ].join("\n");
    expect(() => parseModalDat(broken)).toThrow(FormatParseError);
  });

  it("throws FormatParseError when resp row column count differs from header", () => {
    const broken = [
      "#BaseShapeInfo",
      "Story,1",
      "Zlebe,0,300",
      "#Resp_Result",
      "質点数,1,出力時間刻み(s),0.01,ダンパー数,0",
      "Time,DX_1,DY_1",
      "0.00,0.1",
      "0.01,0.2,0.3"
    ].join("\n");
    expect(() => parseRespCsv(broken)).toThrow(FormatParseError);
  });
});
