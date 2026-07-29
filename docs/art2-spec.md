# ART2 art pass — implementation spec

Read this before touching `drawPlant`. It is the contract for the botanical art
pass. It exists so each wave of work starts from the same primitives, the same
performance rules, and the same calibration method instead of re-deriving them.

The prototype (five *Echinacea*, `form:'cone'`) is landed and validated. This
spec generalises it to the rest of the catalog.

## 1. What the pass changes, and why

The classic renderer draws plants with **constant-width strokes and flat
fills**. That is what reads as "diagram" rather than "plant". Three changes fix
most of it, in order of how much they move the needle:

1. **Leaves are shapes, not strokes.** The classic fallback draws every species
   as the same fan of identical stroked quadratics. A constant-width stroke *is*
   a grass blade — correct for `bunchgrass`, wrong for a coneflower.
2. **Every fill carries a value gradient.** Flat fill is the strongest
   "this is a diagram" signal in the render.
3. **Clumps have depth.** Stems get a z, root further back, recede, and paint
   back-to-front instead of in loop order.

## 2. The two gates

Both must pass before any ART2 code runs:

| Gate | What it is |
| --- | --- |
| `ART2.on` | Master switch. On by default; **`?art2=0`** turns the whole pass off so the app can be A/B'd without editing code. |
| `look.art2` | **Per-species opt-in.** Without it a species keeps its classic art. |

Always test with `art2On(L)`, never `ART2.on` directly. `L` is the resolved
`P.look` object, in scope in every form branch.

This means rollout is one data key at a time — a half-finished form branch is
safe to commit, because species that have not opted in are untouched.

> **The cultivar trap.** `plantDef` does `Object.assign({}, base, cultivar)`, so
> a cultivar declaring its own `look` **replaces** the species `look` wholesale
> rather than merging. `Echinacea 'Magnus'` declares one, so it needed every
> ART2 key repeated. **Any species you opt in must have its cultivars checked.**
> A cultivar with no `look` of its own inherits correctly and needs nothing.

## 3. Primitive API

All in `js/draw.js`, above `drawPlant`. **Do not modify these.** If a form
branch needs a new *shared* primitive, add it in a clearly marked block at the
end of the primitives section and say so in your report, so it can be reconciled
against the other waves rather than duplicated three times.

```js
art2On(L)                                  // the gate — always use this
LIT                                        // {x,y} unit vector TO the light (upper left)

litFill(ctx, cx, cy, r, col, lift, drop)
  // Fills the CURRENT path with a value gradient along the light axis.
  // r = the shape's rough radius. Below GRAD_MIN_R (6) it flat-fills instead:
  // a 3-stop gradient is invisible at that size but still allocates a
  // CanvasGradient per shape per frame. lift/drop default +26/-30.

ribbonPath(ctx, x0,y0, cx,cy, x1,y1, prof, hw, teeth, tn)
  // Tapered ribbon along a QUADRATIC spine. Builds leaves AND ray florets;
  // only the width PROFILE differs. `prof` is a baked Float64Array table
  // (see §4), `hw` scales it, teeth/tn serrate the margin (0 for none).
  // Leaves the path current — follow with litFill.

drawLeaf(ctx, bx,by, tx,ty, hw, col, opt)
  // One leaf, base -> tip, filled + gradient + midrib.
  // opt: {shape, teeth, teethN, bow, rib, lift, drop}
  //   shape  — key into LEAF_SHAPES: 'linear'|'lance'|'ovate'|'cordate'
  //   bow    — sideways curve of the spine (0.06 default-ish)
  //   rib    — false to suppress the midrib (use for grass blades)

drawRay(ctx, cx,cy, ang, len, hw, droop, col, opt)
  // A ray floret: strap that swells past the base, tapers to a soft tip,
  // droops away from the centre. opt: {vein, lift, drop}

drawConeDome(ctx, cx,cy, rw,rh, col, rnd)
  // Domed, bristly head. Contrast is deliberately HALF what reads well in
  // isolation — at full strength the cone detaches and floats as its own
  // object. Do not raise it. The bristle lift is halved with it for the
  // same reason.

drawFloret(ctx, cx,cy, r, col, opt)
  // Small lit blob with a highlight offset toward the light. This is the
  // replacement for the flat `ctx.arc`/`ctx.ellipse` fills that spike,
  // umbel, globe and panicle heads use. opt: {squash, lift, drop}

/* ---- added by Wave B (grasses & sedges) ---- */

drawBlade(ctx, bx,by, cx,cy, tx,ty, hw, col, lit)
  // One grass/sedge blade along an EXPLICIT quadratic (drawLeaf derives its
  // control point from `bow`, a perpendicular offset, which cannot express the
  // hand-tuned arch/sweep/cascade the grass branches already carry). Monotone
  // taper from the sheath, baked at 6 steps rather than 10, no midrib.
  //
  // It deliberately does NOT call litFill. Measured: filling a blade-sized
  // path through a 3-stop gradient costs 14.5us vs 3.8us flat, and the cost is
  // the gradient SHADER, not the allocation (creating the object is 0.7us).
  // A bunchgrass draws 13-34 blades, so per-blade gradients alone put little
  // bluestem over the 5x budget. Instead the blade is a dark body plus a lit
  // sliver (BLADE_LIT, a second baked profile that nests inside BLADE_PROF on
  // the same spine) — ~5.6us, and on a near-vertical blade a gradient along
  // the light axis IS just a lighter tip. `lit:false` skips the sliver; the
  // shadowed skirt of a clump has no lit face to show, so it costs one fill.

fanIdx(k, n)  // outermost-first fan order: 0, n-1, 1, n-2, ... centre last
  // The classic loops run left to right, so the rightmost blade always
  // over-paints the clump and a tuft reads as a flat comb. Walking in from
  // both edges makes it read as a dome, and because depth then tracks |side|
  // the recession is arithmetic — no {z} records, no comparator, no sort, so
  // the hot path stays allocation-free.
// --- added by Wave A -------------------------------------------------------
fcPush(x, y, r, squash)          // stage one blob in module-level scratch
fcDraw(ctx, col, lift, drop)     // paint the staged cluster, then reset
fcReset()                        // abandon a staged cluster
  // Batched floret cluster: a whole same-coloured spray as TWO fills — every
  // body, then the highlights of only the blobs big enough to resolve one.
  // drawFloret is right for a head you can count on one hand; this is for a
  // spray. A rough goldenrod draws ~360 panicle dots, an aromatic aster ~48
  // disc florets, a moss phlox ~110 petals: at 2 fills per blob those are
  // unaffordable, and at r≈1.2 the highlight is invisible anyway. Cost is 2
  // fills for any n, so the value gradient arrives while the op count goes
  // DOWN. Nothing allocates. Overflow past FC_MAX (96) is dropped, not grown.
```

### `LEAF_SHAPES`

| key | silhouette | typical use |
| --- | --- | --- |
| `linear` | near-parallel sides, blunt tip | grass blades, *E. pallida*, iris straps |
| `lance` | widest at ~1/3, tapered point | most prairie forbs |
| `ovate` | broad, widest near middle | *E. purpurea*, aster, woodland forbs |
| `cordate` | broad heart-shaped base | violets, some woodland species |

Add a shape only if several species genuinely need it — a new entry costs a
baked table and another thing to keep calibrated.

## 4. Performance rules — non-negotiable

The prototype's first cut was **9.1× the classic cost**, while its draw-op count
was only 2.4×. The gap was **per-frame allocation**, not painting. Sway means
every frame is a fresh procedural frame, so anything allocated per shape is
allocated tens of thousands of times a second. This is the same GC-churn stutter
the persistent scene list was built to eliminate; do not reintroduce it.

Rules, all of which the current primitives already follow:

1. **No allocation in a per-shape path.** No `[x,y]` tuples, no arrays, no
   closures per shape. `ribbonPath` writes into module-level `Float64Array`
   scratch (`_ribA`/`_ribB`).
2. **Bake width profiles at load.** A fractional `Math.pow` in the sample loop
   was the single most expensive call. Sample steps never change, so evaluate
   once at module load into a `Float64Array` and index it.
3. **`Math.sqrt`, never `Math.hypot`.** hypot does overflow-safe scaling nobody
   needs at these magnitudes and costs several times more.
4. **Gradients only where visible.** Below ~6px radius use a flat shade.
   `litFill` handles this; do not hand-roll gradients that bypass it.
5. **Batch strokes that share a style.** One `beginPath`, many
   `moveTo`/`lineTo`, one `stroke`.
6. **Second passes must earn their place.** A vein or midrib on a sub-pixel
   shape is invisible but costs a whole path+stroke per shape per frame. Gate
   them on size.

### Budget

Measure with the harness in §6. Per plant, procedural, full bloom:

| | Target |
| --- | --- |
| Ratio vs classic | **≤ 5×**, ideally ≤ 4× |
| Absolute | **≤ 0.20 ms** for a dense forb; less for simple forms |

Above ~5× and you are eating the headroom the sprite governor needs. Note that
the governor engaging is *good* — a 42-plant garden measured 8.6 ms/frame with
ART2 (sprites engaged) vs 14.3 ms classic (sprites not engaged), because the
heavier art trips the 6 ms threshold and everything then blits. But do not rely
on that; keep the procedural path honest for small gardens that never trip it.

## 5. Units — do not confuse these

Straight from `CLAUDE.md`; the art pass must not blur the line.

- `space`, `spread`, `heightIn` — **real inches**. Rules, exports, footprints.
- `h`, `cw` — **pixels**. Drawing hints only. Read through `plantVisualH(P)` /
  `woodyVisualCw(P)`, never raw.
- ART2 `look` keys are **display-only**. They must not change placement,
  spacing, shade, footprint, or any exported quantity. If a change you make
  alters what can be planted where, it is wrong.

### ART2 `look` keys

| key | meaning |
| --- | --- |
| `art2` | **required** — the per-species opt-in |
| `leafShape` | `LEAF_SHAPES` key |
| `leafHW` | half-width multiplier on the existing `leafW` (~1.3–2.0) |
| `leafFan` | angular spread of the basal fan, radians (~1.2–1.9) |
| `leafRise` | how much the fan rises vs splays (default 0.74; raise for upright) |
| `leafTeeth` / `leafTeethN` | serrated margin, and how many teeth |
| `leafBow` | sideways curve of the leaf spine |
| `leafRib` | **added, Wave A** — `false` suppresses the midrib. For anything thread-fine or grass-like: on a 2px blade the midrib is an invisible stroke charged every frame |
| `floretR` | **added, Wave A** — umbel floret radius (default 1.5). A phlox floret is not a milkweed floret is not a *Zizia* floret |
| `a2Spike` `a2Florets` `a2FloretR` `a2FloretSq` `a2Wobble` | **added, Wave A** — the unstyled `spike` raceme: length as a fraction of drawn height, floret count, radius, squash, and side-to-side wander. 20 species share that branch (salvia, camassia, muscari, astilbe, lizardtail…) and classic drew the same five stacked ellipses for all of them |

Added by Wave B (grasses & sedges), all read only inside `art2On` branches so
`?art2=0` renders exactly the classic art:

| key | meaning |
| --- | --- |
| `bladeHW` | half-width multiplier on the existing `leafW` (default 0.85). Note this is a HALF-width against a `lineWidth`, and the taper averages 0.64 of peak, so 0.85 is roughly equal ink to the stroke it replaces. Going much below ~0.7 visibly thins a drift. |
| `bladeShade` | how much the shaded skirt of a clump darkens (default 16–19 by form) |
| `culmHW` | as `bladeHW`, for `turkeyfoot`'s flowering culms |
| `cloudSquash` | squash on `cloudgrass` panicle spikelets |
| `plumeStyle` | `vertgrass` inflorescence: `fan` (miscanthus, silky), `spike` (Karl Foerster, tight vertical), `open` (indiangrass, loose panicle) |
| `plumeLen` | plume height as a fraction of drawn height |

Add new keys only when a real species needs one, and document it here.

> **`leafHW` means something different in the `shrub` form.** Everywhere else
> it scales a stroke width. In `shrub` the habits site a leaf as an ellipse and
> hand `drawLeaf` the *minor semi-axis*, while the leaf's length is twice the
> major one — so the sane way to pick it is `leafHW = ratio * leafW / leafH`,
> with ratio ≈ 0.24 linear, 0.32 lance, 0.42 ovate, 0.50 cordate. Set to the
> 1.3–1.6 that works in the other forms, every leaf comes out wider than it is
> long: a mound of perfect circles, i.e. exactly what classic already drew.

## 6. How to verify — required before reporting done

1. `node --check js/draw.js && node --check js/plants.js`
2. `node tests/run.js` — must stay at **196 passed, 0 failed** (or more, if you
   add tests; never fewer).
3. **Scope proof.** Render every species+cultivar with the flag off vs on, hash
   the pixels, and confirm *only* the species you opted in changed. Anything
   else moving is a bug. Snippet in §7.
4. **Perf.** Measure your forms against the §4 budget. Report the numbers.

   > **Do not take wall-clock timings inside `art-prototype.html`.** It wraps
   > `CanvasRenderingContext2D.fill/stroke/fillRect/strokeRect/drawImage/fillText`
   > in a counting closure at load and never unwraps them. That wrapper costs
   > per OP, and ART2 issues roughly twice the ops, so it inflates the ART2 side
   > by about 2x — and any further patch/restore of those prototype methods (an
   > op-counting helper, say) compounds it. Measured both ways, little bluestem
   > in Fall came out 6.4x instrumented and **2.0x** clean. Use a separate page
   > that loads the modules with the same DOM stub harness and no
   > instrumentation. Op counts from the prototype are still fine — that is what
   > it is for. On a noisy machine take the MIN over interleaved A/B rounds
   > rather than a mean; means here drifted 30–40% run to run.
5. **Look at it.** `art-prototype.html` renders side-by-side; edit its `SPECIES`
   list to your forms. Serve with `npx http-server -c-1`.

Report actual measured numbers, not estimates. If a form comes in over budget,
say so rather than quietly shipping it.

### The proof the pixel hash cannot give you

Hashing flag-off against flag-on answers *"does this species respond to the
flag"*. It does **not** answer *"did my edits break the classic path for
someone else"* — a regression there moves the off and the on render together
and hashes clean. Wave A shipped exactly that bug: chaining the new branch onto
the globe form's `if/else` chain put the shared ball in the final `else` and
silently deleted the head of every classic sea holly and rattlesnake master.

So there is a second check, `node tools/art2-scope.js base`: it loads the
pre-wave build in a second `vm` sandbox and diffs the recorded draw-op stream
with the flag OFF. Zero refs may move. Run both.

## 7. Scope-proof snippet

Run in the browser console on `art-prototype.html`:

```js
const cv=document.createElement('canvas'); cv.width=340; cv.height=340;
const x=cv.getContext('2d');
const hash=(k,v,on,s)=>{ ART2.on=on; x.clearRect(0,0,340,340);
  x.save(); x.translate(170,320); drawPlant(x,0,0,k,1,s,101,0,v,1); x.restore();
  const d=x.getImageData(0,0,340,340).data; let h=2166136261;
  for(let i=0;i<d.length;i+=4){ h^=d[i]+d[i+1]*3+d[i+2]*7+d[i+3]*11; h=Math.imul(h,16777619); }
  return h>>>0; };
const refs=[]; for(const k of Object.keys(PLANTS)){ refs.push([k,undefined]);
  const c=PLANTS[k].cv; if(c) for(const v of Object.keys(c)) refs.push([k,v]); }
const changed=refs.filter(([k,v])=>['Spring','Summer','Fall','Winter']
  .some(s=>hash(k,v,false,s)!==hash(k,v,true,s))).map(([k,v])=>k+(v?'|'+v:''));
ART2.on=true; console.log(refs.length, changed.length, changed);
```

## 8. Calibration — where the real work is

Writing the primitives took one pass. Getting *E. purpurea* to look like
*E. purpurea* took a second pass tuning four numbers, and the first attempt was
badly wrong — leaves so broad and splayed the plant read as tropical. **Assume
your first numbers are wrong and look at the render.**

Method:

1. Opt the species in with a first guess at `leafShape` from real botany.
2. Render it in the prototype at **drift scale**, not specimen scale. Nobody
   looks at one plant; the question is whether a stand of it reads correctly.
3. Compare against what the plant actually looks like. Kevin grows these —
   botanical accuracy matters more than prettiness.
4. The most common first-pass error is leaves too broad and too horizontal.
   `leafRise` must exceed `sin(leafFan/2)` or the clump reads as a flat rosette.

Species within a genus should be **distinguishable**. The prototype's real test
was that *E. purpurea* (broad ovate, toothed) and *E. pallida* (narrow linear
straps) became tellable apart at drift scale, which they were not before.

## 9. Wave assignments

| Wave | Forms | Species |
| --- | --- | --- |
| **A — herbaceous heads** | `cone` (opt-in only, primitive exists), `spike`, `umbel`, `globe`, `shrub` (herbaceous mound), `drumstick`, `pincushion`, `bractstack`, `airywand` | 156 |
| **B — grasses & sedges** | `bunchgrass`, `cloudgrass`, `oatgrass`, `vertgrass`, `moorgrass`, `fountaingrass`, `turkeyfoot`, `feathergrass`, `forestgrass` | 52 |
| **C — woody** | `bush`, `tree`, `hydrangea`, `conifer`, `bamboo` | 67 |
| **D — long tail** | `bulbcup`, `iris`, `martagon`, `fern`, `rosette`, `leafmound`, `waterleaf`, `agave`, `pyramid`, `archbell`, `sotol`, `ocotillo` | 36 |

Each wave owns **only its own form branches**. Do not edit another wave's
branch, and do not edit the shared primitives.

### Form-specific notes

- **Grasses** want `drawLeaf` with a `linear` profile and **`rib:false`** — a
  blade has no visible midrib at this scale, and suppressing it saves a stroke
  per blade. Arch comes from `bow`. Grasses are the most numerous single form
  and the most perf-sensitive: they draw many blades each.
- **Woody** is the riskiest for performance. Trees are already the expensive
  case after the T10 visual rescale, and a mature oak draws a lot of foliage.
  Prefer shading the existing leaf *blobs* over converting each to a full
  `drawLeaf`. Measure early and often.
- **Spike / umbel / globe** heads are currently flat `ctx.arc`/`ctx.ellipse`
  fills. `drawFloret` is the drop-in replacement. Retain each form's existing
  `look` knobs (`spikeStyle`, `globeStyle`, etc.) — they encode real botany that
  took effort to get right.
