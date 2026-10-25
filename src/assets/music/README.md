# Music

The game's music is its own: every song is synthesised at runtime by the score (`src/audio/Score.ts`, the tables in
`src/audio/songs.ts`), one per place, plus the boss layer and the ending. Nothing has to be put in this folder for the
game to have music.

## Two folders

- **`src/assets/music/` (this folder) is ignored by the game.** Files left directly here are never bundled, never
  played and never shipped, so it is safe to keep anything here. The build audit (`node scripts/music-audit.mjs`)
  only warns about them, by name.
- **`src/assets/music/licensed/` is the only folder that ships.** A file here plays in its slot if, and only if, it has
  a line in `licensed/LICENSES.md`. A media file in `licensed/` without a line fails the build.

## What may go in `licensed/`

Only a track you have the rights to use in the game: your own music, a track whose licence covers use in games
(CC-BY with credit, a game-music licence, a royalty-free pack bought for this use), or one the label and publisher
have permitted in writing. A store purchase or a streaming download is a licence to listen, not to copy the recording
into a game. Commercial recordings do not go in, ripped or bought.

Each track gets one line in `licensed/LICENSES.md`:

```
<file name> — <licence> — <source url> — <credit line>
```

for example `title-loop.ogg — CC BY 4.0 — https://example.org/track — "Night Road" by A. Composer`.

## Slots

Name the file after its slot, in any common format (`.mp3`, `.m4a`, `.aac`, `.ogg`, `.opus`, `.wav`, `.flac`,
`.webm`). The game finds it on the next reload. A slot with no file stays silent (the kingdom then plays the score's
own song).

| Slot | When it plays |
|---|---|
| `title-intro` | Once, when the game opens (the title screen) |
| `title-loop` | Straight after the intro, on repeat until you click into the game |
| `kingdom` | On repeat while you are in Yung Lean's kingdom (without it, the score's Lean Quarter song plays) |

- Silence at either end of a file is trimmed when it loads, so the intro runs into the loop with no gap and the loops
  repeat cleanly.
- Media files in both folders are git-ignored: a licence to use a track in the game rarely covers republishing it in
  this public repo. `LICENSES.md` is tracked, so the credits travel with the code.
- Browsers keep sound off until the first click or key press, so when the title music is present the title screen
  first says CLICK TO BEGIN (that click starts the music), then CLICK TO ENTER THE FOG.
