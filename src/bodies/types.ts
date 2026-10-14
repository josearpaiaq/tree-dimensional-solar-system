export type BodyType = 'star' | 'planet' | 'moon';

export interface OrbitData {
  distanceMillionKm: number;
  periodDays: number;
  retrograde?: boolean;
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

export interface PlanetFacts {
  diameterKm: number;
  distanceFromSunKm: number;
  dayLengthHours: number;
  moons: number;
}

export interface MoonFacts {
  diameterKm: number;
  distanceFromParentKm: number;
  orbitalPeriodDays: number;
}

export type FactsData = PlanetFacts | MoonFacts;

export interface CelestialBodyData {
  id: string;
  name: string;
  type: BodyType;
  parentId: string | null;
  radiusKm: number;
  textureMap: string;
  tint?: string; // multiplied over the texture; lets moons share one base texture
  orbit: OrbitData | null;
  rotation: RotationData;
  ring: RingData | null;
  facts: FactsData;
}
