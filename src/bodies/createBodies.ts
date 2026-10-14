import * as THREE from 'three';
import { bodies as bodyData } from './data/bodies.ts';
import { planetSceneRadius } from './scaleConfig.ts';
import CelestialBody from './CelestialBody.ts';
import { computeZones } from './zones.ts';
import type { RingData } from './types.ts';

export interface CreateBodiesResult {
  group: THREE.Group;
  celestialBodies: CelestialBody[];
  byId: Map<string, CelestialBody>;
}

// Factory: turns the plain data array into live CelestialBody instances,
// loading textures through a shared LoadingManager so the app can gate
// its first render on everything being ready (no texture pop-in).
export function createBodies(loadingManager: THREE.LoadingManager): CreateBodiesResult {
  const textureLoader = new THREE.TextureLoader(loadingManager);
  const group = new THREE.Group();
  const celestialBodies: CelestialBody[] = [];
  const byId = new Map<string, CelestialBody>();

  for (const data of bodyData) {
    const texture = textureLoader.load(data.textureMap);
    texture.colorSpace = THREE.SRGBColorSpace;

    const material =
      data.type === 'star'
        ? new THREE.MeshBasicMaterial({ map: texture })
        : new THREE.MeshStandardMaterial({ map: texture, color: data.tint ?? 0xffffff, roughness: 1, metalness: 0 });

    const ringMesh = data.ring ? createRing(data.ring, data.rotation.axialTiltDeg, textureLoader) : null;

    // Planets orbit the sun at the scene origin, so their pivots live in
    // the root group; moons hang off their parent's (non-spinning) anchor.
    const parent = data.parentId ? (byId.get(data.parentId) ?? null) : null;
    const body = new CelestialBody(data, material, ringMesh, parent);
    celestialBodies.push(body);
    byId.set(data.id, body);
    if (data.type === 'moon' && parent) {
      parent.anchor.add(body.pivot);
    } else {
      group.add(body.pivot);
    }
  }

  const zones = computeZones(
    celestialBodies.map((b) => ({
      id: b.id,
      type: b.type,
      parentId: b.data.parentId,
      sceneRadius: b.sceneRadius,
      orbitRadius: b.orbitRadius,
    }))
  );
  for (const body of celestialBodies) {
    const { soiRadius, scanRadius } = zones.get(body.id)!;
    body.soiRadius = soiRadius;
    body.scanRadius = scanRadius;
  }

  return { group, celestialBodies, byId };
}

function createRing(ring: RingData, axialTiltDeg: number, textureLoader: THREE.TextureLoader): THREE.Mesh {
  const innerRadius = planetSceneRadius(ring.innerRadiusKm);
  const outerRadius = planetSceneRadius(ring.outerRadiusKm);
  const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 64);
  remapRingUVsRadially(geometry, innerRadius, outerRadius);

  const texture = textureLoader.load(ring.textureMap);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
    transparent: true,
  });

  const mesh = new THREE.Mesh(geometry, material);
  // Rings lie in the planet's equatorial plane.
  mesh.rotation.x = Math.PI / 2 - THREE.MathUtils.degToRad(axialTiltDeg);
  return mesh;
}

// RingGeometry's default UVs are derived from each vertex's raw x/y
// position, not its radial distance — with a radial-gradient ring texture
// (inner edge to outer edge along one axis) that renders as a swirled
// mess. Remap u to normalized radius so the texture reads correctly.
function remapRingUVsRadially(geometry: THREE.RingGeometry, innerRadius: number, outerRadius: number): void {
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const uv = geometry.attributes.uv as THREE.BufferAttribute;
  const vertex = new THREE.Vector3();

  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    const u = (vertex.length() - innerRadius) / (outerRadius - innerRadius);
    uv.setXY(i, u, 1);
  }
  uv.needsUpdate = true;
}
