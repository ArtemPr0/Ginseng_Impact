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
| Left mouse | basic attack (3-hit combo, third hit applies the character's element) |
| E | elemental skill (Moonfall / Crimson Cleave / Starfall) |
| 1 2 3 | switch character |

## Party and elements

| Character | Element (Genshin) | Weapon | Skill |
|---|---|---|---|
| Vesper | Lunar (Cryo) | sword | Moonfall: cone slash + frost ring |
| Morrow | Blood (Pyro) | greatsword | Crimson Cleave: cone + burning ground |
| Ashka | Astral (Electro) | staff | Starfall: chaining bolt |

Reactions: Lunar + Blood = **Eclipse** (burst), Lunar + Astral = **Conduit** (defence down),
Blood + Astral = **Overload** (knockback splash).

## Code map

```
src/core      fixed-step loop (hit-stop, advance() for scripted checks), input
src/render    composer pipeline (MSAA, bloom, grade), materials + wind, sky, atmosphere (mist, motes), palette
src/world     terrain height field, height-field colliders, landmarks, flora, cloud sea, World assembler
src/player    kinematic controller (ground/air/climb/glide), spring-arm camera, party
src/characters procedural low-poly rigs + roster
src/combat    elements/reactions, damage, combos, skills, enemies, projectiles, VFX, CombatSystem
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
