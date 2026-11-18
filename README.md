# Vistamar — An Open-World Crime Story

[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/rahmad07/gta6-open-world/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/rahmad07/gta6-open-world/reward.svg)](https://make.fun/bounty/gta6-01)

An original 2D top-down open-world crime game, built for the
[make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01). Explore the
fictional coastal city of Vistamar on foot and by car, steal cars, outrun
the Vistamar police, and finish four story jobs for the fixer Delia Ramos.

Everything is invented for this game — the city, the characters, the story.
Nothing is taken from any commercial game.

## How to play

Serve the game and open it in desktop Chrome (no build step, no network):

```sh
node serve.ts
# open http://localhost:8080
```

| Key | Action |
| --- | --- |
| W A S D / arrows | Move on foot, drive the car |
| Shift | Run |
| Mouse | Aim |
| Click | Shoot |
| E | Enter / leave a car |
| Q | Start the next job |
| P / Esc | Pause |
| M | Mute |

## What's in the game

- **A city to explore** — Vistamar: eight blocks a side of roads, parks,
  a mall, a hospital, a police HQ, the Harbor Docks and Delia's Garage.
- **Traffic and pedestrians** — cars keep to their lanes and turn at
  intersections; pedestrians stroll the sidewalks and run from gunfire.
- **Cars to steal** — take a parked car, or jack one with a driver (if
  anyone sees you, the law hears about it).
- **A wanted level** — 0 to 5 stars. Patrol cars hunt along the roads and
  foot cops chase you down; get caught standing still and you're busted.
  Stay quiet and out of sight and the heat dies down.
- **Missions and a story** — four jobs: steal wheels for Delia, run a
  package through a police ambush, a timed midnight run, and the Harbor
  Job against armed guards. Each pays cash; the story ends in free roam.
- **Combat** — a pistol with mouse aim, armed guards, and police who
  shoot back when you shoot at them.
- **HUD with a minimap** — cash, health, wanted stars, the current
  objective with a timer, speed, and a live minimap with the mission
  marker, police and traffic.
- **Save / load** — progress saves to the browser after every job (and
  from the pause menu); the title screen offers Continue.
- **Polish** — a smooth camera that pulls back at speed, particles for
  shots, crashes and pickups, and fully synthesized WebAudio sound
  effects plus a looping music track. Mute with M.

## Files

- `game/index.html` — the page; `game/src/main.js` boots the loop.
- `game/src/city.js` — the seeded city: roads, blocks, landmarks.
- `game/src/world.js` — the world state and the one step that moves it.
- `game/src/player.js` — Jax on foot and behind the wheel.
- `game/src/traffic.js` — traffic cars and pedestrians.
- `game/src/police.js` — the wanted level and the police who answer it.
- `game/src/missions.js` — the four jobs and their steps.
- `game/src/render.js` — drawing the city and the menu screens.
- `game/src/hud.js` — the HUD, the minimap and the objective arrow.
- `game/src/audio.js` — synthesized sound effects and the music loop.
- `game/src/particles.js` — muzzle flashes, smoke, sparks, explosions.
- `game/src/input.js` — keyboard and mouse.
- `game/src/shots.js` — the deterministic `?shot=` scenes.
- `game/src/save.js` — localStorage save / load.
- `game/src/random.js` — the seeded random source.
- `game/src/config.js` — tuning numbers and colours.
- `main.ts` — hands the game in: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json` with the vendored make.fun library.

## Screenshots

Deterministic scenes, staged with `?shot=` and a fixed seed:

1. `1-drive.jpg` — driving through Vistamar, HUD and minimap up.
2. `2-chase.jpg` — a three-star police chase.
3. `3-mission.jpg` — "The Package" in progress, objective on the HUD.
4. `4-foot.jpg` — on foot, shots fired, pedestrians running.

## License

MIT — see [LICENSE](LICENSE).
