import * as THREE from 'three';
import {
  THRUSTER_MAX_SPEED,
  THRUSTER_ACCELERATION,
  CRUISE_MAX_SPEED,
  CRUISE_ACCELERATION,
  CRUISE_DISTANCE_FACTOR,
  ABSOLUTE_MAX_SPEED,
  MAX_ANGULAR_SPEED,
  ANGULAR_RESPONSE,
  SHIP_COLLISION_RADIUS,
  NAV_LOCK_CONE_DEG,
  PARKING_ORBIT_SPEED,
  PARKING_ORBIT_MAX_ANGULAR_SPEED,
  PARKING_IDLE_SPEED,
} from '../bodies/scaleConfig.ts';
import type { ControlState } from '../input/ControlState.ts';
import type { BodySnapshot } from './referenceFrame.ts';

export interface ShipState {
  position: THREE.Vector3; // world
  velocity: THREE.Vector3; // relative to the reference body, world axes
  orientation: THREE.Quaternion; // ship forward is local -Z
  angularVelocity: THREE.Vector3; // local axes, rad/s
  flightAssist: boolean;
  cruise: boolean;
  referenceBodyId: string;
}

const AXES = ['x', 'y', 'z'] as const;
const NAV_LOCK_COS = Math.cos(THREE.MathUtils.degToRad(NAV_LOCK_CONE_DEG));
const ORBIT_AXIS = new THREE.Vector3(0, 1, 0);

export function cloneShipState(state: ShipState): ShipState {
  return {
    ...state,
    position: state.position.clone(),
    velocity: state.velocity.clone(),
    orientation: state.orientation.clone(),
    angularVelocity: state.angularVelocity.clone(),
  };
}

export function shipForward(orientation: THREE.Quaternion, target = new THREE.Vector3()): THREE.Vector3 {
  return target.set(0, 0, -1).applyQuaternion(orientation);
}

export function nearestSurfaceDistance(position: THREE.Vector3, bodies: BodySnapshot[]): number {
  let nearest = Infinity;
  for (const body of bodies) {
    nearest = Math.min(nearest, position.distanceTo(body.position) - body.radius);
  }
  return nearest;
}

export function nearestBody(position: THREE.Vector3, bodies: BodySnapshot[]): BodySnapshot | null {
  let nearest: BodySnapshot | null = null;
  let nearestDistance = Infinity;
  for (const body of bodies) {
    const distance = position.distanceTo(body.position) - body.radius;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = body;
    }
  }
  return nearest;
}

export function cruiseCap(position: THREE.Vector3, bodies: BodySnapshot[]): number {
  return THREE.MathUtils.clamp(CRUISE_DISTANCE_FACTOR * nearestSurfaceDistance(position, bodies), 0, CRUISE_MAX_SPEED);
}

export function canEngageCruise(position: THREE.Vector3, bodies: BodySnapshot[]): boolean {
  return cruiseCap(position, bodies) >= THRUSTER_MAX_SPEED;
}

// Cruise is locked onto the target while it's engaged and the nose points
// roughly at the target.
export function isNavLocked(state: ShipState, bodies: BodySnapshot[], targetId: string | null): boolean {
  if (!state.cruise || !targetId) return false;
  const target = bodies.find((b) => b.id === targetId);
  if (!target) return false;
  const toTarget = target.position.clone().sub(state.position);
  const distance = toTarget.length();
  return distance > 0 && toTarget.divideScalar(distance).dot(shipForward(state.orientation)) >= NAV_LOCK_COS;
}

// Sitting still (no thrust, stopped, not cruising) inside a planet's or
// moon's SOI. The root star is excluded: its SOI is all of deep space.
export function isParked(state: ShipState, controls: ControlState, bodies: BodySnapshot[]): boolean {
  if (state.cruise || state.velocity.length() > PARKING_IDLE_SPEED) return false;
  const { x, y, z } = controls.thrust;
  if (x !== 0 || y !== 0 || z !== 0) return false;
  const reference = bodies.find((b) => b.id === state.referenceBodyId);
  return reference !== undefined && Number.isFinite(reference.soiRadius);
}

// One fixed physics step. Returns a new state; the input is not mutated.
export function stepFlight(
  state: ShipState,
  controls: ControlState,
  bodies: BodySnapshot[],
  dt: number,
  targetId: string | null = null
): ShipState {
  const next = cloneShipState(state);

  stepRotation(next, controls, dt);
  if (next.cruise) {
    stepCruise(next, bodies, dt, isNavLocked(next, bodies, targetId) ? targetId : null);
  } else {
    stepThrusters(next, controls, dt);
  }

  if (isParked(next, controls, bodies)) stepParkingOrbit(next, bodies, dt);

  const start = next.position.clone();
  next.position.addScaledVector(next.velocity, dt);
  resolveCollisions(next, start, bodies);
  return next;
}

export function disengageCruise(state: ShipState): void {
  state.cruise = false;
  state.velocity.clampLength(0, THRUSTER_MAX_SPEED);
}

// Rate control: the input commands an angular velocity, which the ship
// eases toward (always damped, regardless of flight assist).
function stepRotation(state: ShipState, controls: ControlState, dt: number): void {
  const target = new THREE.Vector3(controls.rotate.x, controls.rotate.y, controls.rotate.z).multiplyScalar(MAX_ANGULAR_SPEED);
  state.angularVelocity.lerp(target, 1 - Math.exp(-ANGULAR_RESPONSE * dt));

  const w = state.angularVelocity;
  const delta = new THREE.Quaternion().setFromEuler(new THREE.Euler(w.x * dt, w.y * dt, w.z * dt));
  state.orientation.multiply(delta).normalize();
}

function stepThrusters(state: ShipState, controls: ControlState, dt: number): void {
  const inverse = state.orientation.clone().invert();
  const local = state.velocity.clone().applyQuaternion(inverse);
  const thrust = new THREE.Vector3(controls.thrust.x, controls.thrust.y, -controls.thrust.z);
  const maxDelta = THRUSTER_ACCELERATION * dt;

  for (const axis of AXES) {
    if (thrust[axis] !== 0) {
      local[axis] += thrust[axis] * maxDelta;
    } else if (state.flightAssist) {
      // Counter-thrust on idle axes: drift dies out, bounded by thruster power.
      local[axis] -= Math.sign(local[axis]) * Math.min(Math.abs(local[axis]), maxDelta);
    }
  }

  const speed = local.length();
  if (state.flightAssist) {
    // Soft cap: braking from above the limit (e.g. after turning assist
    // back on at speed) happens at thruster power instead of instantly.
    if (speed > THRUSTER_MAX_SPEED) local.setLength(Math.max(THRUSTER_MAX_SPEED, speed - maxDelta));
  } else if (speed > ABSOLUTE_MAX_SPEED) {
    local.setLength(ABSOLUTE_MAX_SPEED);
  }

  state.velocity.copy(local.applyQuaternion(state.orientation));
}

// Cruise isn't Newtonian: velocity follows the nose, ramps up at cruise
// acceleration, and is capped by distance to the nearest surface, so the
// drive brakes on its own while approaching anything. Nav-locked, it
// instead matches the target's motion and closes in on top of it, so even
// a planet orbiting faster than the capped closing speed can't run away.
function stepCruise(state: ShipState, bodies: BodySnapshot[], dt: number, lockedTargetId: string | null): void {
  const cap = cruiseCap(state.position, bodies);
  if (cap < THRUSTER_MAX_SPEED) {
    disengageCruise(state);
    return;
  }
  const target = lockedTargetId ? bodies.find((b) => b.id === lockedTargetId) : undefined;
  const reference = bodies.find((b) => b.id === state.referenceBodyId);
  if (target && reference) {
    const targetVelocity = target.velocity.clone().sub(reference.velocity);
    const closing = Math.min(state.velocity.distanceTo(targetVelocity) + CRUISE_ACCELERATION * dt, cap);
    const toTarget = target.position.clone().sub(state.position).normalize();
    state.velocity.copy(targetVelocity).addScaledVector(toTarget, closing);
  } else {
    const speed = Math.min(state.velocity.length() + CRUISE_ACCELERATION * dt, cap);
    shipForward(state.orientation, state.velocity).multiplyScalar(speed);
  }
}

// Rigid rotation of position *and* orientation about the reference body's
// center, so the body stays put in the pilot's view while the ship circles.
function stepParkingOrbit(state: ShipState, bodies: BodySnapshot[], dt: number): void {
  const reference = bodies.find((b) => b.id === state.referenceBodyId)!;
  const offset = state.position.clone().sub(reference.position);
  const distance = offset.length();
  if (distance === 0) return;
  const angularSpeed = Math.min(PARKING_ORBIT_SPEED / distance, PARKING_ORBIT_MAX_ANGULAR_SPEED);
  const rotation = new THREE.Quaternion().setFromAxisAngle(ORBIT_AXIS, angularSpeed * dt);
  state.position.copy(reference.position).add(offset.applyQuaternion(rotation));
  state.orientation.premultiply(rotation).normalize();
}

// Swept sphere test per body so a fast step can't tunnel through a small
// moon, followed by stopping at the surface and removing only the inward
// part of the velocity (the ship slides along instead of sticking).
function resolveCollisions(state: ShipState, start: THREE.Vector3, bodies: BodySnapshot[]): void {
  const reference = bodies.find((b) => b.id === state.referenceBodyId);
  const referenceVelocity = reference ? reference.velocity : new THREE.Vector3();

  let hitBody: BodySnapshot | null = null;
  let hitT = Infinity;
  for (const body of bodies) {
    const t = sweepSphere(start, state.position, body.position, body.radius + SHIP_COLLISION_RADIUS);
    if (t !== null && t < hitT) {
      hitT = t;
      hitBody = body;
    }
  }
  if (!hitBody) return;

  const contact = start.clone().lerp(state.position, hitT);
  const normal = contact.sub(hitBody.position);
  if (normal.lengthSq() < 1e-12) normal.set(0, 1, 0);
  normal.normalize();
  state.position.copy(hitBody.position).addScaledVector(normal, hitBody.radius + SHIP_COLLISION_RADIUS);

  const relative = state.velocity.clone().add(referenceVelocity).sub(hitBody.velocity);
  const inward = relative.dot(normal);
  if (inward < 0) relative.addScaledVector(normal, -inward);
  state.velocity.copy(relative.add(hitBody.velocity).sub(referenceVelocity));
  state.cruise = false;
}

// Fraction t in [0, 1] along start→end where the segment first touches the
// sphere; 0 if it starts inside; null if it never touches.
export function sweepSphere(
  start: THREE.Vector3,
  end: THREE.Vector3,
  center: THREE.Vector3,
  radius: number
): number | null {
  const d = end.clone().sub(start);
  const f = start.clone().sub(center);
  const c = f.lengthSq() - radius * radius;
  if (c <= 0) return 0;
  const a = d.lengthSq();
  if (a === 0) return null;
  const b = 2 * f.dot(d);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}
