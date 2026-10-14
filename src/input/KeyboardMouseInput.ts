import { clamp } from '../camera/easing.ts';
import { MAX_ANGULAR_SPEED } from '../bodies/scaleConfig.ts';
import { emptyControls, type ControlAction, type ControlState } from './ControlState.ts';

const MOUSE_SENSITIVITY = 0.0025; // radians of commanded turn per pixel

// Continuous axes: [code, axis group, axis, direction].
const AXIS_BINDINGS: [string, 'thrust' | 'rotate', 'x' | 'y' | 'z', number][] = [
  ['KeyW', 'thrust', 'z', 1],
  ['KeyS', 'thrust', 'z', -1],
  ['KeyD', 'thrust', 'x', 1],
  ['KeyA', 'thrust', 'x', -1],
  ['ArrowUp', 'thrust', 'z', 1],
  ['ArrowDown', 'thrust', 'z', -1],
  ['ArrowRight', 'thrust', 'x', 1],
  ['ArrowLeft', 'thrust', 'x', -1],
  ['KeyR', 'thrust', 'y', 1],
  ['KeyF', 'thrust', 'y', -1],
  ['KeyQ', 'rotate', 'z', 1],
  ['KeyE', 'rotate', 'z', -1],
];

const ACTION_BINDINGS: Record<string, ControlAction> = {
  KeyZ: 'toggleAssist',
  KeyJ: 'toggleCruise',
  KeyT: 'target',
  KeyC: 'toggleCamera',
  KeyM: 'toggleMap',
  Tab: 'toggleCodex',
  KeyO: 'toggleOrbits',
  Escape: 'back',
};

export interface KeyboardMouseInputOptions {
  onLockChange?: (locked: boolean) => void;
}

// Keyboard + pointer-lock mouse → ControlState. Mouse movement is turned
// into an angular *rate* command (pixels this frame / frame time), so the
// flight model's rate control smooths it like a stick input.
export default class KeyboardMouseInput {
  domElement: HTMLElement;
  private _held = new Set<string>();
  private _actions: ControlAction[] = [];
  private _mouseX = 0;
  private _mouseY = 0;
  private _onLockChange: (locked: boolean) => void;

  constructor(domElement: HTMLElement, { onLockChange }: KeyboardMouseInputOptions = {}) {
    this.domElement = domElement;
    this._onLockChange = onLockChange ?? (() => {});

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', (e) => this._held.delete(e.code));
    window.addEventListener('blur', () => this._held.clear());
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('pointerlockchange', () => {
      if (!this.locked) this._held.clear();
      this._onLockChange(this.locked);
    });
    document.addEventListener('pointerlockerror', () => this._onLockChange(false));
  }

  get locked(): boolean {
    return document.pointerLockElement === this.domElement;
  }

  // Must be called from (or shortly after) a user gesture. A refusal (e.g.
  // re-locking too soon after Esc) is fine: the game stays paused and the
  // overlay asks for a click.
  requestLock(): void {
    if (this.locked) return;
    try {
      const result = this.domElement.requestPointerLock() as unknown;
      if (result instanceof Promise) result.catch(() => this._onLockChange(false));
    } catch {
      this._onLockChange(false);
    }
  }

  exitLock(): void {
    if (this.locked) document.exitPointerLock();
  }

  read(dt: number): ControlState {
    const controls = emptyControls();
    for (const [code, group, axis, direction] of AXIS_BINDINGS) {
      if (this._held.has(code)) controls[group][axis] += direction;
    }
    // W + ArrowUp held together must not double the thrust.
    for (const axis of ['x', 'y', 'z'] as const) controls.thrust[axis] = clamp(controls.thrust[axis], -1, 1);

    if (dt > 0) {
      const toCommand = MOUSE_SENSITIVITY / dt / MAX_ANGULAR_SPEED;
      controls.rotate.x = clamp(-this._mouseY * toCommand, -1, 1); // mouse up → nose up
      controls.rotate.y = clamp(-this._mouseX * toCommand, -1, 1); // mouse right → nose right
    }
    this._mouseX = 0;
    this._mouseY = 0;
    return controls;
  }

  consumeActions(): ControlAction[] {
    const actions = this._actions;
    this._actions = [];
    return actions;
  }

  private _onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Tab') event.preventDefault(); // keep focus from leaving the game
    this._held.add(event.code);
    const action = ACTION_BINDINGS[event.code];
    if (action && !event.repeat) this._actions.push(action);
  };

  private _onMouseMove = (event: MouseEvent): void => {
    if (!this.locked) return;
    this._mouseX += event.movementX;
    this._mouseY += event.movementY;
  };
}
