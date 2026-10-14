# Solar Pilot

A 3D space-flight game built with [Three.js](https://threejs.org/). Pilot a small survey ship through the solar system, fly out to the planets and their major moons, and scan each one to complete your Codex. The game grew out of an interactive solar system viewer, which lives on as the in-game map.

## How to play

Click anywhere on the start screen to capture the mouse, then:

| Input | Action |
|---|---|
| Mouse | Steer |
| W / S or ↑ / ↓ | Thrust forward / back |
| A / D or ← / → | Strafe sideways |
| R / F | Strafe up / down |
| Q / E | Roll |
| T | Target the body ahead (or the nearest one) |
| J | Cruise drive |
| Z | Flight assist on / off |
| C | Chase / cockpit camera |
| O | Show / hide orbit lines |
| M | Map |
| Tab | Codex |
| Esc | Pause / resume |

**On phones and tablets** (landscape): your left thumb moves the ship (a joystick appears where you touch), your right thumb steers (drag further to turn faster), and on-screen buttons handle Map, Codex, Pause, Target, Cruise, Camera and Orbits. Tap **Fly** to leave the map. Starting to fly goes fullscreen and locks to landscape where the browser allows it (not iPhone Safari).

**Goal:** catalog all 22 bodies (the Sun, 8 planets, 13 major moons). Target a body, get within its scan range, and keep it near the crosshair until the scan ring fills.

**Getting around:**
- **Thrusters** handle close maneuvering. With **flight assist** on (default), the ship stops when you let go; with it off, you drift like a real spacecraft.
- **Cruise (J)** covers long distances and slows down on its own near anything. Pressed too close to a body, it arms and engages once you're clear.
- **Nav lock:** cruising with a target near the crosshair, the ship follows the target's orbit and drops out of cruise right next to it.
- **Spheres of influence:** near a planet or moon, the ship is carried along with it, and when you stop it settles into a slow parking orbit.
- **Map (M)** shows the whole system, your position ("You"), and a route line to your target. Click a body there to target it.

Map, Codex and pause open from any mode; pressing a mode's key again returns to flight. Codex progress is saved in the browser.

## Features

- Newtonian flight with flight assist, a distance-capped cruise drive with nav lock, swept collisions
- Real relative sizes and textures; orbital distances compressed so the system stays navigable; orbits run at half speed while flying
- 13 major moons on their own compressed orbits, tidally locked, with Triton retrograde
- Chase and cockpit cameras, HUD with target bracket / off-screen arrow and scan ring
- Map mode reusing the original free-orbit explorer: whole-system framing, pan, click-to-focus fly-to, facts panel
- Saturn's ring, sun and engine bloom, orbit lines, procedural starfield

## Tech stack

- [Three.js](https://threejs.org/) for the 3D scene, camera, and rendering
- [TypeScript](https://www.typescriptlang.org/) (strict mode)
- [Vite](https://vite.dev/) for the dev server and build
- [Vitest](https://vitest.dev/) for unit tests

## Getting started

```bash
npm install
npm run dev       # start the dev server (add -- --host to open it from a phone on your network)
npm test          # run the unit tests
npm run build     # type-check and build for production
npm run preview   # preview the production build locally
```

## Project structure

```
src/
├── main.ts                 # composition root: wires modules together, owns the render loop
├── bodies/                 # celestial body data model, scale/compression config, zones (SOI / scan range)
│   └── data/bodies.ts        # sun, 8 planets, 13 moons: real-world values
├── ship/                   # flight model, reference frames, ship mesh
├── game/                   # game modes, scanner, Codex, save store, body tracker
├── input/                  # device-agnostic ControlState + keyboard/mouse and touch inputs
├── camera/                 # map camera (free orbit + fly-to) and ship chase/cockpit camera
├── interaction/             # map raycasting, hover, click/drag disambiguation
├── scene/                  # scene, lighting, starfield, orbit lines, quality tier
└── ui/                      # HUD, target marker, map overlay, Codex, facts panel, nav list, loading screen
public/textures/            # planet, moon and sun textures (see Credits)
docs/superpowers/specs/     # design specs
```

The flight, reference-frame and scan logic are pure functions with unit tests; the classes around them only deal with Three.js and the DOM. Bodies orbit a generic parent (`parentId`), so moons were a data addition, and a future galaxy of star systems can be too.

## Roadmap

- **Part 1 (done):** flight, scanning, Codex, map.
- **Part 1b (done):** mobile: touch controls, landscape layout, lighter graphics on phones.
- **Part 2:** campaign: Mission Control story missions, fuel and depots, solar heat, credits and upgrades, difficulty levels.
- Later: expand into a galaxy / universe-scale map, reusing the same body/orbit model.

## Credits

Planet, moon and sun textures by [Solar System Scope](https://www.solarsystemscope.com/textures/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
