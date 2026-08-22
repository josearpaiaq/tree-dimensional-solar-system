// Real astronomical values span too many orders of magnitude to render
// directly and stay navigable, so size/distance/speed are each compressed
// independently. Tuning knobs live here so adjustments are a single pass.

export const EARTH_RADIUS_KM = 6371;

// --- Size ---
export const PLANET_UNIT = 1; // scene units per Earth radius
export const MIN_PLANET_RADIUS = 0.3; // keeps Mercury clickable
export const SUN_SCENE_RADIUS = 5.5; // deliberately dampened, not true ~109x Earth

export function planetSceneRadius(radiusKm) {
  return Math.max((radiusKm / EARTH_RADIUS_KM) * PLANET_UNIT, MIN_PLANET_RADIUS);
}

// --- Orbit distance ---
// Square-root compression preserves relative ordering/spacing while
// collapsing the ~78x real span between Mercury and Neptune down to a
// reachable ~6-7x span in scene units.
const ORBIT_BASE_OFFSET = 9;
const ORBIT_FACTOR = 4.4;

export function orbitSceneRadius(distanceMillionKm) {
  return ORBIT_BASE_OFFSET + Math.sqrt(distanceMillionKm) * ORBIT_FACTOR;
}

// --- Orbital speed ---
// Same sqrt compression, inverted: angular speed ~ 1 / sqrt(period).
const ORBIT_SPEED_FACTOR = 1.6;

export function orbitAngularSpeed(periodDays) {
  return ORBIT_SPEED_FACTOR / Math.sqrt(periodDays);
}

// --- Axial rotation ---
const ROTATION_SPEED_FACTOR = 4;
const MIN_ROTATION_SPEED = 0.05; // Venus's real 243-day rotation would otherwise look static

export function axialAngularSpeed(periodHours) {
  return Math.max(ROTATION_SPEED_FACTOR / periodHours, MIN_ROTATION_SPEED);
}

// --- Camera home / focus framing ---
export const HOME_CAMERA_POSITION = [0, 55, 95];
export const HOME_TARGET = [0, 0, 0];
export const FOCUS_OFFSET_MULTIPLIER = 5; // focused camera distance = planetRadius * this
export const MIN_FOCUS_OFFSET = 3;
