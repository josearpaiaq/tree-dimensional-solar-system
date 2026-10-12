import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { createScene } from './scene/createScene.ts';
import { createLighting } from './scene/lighting.ts';
import { createStarfield } from './scene/starfield.ts';
import { createBodies } from './bodies/createBodies.ts';
import CameraRig from './camera/CameraRig.ts';
import PlanetPicker from './interaction/PlanetPicker.ts';
import FactsPanel from './ui/FactsPanel.ts';
import NavList from './ui/NavList.ts';
import LoadingScreen from './ui/LoadingScreen.ts';
import type CelestialBody from './bodies/CelestialBody.ts';
import './style.css';

const canvas = document.getElementById('scene-canvas') as HTMLCanvasElement;
const { scene, camera, renderer } = createScene(canvas);

createLighting(scene);
scene.add(createStarfield());

const loadingManager = new THREE.LoadingManager();
const { group: bodiesGroup, celestialBodies, byId } = createBodies(loadingManager);
scene.add(bodiesGroup);

// Bloom on the sun's unlit, bright material — nothing else in the scene
// crosses the threshold, so no manual selective-bloom layer is needed.
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.9,
  0.6,
  0.82
);
composer.addPass(bloomPass);
window.addEventListener('resize', () => {
  composer.setSize(window.innerWidth, window.innerHeight);
});

const loadingScreen = new LoadingScreen(loadingManager, {
  onLoad: () => requestAnimationFrame(() => loadingScreen.hide()),
});

function handleFlightStart(): void {
  factsPanel.hide();
}

function handleFlightEnd(body: CelestialBody | null): void {
  if (body) {
    factsPanel.show(body);
    navList.setActive(body.id);
  } else {
    factsPanel.hide();
    navList.setActive(null);
  }
}

function focusBody(bodyId: string): void {
  const body = byId.get(bodyId);
  if (body) cameraRig.focusOn(body);
}

function handleMiss(): void {
  if (cameraRig.state === 'focused') cameraRig.returnToOverview();
}

let hoveredBody: CelestialBody | null = null;
function handleHoverChange(bodyId: string | null): void {
  if (hoveredBody) hoveredBody.setHighlighted(false);
  hoveredBody = bodyId ? (byId.get(bodyId) ?? null) : null;
  if (hoveredBody) hoveredBody.setHighlighted(true);
}

const outermostOrbitRadius = Math.max(...celestialBodies.map((b) => b.orbitRadius));

const factsPanel = new FactsPanel({ onClose: () => cameraRig.returnToOverview() });
const cameraRig = new CameraRig(camera, renderer.domElement, {
  onFlightStart: handleFlightStart,
  onFlightEnd: handleFlightEnd,
  outermostOrbitRadius,
});
const navList = new NavList(celestialBodies, { onSelect: focusBody });
const planetPicker = new PlanetPicker(
  camera,
  renderer.domElement,
  celestialBodies.map((b) => b.mesh),
  { onPick: focusBody, onMiss: handleMiss, onHoverChange: handleHoverChange }
);

const controlsHint = document.getElementById('controls-hint')!;
renderer.domElement.addEventListener('pointerdown', () => controlsHint.classList.add('hidden'), {
  once: true,
});

const timer = new THREE.Timer();
timer.connect(document); // uses the Page Visibility API to avoid a huge delta after a backgrounded tab

function animate(): void {
  requestAnimationFrame(animate);
  timer.update();
  const dt = timer.getDelta();

  for (const body of celestialBodies) body.update(dt);
  cameraRig.update(dt);
  planetPicker.update();

  composer.render();
}
animate();
