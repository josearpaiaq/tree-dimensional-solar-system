import * as THREE from 'three';
import { HOME_CAMERA_POSITION } from '../bodies/scaleConfig.ts';
import { MAX_PIXEL_RATIO, type QualityTier } from './quality.ts';

export interface SceneBundle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
}

export function createScene(canvas: HTMLCanvasElement, qualityTier: QualityTier): SceneBundle {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.03, // close enough for the cockpit view right against a moon's surface
    4000
  );
  camera.position.set(...HOME_CAMERA_POSITION);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO[qualityTier]));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  let resizeQueued = false;
  window.addEventListener('resize', () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  });

  return { scene, camera, renderer };
}
