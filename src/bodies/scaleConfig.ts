// Real astronomical values span too many orders of magnitude to render
// directly and stay navigable, so size/distance/speed are each compressed
// independently. Tuning knobs live here so adjustments are a single pass.

export const EARTH_RADIUS_KM = 6371;

// --- Size ---
export const PLANET_UNIT = 1; // scene units per Earth radius
export const MIN_PLANET_RADIUS = 0.3; // keeps Mercury clickable
export const SUN_SCENE_RADIUS = 5.5; // deliberately dampened, not true ~109x Earth

export function planetSceneRadius(radiusKm: number): number {
  return Math.max((radiusKm / EARTH_RADIUS_KM) * PLANET_UNIT, MIN_PLANET_RADIUS);
}

// --- Orbit distance ---
// Square-root compression preserves relative ordering/spacing while
// collapsing the ~78x real span between Mercury and Neptune down to a
// reachable ~6-7x span in scene units.
const ORBIT_BASE_OFFSET = 9;
const ORBIT_FACTOR = 4.4;

export function orbitSceneRadius(distanceMillionKm: number): number {
  return ORBIT_BASE_OFFSET + Math.sqrt(distanceMillionKm) * ORBIT_FACTOR;
}

// --- Orbital speed ---
// Same sqrt compression, inverted: angular speed ~ 1 / sqrt(period).
const ORBIT_SPEED_FACTOR = 1.6;

export function orbitAngularSpeed(periodDays: number): number {
  return ORBIT_SPEED_FACTOR / Math.sqrt(periodDays);
}

// Orbits (and spins) run at this rate while flying. At full rate every
// planet out-runs the ship's thrusters between frames of reference; half
// rate keeps the system visibly alive while making it chaseable.
export const ORBIT_TIME_SCALE = 0.5;

// --- Axial rotation ---
const ROTATION_SPEED_FACTOR = 4;
const MIN_ROTATION_SPEED = 0.05; // Venus's real 243-day rotation would otherwise look static

export function axialAngularSpeed(periodHours: number): number {
  return Math.max(ROTATION_SPEED_FACTOR / periodHours, MIN_ROTATION_SPEED);
}

// --- Moons ---
// Moons get their own compression: the planet formulas above are tuned for
// heliocentric distances and would either bury moons inside their parent or
// fling them across the system.
export const MIN_MOON_RADIUS = 0.1; // lower floor than planets so Phobos/Deimos read as small
const MOON_BASE_OFFSET = 1; // clearance between the parent's surface (or ring) and the innermost moon
const MOON_ORBIT_FACTOR = 1.2;
const MOON_SPEED_FACTOR = 1.2;
const MOON_MAX_LINEAR_SPEED = 1; // scene units/s; keeps every moon catchable on thrusters

export function moonSceneRadius(radiusKm: number): number {
  return Math.max((radiusKm / EARTH_RADIUS_KM) * PLANET_UNIT, MIN_MOON_RADIUS);
}

// Sqrt of the distance in parent radii, scaled up for big parents so the
// Galilean moons get room for their own spheres of influence.
// parentClearance = the parent's outermost extent (surface, or ring edge).
export function moonOrbitSceneRadius(
  distanceKm: number,
  parentRadiusKm: number,
  parentSceneRadius: number,
  parentClearance: number
): number {
  const systemScale = MOON_ORBIT_FACTOR * Math.max(1, Math.sqrt(parentSceneRadius));
  return parentClearance + MOON_BASE_OFFSET + systemScale * Math.sqrt(distanceKm / parentRadiusKm);
}

// Derived from a capped *linear* speed rather than angular speed directly:
// outer moons sit far from their parent, so equal angular speeds would make
// them unreachably fast.
export function moonAngularSpeed(periodDays: number, orbitSceneRadius: number): number {
  const linearSpeed = Math.min(MOON_SPEED_FACTOR / Math.sqrt(periodDays), MOON_MAX_LINEAR_SPEED);
  return linearSpeed / orbitSceneRadius;
}

// --- Zones: sphere of influence (SOI) + scan range ---
export const MOON_SOI_MARGIN = 1.5; // SOI = radius + this, unless siblings are closer
export const MOON_SOI_GAP_SHARE = 0.45; // max share of the gap to the nearest sibling orbit
export const MOON_SCAN_MARGIN = 1;
export const PLANET_SOI_MULTIPLIER = 4;
export const PLANET_SOI_MARGIN = 1; // headroom beyond the cruise drop-out distance
export const PLANET_SOI_MOON_MARGIN = 1; // headroom beyond the outermost moon's SOI
export const PLANET_SCAN_MULTIPLIER = 2;
export const PLANET_SCAN_MARGIN = 1.5;

// --- Flight ---
// Speeds in scene units/s. The HUD shows km using KM_PER_SCENE_UNIT.
export const KM_PER_SCENE_UNIT = EARTH_RADIUS_KM;
export const THRUSTER_MAX_SPEED = 2;
export const THRUSTER_ACCELERATION = 2;
export const CRUISE_MAX_SPEED = 30;
export const CRUISE_ACCELERATION = 6;
export const CRUISE_DISTANCE_FACTOR = 0.4; // cruise cap = this * distance to nearest surface
// Cruise disengages once its cap drops below thruster speed, i.e. at this
// distance from any surface. Planet SOIs reach past it, so arriving in
// cruise always lands the ship in the planet's frame (captured), never
// chasing a fast-orbiting planet on thrusters.
export const CRUISE_DROPOUT_DISTANCE = THRUSTER_MAX_SPEED / CRUISE_DISTANCE_FACTOR;
export const ABSOLUTE_MAX_SPEED = CRUISE_MAX_SPEED; // assist-off safety cap
export const MAX_ANGULAR_SPEED = 1.6; // rad/s
export const ANGULAR_RESPONSE = 8; // higher = snappier rotation
export const SHIP_COLLISION_RADIUS = 0.06;
// Cruise nav lock: with the nose within this cone of the target, cruise
// steers itself onto an intercept course, leading the target's orbit.
export const NAV_LOCK_CONE_DEG = 20;
export const PHYSICS_STEP = 1 / 60;
// Parking orbit: a ship sitting still near a planet or moon slowly circles
// it (about the ecliptic normal), like a satellite.
export const PARKING_ORBIT_SPEED = 0.35; // scene units/s along the orbit
export const PARKING_ORBIT_MAX_ANGULAR_SPEED = 0.15; // rad/s, so tight orbits round tiny moons don't whirl
export const PARKING_IDLE_SPEED = 0.01; // below this relative speed the ship counts as stopped

// --- Scanning ---
export const SCAN_DURATION = 3; // seconds
export const SCAN_CONE_DEG = 25;
export const TARGET_PICK_CONE_DEG = 10;

// --- Camera home / focus framing ---
export const HOME_CAMERA_POSITION: [number, number, number] = [0, 55, 95];
export const HOME_TARGET: [number, number, number] = [0, 0, 0];
export const FOCUS_OFFSET_MULTIPLIER = 5; // focused camera distance = planetRadius * this
export const MIN_FOCUS_OFFSET = 3;
