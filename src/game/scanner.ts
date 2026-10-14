import * as THREE from 'three';
import { SCAN_DURATION, SCAN_CONE_DEG, TARGET_PICK_CONE_DEG } from '../bodies/scaleConfig.ts';
import type { BodySnapshot } from '../ship/referenceFrame.ts';

export interface ScanState {
  targetId: string | null;
  progress: number; // 0..1
}

export interface ScanStatus {
  inRange: boolean;
  aligned: boolean;
  scanning: boolean; // every condition holds this step
  completed: boolean; // true only on the step progress reaches 1
}

export interface ScanShip {
  position: THREE.Vector3;
  forward: THREE.Vector3; // unit
  cruise: boolean;
}

const SCAN_COS = Math.cos(THREE.MathUtils.degToRad(SCAN_CONE_DEG));
const PICK_COS = Math.cos(THREE.MathUtils.degToRad(TARGET_PICK_CONE_DEG));

export function initialScanState(): ScanState {
  return { targetId: null, progress: 0 };
}

// A new target starts from scratch; re-selecting the same one keeps progress.
export function setTarget(state: ScanState, targetId: string | null): ScanState {
  if (targetId === state.targetId) return state;
  return { targetId, progress: 0 };
}

// Progress fills while every condition holds and pauses (not resets) when
// one breaks, so drifting briefly off-target isn't punished.
export function stepScan(
  state: ScanState,
  ship: ScanShip,
  target: BodySnapshot | null,
  dt: number
): { state: ScanState; status: ScanStatus } {
  const idle = { inRange: false, aligned: false, scanning: false, completed: false };
  if (!target || target.id !== state.targetId) return { state, status: idle };

  const toTarget = target.position.clone().sub(ship.position);
  const distance = toTarget.length();
  const inRange = distance <= target.scanRadius;
  const aligned = distance > 0 && toTarget.divideScalar(distance).dot(ship.forward) >= SCAN_COS;
  const scanning = inRange && aligned && !ship.cruise && state.progress < 1;
  if (!scanning) return { state, status: { inRange, aligned, scanning: false, completed: false } };

  const progress = Math.min(state.progress + dt / SCAN_DURATION, 1);
  return {
    state: { ...state, progress },
    status: { inRange, aligned, scanning: true, completed: progress >= 1 },
  };
}

// The body closest to the crosshair within a small cone, else the nearest
// body by surface distance, so T always selects something.
export function pickTarget(position: THREE.Vector3, forward: THREE.Vector3, bodies: BodySnapshot[]): string | null {
  let bestAligned: BodySnapshot | null = null;
  let bestCos = PICK_COS;
  let nearest: BodySnapshot | null = null;
  let nearestDistance = Infinity;
  const toBody = new THREE.Vector3();

  for (const body of bodies) {
    toBody.copy(body.position).sub(position);
    const distance = toBody.length();
    const surfaceDistance = distance - body.radius;
    if (surfaceDistance < nearestDistance) {
      nearestDistance = surfaceDistance;
      nearest = body;
    }
    if (distance === 0) continue;
    const cos = toBody.divideScalar(distance).dot(forward);
    if (cos >= bestCos) {
      bestCos = cos;
      bestAligned = body;
    }
  }
  return (bestAligned ?? nearest)?.id ?? null;
}
