# Pocket Prairie Garden Design — agent guide

## Canonical project specification

`CLAUDE.md` is the authoritative, current specification for this application.
Read it in full before changing the app. It contains the product direction,
architecture, data-model contract, interaction rules, renderer performance
constraints, woody-plant policy, testing guidance, and roadmap.

This guide deliberately does not duplicate that evolving technical
specification. Duplication had allowed this file to drift: the former
story-first product description and its associated assumptions are obsolete.
When this guide and `CLAUDE.md` appear to conflict, **`CLAUDE.md` wins**. When
an app change affects an enduring convention or architecture decision, update
`CLAUDE.md` and keep this guide conflict-free.

Current product direction, for orientation:

- Pocket Prairie Garden Design is a design-first, 2.5D naturalistic garden
  planner. The primary experience is **Design a Garden**.
- New gardens start only in `gameMode: 'design'`: blank plot, direct placement,
  free camera, and no avatar or house.
- The old story flow is retired from the creation menu. `gameMode: 'story'`
  remains only for read-only **Visit** of saved/imported gardens and legacy
  story saves.
- The menu also provides Daily design challenge, Plant Library, and View
  Gardens. `plant-creator.html` is a dev-only, direct-entry plant-authoring
  tool and is not linked from the game.

## Working rules

- This is plain HTML, CSS, and JavaScript: no framework, bundler, build step,
  or new remote dependencies unless explicitly requested.
- `index.html` script order is a runtime contract. `js/plants.js` must load
  first; preserve the module order in `CLAUDE.md`. Earlier modules must not
  call later-module functions at load time.
- Use the centralized state and tool pathways documented in `CLAUDE.md`:
  `setTile`/`clearTile` and related mutation helpers; `toolMeta()` as the tool
  contract; `applyToolAt()` for placement/material dispatch; and batched sync
  after gestures.
- Mobile and deterministic canvas rendering are first-class constraints. Keep
  canvas touch handling intact, test gesture changes on a phone where possible,
  use seeded visual variation, and keep expensive work out of the frame loop.
- For routine verification, run `node --check` on each touched module and
  `node tests/run.js` (or `npm test`). Browser-test load-order-sensitive
  changes as well.
- Preserve unrelated work in a dirty worktree. Keep changes local, and do not
  rewrite the app without explicit scope.

## Plant data, catalog, and library changes

Follow the full `PLANTS` schema, units, footprint policy, renderer guidance,
and Sedge rules in `CLAUDE.md`. In particular, distinguish real-world inches
(`space`, `spread`, and `heightIn`) from pixel art (`h`, `cw`); use shared woody
size helpers rather than introducing parallel conversions. Plant accuracy,
seasonal structure, and meaningful garden roles matter more than novelty.

For broad or design-sensitive plant-library/catalog work, use only the
reviewer agents relevant to the change. Keep implementation with the main
agent unless a modification is clearly isolated.

- **Botanical Data Reviewer**: verifies names, duplicates, hardiness ranges,
  dimensions, sun/moisture needs, and factual plant data.
- **Landscape Design Reviewer**: evaluates planting roles, matrix/structure/
  filler behavior, seasonality, and category balance.
- **Visual Morphology Reviewer**: evaluates whether previews communicate real
  plant form and proposes renderer archetypes or parameters.
- **Catalog UX / Mobile Reviewer**: evaluates tray organization, labels,
  filters, mobile behavior, scroll behavior, and readability.
- **Codebase Schema Inspector**: identifies affected files, data-model
  constraints, validators, renderers, and test coverage.
- **QA / Regression Reviewer**: conducts a read-only final review after the
  implementation is complete.

Do not spawn every reviewer by default. Select the smallest relevant set for
the task, and use QA only as a read-only final pass.
