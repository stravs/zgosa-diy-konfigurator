import * as THREE from 'three';
import { getDevicePixelRatioCap } from './performance.js';

export function createScene(app) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, getDevicePixelRatioCap()));
  renderer.setSize(app.clientWidth, app.clientHeight);
  renderer.shadowMap.enabled = false;
  app.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b8e6);
  scene.fog = new THREE.Fog(0x87b8e6, 35, 90);

  const camera = new THREE.PerspectiveCamera(60, app.clientWidth / app.clientHeight, 0.1, 300);
  camera.position.set(12, 12, 12);

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.6);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
  sunLight.position.set(10, 18, 8);
  scene.add(sunLight);

  const grid = new THREE.GridHelper(100, 100, 0x94a3b8, 0x475569);
  grid.position.y = 0.001;
  grid.visible = false;
  scene.add(grid);

  const groundGeometry = new THREE.PlaneGeometry(100, 100);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    transparent: true,
    opacity: 0.15,
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = false;
  ground.name = 'ground';
  scene.add(ground);

  const axes = new THREE.AxesHelper(2);
  axes.visible = false;
  scene.add(axes);

  const objectLayer = new THREE.Group();
  objectLayer.name = 'object-layer';
  scene.add(objectLayer);

  return {
    renderer,
    scene,
    camera,
    ground,
    grid,
    objectLayer,
  };
}
