# Pocket Prairie — direction & decisions

> A short record of where the project is heading after the mid-2026 scope
> pivot. Supersedes the old "Story Mode design" doc (a sprawling build-out
> plan that was cut — see below). Keep this current; it's the why behind the
> shape of the app.

## What the game is

A **garden-design tool first**, with light, calm engagement around it. The core
is **Design a Garden** — a serious, Procreate-style planner for laying out a
real perennial planting (zone/style/native filters, the full plant palette,
planting list + plan export). Accuracy matters; Kevin grows these.

Around that core:
- **Daily design challenge** *(built)* — a date-seeded planting prompt on the
  main menu (everyone gets the same one each day, no backend). Prompt-only: it
  *suggests* a style + plant types and drops you into Design mode. Nothing is
  scored or enforced. Prompts live in `DAILY_CHALLENGES` (game.js).
- **Plant Library** *(built)* — browse every species.
- **View Gardens** *(built)* — open, duplicate, share, and manage saved gardens.

## The pivot (what was cut, and why)

A large **Story Mode** was explored: an Animal-Crossing-style avatar game where
you forage seed, propagate it (cold-stratify over winter), grow plants out, run
NPC garden commissions, visit a town/shop with an economy, and travel a
multi-location world. The seed-propagation slice was **actually built** (sow →
stratify → grow → plant, with a potting-bench UI) and then **reverted**.

Why cut it: no single piece was impossible in the current plain-HTML/canvas/
no-framework engine, but the **sum** — NPC behavior, dialogue, quests, an
economy, a living town, world-scale save/sync — is a pile of bespoke systems
you'd get for free in a real game engine (Godot/Unity) and hand-roll here. Not
worth a months-long build or an engine switch for this project's goals.

**The lesson that shapes the roadmap:** stay scoped to what the current engine
does well. The engine is great at *rendering a tile garden* — so lean into that,
and skip the simulation-heavy systems.

## The avatar's second life, and its end (Aug 2026)

For a while the charming part of Story Mode — a cat/dog walking a garden —
survived as **Visit Gardens**: a read-only stroll through a saved or imported
garden, reusing `drawCritter`, tap-to-walk movement and the renderer with the
editing HUD hidden. It shipped, and it has now been **removed**.

Why: Visit was the last thing keeping the avatar alive, and the avatar was
paying for itself in permanent complexity — a second game mode branching the
renderer, camera, input, tap handling, placement rules and save format, all so
one read-only feature could exist. Every design feature had to be written twice
or guarded against a mode nobody starts in. The planner is the product; a garden
is read by looking at it, not by walking a dog through it.

What went with it: `gameMode` entirely, `drawCritter` and `COATS`, the character
creator, tile-to-tile movement (`tryMove`/`stepMove`/`followPath`), door-sleep,
multiplayer presence avatars, and `game.visiting`. Legacy story saves now open
in the planner, keeping their house and plants.

Multiplayer followed it out the same month. The shared-garden lobby had never
worked across devices — "shared" keys were just localStorage, so two tabs of one
browser was the whole feature — and once the avatar was gone there was nobody to
see in a shared garden anyway. Removing it took the lobby and code screens,
host/join, the polling merge, and the eight per-layer sync flushes that every
editing gesture used to end with.

What survives: **share-a-file**. A garden is just a JSON blob, so export yours
→ a friend imports it → they open it in their own planner. **No backend**, and
that is now the deliberate end state rather than a step toward one. If live
collaboration is ever wanted it starts from a real server behind `sGet`/`sSet`,
not from the tab-local scaffolding that was removed.

## The cat and dog came back (as furniture)

The avatar art was the one part of Story Mode people actually liked, so it
returned as a **garden pet**: a one-tile decoration you place, in either
species with six coats and three markings. It never moves and it claims
nothing — you can plant right where it sits — which is the point. It is also
deliberately kept off the **design plan and the planting list**, the two
documents a client sees; a cat is for the gardener, not for the drawing.

## Tooling

- **Plant Creator** (`plant-creator.html`) — a dev-only tool (not linked from
  the game, opened standalone) that loads the real `plants.js`/`game.js` and
  uses the actual `drawPlant` for a live, pixel-accurate preview while authoring
  a `PLANTS` entry: every field, per-season colour pickers, a shape gallery,
  `look`-parameter sliders (incl. foliage), a per-plant draw-cost meter, and
  copy-paste code output. The model: **tooling is dev-gated; content (species,
  authored maps) ships as committed data.**

## Out of scope (for now)

- Story Mode's build-out: propagation, NPCs, town/shop, economy, multi-location
  world. (Parked, not deleted from history — this doc is the record.)
- Multiplayer of any kind: live cross-device play, or the tab-local lobby that
  stood in for it (removed Aug 2026).
- Anything that pushes toward needing a real game engine.
