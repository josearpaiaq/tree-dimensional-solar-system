import * as THREE from 'three';

const MIN_BRACKET_PX = 14;
const EDGE_MARGIN_PX = 48;

// Screen-space bracket around the current target, or an arrow pinned to
// the screen edge pointing toward it when it's off-screen or behind.
export default class TargetMarker {
  private _bracket = document.getElementById('target-bracket')!;
  private _arrow = document.getElementById('target-arrow')!;
  private _label = document.getElementById('target-bracket-label')!;
  private _view = new THREE.Vector3();

  update(camera: THREE.PerspectiveCamera, target: { position: THREE.Vector3; radius: number; name: string } | null): void {
    if (!target) {
      this._bracket.classList.add('hidden');
      this._arrow.classList.add('hidden');
      return;
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    // Camera space: -Z is in front of the camera.
    const view = this._view.copy(target.position).applyMatrix4(camera.matrixWorldInverse);
    const halfHeightAtDepth = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const inFront = view.z < 0;
    const ndcX = inFront ? view.x / (-view.z * halfHeightAtDepth * camera.aspect) : 0;
    const ndcY = inFront ? view.y / (-view.z * halfHeightAtDepth) : 0;

    if (inFront && Math.abs(ndcX) <= 1 && Math.abs(ndcY) <= 1) {
      const x = ((ndcX + 1) / 2) * width;
      const y = ((1 - ndcY) / 2) * height;
      const radiusPx = (target.radius / (-view.z * halfHeightAtDepth)) * (height / 2);
      const size = Math.max(radiusPx * 2 + 12, MIN_BRACKET_PX * 2);
      if (size > Math.min(width, height)) {
        // Target fills the view: a bracket would just be stray edge lines.
        this._bracket.classList.add('hidden');
        this._arrow.classList.add('hidden');
        return;
      }
      this._bracket.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px)`;
      this._bracket.style.width = `${size}px`;
      this._bracket.style.height = `${size}px`;
      if (this._label.textContent !== target.name) this._label.textContent = target.name;
      this._bracket.classList.remove('hidden');
      this._arrow.classList.add('hidden');
      return;
    }

    // Off-screen or behind: the camera-space x/y still say which way to
    // turn, so the arrow sits on the screen edge in that direction.
    const angle = Math.atan2(view.y, view.x);
    const rx = width / 2 - EDGE_MARGIN_PX;
    const ry = height / 2 - EDGE_MARGIN_PX;
    const scale = 1 / Math.max(Math.abs(Math.cos(angle)) / rx, Math.abs(Math.sin(angle)) / ry);
    const x = width / 2 + Math.cos(angle) * scale;
    const y = height / 2 - Math.sin(angle) * scale;
    this._arrow.style.transform = `translate(${x}px, ${y}px) rotate(${-angle}rad)`;
    this._arrow.classList.remove('hidden');
    this._bracket.classList.add('hidden');
  }
}
