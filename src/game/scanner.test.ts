import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { initialScanState, setTarget, stepScan, pickTarget, type ScanShip } from './scanner.ts';
import { SCAN_DURATION } from '../bodies/scaleConfig.ts';
import { body } from '../ship/testBodies.ts';

const target = body('moon', [0, 0, -2], 0.3, 2, [0, 0, 0], 3);
const forward = new THREE.Vector3(0, 0, -1);
const goodShip: ScanShip = { position: new THREE.Vector3(), forward, cruise: false };
const targeted = setTarget(initialScanState(), 'moon');

describe('stepScan', () => {
  it('fills progress while every condition holds', () => {
    const { state, status } = stepScan(targeted, goodShip, target, 1);
    expect(status.scanning).toBe(true);
    expect(state.progress).toBeCloseTo(1 / SCAN_DURATION);
  });

  it('is gated by range', () => {
    const far = { ...goodShip, position: new THREE.Vector3(0, 0, 5) };
    const { state, status } = stepScan(targeted, far, target, 1);
    expect(status.inRange).toBe(false);
    expect(state.progress).toBe(0);
  });

  it('is gated by alignment', () => {
    const sideways = { ...goodShip, forward: new THREE.Vector3(1, 0, 0) };
    const { status } = stepScan(targeted, sideways, target, 1);
    expect(status.aligned).toBe(false);
    expect(status.scanning).toBe(false);
  });

  it('is gated by cruise', () => {
    const { status } = stepScan(targeted, { ...goodShip, cruise: true }, target, 1);
    expect(status.scanning).toBe(false);
  });

  it('pauses (does not reset) when a condition breaks', () => {
    const partial = stepScan(targeted, goodShip, target, 1).state;
    const paused = stepScan(partial, { ...goodShip, cruise: true }, target, 1).state;
    expect(paused.progress).toBeCloseTo(1 / SCAN_DURATION);
  });

  it('resets when the target changes, but not when re-selecting the same one', () => {
    const partial = stepScan(targeted, goodShip, target, 1).state;
    expect(setTarget(partial, 'moon').progress).toBeGreaterThan(0);
    expect(setTarget(partial, 'planet').progress).toBe(0);
  });

  it('completes exactly once', () => {
    let state = targeted;
    let completions = 0;
    for (let i = 0; i < SCAN_DURATION * 2 * 60; i++) {
      const result = stepScan(state, goodShip, target, 1 / 60);
      state = result.state;
      if (result.status.completed) completions++;
    }
    expect(completions).toBe(1);
    expect(state.progress).toBe(1);
  });
});

describe('pickTarget', () => {
  const bodies = [body('sun', [0, 0, 0], 5, Infinity), body('ahead', [0, 0, -50], 1, 5), body('near', [3, 0, 0], 0.5, 2)];
  const position = new THREE.Vector3(0, 0, -10);

  it('prefers the body near the crosshair', () => {
    expect(pickTarget(position, forward, bodies)).toBe('ahead');
  });

  it('falls back to the nearest surface when nothing is near the crosshair', () => {
    expect(pickTarget(position, new THREE.Vector3(0, 1, 0), bodies)).toBe('sun');
  });
});
