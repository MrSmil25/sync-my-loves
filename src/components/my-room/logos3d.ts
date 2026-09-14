import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type LogoPose = {
  x: number;
  y: number;
  size: number;
  spin: number;
  tilt: number;
  alpha: number;
};

export type LogoLayer = {
  ready: boolean;
  setSize: (width: number, height: number, ratio: number) => void;
  render: (poses: [LogoPose, LogoPose], light: boolean) => void;
  snapshot: (index: 0 | 1) => HTMLCanvasElement | null;
  dispose: () => void;
};

type Entry = {
  group: THREE.Group;
  model: THREE.Object3D;
  baseScale: number;
};

function prepare(model: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  model.position.sub(center);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  return 2 / maxDim;
}

export function createLogoLayer(
  canvas: HTMLCanvasElement,
  urls: [string, string],
  onReady: () => void,
): LogoLayer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -3000, 3000);

  const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x0a1327, 1.15);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(2.5, 3.5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x86b4ff, 1.3);
  rim.position.set(-3, 1.5, -2.5);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xcda455, 0.6);
  fill.position.set(0, -3, 2);
  scene.add(fill);

  const entries: (Entry | null)[] = [null, null];
  const layer: LogoLayer = {
    ready: false,
    setSize,
    render,
    snapshot,
    dispose,
  };

  let width = 1;
  let height = 1;
  let disposed = false;

  const loader = new GLTFLoader();
  urls.forEach((url, index) => {
    loader.load(
      url,
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        const baseScale = prepare(model);
        model.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const material of materials) {
            const std = material as THREE.MeshStandardMaterial;
            std.transparent = true;
            if (std.envMapIntensity !== undefined) std.envMapIntensity = 1.1;
          }
        });
        const group = new THREE.Group();
        group.add(model);
        scene.add(group);
        entries[index] = { group, model, baseScale };
        if (entries[0] && entries[1]) {
          layer.ready = true;
          onReady();
        }
      },
      undefined,
      (error) => {
        console.error("Gagal memuat logo 3D", url, error);
      },
    );
  });

  function setSize(nextWidth: number, nextHeight: number, ratio: number) {
    width = Math.max(1, nextWidth);
    height = Math.max(1, nextHeight);
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    camera.left = -width / 2;
    camera.right = width / 2;
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.position.set(0, 0, 1000);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }

  function applyPose(entry: Entry, pose: LogoPose) {
    entry.group.position.set(pose.x - width / 2, height / 2 - pose.y, 0);
    const scale = entry.baseScale * pose.size * 0.62;
    entry.group.scale.setScalar(scale);
    entry.group.rotation.set(pose.tilt, pose.spin, 0);
    entry.model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        (material as THREE.Material).opacity = pose.alpha;
      }
    });
    entry.group.visible = pose.alpha > 0.02;
  }

  function render(poses: [LogoPose, LogoPose], light: boolean) {
    if (disposed) return;
    hemi.intensity = light ? 1.5 : 1.15;
    key.intensity = light ? 2.6 : 2.1;
    const first = entries[0];
    const second = entries[1];
    if (first) applyPose(first, poses[0]);
    if (second) applyPose(second, poses[1]);
    renderer.render(scene, camera);
  }

  function snapshot(index: 0 | 1) {
    const entry = entries[index];
    if (!entry || disposed) return null;
    const size = 320;
    const shotRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    shotRenderer.setClearColor(0x000000, 0);
    shotRenderer.setSize(size, size, false);
    shotRenderer.outputColorSpace = THREE.SRGBColorSpace;

    const shotScene = new THREE.Scene();
    shotScene.add(new THREE.HemisphereLight(0xbfd4ff, 0x0a1327, 1.3));
    const shotKey = new THREE.DirectionalLight(0xffffff, 2.2);
    shotKey.position.set(2.5, 3.5, 4);
    shotScene.add(shotKey);

    const clone = entry.model.clone(true);
    clone.scale.setScalar(entry.baseScale);
    clone.rotation.set(0, 0, 0);
    shotScene.add(clone);

    const shotCamera = new THREE.OrthographicCamera(-1.25, 1.25, 1.25, -1.25, -50, 50);
    shotCamera.position.set(0, 0, 10);
    shotCamera.lookAt(0, 0, 0);
    shotRenderer.render(shotScene, shotCamera);

    const output = document.createElement("canvas");
    output.width = size;
    output.height = size;
    const context = output.getContext("2d", { willReadFrequently: true });
    context?.drawImage(shotRenderer.domElement, 0, 0, size, size);
    shotRenderer.dispose();
    shotRenderer.forceContextLoss();
    return output;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) (material as THREE.Material).dispose();
    });
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return layer;
}
