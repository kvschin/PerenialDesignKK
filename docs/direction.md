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
- **View Gardens** *(built)* — open, manage, and **Visit** saved gardens
  (read-only avatar stroll; Visit is offered here, not in the Design flow).

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
does well. The engine is great at *rendering a tile garden and walking an
avatar in it* — so lean into that, and skip the simulation-heavy systems.

## What survives the avatar idea: "Visit Gardens" (planned)

The charming part of Story Mode — a cat/dog walking a garden — survives as a
**lightweight, read-only stroll**, not a build/tend sim. It reuses what already
exists (the avatar `drawCritter`, tap-to-walk movement, the renderer, garden
loading); only the heavy systems are dropped.

- **Visit your own gardens** as an avatar: load any saved garden and walk it,
  read-only (editing HUD hidden). Nearly free — it's the existing avatar mode
  with editing off.
- **Visit a friend's garden** via **share-a-file**: a garden is just a JSON
  blob, so export yours → a friend imports it → they stroll it. **No backend.**
- **Live cross-device visiting** is deferred — that's the one piece that needs
  the small backend (the `sGet`/`sSet` constraint in CLAUDE.md).

Recommended build order: read-only "visit" of your own gardens first, then the
export/import sharing. Whether this *replaces* the current Story Mode menu entry
or sits alongside it is the open call to make when building it.

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
- A multiplayer backend / live cross-device play.
- Anything that pushes toward needing a real game engine.
