import type { Point2D, RColumn } from "../../core/types";
import type { BuildingModelWarning } from "./types";

export interface LegacyDXPanel {
  layer: number;
  direct: "X" | "Y";
  pos: Point2D[];
  k: number;
}

export function legacyStructTypeWarning(): BuildingModelWarning {
  return {
    code: "legacy-struct-type-ignored",
    path: "structInfo.sType",
    message: "Legacy field structInfo.sType was ignored."
  };
}

export function legacyDXPanelsWarning(count: number): BuildingModelWarning {
  const noun = count === 1 ? "dxPanel" : "dxPanels";
  const columnNoun = count === 1 ? "column" : "columns";
  return {
    code: "legacy-dx-panels-converted",
    path: "dxPanels",
    count,
    message: `Converted ${count} legacy ${noun} to equivalent ${columnNoun}.`
  };
}

export function convertLegacyDXPanelToColumn(panel: LegacyDXPanel): RColumn {
  // Legacy matrix assembly used the arithmetic mean of every listed point,
  // not an area-weighted polygon centroid. Preserve that behavior exactly.
  const positionSum = panel.pos.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 }
  );
  const pos = {
    x: positionSum.x / panel.pos.length,
    y: positionSum.y / panel.pos.length
  };

  return {
    layer: panel.layer,
    pos,
    kx: panel.direct === "X" ? panel.k : 0,
    ky: panel.direct === "Y" ? panel.k : 0
  };
}
