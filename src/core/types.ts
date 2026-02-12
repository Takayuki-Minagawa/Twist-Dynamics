export type StructType = "R" | "DX";

export interface Point2D {
  x: number;
  y: number;
}

export interface StructInfo {
  massN: number;
  sType: StructType;
  zLevel: number[];
  weight: number[];
  wMoment: number[];
  wCenter: Point2D[];
}

export interface Floor {
  layer: number;
  pos: Point2D[];
}

export interface RColumn {
  layer: number;
  pos: Point2D;
  kx: number;
  ky: number;
}

export interface WallCharaDB {
  name: string;
  k: number;
  h: number;
  c: number;
  isEigenEffectK: boolean;
  isKCUnitChara: boolean;
  memo: string;
}

export interface Wall {
  name: string;
  layer: number;
  pos: [Point2D, Point2D];
  isVisible: boolean;
}

export interface MassDamper {
  name: string;
  layer: number;
  pos: Point2D;
  weight: number;
  freq: Point2D;
  h: Point2D;
}

export interface BraceDamper {
  layer: number;
  pos: Point2D;
  direct: "X" | "Y";
  k: number;
  c: number;
  width: number;
  height: number;
  isLightPos: boolean;
  isEigenEffectK: boolean;
}

export interface DXPanel {
  layer: number;
  direct: "X" | "Y";
  pos: Point2D[];
  k: number;
}

export interface BuildingModel {
  structInfo?: StructInfo;
  floors: Floor[];
  columns: RColumn[];
  wallCharaDB: WallCharaDB[];
  walls: Wall[];
  massDampers: MassDamper[];
  braceDampers: BraceDamper[];
  dxPanels: DXPanel[];
}

export interface MassCenter {
  layer: number;
  x: number;
  y: number;
}

export interface BaseShapeInfo {
  story?: number;
  zLevel: number[];
  massCenters: MassCenter[];
}

export interface ModalResult {
  frequenciesHz: number[];
  participationFactorX: number[];
  participationFactorY: number[];
  effectiveMassRatioX: number[];
  effectiveMassRatioY: number[];
  eigenVectors: Array<{ label: string; values: number[] }>;
}

export interface ModalDatFile {
  baseShape: BaseShapeInfo;
  modal: ModalResult;
}

export interface ComplexModeVector {
  component: string;
  amplitude: number;
  phaseRad: number;
  complexReal?: number;
  complexImag?: number;
}

export interface ComplexMode {
  mode: number;
  frequencyHz: number;
  dampingRatioPercent: number;
  eigenValueReal?: number;
  eigenValueImag?: number;
  vectors: ComplexModeVector[];
}

export interface ComplexModalFile {
  baseShape: BaseShapeInfo;
  modes: ComplexMode[];
}

export interface RespMeta {
  massCount: number;
  dt: number;
  damperCount: number;
}

export interface RespFile {
  baseShape: BaseShapeInfo;
  meta: RespMeta;
  header: string[];
  records: number[][];
  columnMaxAbs: number[];
}
