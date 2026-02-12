import { describe, expect, it } from "vitest";
import { parseRespCsv } from "../src/io/resp";
import { readFixture } from "./helpers";

describe("Resp csv parser", () => {
  it("parses test.csv", () => {
    const text = readFixture("reference/resp/test.csv");
    const data = parseRespCsv(text);

    expect(data.baseShape.story).toBe(3);
    expect(data.meta.massCount).toBe(3);
    expect(data.records.length).toBeGreaterThan(100);
    expect(data.header.length).toBeGreaterThan(10);
  });
});
