# Solar Pilot — Part 1: Flight & Scanning (Design)

Date: 2026-10-12
Status: draft, awaiting user review

## Context

The app is currently a free-orbit 3D solar system viewer (Sun + 8 planets, click-to-focus fly-to, facts panel). It is being turned into a game where the player is a spaceship pilot.

The full game is split into sub-projects, each with its own spec → plan → implementation cycle:

| Part | Scope | Status |
|---|---|---|
| **1 — Flight & Scanning** | Ship, Newtonian flight w/ assist, cruise drive, chase/cockpit cameras, HUD, map mode, 13 moons, scanning, Codex, minimal save | **This spec** |
| 1b — Mobile | Touch controls, landscape prompt, mobile quality tier | Next, after Part 1's flight feel is tuned |
| 2 — Campaign | Mission Control story chain, fuel + depots, Sun heat, credits + upgrades, difficulty levels, full save, never-stuck rules | After 1b |

Part 1 is playable on its own as free exploration: "catalog every body in the system."

### Decisions already made (with the user)

- **Core loop (whole game):** missions drive progression, fuel sets your range, scanning is what you actually do. Required upgrades are mission rewards (never bought), so the player can't soft-lock. *(Part 2)*
- **Difficulty (Part 2):** Explorer (no fuel/heat) / Pilot (free tow on empty) / Commander (tight fuel, paid tow → debt if broke). "Return to last checkpoint" is always available.
- **Flight model:** Newtonian + flight assist (Elite Dangerous–style).
- **Moving bodies:** local reference frames (sphere of influence). Orbits keep their current speeds.
- **Long distances:** cruise drive with a distance-based speed cap.
- **Camera:** chase cam by default, `C` toggles cockpit.
- **Existing free-orbit mode:** becomes the Map (`M`).
- **Ship model:** built from Three.js primitives in code, no external asset.
- **Mobile:** Part 1 is desktop-first but mobile-ready (input abstraction, responsive HUD, quality tier hook). Touch controls are Part 1b.

## 1. Player experience

### Start
After the loading screen, the ship spawns parked inside Earth's sphere of influence (SOI), facing Earth, with zero relative velocity, in chase view. A short controls hint is shown and hides on first input.

### Controls (desktop)
Clicking the canvas engages pointer lock. `Esc` releases it and pauses the game.

| Input | Action |
|---|---|
| Mouse | Pitch / yaw (rate-controlled: mouse delta → angular velocity command) |
| `Q` / `E` | Roll |
| `W` / `S` | Thrust forward / reverse |
| `A` / `D` | Strafe left / right |
| `R` / `F` | Strafe up / down (not `Ctrl`: `Ctrl+W` closes the browser tab) |
| `Z` | Toggle flight assist (default on) |
| `J` | Toggle cruise drive |
| `T` | Target the body nearest the crosshair (within 10°), else the nearest body by distance |
| `C` | Toggle chase / cockpit camera |
| `M` | Open / close Map (pauses simulation) |
| `Tab` | Open / close Codex (pauses simulation) |

### Flight
- **Thrusters (normal flight):** Newtonian. Thrust accelerates the ship along its local axes; velocity persists when input stops.
- **Flight assist ON:** on any axis with no thrust input, counter-thrust drives the velocity *relative to the reference body* toward zero (bounded by thruster acceleration). Total relative speed is capped at `THRUSTER_MAX_SPEED`.
- **Flight assist OFF:** pure Newtonian; no automatic damping, no assist speed cap.
- Rotation is always rate-controlled and damped (assist only affects linear motion).
- **Cruise drive:** while engaged, velocity is steered toward `forward × cruiseCap` (not Newtonian), where `cruiseCap = clamp(CRUISE_DISTANCE_FACTOR × distanceToNearestSurface, 0, CRUISE_MAX_SPEED)`, approached at `CRUISE_ACCELERATION`. Cruise **auto-disengages** when `cruiseCap` falls below `THRUSTER_MAX_SPEED` — this naturally drops the player out of cruise at a fixed distance `THRUSTER_MAX_SPEED / CRUISE_DISTANCE_FACTOR` from any surface. That drop-out distance may be outside or inside a body's scan radius; either way the player finishes the approach on thrusters, since scanning requires cruise to be off. On disengage, relative speed is clamped to `THRUSTER_MAX_SPEED`. Cruise cannot engage if `cruiseCap < THRUSTER_MAX_SPEED`.

- **Armed cruise:** pressing `J` while too close to a body arms cruise instead of refusing; it engages by itself once the ship is clear and the nose isn't pointing back at the body being cleared. The HUD shows what it's waiting for ("clear 9,000 km" / "turn away from Earth").
- **Nav lock:** while cruising with a target and the nose within 20° of it, cruise matches the target's motion and closes in on top of it (instead of following the nose), so a moving planet can't slide away. HUD shows "NAV LOCK".
- **Parking orbit:** stopped (no thrust, relative speed ≈ 0, not cruising) inside a planet's or moon's SOI, the ship slowly circles the body about the ecliptic normal, rotating with it so the body stays fixed in view. HUD shows "Orbiting <body>". Not applied around the Sun.
- **Orbit time scale:** orbits and spins run at half rate while flying (`ORBIT_TIME_SCALE = 0.5`), keeping the system alive but chaseable.

### Reference frames
- Every body has an SOI radius. The ship's **reference body** is the body with the *smallest* SOI that contains the ship (so a moon beats its planet); outside every planet SOI, the reference body is the Sun.
- Each physics step, the ship is translated by the reference body's world-space displacement for that step ("carried along"). Velocity is stored relative to the reference body.
- **Frame switch (capture):** when the reference body changes, velocity relative to the reference body is kept as-is, so entering an SOI captures the ship. (Preserving world-space velocity instead was rejected during implementation: planets orbit at up to ~7 u/s against 2 u/s thrusters, so the ship would be flung back out of the SOI it just entered.)
- HUD speed is relative to the reference body.

### Collisions
Each body is a sphere. Collision is tested as a segment–sphere sweep over the physics step (no tunneling at cruise speed). On contact, the ship is placed on the surface + a small margin and the inward component of relative velocity is removed. No damage in Part 1. Saturn's ring is not collidable.

### Scanning
- A scan requires: a **target** set (`T` or map click), ship within the target's **scan radius**, target within **25°** of the ship's forward axis, cruise **not** engaged.
- While all conditions hold, scan progress fills over `SCAN_DURATION` (3 s). If any condition breaks, progress **pauses** (does not reset). Changing target resets progress.
- On completion: the body is added to the Codex, the facts panel slides in for 6 s (or until dismissed), and the HUD Codex counter updates. Already-cataloged targets don't scan again; the HUD shows "Cataloged".
- All 22 bodies are scannable, including the Sun.

### HUD (heads-up display)
- Speed (relative to reference body) + reference body name
- Flight assist state, drive state (Thrusters / Cruise + current cap)
- Target bracket with name + distance; when off-screen, an arrow at the screen edge pointing toward it
- Scan progress ring around the crosshair (only while a scan is active)
- Codex progress, e.g. `4 / 22`
- Layout uses CSS `clamp()` sizing and safe-area insets (mobile-ready).

### Map mode (`M`)
- Pauses the simulation (orbits + ship frozen). Releases pointer lock.
- The camera does an eased fly from the ship camera's pose to the existing overview (reusing `CameraRig`); closing the map flies back to the ship-camera pose before handing control back. No hard cuts in either direction.
- Opens on the whole system: same viewing angle as the original home pose, at the closest distance where the outermost orbit fits on screen.
- Existing behavior is kept (orbit/zoom, nav list, hover highlight, click-to-focus with facts panel), plus right-drag panning.
- Orbit lines (one circle per orbit, moons' following their planet) toggle with `O` in flight and map.
- New: clicking a body (or nav list entry) also **sets it as the flight target**. A pulsing "You" marker shows the ship's position, a dashed line runs from the ship to the current target, and a "Your ship" entry at the top of the nav list flies the map camera to the ship.
- Facts panel shows real facts only for cataloged bodies; uncataloged bodies show the name, type, and "Unscanned".

### Codex (`Tab`)
Overlay panel (pauses simulation, releases pointer lock) listing all 22 bodies grouped by parent (Sun → planets → moons). Cataloged entries show the name and open the facts panel on click; uncataloged entries show "???" and their parent ("Moon of Jupiter").

### Pause
`Esc` / losing pointer lock / window blur → paused overlay "Click to resume". Simulation is frozen while paused.

## 2. Content

### Bodies
22 total: Sun, 8 planets, 13 moons:

| Parent | Moons |
|---|---|
| Earth | Moon |
| Mars | Phobos, Deimos |
| Jupiter | Io, Europa, Ganymede, Callisto |
| Saturn | Titan, Enceladus, Rhea |
| Uranus | Titania, Oberon |
| Neptune | Triton (retrograde orbit) |

- Moons use real radius, orbit distance, orbital period, and are tidally locked (rotation period = orbital period).
- **Moon scene scale** (new functions in `scaleConfig.ts`): moon size uses the same `planetSceneRadius` but with a lower floor `MIN_MOON_RADIUS` (so Phobos/Deimos read as small). Moon orbit radius = `parentClearance + MOON_BASE_OFFSET + MOON_ORBIT_FACTOR × max(1, sqrt(parentSceneRadius)) × sqrt(distanceKm / parentRadiusKm)`, where the clearance is the parent's surface or ring edge, and the factor grows with the parent so the Galilean moons have room. Moon *linear* speed = `min(MOON_SPEED_FACTOR / sqrt(periodDays), MOON_MAX_LINEAR_SPEED)`, so every moon is catchable on thrusters. Exact constants are tuning values set during implementation, constrained by the invariants below.
- **Textures:** add Solar System Scope's moon texture (CC BY 4.0, same source as existing textures) as `moon.jpg`. Other moons reuse it as a base with a per-moon color tint (`tint` field in data), e.g. Io yellow-orange, Europa pale tan, Titan hazy orange, Enceladus near-white, Triton pinkish-grey.
- **Facts:** `FactsData` gets a moon variant: `{ diameterKm, distanceFromParentKm, orbitalPeriodDays }`. The facts panel picks rows by body type (moons show "Orbits: Jupiter", distance from parent, orbital period).

### Radii (per body, computed in `bodies/zones.ts` from constants in `scaleConfig.ts`)
- `soiRadius` — sphere of influence
- `scanRadius` — max scan distance

### Invariants (enforced by unit tests)
1. Every moon orbits outside its parent's surface (and outside Saturn's ring for Saturn's moons).
2. A moon's SOI lies entirely inside its parent's SOI at every point of its orbit.
3. Sibling moons' SOIs never overlap.
4. Every body: `sceneRadius < scanRadius ≤ soiRadius`.
5. Every planet's SOI reaches past the cruise drop-out distance, so arriving in cruise always lands in the planet's frame.

> Planet SOIs may overlap when neighboring planets align (e.g. Venus/Earth); the "smallest containing SOI wins" rule handles it.

## 3. Architecture

Same style as the existing code: feature folders, data-driven bodies, `main.ts` as the composition root wiring modules via callbacks, explicit state machines. New simulation logic follows "functional core, imperative shell": pure functions for the logic, thin classes for Three.js/DOM.

### New modules

```
src/
├── ship/
│   ├── Ship.ts               # primitives-built mesh + engine glow; holds ShipState
│   ├── flightModel.ts        # PURE: (state, controls, frameInfo, dt) → state
│   └── referenceFrame.ts     # PURE: pick reference body; carry; frame-switch velocity
├── input/
│   ├── ControlState.ts       # device-agnostic: { thrust: vec3, rotate: vec3, actions }
│   └── KeyboardMouseInput.ts # keyboard + pointer lock → ControlState
├── camera/
│   └── ShipCamera.ts         # chase (spring follow) + cockpit
├── game/
│   ├── scanner.ts            # PURE: target selection, scan conditions, progress
│   ├── Codex.ts              # cataloged set; emits onUnlock
│   ├── GameMode.ts           # 'flight' | 'map' | 'codex' | 'paused' state machine
│   └── SaveStore.ts          # versioned localStorage load/save/migrate
└── ui/
    ├── Hud.ts
    ├── TargetMarker.ts
    └── CodexPanel.ts
```

### Changes to existing code
- `CelestialBody`: add a non-spinning `anchor` group at the orbit position holding the mesh, ring, and child moon pivots (currently spin is on the mesh, so children can't attach to it). Add `soiRadius`, `scanRadius`, `parent`.
- `createBodies`: attach moon pivots to their parent's `anchor`; apply moon tints.
- `types.ts`: `BodyType` adds `'moon'`; moon facts variant; optional `tint`.
- `data/bodies.ts`: 13 moons.
- `scaleConfig.ts`: moon scale functions, SOI/scan radii, flight + scan tuning constants.
- `FactsPanel`: "Unscanned" state; rows by body type.
- `CameraRig`: add an entry that flies from the camera's *current* pose to the overview regardless of current state (today `returnToOverview()` no-ops when `idle`), and a fly-to-arbitrary-pose used when leaving the map.
- `PlanetPicker`: active only in map mode.
- `main.ts`: owns `GameMode`; per-mode update pipeline.
- `index.html` / `style.css`: HUD, Codex, pause overlay, updated controls hint.

### Frame loop
```
render frame (variable dt):
  if mode == flight:
    accumulator += dt
    while accumulator >= 1/60:
      bodies.update(step)                 # orbits advance
      frame = referenceFrame.resolve(ship, bodies)   # pick body, carry, re-express velocity
      ship.state = flightModel.step(ship.state, input.controls, frame, step)  # incl. collision
      scan = scanner.step(scan, ship, target, step)
      accumulator -= step
    shipCamera.update(dt); hud.update(); targetMarker.update()
  if mode == map:
    cameraRig.update(dt); planetPicker.update()   # bodies frozen
  composer.render()
```

### Performance hook (mobile-ready)
A `qualityTier` ('high' | 'low') is chosen at startup (coarse pointer or small screen → low). Part 1 only implements the hook and uses it for pixel-ratio cap; Part 1b tunes bloom/starfield for 'low'.

## 4. Saving

- One `localStorage` key, versioned JSON: `{ version: 1, codex: string[] }`.
- Written on every Codex unlock. Loaded at startup.
- `SaveStore` exposes `load()`, `save(data)`, and `migrate(raw) → current`, keyed on `version`, so Part 2's v2 (credits, upgrades, missions, depots, checkpoint, difficulty) upgrades v1 saves without losing the Codex.
- Missing, corrupt, unknown-version, or unavailable storage (private mode, quota) → fresh state, never throws, never blocks play.
- Ship position is **not** saved (orbits start at random angles each load); the ship always spawns at Earth.

## 5. Testing

- Add **Vitest** (dev dependency, `npm test`).
- Unit tests (pure modules):
  - `flightModel`: thrust integrates velocity; assist damps to zero relative velocity; assist caps speed; assist-off preserves velocity; cruise cap scales with distance; cruise auto-disengages and clamps speed; swept collision stops the ship at the surface without tunneling at `CRUISE_MAX_SPEED`.
  - `referenceFrame`: smallest containing SOI wins; Sun fallback; carry by displacement; switching frame on SOI entry.
  - `scanner`: each condition gates progress; progress pauses (not resets) when broken; target change resets; completion fires once.
  - `scaleConfig` invariants (section 2) over the real body data.
  - `SaveStore`: round trip; corrupt/unknown → fresh; storage throwing → fresh.
- Manual check in the browser: fly Earth → Moon → scan; cruise Earth → Jupiter, drop out, scan Io while it moves; map open/close transitions are eased; pause/resume.
- `npm run build` (tsc strict) passes.

## Out of scope for Part 1

Fuel, heat, damage, credits, upgrades, missions, depots, difficulty, touch controls, sound, gravity, cloud saves, multiple save slots, saving ship position.
