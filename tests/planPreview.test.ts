import { describe, expect, it } from "vitest";
import { createPlanTransform } from "../src/app/planPreview";

describe("plan preview transform", () => {
  it("maps model Y upward while fitting the requested bounds", () => {
    const transform = createPlanTransform(
      { minX: 0, maxX: 100, minY: 0, maxY: 50 },
      240,
      140,
      20
    );
    const lowerLeft = transform.point({ x: 0, y: 0 });
    const upperRight = transform.point({ x: 100, y: 50 });

    expect(lowerLeft.x).toBeGreaterThanOrEqual(20);
    expect(lowerLeft.y).toBeGreaterThan(upperRight.y);
    expect(upperRight.x).toBeLessThanOrEqual(220);
    expect(upperRight.y).toBeGreaterThanOrEqual(20);
  });
});
