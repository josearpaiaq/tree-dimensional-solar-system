import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { stepFlight, cruiseCap, canEngageCruise, sweepSphere, shipForward, isNavLocked, isParked, type ShipState } from './flightModel.ts';
import { emptyControls, type ControlState } from '../input/ControlState.ts';
import {
  THRUSTER_MAX_SPEED,
  CRUISE_MAX_SPEED,
  CRUISE_DISTANCE_FACTOR,
  SHIP_COLLISION_RADIUS,
  PHYSICS_STEP,
} from '../bodies/scaleConfig.ts';
import { body } from './testBodies.ts';

const sun = body('sun', [0, 0, 0], 5, Infinity);
const farBodies = [sun];

function ship(overrides: Partial<ShipState> = {}): ShipState {
  return {
    position: new THREE.Vector3(1000, 0, 0),
    velocity: new THREE.Vector3(),
    orientation: new THREE.Quaternion(), // forward = -Z
    angularVelocity: new THREE.Vector3(),
    flightAssist: true,
    cruise: false,
    referenceBodyId: 'sun',
    ...overrides,
  };
}

function controls(thrust: Partial<ControlState['thrust']> = {}): ControlState {
  const c = emptyControls();
  Object.assign(c.thrust, thrust);
  return c;
}

function run(state: ShipState, c: ControlState, seconds: number, bodies = farBodies): ShipState {
  let s = state;
  for (let t = 0; t < seconds; t += PHYSICS_STEP) s = stepFlight(s, c, bodies, PHYSICS_STEP);
  return s;
}

describe('thrusters', () => {
  it('forward thrust accelerates along the nose (-Z)', () => {
    const s = run(ship(), controls({ z: 1 }), 0.5);
    expect(s.velocity.z).toBeLessThan(0);
    expect(Math.abs(s.velocity.x)).toBeLessThan(1e-9);
  });

  it('does not mutate the input state', () => {
    const before = ship();
    stepFlight(before, controls({ z: 1 }), farBodies, PHYSICS_STEP);
    expect(before.velocity.length()).toBe(0);
  });

  it('flight assist damps drift to zero when input stops', () => {
    const s = run(ship({ velocity: new THREE.Vector3(1.5, 0, 0) }), controls(), 2);
    expect(s.velocity.length()).toBeLessThan(1e-9);
  });

  it('flight assist caps speed at thruster max', () => {
    const s = run(ship(), controls({ z: 1 }), 5);
    expect(s.velocity.length()).toBeCloseTo(THRUSTER_MAX_SPEED, 5);
  });

  it('with assist off, velocity persists (Newtonian drift)', () => {
    const s = run(ship({ flightAssist: false, velocity: new THREE.Vector3(1.5, 0, 0) }), controls(), 2);
    expect(s.velocity.x).toBeCloseTo(1.5, 9);
  });

  it('with assist off, thrust can exceed the assist cap', () => {
    const s = run(ship({ flightAssist: false }), controls({ z: 1 }), 5);
    expect(s.velocity.length()).toBeGreaterThan(THRUSTER_MAX_SPEED * 2);
  });
});

describe('cruise drive', () => {
  it('caps speed by distance to the nearest surface', () => {
    expect(cruiseCap(new THREE.Vector3(15, 0, 0), farBodies)).toBeCloseTo(10 * CRUISE_DISTANCE_FACTOR);
    expect(cruiseCap(new THREE.Vector3(10_000, 0, 0), farBodies)).toBe(CRUISE_MAX_SPEED);
  });

  it('cannot engage close to a surface', () => {
    expect(canEngageCruise(new THREE.Vector3(6, 0, 0), farBodies)).toBe(false);
    expect(canEngageCruise(new THREE.Vector3(1000, 0, 0), farBodies)).toBe(true);
  });

  it('accelerates along the nose up to the cap', () => {
    const s = run(ship({ cruise: true }), controls(), 10);
    expect(s.cruise).toBe(true);
    expect(s.velocity.length()).toBeCloseTo(CRUISE_MAX_SPEED, 5);
    expect(s.velocity.clone().normalize().dot(shipForward(s.orientation))).toBeCloseTo(1);
  });

  it('auto-disengages on approach and clamps to thruster speed', () => {
    // Nose pointed at the sun (from +X toward origin: forward -Z rotated to -X).
    const orientation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    expect(shipForward(orientation).x).toBeCloseTo(-1);
    const s = run(ship({ cruise: true, position: new THREE.Vector3(200, 0, 0), orientation }), controls(), 30);
    expect(s.cruise).toBe(false);
    expect(s.velocity.length()).toBeLessThanOrEqual(THRUSTER_MAX_SPEED + 1e-9);
    expect(s.position.length()).toBeGreaterThan(5); // never entered the sun
  });
});

describe('collisions', () => {
  it('sweepSphere finds the first contact and ignores misses', () => {
    const center = new THREE.Vector3(0, 0, 0);
    expect(sweepSphere(new THREE.Vector3(-10, 0, 0), new THREE.Vector3(10, 0, 0), center, 1)).toBeCloseTo(9 / 20);
    expect(sweepSphere(new THREE.Vector3(-10, 5, 0), new THREE.Vector3(10, 5, 0), center, 1)).toBeNull();
    expect(sweepSphere(new THREE.Vector3(0.5, 0, 0), new THREE.Vector3(10, 0, 0), center, 1)).toBe(0);
  });

  it('stops at the surface without tunneling, even at max speed through a tiny moon', () => {
    const moon = body('moon', [0, 0, -10], 0.1, 1);
    const start = ship({
      position: new THREE.Vector3(0, 0, -9.5),
      velocity: new THREE.Vector3(0, 0, -CRUISE_MAX_SPEED),
      flightAssist: false,
    });
    const s = stepFlight(start, controls(), [sun, moon], PHYSICS_STEP);
    expect(s.position.z).toBeCloseTo(-10 + 0.1 + SHIP_COLLISION_RADIUS);
    expect(s.velocity.z).toBeCloseTo(0); // inward component removed
  });

  it('keeps tangential velocity on contact (slides instead of sticking)', () => {
    const moon = body('moon', [0, 0, -10], 0.1, 1);
    const start = ship({
      position: new THREE.Vector3(0, 0, -9.8),
      velocity: new THREE.Vector3(1, 0, -10),
      flightAssist: false,
    });
    const s = stepFlight(start, controls(), [sun, moon], PHYSICS_STEP);
    const normal = s.position.clone().sub(moon.position).normalize();
    expect(s.velocity.dot(normal)).toBeGreaterThanOrEqual(-1e-9); // no inward component
    expect(s.velocity.length()).toBeGreaterThan(0.5); // tangential motion survives
  });
});

describe('cruise nav lock', () => {
  // Far from the sun: a planet crossing the ship's path at 4 u/s, 80 units ahead (-Z).
  const origin = new THREE.Vector3(1000, 0, 0);
  const movingPlanet = () => body('planet', [1000, 0, -80], 1, 8, [4, 0, 0]);

  function cruiseAt(planet: ReturnType<typeof body>, targetId: string | null) {
    const bodies = [sun, planet];
    let s = ship({ cruise: true, position: origin.clone() });
    let closest = Infinity;
    for (let t = 0; t < 20; t += PHYSICS_STEP) {
      // Move the planet like the body tracker would.
      planet.position.addScaledVector(planet.velocity, PHYSICS_STEP);
      s = stepFlight(s, controls(), bodies, PHYSICS_STEP, targetId);
      closest = Math.min(closest, s.position.distanceTo(planet.position));
      if (!s.cruise) break;
    }
    return { state: s, closest };
  }

  it('locks only while cruising with the nose near the target', () => {
    const planet = movingPlanet();
    expect(isNavLocked(ship({ cruise: true, position: origin.clone() }), [sun, planet], 'planet')).toBe(true);
    expect(isNavLocked(ship({ cruise: false, position: origin.clone() }), [sun, planet], 'planet')).toBe(false);
    const sideways = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    expect(isNavLocked(ship({ cruise: true, position: origin.clone(), orientation: sideways }), [sun, planet], 'planet')).toBe(false);
  });

  it('intercepts a moving target that plain cruise would miss', () => {
    const unlocked = cruiseAt(movingPlanet(), null);
    const locked = cruiseAt(movingPlanet(), 'planet');
    // Drop-out happens within the cruise drop-out distance of the surface, inside the planet SOI.
    expect(locked.state.cruise).toBe(false);
    expect(locked.closest).toBeLessThan(8);
    expect(unlocked.closest).toBeGreaterThan(locked.closest);
  });

  it('matches a target faster than the closing speed instead of trailing it', () => {
    // 6 u/s sideways: faster than the cruise cap near the surface.
    const fast = body('planet', [1000, 0, -80], 1, 8, [6, 0, 0]);
    expect(cruiseAt(fast, 'planet').state.cruise).toBe(false);
  });
});

describe('parking orbit', () => {
  const planet = body('planet', [1000, 0, 0], 1, 10);
  const bodies = [sun, planet];
  const parked = () =>
    ship({ position: new THREE.Vector3(1000, 0, 4), referenceBodyId: 'planet' });

  it('applies only when stopped, unthrusted, not cruising, and near a planet (not the star)', () => {
    expect(isParked(parked(), controls(), bodies)).toBe(true);
    expect(isParked(parked(), controls({ z: 1 }), bodies)).toBe(false);
    expect(isParked({ ...parked(), cruise: true }, controls(), bodies)).toBe(false);
    expect(isParked({ ...parked(), velocity: new THREE.Vector3(0.5, 0, 0) }, controls(), bodies)).toBe(false);
    expect(isParked({ ...parked(), referenceBodyId: 'sun' }, controls(), bodies)).toBe(false);
  });

  it('circles the body at constant distance, keeping the body fixed in the pilot view', () => {
    const start = parked();
    const localBefore = planet.position.clone().sub(start.position).applyQuaternion(start.orientation.clone().invert());
    const s = run(start, controls(), 5, bodies);
    const localAfter = planet.position.clone().sub(s.position).applyQuaternion(s.orientation.clone().invert());
    expect(s.position.distanceTo(planet.position)).toBeCloseTo(4, 6);
    expect(s.position.distanceTo(start.position)).toBeGreaterThan(1);
    expect(localAfter.distanceTo(localBefore)).toBeLessThan(1e-6);
  });
});
