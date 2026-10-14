import * as THREE from 'three';
import {
  planetSceneRadius,
  orbitSceneRadius,
  orbitAngularSpeed,
  axialAngularSpeed,
  moonSceneRadius,
  moonOrbitSceneRadius,
  moonAngularSpeed,
  SUN_SCENE_RADIUS,
} from './scaleConfig.ts';
import type { CelestialBodyData, BodyType, FactsData } from './types.ts';

const sharedSphereGeometry = new THREE.SphereGeometry(1, 48, 32);

// Generic "body orbiting a parent" wrapper. A pivot Group sits at the
// parent's position; the anchor is offset from it by the orbit radius, and
// revolving the pivot revolves the anchor. The anchor counter-rotates so it
// stays non-rotating in its parent's frame: the mesh spins inside it, and
// moons hang their own pivots off it without inheriting that spin.
export default class CelestialBody {
  id: string;
  name: string;
  type: BodyType;
  facts: FactsData;
  data: CelestialBodyData;
  parent: CelestialBody | null;

  sceneRadius: number;
  orbitRadius: number;
  clearanceRadius: number; // outermost extent: the surface, or the ring's outer edge
  angularSpeed: number;
  rotationSpeed: number;
  soiRadius: number;
  scanRadius: number;

  revolutionAngle: number;
  paused: boolean;

  pivot: THREE.Group;
  anchor: THREE.Group;
  mesh: THREE.Mesh;

  constructor(
    data: CelestialBodyData,
    material: THREE.Material,
    ringMesh: THREE.Mesh | null,
    parent: CelestialBody | null = null
  ) {
    this.id = data.id;
    this.name = data.name;
    this.type = data.type;
    this.facts = data.facts;
    this.data = data;
    this.parent = parent;

    if (data.type === 'moon' && parent && data.orbit) {
      this.sceneRadius = moonSceneRadius(data.radiusKm);
      this.orbitRadius = moonOrbitSceneRadius(
        data.orbit.distanceMillionKm * 1e6,
        parent.data.radiusKm,
        parent.sceneRadius,
        parent.clearanceRadius
      );
      this.angularSpeed = moonAngularSpeed(data.orbit.periodDays, this.orbitRadius);
      // Tidally locked: the anchor doesn't rotate, so spinning the mesh at
      // the orbital rate keeps the same face toward the parent.
      this.rotationSpeed = this.angularSpeed;
    } else {
      this.sceneRadius = data.id === 'sun' ? SUN_SCENE_RADIUS : planetSceneRadius(data.radiusKm);
      this.orbitRadius = data.orbit ? orbitSceneRadius(data.orbit.distanceMillionKm) : 0;
      this.angularSpeed = data.orbit ? orbitAngularSpeed(data.orbit.periodDays) : 0;
      this.rotationSpeed = axialAngularSpeed(data.rotation.periodHours);
    }
    if (data.orbit?.retrograde) {
      this.angularSpeed = -this.angularSpeed;
      this.rotationSpeed = -this.rotationSpeed;
    }
    this.clearanceRadius = data.ring ? planetSceneRadius(data.ring.outerRadiusKm) : this.sceneRadius;
    // Assigned by createBodies once every body exists (zones depend on siblings).
    this.soiRadius = Infinity;
    this.scanRadius = 0;

    // Stagger starting positions so bodies don't all line up on load.
    this.revolutionAngle = Math.random() * Math.PI * 2;
    this.paused = false;

    this.pivot = new THREE.Group();
    this.pivot.rotation.y = this.revolutionAngle;

    this.anchor = new THREE.Group();
    this.anchor.position.x = this.orbitRadius;
    this.anchor.rotation.y = -this.revolutionAngle;
    this.pivot.add(this.anchor);

    this.mesh = new THREE.Mesh(sharedSphereGeometry, material);
    this.mesh.scale.setScalar(this.sceneRadius);
    this.mesh.rotation.z = THREE.MathUtils.degToRad(data.rotation.axialTiltDeg);
    this.mesh.userData.bodyId = this.id;
    this.anchor.add(this.mesh);

    if (ringMesh) {
      this.anchor.add(ringMesh);
    }
  }

  update(dt: number): void {
    if (!this.paused && this.data.orbit) {
      this.revolutionAngle += this.angularSpeed * dt;
      this.pivot.rotation.y = this.revolutionAngle;
      this.anchor.rotation.y = -this.revolutionAngle;
    }
    this.mesh.rotation.y += this.rotationSpeed * dt;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  // Hover affordance: a small scale bump on the mesh only (the ring, if
  // any, is a sibling in the anchor so it doesn't pulse with it).
  setHighlighted(active: boolean): void {
    this.mesh.scale.setScalar(this.sceneRadius * (active ? 1.08 : 1));
  }

  getWorldPosition(target: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 {
    return this.anchor.getWorldPosition(target);
  }
}

// Star, then each planet followed by its moons (data order lists moons last).
export function orderByParent(bodies: CelestialBody[]): CelestialBody[] {
  const ordered: CelestialBody[] = [];
  for (const body of bodies) {
    if (body.type === 'moon') continue;
    ordered.push(body, ...bodies.filter((b) => b.type === 'moon' && b.parent === body));
  }
  return ordered;
}
