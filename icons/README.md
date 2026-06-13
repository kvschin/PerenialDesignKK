# HUD icons

The top-right HUD icon bar loads these five PNGs. Drop your icon files
here with exactly these names (square images, ~64–128px, transparent
background work best):

| File         | Button | Your art                          |
|--------------|--------|-----------------------------------|
| `list.png`   | List   | clipboard with leaf checklist     |
| `region.png` | Region | globe with location pin + leaf    |
| `rotate.png` | Rotate | recycle arrow around a potted plant |
| `photo.png`  | Photo  | camera with leaf + sparkles       |
| `plan.png`   | Plan   | rolled blueprint with plant beds  |

Until a file is present the button falls back to an emoji
automatically, so nothing breaks. Replace or rename freely — the
references live in `index.html` (the `.iconbar` buttons).
