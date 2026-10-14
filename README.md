# Ginseng Impact

A Genshin-style action RPG vertical slice for the browser, rendered as a cinematic dark-fantasy
world (full-res, soft shadows, bloom, drifting mist): cobalt skies, blue fog, a stone causeway toward a giant head with burning red eyes, cathedral
spires above a cloud sea, and glowing blue sunflower fields. The look follows the project skill in
`.claude/skills/ginseng-impact-design/`, which encodes the visual language of the @ozavry_ reels.

## Run

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm test           # vitest: controller, elements, combat, enemy brain, colliders, terrain
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
```

Deploy: the `dist/` folder is a static site. On Vercel, import the repo (framework: Vite) or run
`vercel` after `npm i -g vercel`.

## Controls

| Key | Action |
|---|---|
| Click | enter the fog (pointer lock); Esc pauses and releases the mouse |
| W A S D | move · Shift sprint |
| Space | jump · hold toward a wall or steep slope to climb · press in the air to deploy the glider |
| Left mouse | light attack (3-hit combo, third hit applies the character's element) |
| Right mouse (hold) | heavy attack: charge up to 1 s, release for a big elemental cut |
| E | elemental skill (Moonfall / Crimson Cleave / Starfall) |
| Q | burst when the meter is full (fills by landing hits) |
| R | dodge roll with invulnerability frames |
| F | talk to an NPC, or take an item drop (shards are collected automatically) |
| I | satchel: equip weapons, use consumables, drop items |
| 1 2 3 | switch character |

## Party and elements

| Character | Element (Genshin) | Weapon | Skill |
|---|---|---|---|
| Vesper | Lunar (Cryo) | sword | Moonfall: cone slash + frost ring |
| Morrow | Blood (Pyro) | greatsword | Crimson Cleave: cone + burning ground |
| Ashka | Astral (Electro) | staff | Starfall: chaining bolt |

Reactions: Lunar + Blood = **Eclipse** (burst), Lunar + Astral = **Conduit** (defence down),
Blood + Astral = **Overload** (knockback splash).

## Bosses, loot, trade and hiring

New in the third pass: **The Gorge Troll** (north-west gorge), **The Lake Lurker** (lily pond), **The Marsh Sovereign** (flooded
nave east of the river) and **The Hollow King** (seated colossus by the northern mountains, with a sky of watching eyes). The
log-hauling stone giant walks the village street and the chapel-carrying spider patrols the west woods; neither can be fought.

Six bosses with their own attack patterns roam the island: the Yeti (slam, boulders, roar) in the frozen grove, the Horned Shade
(volleys, summons, blink, sweep) in the dead forest, the Antlered Warden (root spikes, sweeps, slams) wading the great river, the
Moon Wyrm (frost breath, dives) circling the castle, the River Shade rising from the coven stream and the Pass Beast below the peak.
Each drops a mythic weapon plus a trophy and Moon Shards. Shards buy potions, charms, weapons and the Star Chart from Mirren,
Brother Croak, Mother Marrow and the Antlered King, or hire companions (Sir Aldous, the Vigil, Sir Halvard, the skeleton Rattle)
who follow and fight beside you. Every strike, loot pickup, coin, roar and spell is synthesised with Web Audio.

## Real models (Meshy)

`public/models/*.glb` are Meshy exports (image-to-3D from the reel frames in `docs/reference/frames/`, or text-to-3D), remeshed to
~30k triangles, rigged and animated with Meshy's preset library, then shrunk with `node scripts/model-tools.mjs optimize` (WebP
textures). The game swaps them in for the procedural builds at startup; delete a file to see the procedural version again. See
`public/models/README.md` for the per-file list and the pipeline, and `docs/reference/meshy-tasks.json` for the task ids.

Debug URL parameters: `?at=x,z` spawns the party there with free mouse-look (no pointer lock needed), `&face=x,z` aims the camera,
`&cam=x,y,z` pins the camera at a world position.

## Code map

```
src/core      fixed-step loop (hit-stop, advance() for scripted checks), input
src/render    composer pipeline (MSAA, bloom, grade), materials + wind, sky, atmosphere (mist, motes), palette
src/world     terrain, colliders, landmarks, biomes, settlements, water, creatures, NPCs, companions, World assembler
src/player    kinematic controller (ground/air/climb/glide), spring-arm camera, party
src/characters procedural low-poly rigs + roster
src/combat    elements/reactions, damage, combos, skills, enemies, boss rigs and attacks, projectiles, loot, VFX, CombatSystem
src/items     item definitions and the inventory
src/audio     procedural sound engine
src/ui        DOM HUD, minimap, element glyphs
src/data      world layout, enemy spawns
docs/superpowers/specs   design spec
```

`window.__ginseng` exposes the live objects; `__ginseng.game.advance(seconds)` steps the simulation
synchronously for scripted testing.

## World tour (everything from the reels)

Causeway to the giant head · cathedral in the frozen realm (ice crystals, dead trees, snow) · cliff castle
with waving banners and a rune gate · witch coven on the bridge over the glowing green stream · the Astral
Frog King in the mushroom hollow · the Moon-Shell Colossus crawling the east cliffs · rainy orchard with
glowing fruit and lightning · blue sunflower gardens and flower meadows · mountains beyond the cloud sea and
a climbable peak · fog wisps, stone sentinels and the red-eyed fog beast · nebula sky, shooting stars, and a
moon that sometimes grins.
