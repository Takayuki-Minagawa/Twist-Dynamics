import type { BuildingModel, Point2D, WallCharaDB } from "../core/types";
import { serializeBuildingModelXml } from "./buildingModel";

export interface NiceJsonInput {
  物件情報: {
    建物階数: number;
  };
  固有値解析諸元: Array<{
    階: number;
    層重量: number;
    重心: [number, number];
    重量慣性モーメント: number;
  }>;
  床情報: Array<{
    階: number;
    座標: number[];
  }>;
  柱剛性情報: Array<{
    階: number;
    位置: [number, number];
    通り方向剛性: [number, number];
  }>;
  壁剛性情報: Array<{
    名前: string;
    階: number;
    単位剛性: number;
    位置: [number, number, number, number];
  }>;
}

const UNIT_LABELS = ["(kN)", "(cm)", "(kN･cm2)", "(kN/cm)", "(kN/cm/m)"];

export function cleanJsonUnits(rawJson: string): string {
  let text = rawJson;
  for (const label of UNIT_LABELS) {
    text = text.split(label).join("");
  }
  return text;
}

function wallModelName(name: string, unitStiffness: number): string {
  return `${name}_${Math.trunc(unitStiffness * 1000.0)}`;
}

export function convertNiceJsonToBuildingModel(rawJson: string): BuildingModel {
  const json = JSON.parse(cleanJsonUnits(rawJson)) as NiceJsonInput;
  const story = Number(json.物件情報?.建物階数 ?? 0);

  const eigenByStory = new Map<number, NiceJsonInput["固有値解析諸元"][number]>();
  for (const e of json.固有値解析諸元 ?? []) {
    eigenByStory.set(e.階, e);
  }

  const zLevel: number[] = [0];
  const weight: number[] = [];
  const wMoment: number[] = [];
  const wCenter: Point2D[] = [];
  let z = 0;
  for (let i = 1; i <= story; i++) {
    const e = eigenByStory.get(i);
    if (!e) continue;
    z += 288.0;
    zLevel.push(z);
    weight.push(e.層重量);
    wMoment.push(e.重量慣性モーメント);
    wCenter.push({ x: e.重心[0], y: e.重心[1] });
  }

  const wallCharaMap = new Map<string, WallCharaDB>();
  const walls = [];
  for (const w of json.壁剛性情報 ?? []) {
    if (w.単位剛性 <= 0.001) continue;
    const modelName = wallModelName(w.名前, w.単位剛性);
    if (!wallCharaMap.has(modelName)) {
      const stiff = Number(modelName.split("_").pop() ?? "0") / 1000.0;
      wallCharaMap.set(modelName, {
        name: modelName,
        k: stiff,
        h: 0,
        c: 0,
        isEigenEffectK: true,
        isKCUnitChara: true,
        memo: ""
      });
    }
    walls.push({
      name: modelName,
      layer: w.階,
      pos: [
        { x: w.位置[0], y: w.位置[1] },
        { x: w.位置[2], y: w.位置[3] }
      ] as [Point2D, Point2D],
      isVisible: false
    });
  }

  return {
    structInfo: {
      massN: story,
      sType: "R",
      zLevel,
      weight,
      wMoment,
      wCenter
    },
    floors: (json.床情報 ?? [])
      .slice()
      .sort((a, b) => a.階 - b.階)
      .map((floor) => {
        const pos: Point2D[] = [];
        for (let i = 0; i < floor.座標.length - 1; i += 2) {
          pos.push({ x: floor.座標[i], y: floor.座標[i + 1] });
        }
        return { layer: floor.階, pos };
      }),
    columns: (json.柱剛性情報 ?? [])
      .slice()
      .sort((a, b) => a.階 - b.階)
      .map((col) => ({
        layer: col.階,
        pos: { x: col.位置[0], y: col.位置[1] },
        kx: col.通り方向剛性[0],
        ky: col.通り方向剛性[1]
      })),
    wallCharaDB: Array.from(wallCharaMap.values()),
    walls,
    massDampers: [],
    braceDampers: [],
    dxPanels: []
  };
}

export function convertNiceJsonToBuildingModelXml(rawJson: string): string {
  const model = convertNiceJsonToBuildingModel(rawJson);
  return serializeBuildingModelXml(model);
}
