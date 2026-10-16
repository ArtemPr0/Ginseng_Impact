# Music

Drop a song here named after its slot, in any common format (`.mp3`, `.m4a`, `.ogg`, `.opus`, `.wav`, `.flac`,
`.webm`). The game finds it on the next reload. A slot with no file stays silent.

| Slot | When it plays | Song |
|---|---|---|
| `title-intro` | Once, when the game opens (the title screen) | Ginseng Strip 2002's original sample, *Heart of Asia* (youtube.com/watch?v=TjdNSIHFgZ8) |
| `title-loop` | Straight after the intro, on repeat until you click into the game | Yung Lean, *Ginseng Strip 2002* (instrumental) (youtube.com/watch?v=OYCM5TFb6Jg) |
| `kingdom` | On repeat while you are in Yung Lean's kingdom (without it, the kingdom's synthesised beat plays) | Yung Lean, *Ginseng Strip 2002* (youtube.com/watch?v=31lDgU90Yrg) |

- Silence at either end of a file is trimmed when it loads, so the intro runs into the loop with no gap and the loops
  repeat cleanly. To loop only part of a song, cut the file to that part.
- These files are git-ignored (the repo is public): only this README is committed.
- Browsers keep sound off until the first click or key press, so when the title music is present the title screen
  first says CLICK TO BEGIN (that click starts the music), then CLICK TO ENTER THE FOG.
