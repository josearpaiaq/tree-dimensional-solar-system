import * as THREE from 'three';
import type { ShipState } from './flightModel.ts';

const SHIP_SCALE = 0.12; // model is built ~1 unit long, then scaled to scene size
const ENGINE_COLOR = new THREE.Color(0.6, 1.4, 2.4); // > 1 at full throttle so it crosses the bloom threshold
const ENGINE_IDLE_LEVEL = 0.15; // below the bloom threshold: a dim pilot light, not a flare

// Visual shell around ShipState: a small fighter built from primitives
// (nose along -Z) plus an engine glow that tracks thrust. All flight logic
// lives in flightModel; this only mirrors the state into the scene.
export default class Ship {
  state: ShipState;
  group: THREE.Group;
  private _engineGlow: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;

  constructor(state: ShipState) {
    this.state = state;
    this.group = new THREE.Group();

    const hull = new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.2, roughness: 0.45 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x34404f, metalness: 0.3, roughness: 0.6 });
    const canopy = new THREE.MeshStandardMaterial({ color: 0x1b3b5a, metalness: 0.1, roughness: 0.15 });

    const model = new THREE.Group();
    model.scale.setScalar(SHIP_SCALE);

    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.6, 12), hull);
    fuselage.rotation.x = Math.PI / 2;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 12), hull);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -0.5;
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), canopy);
    cockpit.scale.set(1, 0.7, 1.8);
    cockpit.position.set(0, 0.08, -0.18);
    const wings = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.025, 0.22), trim);
    wings.position.set(0, -0.02, 0.1);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.16), trim);
    fin.position.set(0, 0.12, 0.24);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.08, 12, 1, true), trim);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.z = 0.33;

    this._engineGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 12, 8),
      new THREE.MeshBasicMaterial({ color: ENGINE_COLOR })
    );
    this._engineGlow.position.z = 0.36;

    model.add(fuselage, nose, cockpit, wings, fin, nozzle, this._engineGlow);
    this.group.add(model);


    this.sync(0);
  }

  // throttle in [0, 1]: brightens and stretches the engine glow.
  sync(throttle: number): void {
    this.group.position.copy(this.state.position);
    this.group.quaternion.copy(this.state.orientation);
    const level = ENGINE_IDLE_LEVEL + (1 - ENGINE_IDLE_LEVEL) * throttle;
    this._engineGlow.material.color.copy(ENGINE_COLOR).multiplyScalar(level);
    this._engineGlow.scale.set(0.7 + 0.3 * throttle, 0.7 + 0.3 * throttle, 0.7 + throttle * 2.8);
    this._engineGlow.position.z = 0.36 + throttle * 0.08;
  }
}
