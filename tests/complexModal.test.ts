import { describe, expect, it } from "vitest";
import { parseComplexModalDat } from "../src/io/complexModal";
import { readFixture } from "./helpers";

describe("Complex modal dat parser", () => {
  it("parses Test_simple_ceig.dat", () => {
    const text = readFixture("reference/complex/Test_simple_ceig.dat");
    const data = parseComplexModalDat(text);

    expect(data.baseShape.story).toBe(1);
    expect(data.modes.length).toBe(3);
    expect(data.modes[0].frequencyHz).toBeGreaterThan(3.0);
    expect(data.modes[0].vectors.length).toBeGreaterThan(0);
  });
});
