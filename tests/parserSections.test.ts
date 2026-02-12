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
});
