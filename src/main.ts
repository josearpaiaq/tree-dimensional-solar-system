import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { createScene } from './scene/createScene.ts';
import { createLighting } from './scene/lighting.ts';
import { createStarfield } from './scene/starfield.ts';
import { detectQualityTier } from './scene/quality.ts';
import { createOrbitLines } from './scene/orbitLines.ts';
import { createBodies } from './bodies/createBodies.ts';
import { KM_PER_SCENE_UNIT, PHYSICS_STEP, ORBIT_TIME_SCALE, CRUISE_DROPOUT_DISTANCE } from './bodies/scaleConfig.ts';
import CameraRig from './camera/CameraRig.ts';
import ShipCamera from './camera/ShipCamera.ts';
import PlanetPicker from './interaction/PlanetPicker.ts';
import KeyboardMouseInput from './input/KeyboardMouseInput.ts';
import { emptyControls, type ControlAction } from './input/ControlState.ts';
import Ship from './ship/Ship.ts';
import {
  stepFlight,
  canEngageCruise,
  cruiseCap,
  disengageCruise,
  shipForward,
  isNavLocked,
  isParked,
  nearestSurfaceDistance,
  nearestBody,
  type ShipState,
} from './ship/flightModel.ts';
import { resolveFrame, pickReferenceBody } from './ship/referenceFrame.ts';
import BodyTracker from './game/BodyTracker.ts';
import { initialScanState, setTarget, stepScan, pickTarget, type ScanStatus } from './game/scanner.ts';
import Codex from './game/Codex.ts';
import SaveStore from './game/SaveStore.ts';
import GameMode, { type Mode } from './game/GameMode.ts';
import FactsPanel from './ui/FactsPanel.ts';
import NavList, { SHIP_ENTRY_ID } from './ui/NavList.ts';
import LoadingScreen from './ui/LoadingScreen.ts';
import Hud, { type HudTarget } from './ui/Hud.ts';
import TargetMarker from './ui/TargetMarker.ts';
import CodexPanel from './ui/CodexPanel.ts';
import MapOverlay from './ui/MapOverlay.ts';
import type CelestialBody from './bodies/CelestialBody.ts';
import './style.css';

const SPAWN_DISTANCE = 4.2; // from Earth's center: just outside its scan range, so the first lesson is the approach
const SCAN_FACTS_DURATION_MS = 6000;
const ARMED_CRUISE_FACING_COS = Math.cos(THREE.MathUtils.degToRad(60));
const MAX_FRAME_DT = 0.1; // a long hitch is absorbed rather than simulated as a huge jump

const CONTROLS_HINTS: Partial<Record<Mode, string>> = {
  flight: 'T target · J cruise · O orbits · M map · Tab codex · Esc pause',
  map: 'drag to orbit · right-drag to pan · scroll to zoom · click a body to target it · O orbits · M to fly',
};

const appEl = document.getElementById('app')!;
const canvas = document.getElementById('scene-canvas') as HTMLCanvasElement;
const { scene, camera, renderer } = createScene(canvas, detectQualityTier());

createLighting(scene);
const starfield = createStarfield();
scene.add(starfield);

const loadingManager = new THREE.LoadingManager();
const { group: bodiesGroup, celestialBodies, byId } = createBodies(loadingManager);
scene.add(bodiesGroup);
const orbitLines = createOrbitLines(celestialBodies);

// Bloom on the sun's unlit, bright material (and the ship's engine glow) —
// nothing else crosses the threshold, so no selective-bloom layer is needed.
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

// --- Game state ---

const tracker = new BodyTracker(celestialBodies);
const ship = new Ship(spawnState());
scene.add(ship.group);
const shipCamera = new ShipCamera(camera, ship);

const saveStore = new SaveStore();
const codex = new Codex(
  saveStore.load().codex.filter((id) => byId.has(id)),
  { onUnlock: () => saveStore.save({ version: 1, codex: codex.toArray() }) }
);
let scanState = initialScanState();
let scanStatus: ScanStatus = { inRange: false, aligned: false, scanning: false, completed: false };
let throttle = 0;
let lastControls = emptyControls();
// J pressed too close to a body: cruise engages by itself once clear.
let cruiseArmed = false;
let factsTimer: number | undefined;

// Spawn between the Sun and Earth, facing Earth's lit side.
function spawnState(): ShipState {
  const earth = tracker.byId.get('earth')!.position;
  const position = earth.clone().sub(earth.clone().normalize().multiplyScalar(SPAWN_DISTANCE));
  const orientation = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().lookAt(position, earth, new THREE.Vector3(0, 1, 0))
  );
  return {
    position,
    velocity: new THREE.Vector3(),
    orientation,
    angularVelocity: new THREE.Vector3(),
    flightAssist: true,
    cruise: false,
    referenceBodyId: pickReferenceBody(position, tracker.snapshots).id,
  };
}

// --- UI ---

const hud = new Hud();
const targetMarker = new TargetMarker();
const factsPanel = new FactsPanel({ onClose: handleFactsClose });
const codexPanel = new CodexPanel(celestialBodies, {
  onSelect: (bodyId) => showFacts(byId.get(bodyId)!, 'Close'),
  onClose: () => gameMode.toggleCodex(),
});
const controlsHint = document.getElementById('controls-hint')!;

function showFacts(body: CelestialBody, closeLabel: string): void {
  window.clearTimeout(factsTimer);
  factsPanel.show(body, { cataloged: codex.has(body.id), closeLabel });
}

function handleFactsClose(): void {
  if (gameMode.mode === 'map') {
    cameraRig.returnToOverview();
  } else {
    factsPanel.hide();
  }
}

// --- Map (the original free-orbit explorer) ---

function handleFlightStart(): void {
  factsPanel.hide();
}

function handleFlightEnd(body: CelestialBody | null): void {
  if (body) {
    showFacts(body, '← Overview');
    navList.setActive(body.id);
  } else {
    factsPanel.hide();
    navList.setActive(null);
  }
}

// In the map, picking a body both focuses the camera on it and makes it
// the flight target.
function focusBody(bodyId: string): void {
  if (cameraRig.state === 'transition') return;
  const body = byId.get(bodyId);
  if (!body) return;
  cameraRig.focusOn(body);
  selectTarget(bodyId);
}

const SHIP_FOCUS_DISTANCE = 6; // close enough to see the ship's neighbourhood

function focusShip(): void {
  if (cameraRig.state === 'transition') return;
  cameraRig.focusOnPoint(ship.state.position, SHIP_FOCUS_DISTANCE, () => navList.setActive(SHIP_ENTRY_ID));
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

const cameraRig = new CameraRig(camera, renderer.domElement, {
  onFlightStart: handleFlightStart,
  onFlightEnd: handleFlightEnd,
  outermostOrbitRadius,
});
// The game starts in the flight camera. Placed after CameraRig, whose
// OrbitControls re-aims the camera on construction.
cameraRig.controls.enabled = false;
shipCamera.snap();
shipCamera.update(0);
const navList = new NavList(celestialBodies, { onSelect: focusBody, onSelectShip: focusShip });
const mapOverlay = new MapOverlay();
const planetPicker = new PlanetPicker(
  camera,
  renderer.domElement,
  celestialBodies.map((b) => b.mesh),
  { onPick: focusBody, onMiss: handleMiss, onHoverChange: handleHoverChange }
);
planetPicker.setEnabled(false);

// --- Modes ---

const input = new KeyboardMouseInput(renderer.domElement, {
  onLockChange: (locked) => gameMode.handleLockChange(locked),
});

const gameMode = new GameMode({
  input,
  cameraRig,
  getFlightCameraPose: (position, quaternion) => {
    shipCamera.snap();
    shipCamera.computePose(ship.state, position, quaternion);
  },
  onChange: handleModeChange,
});

function handleModeChange(mode: Mode): void {
  appEl.dataset.mode = mode;
  controlsHint.textContent = CONTROLS_HINTS[mode] ?? '';
  planetPicker.setEnabled(mode === 'map');
  // The model is hidden in cockpit view, but the map should show it.
  ship.group.visible = mode === 'map' || shipCamera.view === 'chase';

  if (mode === 'map') {
    factsPanel.hide();
  } else {
    navList.setActive(null);
  }
  if (mode === 'codex') codexPanel.render(codex);
  if (mode === 'flight') {
    factsPanel.hide();
    shipCamera.snap();
  }
}
handleModeChange(gameMode.mode);

document.getElementById('pause-resume')!.addEventListener('click', () => gameMode.resume());

// --- Flight actions ---

function selectTarget(bodyId: string | null): void {
  scanState = setTarget(scanState, bodyId);
}

function handleActions(actions: ControlAction[]): void {
  for (const action of actions) {
    switch (action) {
      case 'toggleMap':
        gameMode.toggleMap();
        break;
      case 'toggleCodex':
        gameMode.toggleCodex();
        break;
      case 'back':
        gameMode.back();
        break;
      case 'toggleOrbits': {
        const visible = !orbitLines[0]?.visible;
        for (const line of orbitLines) line.visible = visible;
        break;
      }
      default:
        if (gameMode.mode === 'flight') handleFlightAction(action);
    }
  }
}

function handleFlightAction(action: ControlAction): void {
  const state = ship.state;
  switch (action) {
    case 'toggleAssist':
      state.flightAssist = !state.flightAssist;
      hud.flash(state.flightAssist ? 'Flight assist ON' : 'Flight assist OFF — Newtonian drift');
      break;
    case 'toggleCruise':
      if (state.cruise) {
        disengageCruise(state);
        hud.flash('Cruise disengaged');
      } else if (cruiseArmed) {
        cruiseArmed = false;
        hud.flash('Cruise cancelled');
      } else if (canEngageCruise(state.position, tracker.snapshots)) {
        state.cruise = true;
        hud.flash('Cruise engaged');
      } else {
        cruiseArmed = true;
        hud.flash('Cruise armed — it engages once you fly clear');
      }
      break;
    case 'target': {
      const forward = shipForward(state.orientation);
      const id = pickTarget(state.position, forward, tracker.snapshots);
      selectTarget(id);
      if (id) hud.flash(`Target: ${byId.get(id)!.name}`);
      break;
    }
    case 'toggleCamera':
      shipCamera.toggleView();
      break;
  }
}

// --- Simulation ---

let accumulator = 0;

function stepSimulation(frameDt: number): void {
  const controls = input.read(frameDt);
  lastControls = controls;
  throttle = THREE.MathUtils.lerp(throttle, ship.state.cruise ? 1 : Math.max(0, controls.thrust.z), 0.15);

  accumulator += Math.min(frameDt, MAX_FRAME_DT);
  while (accumulator >= PHYSICS_STEP) {
    accumulator -= PHYSICS_STEP;

    for (const body of celestialBodies) body.update(PHYSICS_STEP * ORBIT_TIME_SCALE);
    tracker.update(PHYSICS_STEP);

    const frame = resolveFrame(ship.state.position, ship.state.referenceBodyId, tracker.snapshots, PHYSICS_STEP);
    ship.state.position.copy(frame.position);
    ship.state.referenceBodyId = frame.referenceBodyId;
    ship.state = stepFlight(ship.state, controls, tracker.snapshots, PHYSICS_STEP, scanState.targetId);

    stepScanner();
  }

  if (cruiseArmed && !ship.state.cruise && canEngageCruise(ship.state.position, tracker.snapshots) && !noseOnNearestBody()) {
    cruiseArmed = false;
    ship.state.cruise = true;
    hud.flash('Cruise engaged');
  }
}

// Armed cruise waits while the nose points back at the body being cleared:
// engaging then would dive straight back in and drop out at once.
function noseOnNearestBody(): boolean {
  const nearest = nearestBody(ship.state.position, tracker.snapshots);
  if (!nearest) return false;
  const toNearest = nearest.position.clone().sub(ship.state.position).normalize();
  return toNearest.dot(shipForward(ship.state.orientation)) > ARMED_CRUISE_FACING_COS;
}

function stepScanner(): void {
  const targetId = scanState.targetId;
  const target = targetId && !codex.has(targetId) ? (tracker.byId.get(targetId) ?? null) : null;
  const result = stepScan(
    scanState,
    { position: ship.state.position, forward: shipForward(ship.state.orientation), cruise: ship.state.cruise },
    target,
    PHYSICS_STEP
  );
  scanState = result.state;
  scanStatus = result.status;

  if (result.status.completed && targetId) {
    codex.add(targetId);
    const body = byId.get(targetId)!;
    hud.flash(`Cataloged: ${body.name}  (${codex.size} / ${celestialBodies.length})`, 3500);
    showFacts(body, 'Close');
    factsTimer = window.setTimeout(() => factsPanel.hide(), SCAN_FACTS_DURATION_MS);
  }
}

function targetHudInfo(): HudTarget | null {
  const targetId = scanState.targetId;
  const target = targetId ? tracker.byId.get(targetId) : undefined;
  if (!targetId || !target) return null;

  const distance = ship.state.position.distanceTo(target.position);
  let status: string;
  if (codex.has(targetId)) status = 'Cataloged';
  else if (scanStatus.scanning) status = `Scanning ${Math.round(scanState.progress * 100)}%`;
  else if (isNavLocked(ship.state, tracker.snapshots, targetId)) status = 'Nav lock · approaching';
  else if (ship.state.cruise) status = 'Point the nose at it to nav-lock';
  else if (!scanStatus.inRange) status = `Scan range ${formatKm(target.scanRadius)}`;
  else if (!scanStatus.aligned) status = 'Point the nose at the target';
  else status = 'Ready';

  return { name: byId.get(targetId)!.name, distanceKm: distance * KM_PER_SCENE_UNIT, status };
}

function armedCruiseHint(): string {
  const remaining = CRUISE_DROPOUT_DISTANCE - nearestSurfaceDistance(ship.state.position, tracker.snapshots);
  const nearest = nearestBody(ship.state.position, tracker.snapshots);
  if (remaining > 0) return `clear ${formatKm(remaining)}`;
  return noseOnNearestBody() && nearest ? `turn away from ${byId.get(nearest.id)!.name}` : 'engaging';
}

function updateFlightUi(): void {
  const reference = byId.get(ship.state.referenceBodyId)!;
  hud.update({
    speedKmS: ship.state.velocity.length() * KM_PER_SCENE_UNIT,
    referenceName: reference.name,
    parked: isParked(ship.state, lastControls, tracker.snapshots),
    flightAssist: ship.state.flightAssist,
    cruise: ship.state.cruise,
    navLock: isNavLocked(ship.state, tracker.snapshots, scanState.targetId),
    cruiseArmed: cruiseArmed ? armedCruiseHint() : null,
    cruiseCapKmS: cruiseCap(ship.state.position, tracker.snapshots) * KM_PER_SCENE_UNIT,
    target: targetHudInfo(),
    scanProgress: scanStatus.scanning ? scanState.progress : null,
    codexCount: codex.size,
    codexTotal: celestialBodies.length,
  });

  const target = scanState.targetId ? tracker.byId.get(scanState.targetId) : undefined;
  camera.updateMatrixWorld();
  targetMarker.update(
    camera,
    target ? { position: target.position, radius: target.radius, name: byId.get(target.id)!.name } : null
  );
}

function formatKm(sceneUnits: number): string {
  return `${Math.round(sceneUnits * KM_PER_SCENE_UNIT).toLocaleString('en-US')} km`;
}

// --- Loop ---

const loadingScreen = new LoadingScreen(loadingManager, {
  onLoad: () => requestAnimationFrame(() => loadingScreen.hide()),
});

const timer = new THREE.Timer();
timer.connect(document); // uses the Page Visibility API to avoid a huge delta after a backgrounded tab

function animate(): void {
  requestAnimationFrame(animate);
  timer.update();
  const dt = timer.getDelta();

  handleActions(input.consumeActions());

  if (gameMode.mode === 'flight') {
    stepSimulation(dt);
    ship.sync(throttle);
    shipCamera.update(dt);
    updateFlightUi();
  } else {
    input.read(dt); // drop mouse movement accumulated while not flying
    ship.sync(0);
    if (gameMode.mode === 'map' || cameraRig.state === 'transition') {
      cameraRig.update(dt);
      planetPicker.update();
    }
    if (gameMode.mode === 'map') {
      const target = scanState.targetId ? tracker.byId.get(scanState.targetId) : undefined;
      mapOverlay.update(camera, ship.state.position, target ? target.position : null);
    }
  }

  // Stars sit at "infinity": they follow the camera so the sky never runs
  // out, however far the ship flies.
  starfield.position.copy(camera.position);
  composer.render();
}
animate();
