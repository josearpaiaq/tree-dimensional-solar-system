import * as THREE from 'three';

const CLICK_MOVE_THRESHOLD_PX = 5;

// Raycasts against planet meshes only (not the full scene graph, so the
// starfield/orbit paths can't produce false positives) and disambiguates a
// click from an orbit-drag by how far the pointer moved between
// pointerdown and pointerup.
export default class PlanetPicker {
  constructor(camera, domElement, meshes, { onPick, onMiss, onHoverChange } = {}) {
    this.camera = camera;
    this.domElement = domElement;
    this.meshes = meshes;
    this.onPick = onPick ?? (() => {});
    this.onMiss = onMiss ?? (() => {});
    this.onHoverChange = onHoverChange ?? (() => {});

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.hoveredId = null;
    this._pointerDirty = false;
    this._downPos = null;

    domElement.addEventListener('pointermove', this._onPointerMove);
    domElement.addEventListener('pointerdown', this._onPointerDown);
    domElement.addEventListener('pointerup', this._onPointerUp);
  }

  _onPointerMove = (event) => {
    this._updatePointerNDC(event);
    this._pointerDirty = true;
  };

  _onPointerDown = (event) => {
    this._downPos = { x: event.clientX, y: event.clientY };
  };

  _onPointerUp = (event) => {
    const downPos = this._downPos;
    this._downPos = null;
    if (!downPos) return;

    const moved = Math.hypot(event.clientX - downPos.x, event.clientY - downPos.y);
    if (moved > CLICK_MOVE_THRESHOLD_PX) return; // an orbit drag, not a click

    this._updatePointerNDC(event);
    const hit = this._raycast();
    if (hit) {
      this.onPick(hit.userData.bodyId);
    } else {
      this.onMiss();
    }
  };

  _updatePointerNDC(event) {
    const rect = this.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _raycast() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.meshes, false);
    return hits.length > 0 ? hits[0].object : null;
  }

  // Called once per rendered frame; only does work if the pointer actually
  // moved since the last check.
  update() {
    if (!this._pointerDirty) return;
    this._pointerDirty = false;

    const hit = this._raycast();
    const hoveredId = hit ? hit.userData.bodyId : null;
    if (hoveredId !== this.hoveredId) {
      this.hoveredId = hoveredId;
      this.domElement.style.cursor = hoveredId ? 'pointer' : '';
      this.onHoverChange(hoveredId);
    }
  }
}
