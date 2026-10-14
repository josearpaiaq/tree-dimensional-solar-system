import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { pickReferenceBody, resolveFrame } from './referenceFrame.ts';
import { body } from './testBodies.ts';

const sun = body('sun', [0, 0, 0], 5, Infinity);
const planet = body('planet', [100, 0, 0], 1, 15, [0, 0, 5]);
const moon = body('moon', [110, 0, 0], 0.3, 1.5, [0, 0, 5.5]);
const bodies = [sun, planet, moon];

describe('pickReferenceBody', () => {
  it('falls back to the star outside every planet SOI', () => {
    expect(pickReferenceBody(new THREE.Vector3(50, 0, 0), bodies).id).toBe('sun');
  });

  it('picks the planet inside its SOI', () => {
    expect(pickReferenceBody(new THREE.Vector3(104, 0, 0), bodies).id).toBe('planet');
  });

  it('smallest containing SOI wins: a moon beats its planet', () => {
    expect(pickReferenceBody(new THREE.Vector3(110.5, 0, 0), bodies).id).toBe('moon');
  });
});

describe('resolveFrame', () => {
  it('carries the ship by its reference body displacement', () => {
    const result = resolveFrame(new THREE.Vector3(104, 0, 0), 'planet', bodies, 0.5);
    expect(result.position.toArray()).toEqual([104, 0, 2.5]);
    expect(result.referenceBodyId).toBe('planet');
  });

  it('does not move a ship in the stationary star frame', () => {
    const result = resolveFrame(new THREE.Vector3(50, 0, 0), 'sun', bodies, 1);
    expect(result.position.toArray()).toEqual([50, 0, 0]);
  });

  it('switches reference body when the ship crosses into a smaller SOI', () => {
    const result = resolveFrame(new THREE.Vector3(109, 0, -0.1), 'planet', bodies, 0.1);
    expect(result.referenceBodyId).toBe('moon');
  });
});
