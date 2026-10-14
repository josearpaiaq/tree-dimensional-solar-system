import type * as THREE from 'three';
import type CameraRig from '../camera/CameraRig.ts';
import type { FlightInput } from '../input/ControlState.ts';

export type Mode = 'paused' | 'flight' | 'map' | 'codex';

export interface GameModeOptions {
  input: FlightInput;
  cameraRig: CameraRig;
  // Where the flight camera wants to be, as the destination when leaving the map.
  getFlightCameraPose: (outPosition: THREE.Vector3, outQuaternion: THREE.Quaternion) => void;
  onChange: (mode: Mode) => void;
}

// Owns which mode the game is in and every transition between them. Map,
// Codex and pause each open directly from any other mode (pressing a
// mode's own key again returns to flight). Flight requires pointer lock,
// so losing it always lands in 'paused', and every exit path ends in either
// 'flight' or 'paused' (click to resume): no sequence of inputs can leave
// the player stuck.
export default class GameMode {
  mode: Mode = 'paused';
  busy = false; // a camera transition is running; mode toggles wait for it

  // The camera sits at the map's pose (the map was opened, then Codex or
  // pause layered over it); returning to flight must fly it back first.
  private _cameraAtMap = false;
  private _options: GameModeOptions;

  constructor(options: GameModeOptions) {
    this._options = options;
  }

  // Back to flight from any mode. Pointer lock needs a user gesture, so this
  // runs straight from a click or key press.
  resume(): void {
    if (this.busy) return;
    const { input } = this._options;
    if (this._cameraAtMap) {
      this._set('map'); // the map UI rides along while the camera flies back
      this._flyBackToShip();
    } else if (input.locked) {
      this._set('flight');
    } else {
      this._set('paused');
      input.requestLock();
    }
  }

  handleLockChange(locked: boolean): void {
    if (locked && this.mode === 'paused' && !this.busy && !this._cameraAtMap) {
      this._set('flight');
    } else if (!locked && this.mode === 'flight') {
      this._set('paused');
    }
  }

  toggleMap(): void {
    if (this.busy) return;
    if (this.mode === 'map') {
      this.resume();
      return;
    }
    this._options.input.exitLock();
    this._set('map');
    if (!this._cameraAtMap) {
      this._cameraAtMap = true;
      this.busy = true;
      this._options.cameraRig.enterOverview(() => {
        this.busy = false;
      });
    }
  }

  toggleCodex(): void {
    this._toggleOverlay('codex');
  }

  togglePause(): void {
    this._toggleOverlay('paused');
  }

  private _toggleOverlay(mode: 'codex' | 'paused'): void {
    if (this.busy) return;
    if (this.mode === mode) {
      this.resume();
    } else {
      this._options.input.exitLock();
      this._set(mode);
    }
  }

  private _flyBackToShip(): void {
    const { input, cameraRig, getFlightCameraPose } = this._options;
    input.requestLock(); // now, while the key/click still counts as a gesture
    this.busy = true;
    const position = cameraRig.camera.position.clone();
    const quaternion = cameraRig.camera.quaternion.clone();
    getFlightCameraPose(position, quaternion);
    cameraRig.leaveTo(position, quaternion, () => {
      this.busy = false;
      this._cameraAtMap = false;
      this._set(input.locked ? 'flight' : 'paused');
    });
  }

  private _set(mode: Mode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this._options.onChange(mode);
  }
}
