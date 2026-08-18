# The demo garden

`demo-garden.json` at the repo root is the small finished garden a first-time
gardener is offered on launch. It is **an ordinary exported garden file** —
byte-identical in shape to what the Share button writes — and that is the whole
design. It needs no bundled format, no seeding code and no special loader:
`openDemoGarden()` fetches it and hands it to `installWorldBlob()`, the same
validator a friend's shared file goes through.

Which means **replacing it is a gardening job, not a programming one.**

## Replacing it (the way you should)

1. Open the app and design the garden you want a stranger to meet.
2. Garden menu → **Share garden**. That downloads a `.json`.
3. Rename it `demo-garden.json` and drop it in the repo root, replacing the old
   one.
4. Commit. Bump `APP_VERSION` in `js/core.js` and `VERSION` in `sw.js` together
   so the service worker retires the cached copy — otherwise installed users
   keep the old garden.

Nothing else needs to change. The file's `name` is overwritten to "Demo garden"
at install time, so whatever you called it while designing does not matter.

## Rebuilding it from nothing

`dev/make-demo-garden.js` regenerates the current one:

```bash
node dev/make-demo-garden.js
```

It loads the real app modules in the test sandbox and calls the app's own
`buildSaveBlob()`, so it cannot drift from the save format. The layout is
seeded (`mulberry(20260815)`), so a rebuild that changes no code produces no
diff.

This exists so the file can be recreated if it is ever lost, and so the first
version had a defensible starting point. **It is not the better path.** Planting
by hand produces a better garden than ellipse arithmetic does, and the garden is
the app's shop window.

## What the current one is trying to do

A 41 ft square, 323 plants across 21 species, opening in **late summer** with
about 43% of the planting in flower — coneflower, bergamot, rattlesnake master,
phlox, yarrow, mountain mint, allium, stonecrop and moor grass all going at
once. (`dayOffset` is 28; `DAYS_PER_SEASON` is 16, so Spring is 0–15, Summer
16–31, Fall 32–47, Winter 48–63. It is easy to overshoot into the wrong year.)

- **A path that bends**, sweeping in from the south edge — so the plot reads as
  something you walk into, not a rectangle of planting.
- **Beds as overlapping lobes**, never rectangles, with organic edges on.
- **A grass matrix with feature drifts through it** — the two-layer
  interplanting the Matrix brush exists to produce, shown rather than explained.
- **Three small trees** (serviceberry, flowering dogwood, redbud) for vertical
  scale and to put the flowering-tree work in front of a new gardener.
- **A cat and a boulder**, which say "there is more in here than plants" without
  a word of tutorial text.

Two constraints worth keeping if you re-author:

- **Keep drift centres off the path.** A drift that straddles it gets clipped to
  a handful of tiles and reads as a mistake rather than a planting.
- **Keep it small.** It is precached by the service worker and fetched on first
  launch. The current file is ~30 KB; a site photo would add roughly a megabyte
  to every install, for a garden the user did not make.

## The first-run offer

`maybeOfferDemoGarden()` in `js/screens.js` shows the prompt when
`hortus:welcomed` is unset **and** the device has no saved gardens — having
gardens is the stronger signal, so a returning gardener who cleared their
preferences is not greeted as new. Either answer sets the flag, so the offer
appears exactly once. Declining lands on the main menu.

To see it again while developing:

```js
localStorage.removeItem('hortus:welcomed')
```

…and delete any saved gardens, or the second condition suppresses it.

## The coach beats

Showing the prompt also sets `hortus:coach:armed`, which is what turns on the
onboarding tips in `js/ui.js`. They fire on what the gardener does, not on a
step counter:

| Beat | Fires when | Says |
| --- | --- | --- |
| 1 | entering an EMPTY garden | pick a plant, tap the ground |
| 1b | entering a garden that already has ≥20 plants | this planting is done — have a look around |
| 2 | the **first** plant is placed | drag to plant several; Drift scatters them |
| 3 | the **fifth** plant placed, **or** 45s in an already-planted garden | hold the season box and run the year |
| 4 | the **fifteenth** plant is placed | the planting list is a nursery order — tap to open it |

Beat 1 has two forms because the demo path is the primary first run. Telling
someone who just opened a finished 323-plant garden to "tap the ground to plant"
instructs them to deface the example they were handed to admire — so a garden
that arrives with ≥20 live plants gets the look-around wording instead.

Beat 3 is the point of the whole app, so it waits until there is a planting
worth watching change. It is the pre-existing time coach, re-timed — it used to
fire 900 ms after entering a garden, where it named a control attached to
nothing yet. Its **second trigger matters as much as the first**: the counter
only moves on planting, so a gardener who opened the demo purely to look would
otherwise never meet the seasonal loop, which is the one thing this app does
that nothing else does.

Beat 4 is the commercial one. Nothing anywhere told anyone the planting list
existed, and it is the feature that turns a drawing into a nursery order — the
thing worth paying for. The tip is **tappable** and opens the list, because
naming a buried menu row and then vanishing is barely better than silence.

The counter comes from `plantFx`, which only `placePlantAt`'s success path
calls. Undo, paste and loading a garden do not, so opening the 323-plant demo
garden starts the gardener at zero rather than skipping straight past beat 3.

Arming on the *prompt* rather than on its answer is deliberate: someone who
declines the demo and starts from scratch is exactly as new. To replay them:

```js
Object.keys(localStorage).filter(k=>/^hortus:coach/.test(k)).forEach(k=>localStorage.removeItem(k))
```

then re-arm with `armCoach()`, or clear `hortus:welcomed` and reload to get the
whole first run.
