import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { easeInOutCubic, clamp } from './easing.ts';
import { HOME_CAMERA_POSITION, HOME_TARGET, FOCUS_OFFSET_MULTIPLIER, MIN_FOCUS_OFFSET } from '../bodies/scaleConfig.ts';
import type CelestialBody from '../bodies/CelestialBody.ts';

const OVERVIEW_MIN_DISTANCE = 12;
const OVERVIEW_MAX_DISTANCE = 260; // fallback only, used if constructed without outermostOrbitRadius
const OVERVIEW_MAX_MARGIN = 1.25; // headroom so the outermost orbit isn't touching the frame edge
const OVERVIEW_FIT_SAMPLES = 64; // points on the outermost orbit checked when framing the map
const OVERVIEW_FIT_NDC = 0.92; // keep the outermost orbit just inside the screen edges
const FOCUS_MIN_DISTANCE_FACTOR = 1.6;
const FOCUS_MAX_DISTANCE_FACTOR = 14;

const MIN_FLY_DURATION = 0.8;
const MAX_FLY_DURATION = 1.8;
const DURATION_DISTANCE_FACTOR = 0.008;

type CameraState = 'idle' | 'flying' | 'focused' | 'transition';

interface Flight {
  startPos: THREE.Vector3;
  startTarget: THREE.Vector3;
  endPos: THREE.Vector3;
  endTarget: THREE.Vector3;
  elapsed: number;
  duration: number;
  onComplete: () => void;
}

// A camera move between the flight camera and the map. Unlike Flight it
// also slerps orientation, since the flight camera can be rolled and
// OrbitControls' lookAt would otherwise snap the horizon level.
interface PoseFlight {
  startPos: THREE.Vector3;
  startQuat: THREE.Quaternion;
  endPos: THREE.Vector3;
  endQuat: THREE.Quaternion;
  elapsed: number;
  duration: number;
  onComplete: () => void;
}

export interface CameraRigOptions {
  onFlightStart?: (body: CelestialBody | null) => void;
  onFlightEnd?: (body: CelestialBody | null) => void;
  outermostOrbitRadius?: number;
}

// Owns the free-orbit OrbitControls plus the click-to-focus fly-to state
// machine. This is the module the app's "fluidity" goal hinges on: the
// fly-to is a fixed-duration eased tween over elapsed time (frame-rate
// independent, no snapping), and OrbitControls stays synced via update()
// even while disabled so re-enabling it never causes a jump.
export default class CameraRig {
  camera: THREE.PerspectiveCamera;
  onFlightStart: (body: CelestialBody | null) => void;
  onFlightEnd: (body: CelestialBody | null) => void;

  controls: OrbitControls;
  state: CameraState;
  focusedBody: CelestialBody | null;

  private _overviewMaxDistance: number;
  private _outermostOrbitRadius: number;
  private _flight: Flight | null;
  private _poseFlight: PoseFlight | null;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement, options: CameraRigOptions = {}) {
    const { onFlightStart, onFlightEnd, outermostOrbitRadius = 0 } = options;
    this.camera = camera;
    this.onFlightStart = onFlightStart ?? (() => {});
    this.onFlightEnd = onFlightEnd ?? (() => {});

    // Sized off a top-down view of the outermost orbit (the geometric worst
    // case — any other viewing angle needs less distance to show the same
    // extent), so scrolling all the way out fits every body regardless of
    // how the camera happens to be oriented.
    if (outermostOrbitRadius > 0) {
      const verticalFovRad = THREE.MathUtils.degToRad(camera.fov);
      const fitDistance = outermostOrbitRadius / Math.tan(verticalFovRad / 2);
      this._overviewMaxDistance = fitDistance * OVERVIEW_MAX_MARGIN;
    } else {
      this._overviewMaxDistance = OVERVIEW_MAX_DISTANCE;
    }
    this._outermostOrbitRadius = outermostOrbitRadius;

    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan = true; // right-drag (or shift-drag) to move around the map
    this.controls.minDistance = OVERVIEW_MIN_DISTANCE;
    this.controls.maxDistance = this._overviewMaxDistance;
    this.controls.target.set(...HOME_TARGET);
    this.controls.update();

    this.state = 'idle';
    this.focusedBody = null;

    this._flight = null;
    this._poseFlight = null;
  }

  focusOn(body: CelestialBody): void {
    if (this.state === 'focused' && this.focusedBody === body) return;
    if (this.focusedBody && this.focusedBody !== body) {
      this.focusedBody.setPaused(false);
    }

    const planetPos = body.getWorldPosition(new THREE.Vector3());
    const offsetDistance = Math.max(body.sceneRadius * FOCUS_OFFSET_MULTIPLIER, MIN_FOCUS_OFFSET);

    // Approach from the current camera->planet direction so the swing
    // feels continuous instead of snapping to a canonical angle.
    const approachDir = this.camera.position.clone().sub(planetPos);
    if (approachDir.lengthSq() < 1e-6) approachDir.set(0, 0.3, 1);
    approachDir.normalize();
    approachDir.y += 0.25; // blend slightly upward, avoids a flat edge-on view
    approachDir.normalize();

    const endPos = planetPos.clone().addScaledVector(approachDir, offsetDistance);

    body.setPaused(true);
    this.focusedBody = body;
    this.onFlightStart(body);

    this._startFlight(endPos, planetPos, () => {
      this.state = 'focused';
      this.controls.minDistance = body.sceneRadius * FOCUS_MIN_DISTANCE_FACTOR;
      // Small moons' radius-based max would sit inside the focus offset.
      this.controls.maxDistance = Math.max(body.sceneRadius * FOCUS_MAX_DISTANCE_FACTOR, offsetDistance);
      this.onFlightEnd(body);
    });
  }

  // Like focusOn, for a point that isn't a body (the ship on the map).
  focusOnPoint(point: THREE.Vector3, offsetDistance: number, onComplete: () => void = () => {}): void {
    if (this.focusedBody) this.focusedBody.setPaused(false);
    this.focusedBody = null;
    this.onFlightStart(null);

    const approachDir = this.camera.position.clone().sub(point);
    if (approachDir.lengthSq() < 1e-6) approachDir.set(0, 0.3, 1);
    approachDir.normalize();
    approachDir.y += 0.25;
    approachDir.normalize();
    const endPos = point.clone().addScaledVector(approachDir, offsetDistance);

    this._startFlight(endPos, point.clone(), () => {
      this.state = 'focused';
      this.controls.minDistance = offsetDistance * 0.1;
      this.controls.maxDistance = offsetDistance * 10;
      onComplete();
    });
  }

  returnToOverview(): void {
    if (this.state === 'idle') return;

    if (this.focusedBody) {
      this.focusedBody.setPaused(false);
    }
    this.focusedBody = null;
    this.onFlightStart(null);

    const endPos = this._overviewPosition();
    const endTarget = new THREE.Vector3(...HOME_TARGET);

    this._startFlight(endPos, endTarget, () => {
      this.state = 'idle';
      this.controls.minDistance = OVERVIEW_MIN_DISTANCE;
      this.controls.maxDistance = this._overviewMaxDistance;
      this.onFlightEnd(null);
    });
  }

  // Map entry: from wherever the camera is (the flight camera) to the
  // overview, then hand control to OrbitControls.
  enterOverview(onComplete: () => void = () => {}): void {
    const endPos = this._overviewPosition();
    const endTarget = new THREE.Vector3(...HOME_TARGET);
    const endQuat = lookAtQuaternion(endPos, endTarget);

    this._startPoseFlight(endPos, endQuat, () => {
      this.state = 'idle';
      this.controls.target.copy(endTarget);
      this.controls.minDistance = OVERVIEW_MIN_DISTANCE;
      this.controls.maxDistance = this._overviewMaxDistance;
      this.controls.enabled = true;
      this.controls.update();
      onComplete();
    });
  }

  // Map exit: release any focused body, then fly to an arbitrary pose (the
  // flight camera's) and leave OrbitControls disabled.
  leaveTo(endPos: THREE.Vector3, endQuat: THREE.Quaternion, onComplete: () => void = () => {}): void {
    if (this.focusedBody) this.focusedBody.setPaused(false);
    this.focusedBody = null;
    this._flight = null;
    this._startPoseFlight(endPos.clone(), endQuat.clone(), () => {
      this.state = 'idle';
      onComplete();
    });
  }

  // Same viewing angle as the original home pose, pulled back to the
  // closest distance at which the whole outermost orbit fits on screen.
  // Measured by projecting points on that orbit (perspective makes the near
  // side loom larger than any closed-form estimate), and recomputed per call
  // since the window may have been resized.
  private _overviewPosition(): THREE.Vector3 {
    const home = new THREE.Vector3(...HOME_CAMERA_POSITION);
    const radius = this._outermostOrbitRadius;
    if (radius <= 0) return home;

    const probe = this.camera.clone();
    const target = new THREE.Vector3(...HOME_TARGET);
    const point = new THREE.Vector3();
    const fits = (distance: number): boolean => {
      probe.position.copy(home).setLength(distance);
      probe.lookAt(target);
      probe.updateMatrixWorld();
      for (let i = 0; i < OVERVIEW_FIT_SAMPLES; i++) {
        const angle = (i / OVERVIEW_FIT_SAMPLES) * Math.PI * 2;
        point.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius).project(probe);
        if (Math.abs(point.x) > OVERVIEW_FIT_NDC || Math.abs(point.y) > OVERVIEW_FIT_NDC || point.z > 1) return false;
      }
      return true;
    };

    let near = radius * 0.1;
    let far = this._overviewMaxDistance;
    for (let i = 0; i < 24; i++) {
      const mid = (near + far) / 2;
      if (fits(mid)) far = mid;
      else near = mid;
    }
    return home.setLength(far);
  }

  private _startPoseFlight(endPos: THREE.Vector3, endQuat: THREE.Quaternion, onComplete: () => void): void {
    const startPos = this.camera.position.clone();
    const duration = clamp(
      MIN_FLY_DURATION + startPos.distanceTo(endPos) * DURATION_DISTANCE_FACTOR,
      MIN_FLY_DURATION,
      MAX_FLY_DURATION
    );
    this.controls.enabled = false;
    this.state = 'transition';
    this._poseFlight = {
      startPos,
      startQuat: this.camera.quaternion.clone(),
      endPos,
      endQuat,
      elapsed: 0,
      duration,
      onComplete,
    };
  }

  private _startFlight(endPos: THREE.Vector3, endTarget: THREE.Vector3, onComplete: () => void): void {
    // Deliberately reads the camera's *current* position/target as the
    // start — if a flight is already in progress, that's wherever the
    // in-progress tween has reached, so re-targeting mid-flight (e.g. the
    // user clicks a different planet) reroutes cleanly with no queuing.
    const startPos = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const distance = startPos.distanceTo(endPos);
    const duration = clamp(
      MIN_FLY_DURATION + distance * DURATION_DISTANCE_FACTOR,
      MIN_FLY_DURATION,
      MAX_FLY_DURATION
    );

    this.controls.enabled = false;
    this.state = 'flying';
    this._flight = { startPos, startTarget, endPos, endTarget, elapsed: 0, duration, onComplete };
  }

  update(dt: number): void {
    if (this.state === 'transition') {
      const flight = this._poseFlight!; // invariant: always set together with state = 'transition'
      flight.elapsed += dt;
      const t = clamp(flight.elapsed / flight.duration, 0, 1);
      const eased = easeInOutCubic(t);
      this.camera.position.lerpVectors(flight.startPos, flight.endPos, eased);
      this.camera.quaternion.slerpQuaternions(flight.startQuat, flight.endQuat, eased);
      if (t >= 1) {
        this._poseFlight = null;
        flight.onComplete();
      }
    } else if (this.state === 'flying') {
      const flight = this._flight!; // invariant: always set together with state = 'flying'
      flight.elapsed += dt;
      const t = clamp(flight.elapsed / flight.duration, 0, 1);
      const eased = easeInOutCubic(t);

      this.camera.position.lerpVectors(flight.startPos, flight.endPos, eased);
      this.controls.target.lerpVectors(flight.startTarget, flight.endTarget, eased);
      this.controls.update(); // keep OrbitControls' internal state in sync while disabled

      if (t >= 1) {
        const { onComplete } = flight;
        this._flight = null;
        this.controls.enabled = true;
        onComplete();
      }
    } else {
      this.controls.update();
    }
  }
}

function lookAtQuaternion(eye: THREE.Vector3, target: THREE.Vector3): THREE.Quaternion {
  const matrix = new THREE.Matrix4().lookAt(eye, target, new THREE.Vector3(0, 1, 0));
  return new THREE.Quaternion().setFromRotationMatrix(matrix);
}
