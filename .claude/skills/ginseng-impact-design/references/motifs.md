# Motifs — what the world is made of

Every landmark, creature and plant should be traceable to a reel. Proportions are in metres,
chosen so a 1.8 m character reads as tiny against them.

## Landmarks

| Motif | Reel | Build notes |
|---|---|---|
| **Giant Stone Head** | "Shadows Over the Ancient Lands" cover | 45–60 m tall, square jaw, flat planar cheeks, partly buried to the chin. Hollow eye sockets with `blood` emissive spheres (r ≈ 1.2 m) + additive glow sprites. Visible through fog from 300 m — the eyes are the first thing the player sees. Cracks as dark inset strips. |
| **Lonely Cathedral / Towers** | "The Lonely Towers of the Forgotten Realm", "Forgotten Castles Under Dark Skies" | Cluster of 3–5 spires, tallest ≈ 120 m, on a cliff edge above the cloud sea. Spires are stacked tapering boxes with a pyramid cap; arches are two boxes + a triangle. One `rune` portal-fire at the base door with a `PointLight`. Walls are `climbable`. |
| **Stone Causeway** | "Silent Kingdoms Beyond the Fog", "Beyond the Silent Mountains" | 6 m wide, 200–400 m long, dead straight, slight rise toward the monument, broken balustrade posts every 8 m, 2–3 flights of stairs. Centre it in the spawn view: perfect one-point perspective. Flanked by void or cloud sea. |
| **Cloud Sea** | cathedral cover | Three large planes at −20, −28, −40 m below the cliff, noise-alpha, `fog`-tinted, drifting 0.2 m/s. The player can glide over it. |
| **Waterfalls** | "Mystical Echoes of a Lost Realm" | Vertical planes with scrolling 16-px stripe texture, `moon` × `electric`, pouring off cliffs into the cloud sea. |
| **Dark Forest** | "Last Garden of Darkness", frog cover | Stacked-cone pines 8–15 m, `bark` trunks, canopy `abyss`. Dense at area edges to hide the world boundary. |
| **Glowing Sunflowers** | sunflower cover | 1.2 m tall, 8 flat petals in `electric`, `void` centre, `bark` stem, emissive petals + one glow sprite. Fields of 200+ in clearings. |
| **Moons** | all covers | Default silver `moon` disc at 25° elevation, angular size ≈ 8°, always placed behind the hero landmark. **Blood moon** (`blood`) swaps in during combat/boss. **Moon with a face** (canvas-drawn, grinning) is an easter egg for one hidden vantage point. |
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
