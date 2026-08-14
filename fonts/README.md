# Typefaces

Self-hosted so the app renders correctly offline, starts without a round trip
to a third party, and discloses no data to anyone. Declared in the `@font-face`
block at the top of `styles.css`.

| File | Family | Subset | Size |
| --- | --- | --- | --- |
| `fraunces-latin.woff2` | Fraunces | latin | 66 KB |
| `fraunces-latin-ext.woff2` | Fraunces | latin-ext | 58 KB |
| `ibm-plex-sans-latin.woff2` | IBM Plex Sans | latin | 45 KB |
| `ibm-plex-sans-latin-ext.woff2` | IBM Plex Sans | latin-ext | 30 KB |

Each file is the **variable** font for its family, not a static instance.
Google's CSS names one `@font-face` per requested weight, but those all point at
the same download — the three Fraunces weights the old CDN request asked for
were byte-identical (checksum-verified), which is why twelve files collapsed to
four. `styles.css` therefore declares the real weight range (`400 700` for
Fraunces, `400 600` for Plex) rather than three static instances, so an
in-between weight such as the menu headings' 650 renders at its true optical
weight instead of snapping to the nearest named one.

Only `latin` and `latin-ext` ship. The app has no Cyrillic, Greek or Vietnamese
copy, and `unicode-range` means a subset that is never referenced is never
downloaded in any case.

## Licensing

Both families are under the **SIL Open Font License 1.1**, which expressly
permits self-hosting, embedding and redistribution. The licenses must travel
with the files and are kept here as `OFL-Fraunces.txt` and
`OFL-IBMPlexSans.txt`. Neither may be sold on its own; both are fine inside a
paid application.

- **Fraunces** — Copyright 2018 The Fraunces Project Authors
- **IBM Plex Sans** — Copyright © 2017 IBM Corp., Reserved Font Name "Plex"

## Refreshing

These come from the Google Fonts CDN. To update, request the CSS with a modern
browser user agent (the UA decides whether you are served `woff2` or an older
format), pull the `latin` and `latin-ext` URLs, and replace the files in place —
the `@font-face` block needs no change unless a weight range moves.
