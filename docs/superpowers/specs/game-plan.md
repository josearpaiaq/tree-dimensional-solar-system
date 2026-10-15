# Solar Pilot — Game Plan

Last updated: 2026-10-14

The overall plan for turning the 3D solar system viewer into a game. Each part gets its own design spec (in this folder) before it's built; this file holds the big picture so work can continue from any machine.

## Vision

You're a spaceship pilot flying through a realistic-looking solar system (real textures and relative sizes, compressed distances), collecting information about the planets and moons. The look stays as realistic as the rest of the project.

Long term, the app expands into a galaxy / universe-scale map. The body model is generic (every body orbits a `parentId`) so that's a data and scale extension, not a rewrite.

## Status

| Part | Scope | Status | Spec |
|---|---|---|---|
| 1 — Flight & Scanning | Ship, Newtonian flight with assist, cruise drive and nav lock, chase/cockpit cameras, HUD, map mode, 13 moons, scanning, Codex, minimal save | Done | `2026-10-12-flight-and-scanning-design.md` |
| 1b — Mobile | Touch controls, landscape + fullscreen, lighter graphics on phones, wake lock | Done | `2026-10-14-mobile-design.md` |
| 2 — Campaign | See below | **Next: needs a design session before any code** | — |

## Core loop (whole game)

**Missions drive progress, fuel sets your range, scanning is what you actually do.**

## Part 2 — Campaign (draft ideas, not yet designed)

Agreed direction with the user; details are still open and get settled in Part 2's design session.

1. **Home base:** start at a station orbiting Earth. Mission Control gives one mission at a time, with a bit of story ("Our probes lost contact near Mars. Go scan it.").
2. **Plan the trip:** a full tank only reaches so far. Mars is fine on the starter tank; Jupiter isn't, yet.
3. **Fly and scan:** mission targets advance the story; scanning any other body pays bonus credits, rewarding exploring off-route.
4. **Refuel and upgrade:** dock at a depot to refuel, spend credits on a bigger tank, faster scanner, stronger engine or heat shield.
5. **Missions unlock new depots:** e.g. finishing the Mars arc opens a Mars outpost; later Ganymede and Titan bases. Each depot is a stepping stone outward, so missions and fuel feed each other.

Dangers, both forgiving:
- **Running out of fuel:** distress beacon, tow back to the last depot visited. No game over.
- **The Sun's heat:** hull damage close to the Sun. Late missions (Mercury, a close solar pass) need the heat-shield upgrade.

### Difficulty levels

Chosen at the start, changeable from the pause menu.

- **Explorer:** no fuel limit, no heat damage. Story and scanning only.
- **Pilot:** fuel and heat on. Running dry means a free tow to the last depot.
- **Commander:** tighter fuel; the tow costs credits (debt if broke).

### Never-stuck rules (hard requirement)

The user's rule: "there always has to be a way to continue or get back to the previous checkpoint." Every Part 2 mechanic must be checked against it.

1. **"Return to last checkpoint"** is always in the pause menu, on every difficulty, in any state.
2. **Upgrades a mission requires are that mission's reward, never bought.** Credits only buy optional upgrades, so you can't spend yourself into a dead end.
3. **The tow always works.** On Commander, if you can't pay, you go into debt instead of being refused.
4. **Auto-save** when you dock or finish a mission.

### Save

The save is versioned (`SaveStore` with `migrate`). Part 1 is v1 (Codex only). Part 2 adds v2 (credits, upgrades, missions, depots, checkpoint, difficulty) and must upgrade v1 saves without losing the Codex. Any unreadable save falls back to a fresh one instead of crashing.

### Open questions for the design session

- Mission list and story beats per planet/moon; how many missions.
- Fuel numbers: tank sizes, burn rates for thrusters vs cruise, depot locations.
- Docking: how a depot/station looks and how you dock (fly into a zone? auto-dock?).
- Heat: damage model and what the shield allows.
- Upgrade list and prices.
- How Mission Control talks to the player (HUD messages, a panel, voice-less text).
- How fuel range shows on the map.

## Decisions already locked

- Flight: Newtonian + flight assist (Elite Dangerous style); no gravity.
- Moving bodies: local reference frames (sphere of influence carries the ship); orbits run at half speed while flying.
- Long distances: cruise drive with a distance-based speed cap; nav lock follows the target.
- Camera: chase by default, `C` toggles cockpit.
- The original free-orbit viewer is the Map (`M`).
- Ship built from Three.js primitives; no external models.
- Input is device-agnostic (`ControlState` + `FlightInput`), so new mechanics work on touch too.
- Architecture: feature folders, data-driven bodies, `main.ts` as composition root, explicit state machines, pure logic (flight, frames, scanning) with Vitest tests.

## How to continue

1. Brainstorm Part 2 with the user (one question at a time, using the open questions above).
2. Write `docs/superpowers/specs/<date>-campaign-design.md` and get it approved.
3. Implement, keeping the never-stuck rules and the device-agnostic input.
