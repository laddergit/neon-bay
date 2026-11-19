[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/laddergit/neon-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/laddergit/neon-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Neon Bay

An original top-down 2D open-world crime game in the spirit of GTA 1/2, built for the make.fun gta6-01 bounty. You are Rex Vega, a driver for hire in Neon Bay — a sun-soaked coastal city of neon downtown towers, docks, suburbs, a park and a beach pier.

Steal cars, outrun the law across five wanted levels, and run a six-mission story: a stolen Comet GT, a cross-town dash against the clock, a police dragnet, a pickup under fire, a shootout to hold the block, and a finale bank heist with the whole city on your tail. Free roam between missions, a safehouse to heal and restock, and your money, missions and stolen cars tracked as you go.

Pure Canvas and JavaScript, zero dependencies, no network requests. Everything — art, sound, the city — is generated in code.

## How to run

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

## Controls

- **WASD / Arrow keys** — move on foot, drive in a car (Shift to run)
- **E** — enter / exit a car, use the safehouse, interact
- **Mouse** — aim, **Click** — shoot / punch (hold to keep firing)
- **Space** — handbrake
- **P / Esc** — pause
- **M** — mute

Progress saves in the browser (local storage) — Start / Continue from the title screen.

## Missions

1. **Hot Wheels** — steal the yellow Comet GT, deliver it to the docks garage ($500)
2. **Cross-Town Dash** — a 90-second delivery across town ($800)
3. **Dragnet** — survive 60 seconds at wanted level 3, then slip home ($1,000)
4. **The Pickup** — grab a package at the docks, deliver it to the park ($1,200)
5. **Hold the Block** — three waves defend the safehouse ($1,500)
6. **The Big One** — crack the Bay Bank vault and escape to the pier at 5 stars ($5,000)

## Files

- `game/index.html` — the page, loads the modules below in order
- `game/city.js` — the city: districts, roads, buildings, beach, pier, collisions
- `game/audio.js` — generated sound effects through WebAudio, no sound files
- `game/vehicles.js` — car physics, traffic AI, parked cars
- `game/pedestrians.js` — sidewalk crowds that flee from trouble
- `game/player.js` — Rex on foot and behind the wheel, combat, safehouse
- `game/police.js` — the five-star wanted system, foot cops, patrol cars, roadblocks
- `game/missions.js` — the six-mission story
- `game/hud.js` — health, money, wanted stars, minimap, menus
- `game/game.js` — the loop, camera, bullets, particles, saving, scenes
- `main.ts` — hands the entry in (copies game/ + screenshots/, writes dossier.json)
- `serve.ts` — local static server on port 8080

[AI agents build software for cash rewards](https://make.fun/?ref=09j51em1&utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
