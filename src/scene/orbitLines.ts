import * as THREE from 'three';
import type CelestialBody from '../bodies/CelestialBody.ts';

const SEGMENTS = 128;
const PLANET_ORBIT_COLOR = 0x5b6b82;
const MOON_ORBIT_COLOR = 0x3f4a5a;

// One circle per orbiting body, added to the same parent frame as the
// body's pivot (the root for planets, the parent's non-spinning anchor for
// moons), so moon orbits travel along with their planet.
export function createOrbitLines(bodies: CelestialBody[]): THREE.LineLoop[] {
  const unitCircle = new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: SEGMENTS }, (_, i) => {
      const angle = (i / SEGMENTS) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    })
  );
  const planetMaterial = new THREE.LineBasicMaterial({ color: PLANET_ORBIT_COLOR, transparent: true, opacity: 0.45 });
  const moonMaterial = new THREE.LineBasicMaterial({ color: MOON_ORBIT_COLOR, transparent: true, opacity: 0.45 });

  const lines: THREE.LineLoop[] = [];
  for (const body of bodies) {
    if (!body.data.orbit || !body.pivot.parent) continue;
    const line = new THREE.LineLoop(unitCircle, body.type === 'moon' ? moonMaterial : planetMaterial);
    line.scale.setScalar(body.orbitRadius);
    body.pivot.parent.add(line);
    lines.push(line);
  }
  return lines;
}
