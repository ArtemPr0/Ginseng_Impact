# Motifs — what the world is made of

Every landmark, creature and plant should be traceable to a reel. Proportions are in metres,
chosen so a 1.8 m character reads as tiny against them.

## Landmarks

| Motif | Reel | Build notes |
|---|---|---|
| **Giant Stone Head** | "Shadows Over the Ancient Lands" cover | 26 m tall (real-world scale, see SKILL.md rule 4), square jaw, flat planar cheeks, partly buried to the chin. Hollow eye sockets with `blood` emissive spheres (r ≈ 1.2 m) + additive glow sprites. Visible through fog from 300 m — the eyes are the first thing the player sees. Cracks as dark inset strips. |
| **Lonely Cathedral / Towers** | "The Lonely Towers of the Forgotten Realm", "Forgotten Castles Under Dark Skies" | Cluster of 3–5 spires, tallest ≈ 55 m (real-world scale), on a cliff edge above the cloud sea. Spires are stacked tapering boxes with a pyramid cap; arches are two boxes + a triangle. One `rune` portal-fire at the base door with a `PointLight`. Walls are `climbable`. |
| **Stone Causeway** | "Silent Kingdoms Beyond the Fog", "Beyond the Silent Mountains" | 6 m wide, 200–400 m long, dead straight, slight rise toward the monument, broken balustrade posts every 8 m, 2–3 flights of stairs. Centre it in the spawn view: perfect one-point perspective. Flanked by void or cloud sea. |
| **Cloud Sea** | cathedral cover | Three large planes at −20, −28, −40 m below the cliff, noise-alpha, `fog`-tinted, drifting 0.2 m/s. The player can glide over it. |
| **Waterfalls** | "Mystical Echoes of a Lost Realm", world-look-28, shot-012256 | `cascade()`: glowing blue strands pouring off floating islands, cliffs and pool rims, with mist, spray and a splash ring. |
| **Dark Forest** | "Last Garden of Darkness", frog cover | Stacked-cone pines 8–15 m, `bark` trunks, canopy `abyss`. Dense at area edges to hide the world boundary. |
| **Glowing Sunflowers** | sunflower cover | 1.2 m tall, 8 flat petals in `electric`, `void` centre, `bark` stem, emissive petals + one glow sprite. Fields of 200+ in clearings. |
| **Moons** | all covers, shot-013029/013056/013117 | Blue face-moons (Meshy `moon-laugh`, `moon-grin`) via `faceMoon()`: the island's is a laughing crescent at 25°, the kingdom's grins with glowing eyes, the dream has a spiral of them. **Blood moon** tints it red in combat. A **black sun** with a blue corona hangs over the spire castle. |
| **Star field** | moon covers | 1 500 `Points` in `moon`, size 1.5 px at low-res, no twinkle. |

## Creatures

| Motif | Reel | Role |
|---|---|---|
| **Stone Sentinel** | giant head | Enemy. 3 m miniature head on stubby legs, `stone`, `blood` eyes, slow heavy swing. |
| **Fog Wisp** | fog layers | Enemy. 1 m hovering diamond in `fog` + `electric` core, fires a slow `rune` bolt. |
| **Astral Frog King** | "The Astral Frog King" | Boss/NPC for later. 6 m frog speckled with `moon` stars, orange-red eyes — the single allowed warm accent in the world. |
| **Beast with red eyes** | hairy beast cover | Later boss. Only the eyes are seen in the forest at first. |

## Characters (party)

| Name | Reel anchor | Silhouette |
|---|---|---|
| **Vesper** (Lunar) | silver moons | Slim, long `cloth` cloak, crescent moon-blade in `moon`. |
| **Morrow** (Blood) | lone knight on the cliff | Bulky `bark` plate armour, `blood` rune strips on chest and blade, greatsword 2 m. |
| **Ashka** (Astral) | witches cover | Tall pointed hat, `dusk` robe, `witch` glow at the staff tip. |

## Composition rules

1. **Scale**: one small figure, one monumental thing. If the player is more than 1/12 of frame
   height in the hero shot, the landmark is too small.
2. **Horizon low**: the sky and fog take the upper 60% of the frame.
3. **Path leads the eye**: causeways, stairs and bridges run straight toward the focal landmark.
4. **Depth by fog**: at least three distance bands visible — near (lit), mid (`ultramarine`),
   far (`fog` silhouette).
5. **One red**: a single `blood` focal point per view (eyes or moon), never both at full intensity.
6. **Everything is old**: broken posts, buried bases, moss as `witch` vertex tint, no clean edges.

## Characters and mobs — construction rules (post-rework)

- Humanoids: `CapsuleGeometry` limbs with a joint group at elbow/knee; capsule torso and pelvis; sphere head;
  hood, helmet (sphere + visor + crest) or witch hat; shoulder pads; belt torus; CPU-animated cloak plane
  (10 rows) that streams back with speed; weapons with a metal blade, emissive edge, guard, grip; staff orb with
  orbiting crystals. Never plain boxes for bodies.
- Animation: phase-driven walk/run with knee and elbow bends, lean with speed, landing crouch, climb reach,
  glide spread, attack wind-up → eased cut → settle, alternating sides; staff thrust. Exponential blending.
- Wisp: emissive core + two translucent shells + 6 orbiting glow sprites + 10-sprite position trail.
- Sentinel: `rockify`'d body/head/shoulders/fists, capsule limbs, pulsing rune cracks, stomp dust and shake.


## Round 5 motifs (the user's frames, 2026-10-16)

| Motif | Frame | Where / how |
|---|---|---|
| **Eye vortex pool** | world-look-28 | `eyePool()` where the road from the spawn crosses the river; also the dream's canal village. |
| **Arched wooden bridge with candles** | world-look-28 | `archBridge()` + chasm-bridge tiles pitched along the arch, candles on every other post. |
| **Glowing blue mushrooms** | world-look-28, shot-012256 | giant-mushroom / purple-mushroom with `patchGlowCap`; the road's giants are bouncy. |
| **Floating rock islands with dead trees** | world-look-28, shot-012256 | `floating-island` (Meshy) pouring cascades; skull islands with burning castles in the dream. |
| **Blue cyclops** | world-look-28, shot-011654 | `cyclops` wading at the eye (neutral boss), `cyclops-lord` at the end of the Alley of Graves. |
| **Graveyard alley** | shot-011654 | the Alley of Graves realm behind the demon church: walls, raised grave plots, purple fog, amber storm. |
| **Forest gorge to a black spire** | shot-011636 | carved NW gorge: head fall, stream, stone bridge, pines on ridges; the spire castle rises from the cloud sea. |
| **Red spiky eyeball** | shot-013226 | `blood-eye` boss over the chasm, living iris (`EyeIris`), glare/thorns/beam. |
| **Rainbow wizard** | shot-013245 | `trip-wizard` (galaxy-wizard in the trippy shader) flying in the dream; spells trip the screen. |
| **Watching sky eyes** | user request | `SkyEyes`: blink, follow, moods, hurt then angry when shot. |
| **Flying whale over white flowers** | DeSEl9PvPG_ | `whale` looping over Yung Lean's plaza; the white meadow on the island. |
| **Tiered koi pools** | DeSEl9PvPG_ | three pools stepping down to the eye, cyan spills, koi circling. |
