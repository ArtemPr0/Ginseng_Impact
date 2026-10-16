# Music

A slot plays a track only if you have the rights to use it in the game: your own music, a track whose licence covers
use in games, or one the label and publisher have permitted. A store purchase or a streaming download is a licence to
listen, not to copy the recording into the game.

Drop the file here named after its slot, in any common format (`.mp3`, `.m4a`, `.ogg`, `.opus`, `.wav`, `.flac`,
`.webm`). The game finds it on the next reload. A slot with no file stays silent.

| Slot | When it plays |
|---|---|
| `title-intro` | Once, when the game opens (the title screen) |
| `title-loop` | Straight after the intro, on repeat until you click into the game |
| `kingdom` | On repeat while you are in Yung Lean's kingdom (without it, the kingdom's synthesised beat plays) |

- Silence at either end of a file is trimmed when it loads, so the intro runs into the loop with no gap and the loops
  repeat cleanly.
- These files are git-ignored: a licence to use a track in the game rarely covers republishing it in this public repo.
- Browsers keep sound off until the first click or key press, so when the title music is present the title screen
  first says CLICK TO BEGIN (that click starts the music), then CLICK TO ENTER THE FOG.
