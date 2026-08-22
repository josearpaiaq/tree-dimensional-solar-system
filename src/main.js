import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { createScene } from './scene/createScene.js';
import { createLighting } from './scene/lighting.js';
import { createStarfield } from './scene/starfield.js';
import { createBodies } from './bodies/createBodies.js';
import CameraRig from './camera/CameraRig.js';
import PlanetPicker from './interaction/PlanetPicker.js';
import FactsPanel from './ui/FactsPanel.js';
import NavList from './ui/NavList.js';
import LoadingScreen from './ui/LoadingScreen.js';
import './style.css';

const canvas = document.getElementById('scene-canvas');
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

function handleFlightStart() {
  factsPanel.hide();
}

function handleFlightEnd(body) {
  if (body) {
    factsPanel.show(body);
    navList.setActive(body.id);
  } else {
    factsPanel.hide();
    navList.setActive(null);
  }
}

function focusBody(bodyId) {
  const body = byId.get(bodyId);
  if (body) cameraRig.focusOn(body);
}

function handleMiss() {
  if (cameraRig.state === 'focused') cameraRig.returnToOverview();
}

let hoveredBody = null;
function handleHoverChange(bodyId) {
  if (hoveredBody) hoveredBody.setHighlighted(false);
  hoveredBody = bodyId ? byId.get(bodyId) : null;
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

const controlsHint = document.getElementById('controls-hint');
renderer.domElement.addEventListener('pointerdown', () => controlsHint.classList.add('hidden'), {
  once: true,
});

const timer = new THREE.Timer();
timer.connect(document); // uses the Page Visibility API to avoid a huge delta after a backgrounded tab

function animate() {
  requestAnimationFrame(animate);
  timer.update();
  const dt = timer.getDelta();

  for (const body of celestialBodies) body.update(dt);
  cameraRig.update(dt);
  planetPicker.update();

  composer.render();
}
animate();
