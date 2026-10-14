export type QualityTier = 'high' | 'low';

// Chosen once at startup. Part 1 only uses it for the pixel-ratio cap;
// Part 1b (mobile) tunes bloom and the starfield for 'low'.
export function detectQualityTier(): QualityTier {
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const smallScreen = Math.min(window.screen.width, window.screen.height) < 600;
  return coarsePointer || smallScreen ? 'low' : 'high';
}

export const MAX_PIXEL_RATIO: Record<QualityTier, number> = { high: 2, low: 1.5 };
