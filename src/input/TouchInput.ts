import { emptyControls, type ControlAction, type ControlState, type FlightInput } from './ControlState.ts';

const STICK_RADIUS_PX = 56; // left thumb: full thrust at this offset
const STEER_RADIUS_PX = 70; // right thumb: full turn rate at this offset
const DEAD_ZONE = 0.12; // fraction of the radius ignored around the touch-down point

export function isTouchPrimary(): boolean {
  return window.matchMedia('(pointer: coarse)').matches;
}

// Offset of a drag from its touch-down point → a stick vector: each axis in
// [-1, 1], length clamped to 1, small offsets ignored, and y flipped so that
// dragging up is positive.
export function stickVector(dx: number, dy: number, radius: number, deadZone = DEAD_ZONE): { x: number; y: number } {
  const length = Math.hypot(dx, dy) / radius;
  if (length <= deadZone) return { x: 0, y: 0 };
  const scale = Math.min(length, 1) / length / radius;
  return { x: dx * scale, y: -dy * scale };
}

interface Drag {
  pointerId: number;
  originX: number;
  originY: number;
  x: number;
  y: number;
}

export interface TouchInputOptions {
  onLockChange?: (locked: boolean) => void;
}

// On-screen touch controls: a floating joystick on the left half (thrust
// forward/back, strafe sideways), a steering stick on the right half, and
// action buttons. "Locking" just engages these controls, so unlike pointer
// lock it never needs the browser's permission.
export default class TouchInput implements FlightInput {
  locked = false;
  private _stickBase: HTMLElement;
  private _stickKnob: HTMLElement;
  private _steerBase: HTMLElement;
  private _steerKnob: HTMLElement;
  private _stick: Drag | null = null;
  private _steer: Drag | null = null;
  private _actions: ControlAction[] = [];
  private _onLockChange: (locked: boolean) => void;

  constructor(root: HTMLElement, { onLockChange }: TouchInputOptions = {}) {
    this._stickBase = root.querySelector('.touch-stick')!;
    this._stickKnob = root.querySelector('.touch-stick .touch-knob')!;
    this._steerBase = root.querySelector('.touch-steer')!;
    this._steerKnob = root.querySelector('.touch-steer .touch-knob')!;
    this._onLockChange = onLockChange ?? (() => {});

    root.addEventListener('pointerdown', this._onPointerDown);
    root.addEventListener('pointermove', this._onPointerMove);
    root.addEventListener('pointerup', this._onPointerUp);
    root.addEventListener('pointercancel', this._onPointerUp);

    for (const button of root.querySelectorAll<HTMLElement>('[data-action]')) {
      button.addEventListener('pointerdown', (event) => {
        event.stopPropagation(); // a button press must never start a stick
        event.preventDefault();
      });
      // Act on click, not touch-down: if the action swapped the screen on
      // touch-down (e.g. Pause), the lift-off would click whatever appeared
      // underneath (e.g. the pause screen, resuming at once).
      button.addEventListener('click', () => {
        this._actions.push(button.dataset.action as ControlAction);
      });
    }
  }

  requestLock(): void {
    if (this.locked) return;
    this.locked = true;
    this._onLockChange(true);
  }

  exitLock(): void {
    if (!this.locked) return;
    this.locked = false;
    this._release('stick');
    this._release('steer');
    this._onLockChange(false);
  }

  read(): ControlState {
    const controls = emptyControls();
    if (this._stick) {
      const v = stickVector(this._stick.x - this._stick.originX, this._stick.y - this._stick.originY, STICK_RADIUS_PX);
      controls.thrust.x = v.x;
      controls.thrust.z = v.y;
    }
    if (this._steer) {
      const v = stickVector(this._steer.x - this._steer.originX, this._steer.y - this._steer.originY, STEER_RADIUS_PX);
      controls.rotate.x = v.y; // drag up → nose up
      controls.rotate.y = -v.x; // drag right → nose right
    }
    return controls;
  }

  consumeActions(): ControlAction[] {
    const actions = this._actions;
    this._actions = [];
    return actions;
  }

  private _onPointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    const which = event.clientX < window.innerWidth / 2 ? 'stick' : 'steer';
    if (this[`_${which}`]) return; // that thumb is already down
    const drag = { pointerId: event.pointerId, originX: event.clientX, originY: event.clientY, x: event.clientX, y: event.clientY };
    this[`_${which}`] = drag;
    const base = which === 'stick' ? this._stickBase : this._steerBase;
    base.style.transform = `translate(${drag.originX}px, ${drag.originY}px)`;
    base.classList.add('active');
    this._moveKnob(which);
  };

  private _onPointerMove = (event: PointerEvent): void => {
    for (const which of ['stick', 'steer'] as const) {
      const drag = this[`_${which}`];
      if (drag?.pointerId === event.pointerId) {
        drag.x = event.clientX;
        drag.y = event.clientY;
        this._moveKnob(which);
      }
    }
  };

  private _onPointerUp = (event: PointerEvent): void => {
    if (this._stick?.pointerId === event.pointerId) this._release('stick');
    if (this._steer?.pointerId === event.pointerId) this._release('steer');
  };

  private _moveKnob(which: 'stick' | 'steer'): void {
    const drag = this[`_${which}`]!;
    const radius = which === 'stick' ? STICK_RADIUS_PX : STEER_RADIUS_PX;
    const dx = drag.x - drag.originX;
    const dy = drag.y - drag.originY;
    const scale = Math.min(1, radius / Math.max(Math.hypot(dx, dy), 1e-6));
    const knob = which === 'stick' ? this._stickKnob : this._steerKnob;
    knob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
  }

  private _release(which: 'stick' | 'steer'): void {
    this[`_${which}`] = null;
    (which === 'stick' ? this._stickBase : this._steerBase).classList.remove('active');
  }
}
