import * as THREE from "three";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js";

const root = document.querySelector("[data-model-viewer]");
if (!root) throw new Error("3D model viewer element is missing");

const canvas = root.querySelector("canvas");
const status = root.querySelector("[data-model-status]");
const resetButton = root.querySelector("[data-model-reset]");
const rotateButton = root.querySelector("[data-model-rotate]");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#262626");

const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 1000);
camera.position.set(0, 0.35, 4.4);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

scene.add(new THREE.HemisphereLight(0xf3f1e9, 0x262626, 2.2));

const keyLight = new THREE.DirectionalLight(0xffe2d5, 3.2);
keyLight.position.set(3, 5, 4);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x8ab8d8, 1.1);
fillLight.position.set(-4, 2, -3);
scene.add(fillLight);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.autoRotate = !reducedMotion;
controls.autoRotateSpeed = 0.65;
controls.minDistance = 1.8;
controls.maxDistance = 8;
controls.target.set(0, 0, 0);

let initialCameraPosition;
let initialTarget;

function resize() {
  const width = Math.max(root.clientWidth, 1);
  const height = Math.max(root.clientHeight, 1);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(root);
resize();

const loader = new GLTFLoader();
loader.load(
  "assets/networked-model.glb",
  (gltf) => {
    const model = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const largestSide = Math.max(size.x, size.y, size.z);
    const scale = 2.35 / largestSide;

    model.position.copy(center).multiplyScalar(-scale);
    model.scale.setScalar(scale);
    scene.add(model);

    const normalizedBounds = new THREE.Box3().setFromObject(model);
    const normalizedCenter = normalizedBounds.getCenter(new THREE.Vector3());
    const normalizedSize = normalizedBounds.getSize(new THREE.Vector3());
    const radius = Math.max(normalizedSize.x, normalizedSize.y, normalizedSize.z) * 0.62;
    controls.target.copy(normalizedCenter);
    camera.position.set(radius * 0.12, radius * 0.12, radius * 3.2);
    camera.near = Math.max(radius / 100, 0.01);
    camera.far = radius * 30;
    camera.updateProjectionMatrix();
    controls.minDistance = radius * 1.15;
    controls.maxDistance = radius * 8;
    controls.update();

    initialCameraPosition = camera.position.clone();
    initialTarget = controls.target.clone();
    status.textContent = "拖动旋转 · 滚轮缩放";
    root.classList.add("is-model-ready");
  },
  (event) => {
    if (event.total > 0) {
      const percent = Math.round((event.loaded / event.total) * 100);
      status.textContent = `正在载入模型 ${percent}%`;
    } else {
      status.textContent = "正在载入模型…";
    }
  },
  (error) => {
    console.error("Unable to load 3D model", error);
    status.textContent = "模型载入失败，请刷新页面重试。";
    root.classList.add("has-model-error");
  }
);

resetButton.addEventListener("click", () => {
  if (!initialCameraPosition || !initialTarget) return;
  camera.position.copy(initialCameraPosition);
  controls.target.copy(initialTarget);
  controls.update();
});

rotateButton.setAttribute("aria-pressed", String(controls.autoRotate));
rotateButton.addEventListener("click", () => {
  controls.autoRotate = !controls.autoRotate;
  rotateButton.setAttribute("aria-pressed", String(controls.autoRotate));
});

function render() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

render();
