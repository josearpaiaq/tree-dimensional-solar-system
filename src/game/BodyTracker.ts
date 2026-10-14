import * as THREE from 'three';
import type CelestialBody from '../bodies/CelestialBody.ts';
import type { BodySnapshot } from '../ship/referenceFrame.ts';

// Samples every body's world position once per physics step and derives
// its world velocity from the displacement, producing the plain snapshots
// the flight/scan logic runs on.
export default class BodyTracker {
  snapshots: BodySnapshot[];
  byId: Map<string, BodySnapshot>;
  private _bodies: CelestialBody[];
  private _previous = new THREE.Vector3();

  constructor(bodies: CelestialBody[]) {
    this._bodies = bodies;
    this.snapshots = bodies.map((body) => ({
      id: body.id,
      position: body.getWorldPosition(new THREE.Vector3()),
      velocity: new THREE.Vector3(),
      radius: body.sceneRadius,
      soiRadius: body.soiRadius,
      scanRadius: body.scanRadius,
    }));
    this.byId = new Map(this.snapshots.map((s) => [s.id, s]));
  }

  update(dt: number): void {
    this._bodies.forEach((body, i) => {
      const snapshot = this.snapshots[i];
      this._previous.copy(snapshot.position);
      body.getWorldPosition(snapshot.position);
      snapshot.velocity.subVectors(snapshot.position, this._previous).divideScalar(dt);
    });
  }
}
