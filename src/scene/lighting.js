import * as THREE from 'three';

// Tuned intensity/decay rather than strict inverse-square falloff — at
// compressed-but-still-substantial scene distances, physically accurate
// falloff would leave the outer planets nearly black.
export function createLighting(scene) {
  const sunLight = new THREE.PointLight(0xffffff, 3, 0, 0.15);
  sunLight.position.set(0, 0, 0);
  scene.add(sunLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.18);
  scene.add(ambientLight);

  return { sunLight, ambientLight };
}
