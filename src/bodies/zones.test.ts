import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bodies as bodyData } from './data/bodies.ts';
import CelestialBody from './CelestialBody.ts';
import { computeZones } from './zones.ts';
import { CRUISE_DROPOUT_DISTANCE } from './scaleConfig.ts';

// Mirrors createBodies' layout without textures, so the scale invariants are
// checked against the real data.
function layout(): CelestialBody[] {
  const byId = new Map<string, CelestialBody>();
  const material = new THREE.MeshBasicMaterial();
  for (const data of bodyData) {
    const parent = data.parentId ? (byId.get(data.parentId) ?? null) : null;
    byId.set(data.id, new CelestialBody(data, material, null, parent));
  }
  const all = [...byId.values()];
  const zones = computeZones(
    all.map((b) => ({ id: b.id, type: b.type, parentId: b.data.parentId, sceneRadius: b.sceneRadius, orbitRadius: b.orbitRadius }))
  );
  for (const b of all) Object.assign(b, zones.get(b.id));
  return all;
}

const all = layout();
const moons = all.filter((b) => b.type === 'moon');

describe('body layout invariants', () => {
  it('has the sun, 8 planets and 13 moons', () => {
    expect(all).toHaveLength(22);
    expect(moons).toHaveLength(13);
    expect(moons.every((m) => m.parent !== null)).toBe(true);
  });

  it('every moon orbits clear of its parent surface and ring', () => {
    for (const moon of moons) {
      expect(moon.orbitRadius - moon.sceneRadius, moon.id).toBeGreaterThan(moon.parent!.clearanceRadius);
    }
  });

  it("a moon's SOI stays inside its parent's SOI along its whole orbit", () => {
    for (const moon of moons) {
      expect(moon.orbitRadius + moon.soiRadius, moon.id).toBeLessThanOrEqual(moon.parent!.soiRadius);
    }
  });

  it("sibling moons' SOIs never overlap", () => {
    for (const a of moons) {
      for (const b of moons) {
        if (a === b || a.parent !== b.parent) continue;
        expect(Math.abs(a.orbitRadius - b.orbitRadius), `${a.id}/${b.id}`).toBeGreaterThan(a.soiRadius + b.soiRadius);
      }
    }
  });

  it('every body has sceneRadius < scanRadius <= soiRadius', () => {
    for (const body of all) {
      expect(body.scanRadius, body.id).toBeGreaterThan(body.sceneRadius);
      expect(body.scanRadius, body.id).toBeLessThanOrEqual(body.soiRadius);
    }
  });

  it('cruise drops out inside every planet SOI, so arrival always captures the ship', () => {
    for (const planet of all.filter((b) => b.type === 'planet')) {
      expect(planet.soiRadius, planet.id).toBeGreaterThan(planet.sceneRadius + CRUISE_DROPOUT_DISTANCE);
    }
  });

  it('Triton orbits retrograde', () => {
    expect(all.find((b) => b.id === 'triton')!.angularSpeed).toBeLessThan(0);
  });
});
