import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { easeInOutCubic, clamp } from './easing.js';
import { HOME_CAMERA_POSITION, HOME_TARGET, FOCUS_OFFSET_MULTIPLIER, MIN_FOCUS_OFFSET } from '../bodies/scaleConfig.js';

const OVERVIEW_MIN_DISTANCE = 12;
const OVERVIEW_MAX_DISTANCE = 260; // fallback only, used if constructed without outermostOrbitRadius
const OVERVIEW_MAX_MARGIN = 1.25; // headroom so the outermost orbit isn't touching the frame edge
const FOCUS_MIN_DISTANCE_FACTOR = 1.6;
const FOCUS_MAX_DISTANCE_FACTOR = 14;

const MIN_FLY_DURATION = 0.8;
const MAX_FLY_DURATION = 1.8;
const DURATION_DISTANCE_FACTOR = 0.008;

// Owns the free-orbit OrbitControls plus the click-to-focus fly-to state
// machine. This is the module the app's "fluidity" goal hinges on: the
// fly-to is a fixed-duration eased tween over elapsed time (frame-rate
// independent, no snapping), and OrbitControls stays synced via update()
// even while disabled so re-enabling it never causes a jump.
export default class CameraRig {
  constructor(camera, domElement, { onFlightStart, onFlightEnd, outermostOrbitRadius = 0 } = {}) {
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

    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan = false;
    this.controls.minDistance = OVERVIEW_MIN_DISTANCE;
    this.controls.maxDistance = this._overviewMaxDistance;
    this.controls.target.set(...HOME_TARGET);
    this.controls.update();

    this.state = 'idle'; // 'idle' | 'flying' | 'focused'
    this.focusedBody = null;

    this._flight = null;
  }

  focusOn(body) {
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
      this.controls.maxDistance = body.sceneRadius * FOCUS_MAX_DISTANCE_FACTOR;
      this.onFlightEnd(body);
    });
  }

  returnToOverview() {
    if (this.state === 'idle') return;

    if (this.focusedBody) {
      this.focusedBody.setPaused(false);
    }
    this.focusedBody = null;
    this.onFlightStart(null);

    const endPos = new THREE.Vector3(...HOME_CAMERA_POSITION);
    const endTarget = new THREE.Vector3(...HOME_TARGET);

    this._startFlight(endPos, endTarget, () => {
      this.state = 'idle';
      this.controls.minDistance = OVERVIEW_MIN_DISTANCE;
      this.controls.maxDistance = this._overviewMaxDistance;
      this.onFlightEnd(null);
    });
  }

  _startFlight(endPos, endTarget, onComplete) {
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

  update(dt) {
    if (this.state === 'flying') {
      const flight = this._flight;
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
