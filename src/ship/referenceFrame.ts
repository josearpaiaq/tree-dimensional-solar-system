import type * as THREE from 'three';

// A per-physics-step view of a body: everything the flight/scan logic needs,
// with no Three.js scene objects attached (so the logic stays testable).
export interface BodySnapshot {
  id: string;
  position: THREE.Vector3; // world
  velocity: THREE.Vector3; // world, displacement / step
  radius: number;
  soiRadius: number;
  scanRadius: number;
}

// The body with the smallest SOI containing the point, so a moon wins over
// its planet. The root star's SOI is infinite, so there's always an answer.
export function pickReferenceBody(position: THREE.Vector3, bodies: BodySnapshot[]): BodySnapshot {
  let best: BodySnapshot | null = null;
  for (const body of bodies) {
    if (position.distanceTo(body.position) > body.soiRadius) continue;
    if (!best || body.soiRadius < best.soiRadius) best = body;
  }
  if (!best) throw new Error('No body contains the ship: the root star must have an infinite SOI');
  return best;
}

export interface FrameResult {
  position: THREE.Vector3;
  referenceBodyId: string;
}

// Carries the ship along with its reference body for one step, then
// re-picks the reference body. Velocity is stored relative to the reference
// body and is deliberately left untouched on a switch: entering an SOI
// "captures" the ship (it keeps its speed relative to the new body), which
// is what lets a slow ship park next to a fast-orbiting planet.
export function resolveFrame(
  position: THREE.Vector3,
  referenceBodyId: string,
  bodies: BodySnapshot[],
  dt: number
): FrameResult {
  const reference = bodies.find((b) => b.id === referenceBodyId);
  const carried = position.clone();
  if (reference) carried.addScaledVector(reference.velocity, dt);
  return { position: carried, referenceBodyId: pickReferenceBody(carried, bodies).id };
}
