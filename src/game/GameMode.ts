import type * as THREE from 'three';
import type CameraRig from '../camera/CameraRig.ts';
import type KeyboardMouseInput from '../input/KeyboardMouseInput.ts';

export type Mode = 'paused' | 'flight' | 'map' | 'codex';

export interface GameModeOptions {
  input: KeyboardMouseInput;
  cameraRig: CameraRig;
  // Where the flight camera wants to be, as the destination when leaving the map.
  getFlightCameraPose: (outPosition: THREE.Vector3, outQuaternion: THREE.Quaternion) => void;
  onChange: (mode: Mode) => void;
}

// Owns which mode the game is in and every transition between them. Flight
// requires pointer lock, so losing it always lands in 'paused', and every
// exit path ends in either 'flight' or 'paused' (click to resume): no
// sequence of inputs can leave the player stuck.
export default class GameMode {
  mode: Mode = 'paused';
  busy = false; // a camera transition is running; mode toggles wait for it

  private _options: GameModeOptions;

  constructor(options: GameModeOptions) {
    this._options = options;
  }

  // Click on the pause overlay (a user gesture, as pointer lock requires).
  resume(): void {
    const { input } = this._options;
    if (input.locked) this.handleLockChange(true);
    else input.requestLock();
  }

  handleLockChange(locked: boolean): void {
    if (locked && (this.mode === 'paused' || this.mode === 'codex') && !this.busy) {
      this._set('flight');
    } else if (!locked && this.mode === 'flight') {
      this._set('paused');
    }
  }

  toggleMap(): void {
    if (this.busy) return;
    if (this.mode === 'map') {
      this._leaveMap();
    } else {
      this._options.input.exitLock();
      this._set('map');
      this.busy = true;
      this._options.cameraRig.enterOverview(() => {
        this.busy = false;
      });
    }
  }

  toggleCodex(): void {
    if (this.busy || this.mode === 'map') return;
    if (this.mode === 'codex') {
      this._set('paused');
      this.resume();
    } else {
      this._options.input.exitLock();
      this._set('codex');
    }
  }

  back(): void {
    if (this.mode === 'map') this.toggleMap();
    else if (this.mode === 'codex') this.toggleCodex();
  }

  private _leaveMap(): void {
    const { input, cameraRig, getFlightCameraPose } = this._options;
    input.requestLock(); // now, while the key/click still counts as a gesture
    this.busy = true;
    const position = cameraRig.camera.position.clone();
    const quaternion = cameraRig.camera.quaternion.clone();
    getFlightCameraPose(position, quaternion);
    cameraRig.leaveTo(position, quaternion, () => {
      this.busy = false;
      this._set(input.locked ? 'flight' : 'paused');
    });
  }

  private _set(mode: Mode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this._options.onChange(mode);
  }
}
