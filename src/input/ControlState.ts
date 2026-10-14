// Device-agnostic flight controls. Keyboard/mouse fills this today; a touch
// input (Part 1b) will fill the same struct, so the flight code never knows
// which device is driving it.
export interface ControlState {
  // Each axis in [-1, 1]. x = strafe right, y = strafe up, z = forward.
  thrust: { x: number; y: number; z: number };
  // Angular rate commands in [-1, 1]. x = pitch up, y = yaw left, z = roll left.
  rotate: { x: number; y: number; z: number };
}

export type ControlAction =
  | 'toggleAssist'
  | 'toggleCruise'
  | 'target'
  | 'toggleCamera'
  | 'toggleMap'
  | 'toggleCodex'
  | 'toggleOrbits'
  | 'back';

export function emptyControls(): ControlState {
  return { thrust: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 } };
}
