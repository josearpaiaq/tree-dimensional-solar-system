import * as THREE from 'three';
import {
  planetSceneRadius,
  orbitSceneRadius,
  orbitAngularSpeed,
  axialAngularSpeed,
  SUN_SCENE_RADIUS,
} from './scaleConfig.js';

const sharedSphereGeometry = new THREE.SphereGeometry(1, 48, 32);

// Generic "body orbiting a parent" wrapper. A pivot Group sits at the
// parent's position; the mesh is offset from it by the orbit radius, and
// revolving the pivot revolves the mesh — this is what lets a future moon
// reuse the same class with parentId pointing at a planet instead of the sun.
export default class CelestialBody {
  constructor(data, material, ringMesh) {
    this.id = data.id;
    this.name = data.name;
    this.type = data.type;
    this.facts = data.facts;
    this.data = data;

    this.sceneRadius = data.id === 'sun' ? SUN_SCENE_RADIUS : planetSceneRadius(data.radiusKm);
    this.orbitRadius = data.orbit ? orbitSceneRadius(data.orbit.distanceMillionKm) : 0;
    this.angularSpeed = data.orbit ? orbitAngularSpeed(data.orbit.periodDays) : 0;
    this.rotationSpeed = axialAngularSpeed(data.rotation.periodHours);

    // Stagger starting positions so planets don't all line up on load.
    this.revolutionAngle = Math.random() * Math.PI * 2;
    this.paused = false;

    this.pivot = new THREE.Group();
    this.pivot.rotation.y = this.revolutionAngle;

    this.mesh = new THREE.Mesh(sharedSphereGeometry, material);
    this.mesh.scale.setScalar(this.sceneRadius);
    this.mesh.position.x = this.orbitRadius;
    this.mesh.rotation.z = THREE.MathUtils.degToRad(data.rotation.axialTiltDeg);
    this.mesh.userData.bodyId = this.id;
    this.pivot.add(this.mesh);

    if (ringMesh) {
      ringMesh.position.copy(this.mesh.position);
      this.pivot.add(ringMesh);
    }
  }

  update(dt) {
    if (!this.paused && this.data.orbit) {
      this.revolutionAngle += this.angularSpeed * dt;
      this.pivot.rotation.y = this.revolutionAngle;
    }
    this.mesh.rotation.y += this.rotationSpeed * dt;
  }

  setPaused(paused) {
    this.paused = paused;
  }

  // Hover affordance: a small scale bump on the mesh only (the ring, if
  // any, is a sibling in the pivot so it doesn't pulse with it).
  setHighlighted(active) {
    this.mesh.scale.setScalar(this.sceneRadius * (active ? 1.08 : 1));
  }

  getWorldPosition(target = new THREE.Vector3()) {
    return this.mesh.getWorldPosition(target);
  }
}
