import * as THREE from 'three';
import type { BodySnapshot } from './referenceFrame.ts';

// Test fixture helper shared by the ship/game unit tests.
export function body(id: string, position: [number, number, number], radius: number, soiRadius: number, velocity: [number, number, number] = [0, 0, 0], scanRadius = radius * 2): BodySnapshot {
  return {
    id,
    position: new THREE.Vector3(...position),
    velocity: new THREE.Vector3(...velocity),
    radius,
    soiRadius,
    scanRadius,
  };
}
