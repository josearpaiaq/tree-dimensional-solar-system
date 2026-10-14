# Solar Pilot — Part 1b: Mobile (Design)

Date: 2026-10-14
Status: approved in chat, implementing

## Goal

Play Part 1 on a phone or tablet: fly, scan, use the map and Codex with touch only.

## Decisions (with the user)

- **Steering:** drag like a stick. Touch the right half; the offset from the touch-down point commands the turn rate, and holding keeps turning.
- **Scope:** no roll and no vertical strafe on touch. Flight assist is always on (drifting is too hard with thumbs).

## Design

### Input
- `TouchInput` produces the same `ControlState` and actions as `KeyboardMouseInput`. Both implement a small `FlightInput` interface (`locked`, `requestLock`, `exitLock`, `read`, `consumeActions`) that `GameMode` depends on, so the mode logic is unchanged.
- Chosen once at startup: touch when the primary pointer is coarse (`(pointer: coarse)`), else keyboard + mouse. Chrome's device toolbar emulates this, so touch mode can be tried on desktop.
- On touch, "locking" is engaging the touch controls: no browser permission involved, so resuming always works.

### Layout (flight mode, landscape)
- **Left half:** a floating joystick appears where the thumb lands. Up/down = thrust forward/back, left/right = strafe sideways. Offset normalized by the stick radius, clamped to 1, with a small dead zone.
- **Right half:** steering stick, same math: drag up = nose up, drag right = nose right.
- **Buttons:** Map, Codex, Pause (bottom left); Target, Cruise, Camera, Orbits (bottom right). They take their own touches, so pressing one never moves the sticks.
- HUD flight readout moves above the button row. Keyboard hints are hidden; the pause screen shows touch instructions and "Tap to fly".

### Map
- A **Fly** button (all devices) returns to flight. Touch map navigation comes from the existing OrbitControls (one finger orbits, pinch zooms, two fingers pan); tapping a body targets it via the existing picker.

### Screen
- Tapping anywhere on the pause screen resumes, requests fullscreen and locks the screen to landscape (no-op where unsupported, e.g. iPhone Safari, which keeps the rotate prompt). Where supported, tapping the rotate prompt does the same, so the screen turns to landscape by itself.
- Portrait on a touch device: a full-screen "rotate your phone" prompt, and flight pauses.
- Browser gestures (scroll, pinch-zoom of the page, double-tap zoom) are disabled on the game surface.

### Quality tier 'low'
- Bloom renders at half resolution. Starfield uses half the points. (Pixel-ratio cap 1.5 already exists.)

## Testing
- Unit tests for the stick math (dead zone, clamping, direction).
- Desktop browser smoke test that keyboard/mouse play is unchanged.
- Touch play on a real phone (`npm run dev -- --host`, then open the LAN URL) or Chrome's device toolbar, by the user.
