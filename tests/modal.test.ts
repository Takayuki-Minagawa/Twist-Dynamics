import { describe, expect, it } from "vitest";
import { parseModalDat } from "../src/io/modal";
import { readFixture } from "./helpers";

describe("Modal dat parser", () => {
  it("parses test_01_eig.dat", () => {
    const text = readFixture("reference/modal/test_01_eig.dat");
    const data = parseModalDat(text);

    expect(data.baseShape.story).toBe(3);
    expect(data.modal.frequenciesHz.length).toBe(9);
    expect(data.modal.frequenciesHz[0]).toBeGreaterThan(2.0);
    expect(data.modal.eigenVectors.length).toBeGreaterThan(0);
  });
});
