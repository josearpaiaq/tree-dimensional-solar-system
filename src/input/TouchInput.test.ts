import { describe, expect, it } from 'vitest';
import { stickVector } from './TouchInput.ts';

describe('stickVector', () => {
  it('ignores small offsets inside the dead zone', () => {
    expect(stickVector(3, -2, 50)).toEqual({ x: 0, y: 0 });
  });

  it('maps dragging up to positive y and right to positive x', () => {
    const up = stickVector(0, -25, 50);
    expect(up.x).toBeCloseTo(0);
    expect(up.y).toBeCloseTo(0.5);
    expect(stickVector(25, 0, 50).x).toBeCloseTo(0.5);
  });

  it('clamps to length 1 beyond the radius, keeping direction', () => {
    const v = stickVector(300, -400, 50);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1);
    expect(v.x).toBeCloseTo(0.6);
    expect(v.y).toBeCloseTo(0.8);
  });
});
