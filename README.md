# 3D Solar System

An interactive 3D solar system built with [Three.js](https://threejs.org/). Freely orbit and zoom around the whole system, or click any planet (or pick it from the list) to smoothly fly the camera in and see its key facts. This is phase 1 of a longer-term plan to expand into a galaxy / universe map — the data and camera architecture were kept generic on purpose so that extension doesn't require a rewrite.

## Features

- Free orbit, pan-free navigation: drag to orbit, scroll to zoom, all the way out to see every planet at once
- Click-to-focus: click a planet (or use the nav list) for a smooth, eased camera fly-in with a facts panel (diameter, distance from sun, day length, moons)
- Real relative planet sizes and textures, with orbital distances compressed so the whole system stays continuously navigable
- Saturn's ring, sun bloom glow, procedural starfield, loading screen gated on all textures being ready

## Tech stack

- [Three.js](https://threejs.org/) for the 3D scene, camera, and rendering
- [TypeScript](https://www.typescriptlang.org/) — strict mode
- [Vite](https://vite.dev/) for the dev server and build

## Getting started

```bash
npm install
npm run dev       # start the dev server
npm run build     # type-check and build for production
npm run preview   # preview the production build locally
```

## Project structure

```
src/
├── main.ts                 # entry point, owns the render loop
├── scene/                  # Scene, camera, renderer, lighting, starfield
├── bodies/                 # celestial body data model, scale/compression config, mesh factory
│   └── data/bodies.ts        # sun + 8 planets: real-world values (size, orbit, rotation, facts)
├── camera/                 # free-orbit controls + click-to-focus fly-to state machine
├── interaction/             # raycasting, hover, click/drag disambiguation
└── ui/                      # facts panel, nav list, loading screen
public/textures/            # planet and sun textures (see Credits)
```

`src/bodies/CelestialBody.ts` models a body as orbiting a generic parent (`parentId`) rather than hardcoding "planet orbits sun" — the sun is just a body with `parentId: null`. That's what makes a future moon, or a future galaxy of star systems, a data addition rather than an architecture change.

## Roadmap

Phase 1 (this repo): the solar system, as above. A future phase may expand this into a galaxy or universe-scale map, reusing the same generic body/orbit data model and camera fly-to system.

## Credits

Planet and sun textures by [Solar System Scope](https://www.solarsystemscope.com/textures/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
