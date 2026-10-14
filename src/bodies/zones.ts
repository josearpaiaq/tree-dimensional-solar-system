import {
  MOON_SOI_MARGIN,
  MOON_SOI_GAP_SHARE,
  MOON_SCAN_MARGIN,
  PLANET_SOI_MULTIPLIER,
  PLANET_SOI_MARGIN,
  PLANET_SOI_MOON_MARGIN,
  PLANET_SCAN_MULTIPLIER,
  PLANET_SCAN_MARGIN,
  CRUISE_DROPOUT_DISTANCE,
} from './scaleConfig.ts';
import type { BodyType } from './types.ts';

export interface ZoneInput {
  id: string;
  type: BodyType;
  parentId: string | null;
  sceneRadius: number;
  orbitRadius: number;
}

export interface Zones {
  soiRadius: number; // inside it, the ship is carried along with this body
  scanRadius: number; // max distance to scan this body
}

// Zones depend on siblings (moons must not share an SOI) and children (a
// planet's SOI must enclose its moons'), so they're computed over the whole
// body list at once rather than per body. Moons first, then their parents.
export function computeZones(bodies: ZoneInput[]): Map<string, Zones> {
  const zones = new Map<string, Zones>();

  for (const moon of bodies.filter((b) => b.type === 'moon')) {
    let nearestGap = Infinity;
    for (const sibling of bodies) {
      if (sibling === moon || sibling.type !== 'moon' || sibling.parentId !== moon.parentId) continue;
      nearestGap = Math.min(nearestGap, Math.abs(sibling.orbitRadius - moon.orbitRadius));
    }
    const soiRadius = Math.min(moon.sceneRadius + MOON_SOI_MARGIN, MOON_SOI_GAP_SHARE * nearestGap);
    const scanRadius = Math.min(moon.sceneRadius + MOON_SCAN_MARGIN, soiRadius);
    zones.set(moon.id, { soiRadius, scanRadius });
  }

  for (const body of bodies.filter((b) => b.type !== 'moon')) {
    const scanRadius = body.sceneRadius * PLANET_SCAN_MULTIPLIER + PLANET_SCAN_MARGIN;
    if (body.parentId === null) {
      // The root star's SOI is everything: it's the fallback frame.
      zones.set(body.id, { soiRadius: Infinity, scanRadius });
      continue;
    }
    let soiRadius = Math.max(
      body.sceneRadius * PLANET_SOI_MULTIPLIER,
      body.sceneRadius + CRUISE_DROPOUT_DISTANCE + PLANET_SOI_MARGIN,
      scanRadius
    );
    for (const moon of bodies) {
      if (moon.parentId !== body.id) continue;
      const moonSoi = zones.get(moon.id)!.soiRadius;
      soiRadius = Math.max(soiRadius, moon.orbitRadius + moonSoi + PLANET_SOI_MOON_MARGIN);
    }
    zones.set(body.id, { soiRadius, scanRadius });
  }

  return zones;
}
