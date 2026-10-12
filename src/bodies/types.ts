export type BodyType = 'star' | 'planet';

export interface OrbitData {
  distanceMillionKm: number;
  periodDays: number;
}

export interface RotationData {
  periodHours: number;
  axialTiltDeg: number;
}

export interface RingData {
  innerRadiusKm: number;
  outerRadiusKm: number;
  textureMap: string;
}

export interface FactsData {
  diameterKm: number;
  distanceFromSunKm: number;
  dayLengthHours: number;
  moons: number;
}

export interface CelestialBodyData {
  id: string;
  name: string;
  type: BodyType;
  parentId: string | null;
  radiusKm: number;
  textureMap: string;
  orbit: OrbitData | null;
  rotation: RotationData;
  ring: RingData | null;
  facts: FactsData;
}
