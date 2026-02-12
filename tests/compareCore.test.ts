import { describe, expect, it } from "vitest";
import { compareByType, compareNumberArrays, type CompareType } from "../src/core/compare";
import { readFixture } from "./helpers";

interface GoldenCompareCase {
  name: string;
  type: CompareType;
  referencePath: string;
  targetPath: string;
}

const goldenCases: GoldenCompareCase[] = [
  {
    name: "modal fixture matches itself",
    type: "modal",
    referencePath: "reference/modal/test_01_eig.dat",
    targetPath: "reference/modal/test_01_eig.dat"
  },
  {
    name: "complex fixture matches itself",
    type: "complex",
    referencePath: "reference/complex/Test_simple_ceig.dat",
    targetPath: "reference/complex/Test_simple_ceig.dat"
  },
  {
    name: "response fixture matches itself",
    type: "resp",
    referencePath: "reference/resp/test.csv",
    targetPath: "reference/resp/test.csv"
  }
];

describe("compare core", () => {
  for (const testCase of goldenCases) {
    it(testCase.name, () => {
      const referenceText = readFixture(testCase.referencePath);
      const targetText = readFixture(testCase.targetPath);
      const result = compareByType(testCase.type, referenceText, targetText);
      expect(result.issues.length).toBe(0);
    });
  }

  it("reports value mismatch when absolute and relative tolerances are exceeded", () => {
    const issues = compareNumberArrays("demo.metric", [1.0, 2.0], [1.0, 2.5], {
      rtol: 0.01,
      atol: 1e-6
    });
    expect(issues.length).toBe(1);
    expect(issues[0].kind).toBe("value_mismatch");
    expect(issues[0].metric).toBe("demo.metric");
    expect(issues[0].index).toBe(1);
  });

  it("ignores mismatch within tolerance", () => {
    const issues = compareNumberArrays("demo.metric", [10.0], [10.000001], {
      rtol: 0.001,
      atol: 0.001
    });
    expect(issues.length).toBe(0);
  });
});
