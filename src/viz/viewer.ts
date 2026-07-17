import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { ComplexModalFile, BuildingModel, ModalDatFile, RespFile } from "../core/types";
import { calculateStorySummaries } from "../core/analysis/storySummary";
import {
  createZeroLevelPoses,
  deformAttachedPoint,
  scaledLevelPoses,
  scaledModalLevelPoses
} from "./deformation";
import { buildModelGeometry } from "./geometry";
import {
  buildResponseSeries,
  extractComplexMode,
  extractRealMode,
  sampleComplexMode,
  sampleRealMode,
  sampleResponseSeries,
  type ExtractedComplexMode
} from "./results";
import type {
  LevelPose,
  ModelGeometry,
  ResponseSeries,
  StoryCenterSummary,
  ThreeViewerOptions,
  ViewerPlaybackState,
  VisualizationCategory,
  WallPrimitive
} from "./types";
import { VISUALIZATION_CATEGORIES } from "./types";

const TWO_PI = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

type AnimationSource =
  | { kind: "static" }
  | { kind: "realMode"; shape: LevelPose[]; frequencyHz: number }
  | { kind: "complexMode"; mode: ExtractedComplexMode }
  | { kind: "response"; series: ResponseSeries };

interface Renderable {
  object: THREE.Object3D;
  category: VisualizationCategory;
  story: number;
}

interface LevelObject {
  object: THREE.Object3D;
  level: number;
  baseZ: number;
}

interface SegmentObject {
  mesh: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  primitive: ModelGeometry["columns"][number];
}

interface WallObject {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  primitive: WallPrimitive;
}

export type PlaybackListener = (state: ViewerPlaybackState) => void;

function color(value: number | string | undefined, fallback: number): THREE.ColorRepresentation {
  return value ?? fallback;
}

function vector(value: { x: number; y: number; z: number }): THREE.Vector3 {
  return new THREE.Vector3(value.x, value.y, value.z);
}

function disposeObject(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    const renderObject = object as THREE.Mesh | THREE.Line;
    if (renderObject.geometry instanceof THREE.BufferGeometry) geometries.add(renderObject.geometry);
    const material = renderObject.material;
    if (Array.isArray(material)) material.forEach((entry) => materials.add(entry));
    else if (material instanceof THREE.Material) materials.add(material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

function setCylinderBetween(
  mesh: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>,
  start: THREE.Vector3,
  end: THREE.Vector3
): void {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  if (length < 1e-9) {
    mesh.scale.set(1, 1e-9, 1);
    mesh.quaternion.identity();
    return;
  }
  mesh.scale.set(1, length, 1);
  mesh.quaternion.setFromUnitVectors(Y_AXIS, direction.multiplyScalar(1 / length));
}

function setWallVertices(mesh: THREE.Mesh<THREE.BufferGeometry>, corners: THREE.Vector3[]): void {
  const position = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
  corners.forEach((point, index) => position.setXYZ(index, point.x, point.y, point.z));
  position.needsUpdate = true;
  mesh.geometry.computeBoundingSphere();
}

function clampRotations(poses: LevelPose[], maximumAbs: number): LevelPose[] {
  return poses.map((pose, index) => ({
    ...pose,
    rz: index === 0 ? 0 : THREE.MathUtils.clamp(pose.rz, -maximumAbs, maximumAbs)
  }));
}

export class ThreeViewer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;

  private readonly container: HTMLElement;
  private readonly options: ThreeViewerOptions;
  private readonly resizeObserver: ResizeObserver | null;
  private readonly fallbackResize: () => void;
  private readonly renderables: Renderable[] = [];
  private readonly levelObjects: LevelObject[] = [];
  private readonly segmentObjects: SegmentObject[] = [];
  private readonly wallObjects: WallObject[] = [];
  private readonly categoryVisibility = new Map<VisualizationCategory, boolean>();
  private readonly storyVisibility = new Map<number, boolean>();
  private readonly listeners = new Set<PlaybackListener>();

  private modelRoot = new THREE.Group();
  private helperRoot = new THREE.Group();
  private modelGeometry: ModelGeometry | null = null;
  private source: AnimationSource = { kind: "static" };
  private deformationScale = 1;
  private rotationEmphasis = 1;
  private playbackSpeed = 1;
  private currentTime = 0;
  private playing = false;
  private loop = true;
  private frameId: number | null = null;
  private previousFrameMs: number | null = null;
  private disposed = false;

  constructor(container: HTMLElement, options: ThreeViewerOptions = {}) {
    this.container = container;
    this.options = options;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(color(options.background, 0xf1f5f4));
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100_000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, Math.max(options.maxPixelRatio ?? 2, 1))
    );
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.setAttribute("aria-label", "3D structural model viewer");
    this.container.append(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.screenSpacePanning = true;
    this.controls.addEventListener("change", this.requestFrame);

    this.scene.add(this.helperRoot, this.modelRoot);
    for (const category of VISUALIZATION_CATEGORIES) {
      this.categoryVisibility.set(category, true);
    }

    this.fallbackResize = (): void => this.resize();
    if (typeof ResizeObserver === "function") {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(container);
    } else {
      this.resizeObserver = null;
      window.addEventListener("resize", this.fallbackResize);
    }
    this.resize();
  }

  setModel(model: BuildingModel, storySummaries?: StoryCenterSummary[]): void {
    this.assertActive();
    const summaries = storySummaries ?? calculateStorySummaries(model);
    const geometry = buildModelGeometry(model, summaries);
    this.clearSceneModel();
    this.modelGeometry = geometry;
    for (const category of VISUALIZATION_CATEGORIES) this.categoryVisibility.set(category, true);
    for (let story = 0; story <= geometry.storyCount; story++) this.storyVisibility.set(story, true);
    this.buildHelpers(geometry);
    this.buildFloors(geometry);
    this.buildColumnsAndBraces(geometry);
    this.buildWalls(geometry);
    this.buildMassDampers(geometry);
    this.buildCenters(geometry);
    this.updateVisibility();
    this.setStatic();
    this.resetCamera();
  }

  clearModel(): void {
    this.assertActive();
    this.stopPlayback();
    this.clearSceneModel();
    this.modelGeometry = null;
    this.source = { kind: "static" };
    this.currentTime = 0;
    this.requestFrame();
    this.notifyPlayback();
  }

  setStatic(): void {
    this.assertModel();
    this.stopPlayback();
    this.source = { kind: "static" };
    this.currentTime = 0;
    this.applyCurrentFrame();
    this.notifyPlayback();
  }

  setRealMode(data: ModalDatFile, modeIndex: number): void {
    const geometry = this.assertModel();
    const shape = extractRealMode(data, modeIndex, geometry.storyCount);
    const frequencyHz = data.modal.frequenciesHz[modeIndex];
    if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) {
      throw new Error("Selected real mode has no positive finite frequency.");
    }
    this.stopPlayback();
    this.source = { kind: "realMode", shape, frequencyHz };
    this.currentTime = 0;
    this.loop = true;
    this.applyCurrentFrame();
    this.notifyPlayback();
  }

  setComplexMode(data: ComplexModalFile, modeIndex: number): void {
    const geometry = this.assertModel();
    const mode = extractComplexMode(data, modeIndex, geometry.storyCount);
    if (mode.frequencyHz <= 0) throw new Error("Selected complex mode has no positive frequency.");
    this.stopPlayback();
    this.source = { kind: "complexMode", mode };
    this.currentTime = 0;
    this.loop = true;
    this.applyCurrentFrame();
    this.notifyPlayback();
  }

  setResponse(data: RespFile): void {
    const geometry = this.assertModel();
    const series = buildResponseSeries(data, geometry.storyCount);
    this.stopPlayback();
    this.source = { kind: "response", series };
    this.currentTime = 0;
    this.loop = false;
    this.applyCurrentFrame();
    this.notifyPlayback();
  }

  setPlaying(playing: boolean): void {
    this.assertActive();
    if (this.source.kind === "static") playing = false;
    if (playing === this.playing) return;
    if (playing && !this.loop && this.currentTime >= this.animationDuration()) {
      this.currentTime = 0;
      this.applyCurrentFrame();
    }
    this.playing = playing;
    this.previousFrameMs = null;
    if (playing) this.requestFrame();
    else if (this.frameId !== null) {
      window.cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.notifyPlayback();
  }

  setPlaybackSpeed(speed: number): void {
    if (!Number.isFinite(speed) || speed <= 0) throw new Error("Playback speed must be > 0.");
    this.playbackSpeed = speed;
    this.notifyPlayback();
  }

  setLoop(loop: boolean): void {
    this.loop = loop;
    this.notifyPlayback();
  }

  setDeformationScale(scale: number): void {
    if (!Number.isFinite(scale) || scale < 0) throw new Error("Deformation scale must be >= 0.");
    this.deformationScale = scale;
    this.applyCurrentFrame();
  }

  setRotationEmphasis(scale: number): void {
    if (!Number.isFinite(scale) || scale < 0) throw new Error("Rotation emphasis must be >= 0.");
    this.rotationEmphasis = scale;
    this.applyCurrentFrame();
  }

  /** Seek in seconds from the start of the selected animation. */
  seek(seconds: number): void {
    if (!Number.isFinite(seconds)) throw new Error("Seek position must be finite.");
    const duration = this.animationDuration();
    this.currentTime = Math.min(Math.max(seconds, 0), duration);
    this.previousFrameMs = null;
    this.applyCurrentFrame();
    this.notifyPlayback();
  }

  seekNormalized(progress: number): void {
    if (!Number.isFinite(progress)) throw new Error("Seek progress must be finite.");
    this.seek(Math.min(Math.max(progress, 0), 1) * this.animationDuration());
  }

  setCategoryVisible(category: VisualizationCategory, visible: boolean): void {
    this.categoryVisibility.set(category, visible);
    this.updateVisibility();
  }

  setBackground(background: THREE.ColorRepresentation): void {
    this.scene.background = new THREE.Color(background);
    this.requestFrame();
  }

  setStoryVisible(story: number, visible: boolean): void {
    const geometry = this.assertModel();
    if (!Number.isInteger(story) || story < 0 || story > geometry.storyCount) {
      throw new Error(`Story visibility index must be between 0 and ${geometry.storyCount}.`);
    }
    this.storyVisibility.set(story, visible);
    this.updateVisibility();
  }

  getPlaybackState(): ViewerPlaybackState {
    return {
      playing: this.playing,
      currentTime: this.currentTime,
      duration: this.animationDuration(),
      speed: this.playbackSpeed,
      loop: this.loop,
      kind: this.source.kind
    };
  }

  getStoryCount(): number {
    return this.assertModel().storyCount;
  }

  onPlaybackChange(listener: PlaybackListener): () => void {
    this.listeners.add(listener);
    listener(this.getPlaybackState());
    return () => this.listeners.delete(listener);
  }

  resetCamera(): void {
    const geometry = this.assertModel();
    const target = vector(geometry.bounds.center);
    const radius = Math.max(geometry.bounds.characteristicLength * 0.55, 1);
    const verticalFov = THREE.MathUtils.degToRad(this.camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * this.camera.aspect);
    const limitingFov = Math.min(verticalFov, horizontalFov);
    const distance = radius / Math.tan(limitingFov / 2) * 1.35;
    const direction = new THREE.Vector3(1.1, 0.8, 1.1).normalize();
    this.camera.near = Math.max(distance / 1000, 0.1);
    this.camera.far = Math.max(distance * 20, 10_000);
    this.camera.position.copy(target).addScaledVector(direction, distance);
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(target);
    this.controls.update();
    this.requestFrame();
  }

  resize(): void {
    if (this.disposed) return;
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.requestFrame();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.frameId !== null) window.cancelAnimationFrame(this.frameId);
    this.frameId = null;
    this.resizeObserver?.disconnect();
    if (!this.resizeObserver) window.removeEventListener("resize", this.fallbackResize);
    this.controls.removeEventListener("change", this.requestFrame);
    this.controls.dispose();
    disposeObject(this.modelRoot);
    disposeObject(this.helperRoot);
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.listeners.clear();
    this.renderables.length = 0;
    this.levelObjects.length = 0;
    this.segmentObjects.length = 0;
    this.wallObjects.length = 0;
  }

  private readonly requestFrame = (): void => {
    if (this.disposed || this.frameId !== null) return;
    this.frameId = window.requestAnimationFrame(this.renderFrame);
  };

  private readonly renderFrame = (timestampMs: number): void => {
    this.frameId = null;
    if (this.disposed) return;
    if (this.playing) {
      if (this.previousFrameMs !== null) {
        const elapsed = Math.min(Math.max((timestampMs - this.previousFrameMs) / 1000, 0), 0.25);
        this.advance(elapsed * this.playbackSpeed);
      }
      this.previousFrameMs = timestampMs;
      this.applyCurrentFrame(false);
      this.notifyPlayback();
    }
    this.renderer.render(this.scene, this.camera);
    if (this.playing) this.requestFrame();
  };

  private advance(seconds: number): void {
    const duration = this.animationDuration();
    if (duration <= 0) {
      this.currentTime = 0;
      this.playing = false;
      return;
    }
    const next = this.currentTime + seconds;
    if (next <= duration) {
      this.currentTime = next;
      return;
    }
    if (this.loop) this.currentTime = next % duration;
    else {
      this.currentTime = duration;
      this.playing = false;
      this.previousFrameMs = null;
    }
  }

  private animationDuration(): number {
    if (this.source.kind === "realMode") return 1 / this.source.frequencyHz;
    if (this.source.kind === "complexMode") return 1 / this.source.mode.frequencyHz;
    if (this.source.kind === "response") return this.source.series.duration;
    return 0;
  }

  private samplePoses(): LevelPose[] {
    const geometry = this.assertModel();
    if (this.source.kind === "static") return createZeroLevelPoses(geometry.storyCount);
    if (this.source.kind === "realMode") {
      return sampleRealMode(this.source.shape, this.currentTime * this.source.frequencyHz * TWO_PI);
    }
    if (this.source.kind === "complexMode") {
      return sampleComplexMode(
        this.source.mode,
        this.currentTime * this.source.mode.frequencyHz * TWO_PI
      );
    }
    return sampleResponseSeries(this.source.series, this.currentTime);
  }

  private effectivePoses(): LevelPose[] {
    const geometry = this.assertModel();
    const poses = this.samplePoses();
    if (this.source.kind === "realMode" || this.source.kind === "complexMode") {
      return clampRotations(
        scaledModalLevelPoses(
          poses,
          geometry.bounds.characteristicLength,
          this.deformationScale,
          this.rotationEmphasis
        ),
        Math.PI / 3
      );
    }
    if (this.source.kind === "response") {
      return scaledLevelPoses(
        poses,
        this.deformationScale,
        this.deformationScale * this.rotationEmphasis
      );
    }
    return poses;
  }

  private applyCurrentFrame(requestRender = true): void {
    if (!this.modelGeometry) return;
    const poses = this.effectivePoses();
    for (const item of this.levelObjects) {
      const pivot = this.modelGeometry.levelCenters[item.level];
      const pose = poses[item.level] ?? { dx: 0, dy: 0, rz: 0 };
      item.object.position.set(pivot.x + pose.dx, item.baseZ, -(pivot.y + pose.dy));
      item.object.rotation.set(0, pose.rz, 0);
    }
    for (const item of this.segmentObjects) {
      const start = vector(
        deformAttachedPoint(item.primitive.start, this.modelGeometry.levelCenters, poses)
      );
      const end = vector(
        deformAttachedPoint(item.primitive.end, this.modelGeometry.levelCenters, poses)
      );
      setCylinderBetween(item.mesh, start, end);
    }
    for (const item of this.wallObjects) {
      const primitive = item.primitive;
      setWallVertices(
        item.mesh,
        [primitive.lowerStart, primitive.lowerEnd, primitive.upperEnd, primitive.upperStart].map(
          (point) => vector(deformAttachedPoint(point, this.modelGeometry!.levelCenters, poses))
        )
      );
    }
    if (requestRender) this.requestFrame();
  }

  private buildHelpers(geometry: ModelGeometry): void {
    const gridSize = Math.max(geometry.bounds.characteristicLength * 1.3, 100);
    const grid = new THREE.GridHelper(gridSize, 12, 0x82908c, 0xcbd4d1);
    grid.position.set(
      geometry.bounds.center.x,
      geometry.zLevels[0] - geometry.bounds.characteristicLength * 0.002,
      geometry.bounds.center.z
    );
    this.helperRoot.add(grid);
    const axes = new THREE.AxesHelper(geometry.bounds.characteristicLength * 0.12);
    axes.position.set(geometry.bounds.min.x, geometry.zLevels[0], geometry.bounds.max.z);
    this.helperRoot.add(axes);
  }

  private buildFloors(geometry: ModelGeometry): void {
    for (const primitive of geometry.floors) {
      const pivot = geometry.levelCenters[primitive.level];
      const group = new THREE.Group();
      const shape = new THREE.Shape();
      primitive.polygon.forEach((point, index) => {
        const x = point.x - pivot.x;
        const y = point.y - pivot.y;
        if (index === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      });
      if (primitive.polygon.length >= 3) {
        shape.closePath();
        const surfaceGeometry = new THREE.ShapeGeometry(shape);
        surfaceGeometry.rotateX(-Math.PI / 2);
        const surface = new THREE.Mesh(
          surfaceGeometry,
          new THREE.MeshBasicMaterial({
            color: color(this.options.floorColor, 0x6aa9a0),
            transparent: true,
            opacity: 0.18,
            depthWrite: false,
            side: THREE.DoubleSide
          })
        );
        group.add(surface);
      }
      const outlineGeometry = new THREE.BufferGeometry().setFromPoints(
        primitive.polygon.map(
          (point) => new THREE.Vector3(point.x - pivot.x, 0, -(point.y - pivot.y))
        )
      );
      const outline = new THREE.LineLoop(
        outlineGeometry,
        new THREE.LineBasicMaterial({ color: color(this.options.floorColor, 0x2f6f68) })
      );
      group.add(outline);
      this.addRenderable(group, primitive.category, primitive.story);
      this.levelObjects.push({ object: group, level: primitive.level, baseZ: primitive.z });
    }
  }

  private buildColumnsAndBraces(geometry: ModelGeometry): void {
    for (const primitive of [...geometry.columns, ...geometry.braces]) {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(primitive.radius, primitive.radius, 1, 8),
        new THREE.MeshBasicMaterial({
          color:
            primitive.category === "columns"
              ? color(this.options.columnColor, 0x426f88)
              : color(this.options.braceColor, 0xd2853d)
        })
      );
      this.addRenderable(mesh, primitive.category, primitive.story);
      this.segmentObjects.push({ mesh, primitive });
    }
  }

  private buildWalls(geometry: ModelGeometry): void {
    for (const primitive of geometry.walls) {
      const buffer = new THREE.BufferGeometry();
      buffer.setAttribute("position", new THREE.Float32BufferAttribute(new Array(12).fill(0), 3));
      buffer.setIndex([0, 1, 2, 0, 2, 3]);
      const structural = primitive.category === "structuralWalls";
      const mesh = new THREE.Mesh(
        buffer,
        new THREE.MeshBasicMaterial({
          color: structural
            ? color(this.options.structuralWallColor, 0x345f72)
            : color(this.options.nonStructuralWallColor, 0x9da7aa),
          transparent: true,
          opacity: structural ? 0.7 : 0.32,
          depthWrite: structural,
          side: THREE.DoubleSide
        })
      );
      this.addRenderable(mesh, primitive.category, primitive.story);
      this.wallObjects.push({ mesh, primitive });
    }
  }

  private buildMassDampers(geometry: ModelGeometry): void {
    for (const primitive of geometry.massDampers) {
      const pivot = geometry.levelCenters[primitive.level];
      const baseZ = geometry.zLevels[primitive.level];
      const group = new THREE.Group();
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(primitive.radius, 18, 12),
        new THREE.MeshBasicMaterial({ color: color(this.options.massDamperColor, 0x9f4f77) })
      );
      sphere.position.set(
        primitive.anchor.x - pivot.x,
        primitive.z - baseZ,
        -(primitive.anchor.y - pivot.y)
      );
      group.add(sphere);
      const springPoints = primitive.spring.map(
        (point, index) =>
          new THREE.Vector3(
            point.x - pivot.x,
            primitive.springZ[index] - baseZ,
            -(point.y - pivot.y)
          )
      );
      const spring = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(springPoints),
        new THREE.LineBasicMaterial({ color: 0x6f3654 })
      );
      group.add(spring);
      this.addRenderable(group, primitive.category, primitive.story);
      this.levelObjects.push({ object: group, level: primitive.level, baseZ });
    }
  }

  private buildCenters(geometry: ModelGeometry): void {
    for (const primitive of geometry.centers) {
      const pivot = geometry.levelCenters[primitive.level];
      const baseZ = geometry.zLevels[primitive.level];
      const group = new THREE.Group();
      let marker: THREE.Object3D;
      if (primitive.category === "massCenters") {
        marker = new THREE.Mesh(
          new THREE.SphereGeometry(primitive.radius * 0.32, 14, 10),
          new THREE.MeshBasicMaterial({ color: 0xd83b3b })
        );
      } else {
        marker = new THREE.Mesh(
          new THREE.TorusGeometry(primitive.radius * 0.52, primitive.radius * 0.09, 8, 24),
          new THREE.MeshBasicMaterial({ color: 0x2867c7 })
        );
        marker.rotation.x = Math.PI / 2;
      }
      marker.position.set(
        primitive.point.x - pivot.x,
        primitive.z - baseZ,
        -(primitive.point.y - pivot.y)
      );
      group.add(marker);
      this.addRenderable(group, primitive.category, primitive.story);
      this.levelObjects.push({ object: group, level: primitive.level, baseZ });
    }
  }

  private addRenderable(
    object: THREE.Object3D,
    category: VisualizationCategory,
    story: number
  ): void {
    object.userData.category = category;
    object.userData.story = story;
    this.modelRoot.add(object);
    this.renderables.push({ object, category, story });
  }

  private updateVisibility(): void {
    for (const item of this.renderables) {
      item.object.visible =
        (this.categoryVisibility.get(item.category) ?? true) &&
        (this.storyVisibility.get(item.story) ?? true);
    }
    this.requestFrame();
  }

  private stopPlayback(): void {
    this.playing = false;
    this.previousFrameMs = null;
    if (this.frameId !== null) window.cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }

  private clearSceneModel(): void {
    disposeObject(this.modelRoot);
    disposeObject(this.helperRoot);
    this.scene.remove(this.modelRoot, this.helperRoot);
    this.modelRoot = new THREE.Group();
    this.helperRoot = new THREE.Group();
    this.scene.add(this.helperRoot, this.modelRoot);
    this.renderables.length = 0;
    this.levelObjects.length = 0;
    this.segmentObjects.length = 0;
    this.wallObjects.length = 0;
    this.storyVisibility.clear();
  }

  private assertActive(): void {
    if (this.disposed) throw new Error("ThreeViewer has been disposed.");
  }

  private assertModel(): ModelGeometry {
    this.assertActive();
    if (!this.modelGeometry) throw new Error("Load a BuildingModel before using the 3D viewer.");
    return this.modelGeometry;
  }

  private notifyPlayback(): void {
    const state = this.getPlaybackState();
    this.listeners.forEach((listener) => listener(state));
  }
}
