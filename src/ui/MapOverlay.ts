import * as THREE from 'three';

// Map-only screen overlay: a pulsing "You" marker on the ship (whose model
// is sub-pixel at map scale) and a dashed route line to the current target.
export default class MapOverlay {
  private _marker = document.getElementById('map-ship-marker')!;
  private _routeLine = document.getElementById('map-route-line')!;
  private _ship = new THREE.Vector2();
  private _target = new THREE.Vector2();

  update(camera: THREE.PerspectiveCamera, shipPosition: THREE.Vector3, targetPosition: THREE.Vector3 | null): void {
    camera.updateMatrixWorld();
    const shipVisible = toScreen(camera, shipPosition, this._ship);
    this._marker.classList.toggle('hidden', !shipVisible);
    if (shipVisible) this._marker.style.transform = `translate(${this._ship.x}px, ${this._ship.y}px)`;

    const routeVisible = shipVisible && targetPosition !== null && toScreen(camera, targetPosition, this._target);
    this._routeLine.classList.toggle('hidden', !routeVisible);
    if (routeVisible) {
      this._routeLine.setAttribute('x1', String(this._ship.x));
      this._routeLine.setAttribute('y1', String(this._ship.y));
      this._routeLine.setAttribute('x2', String(this._target.x));
      this._routeLine.setAttribute('y2', String(this._target.y));
    }
  }
}

// Screen position in CSS pixels; false when the point is behind the camera.
function toScreen(camera: THREE.PerspectiveCamera, point: THREE.Vector3, out: THREE.Vector2): boolean {
  const view = point.clone().applyMatrix4(camera.matrixWorldInverse);
  if (view.z >= 0) return false;
  const ndc = point.clone().project(camera);
  out.set(((ndc.x + 1) / 2) * window.innerWidth, ((1 - ndc.y) / 2) * window.innerHeight);
  return true;
}
