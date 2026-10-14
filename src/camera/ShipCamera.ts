import * as THREE from 'three';
import type Ship from '../ship/Ship.ts';
import type { ShipState } from '../ship/flightModel.ts';

export type CameraView = 'chase' | 'cockpit';

const CHASE_OFFSET = new THREE.Vector3(0, 0.06, 0.32); // ship-local: above and behind
const COCKPIT_OFFSET = new THREE.Vector3(0, 0.012, -0.03);
const CHASE_ROTATION_RESPONSE = 7; // higher = camera follows the ship's turns more tightly

// Flight camera. Only the chase camera's *orientation* lags the ship (a
// smoothed quaternion); its position is derived from that orientation
// around the ship's current position, so it never trails behind at cruise
// speed.
export default class ShipCamera {
  camera: THREE.PerspectiveCamera;
  ship: Ship;
  view: CameraView;
  private _smoothed: THREE.Quaternion;

  constructor(camera: THREE.PerspectiveCamera, ship: Ship) {
    this.camera = camera;
    this.ship = ship;
    this.view = 'chase';
    this._smoothed = ship.state.orientation.clone();
  }

  toggleView(): void {
    this.view = this.view === 'chase' ? 'cockpit' : 'chase';
    this.ship.group.visible = this.view === 'chase';
  }

  snap(): void {
    this._smoothed.copy(this.ship.state.orientation);
  }

  update(dt: number): void {
    const state = this.ship.state;
    if (this.view === 'chase') {
      this._smoothed.slerp(state.orientation, 1 - Math.exp(-CHASE_ROTATION_RESPONSE * dt));
    } else {
      this._smoothed.copy(state.orientation);
    }
    this.computePose(state, this.camera.position, this.camera.quaternion, this._smoothed);
  }

  // The pose this camera would take for a given ship state; used directly
  // each frame and as the destination when flying back from the map.
  computePose(
    state: ShipState,
    outPosition: THREE.Vector3,
    outQuaternion: THREE.Quaternion,
    orientation: THREE.Quaternion = state.orientation
  ): void {
    const offset = this.view === 'chase' ? CHASE_OFFSET : COCKPIT_OFFSET;
    outPosition.copy(offset).applyQuaternion(orientation).add(state.position);
    outQuaternion.copy(orientation);
  }
}
