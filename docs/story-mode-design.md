# Pocket Prairie — Story Mode Design

> Scope: **Story Mode only.** Design Mode (the serious planner) is untouched —
> it stays a tool with the full palette available, no collecting, no economy.
> This doc is the build plan for turning Story Mode from "make a garden" into
> "keep a garden": a calm gather → propagate → cultivate → tend loop with a
> real gardener's arc inside it.

---

## 1. The fantasy & the loop

You are a gardener building up a place over seasons. You don't buy plants from
an infinite catalog — you **earn** them: forage seed in the wild, propagate it
(some seed has to overwinter before it'll grow), grow plants out, and use them
to plant your own yard and to take on commissions for NPCs. Your garden grows,
spreads, and pulls you back to tend it.

**Core loop**

```
forage / collect seed
      → propagate (stratify over winter, or direct-sow now)
      → grow plants out
      → plant your yard + fulfil NPC commissions
      → unlock new seed / cultivars / cosmetics
      → your garden spreads → tend & divide → more seed
      → (repeat)
```

**Mastery arc** — progression is baked into the fantasy, no XP bar needed:

| Stage | You are… | Your plant source |
|------|-----------|-------------------|
| 1 | **Forager** | scrounging seed in the wild |
| 2 | **Propagator** | sowing flats, overwintering seed |
| 3 | **Self-sufficient** | your own beds self-seed & divide |
| 4 | **Designer-for-others** | gifting/selling plants, taking commissions |

The keystone that makes the loop *self-sustaining*: **your maturing garden
becomes your nursery.** Year 1 you scrounge; year 3 your asters and grasses
throw seed and your clumps divide into dozens of plugs — for your beds, for
commissions, to gift to other players.

---

## 2. Design principles (guardrails)

1. **Calm cadence is the genre, not a flaw.** No energy timers, no daily-login
   FOMO, no loot boxes. The reward is "something is growing," not dopamine.
2. **Accuracy teaches.** Every mechanic maps to real botany so the game
   instructs while it plays (stratification, aggressiveness, seed season).
   *Kevin grows these — same bar as the species data.*
3. **Spreading must feel alive, not like weeding.** Target ~80/20: most spread
   is a gift ("the asters filled that gap"), a minority is a thug you divide
   back. Never a chore.
4. **Monetize scope & cosmetics, never the loop.** Story Mode stays
   **earn-through-play**. (See §4.8 for where Pocket Prairie+ sits — it's a
   Design-Mode / cosmetics lever, and it does **not** sell a skip button to
   Story Mode's collecting.)
5. **Seed collection over wild-digging.** Foraging is ethical seed collection
   (and the occasional "rescue" dig from a site about to be developed — a real
   practice). Digging natives from the wild is frowned on; the game models the
   right behavior.

---

## 3. The economy: seeds as currency

| | |
|---|---|
| **Earn (sources)** | foraging in the wild · NPC commission rewards · collecting seed from your own (and others') mature plants · dividing established clumps |
| **Spend (sinks)** | time spent propagating (seed → plug) · plugs spent planting your yard & commissions · gifting/sharing plants |
| **Sink that prevents saturation** | spreading creates tending work; thugs must be divided back. Surplus is *given away*, the natural gardener's "problem." |

Seeds are an inventory, not a wallet of coins — you hold *specific species*,
which is what makes foraging feel like collection rather than grinding cash.

---

## 4. Systems

### 4.1 Propagation — **the keystone (build this first)**

The novel, on-brand core. Two ways seed becomes a plant, both authentic:

- **Stratify** — most prairie natives need ~30–60 days cold-moist before
  they'll germinate. You sow flats into a **cold frame** in fall/winter; they
  break dormancy and are ready to grow out in spring. *This gives winter a
  job* — winter becomes the setup season, you're playing toward spring.
- **Direct-sow** — readily-germinating species (many warm-season grasses) can
  be sown straight away and slowly grow.

Stages: `seed → (stratifying) → germinated → plug (plantable) → planted`.
Each stage advances on the existing growing-day clock (winter is skipped for
growth but *is* the stratification window — they're complementary).

**Why it's the keystone:** it's the riskiest *feel* to get right (does the
delay read as anticipation or as waiting?), and everything else — foraging,
commissions, spreading — hangs off having plants to plant. Prototype it alone
on your own yard before building the rest.

### 4.2 Foraging

Walk the avatar into wild patches (beyond/around the plot) to **collect seed**.
Common species are easy finds; **cultivars are rare wild finds** (true to life —
named cultivars are special selections somebody spotted in a field). Rarity
gates discovery without a paywall.

### 4.3 Your yard — the home base

Not a cosmetic afterthought; the emotional anchor and the *physical home of
propagation*. The cold frame and potting bench live here. NPC gardens are jobs;
your yard is home and self-expression. Cosmetics (§4.7) dress this stage.

### 4.4 NPC commissions — the teaching ladder & quest engine

Design a garden for an NPC under **constraints** — limited palette, site
preferences, deer/rabbit pressure (already in the questionnaire). Constraints
are where the craft lives ("right plant, right place"), so commissions *teach*
without lecturing. Order them as a ladder:

`layering → succession → four-season interest → matrix planting`

Completion grades visibly (see §4.6 wildlife), rewards seed/cultivars/cosmetics,
and is **photographable** for sharing/challenges (reuse `takePhoto()`).

### 4.5 Plant spreading & tending

Placed plants slowly spread per their **aggressiveness** (new data, §5).
Clumpers stay put; seeders volunteer into nearby gaps; runners colonize. The
80/20 rule (§2.3) governs feel. Tending reuses existing tools (Select / Erase /
divide). This is the recurring pull that makes it a *tending* game, not a build.

### 4.6 Wildlife — the visible reward

Plant natives → pollinators and birds appear. The single most motivating
feedback in real native gardening ("I planted milkweed and got monarchs"), and
it doubles as the commission **grading rubric**: "design a pollinator bed" →
butterflies arrive → challenge passes. Deer/rabbit are the flip side — pressure
that makes plant choices matter.

### 4.7 Cosmetics

Avatar gardener looks (hats, boots, tools, aprons) and decorative yard dressing.
Purely additive — a reason to care about *your* player and *your* place. Never
gates botany. A natural, non-predatory revenue lane.

### 4.8 My Gardens & sharing

`#worldsScreen` extends to three shelves: gardens you **designed** (Design
Mode), gardens you've **grown** (Story Mode), and gardens **others shared**.
Sharing is the social retention layer (AC's visiting-friends), cheap because
the photo path already exists.

**Pocket Prairie+ ($5, one-time) — where money sits:**
- Unlocks the **full Design-Mode palette** immediately (the "pro tool" value:
  a real gardener planning a real bed wants every species *now*).
- Unlocks **cosmetics**.
- Story Mode stays **100% earn-through-play** — the collecting *is* the reason
  to play it; money never short-circuits it.

Two clean value props, no cannibalization: *buy completeness in the tool, earn
the journey in the game.*

---

## 5. Data model additions

### 5.1 New `PLANTS` fields (in `plants.js`)

All optional with sensible defaults so existing entries keep working. Note
`spread` is **already taken** (mature clump width, inches) — aggressiveness uses
a different key.

| Field | Values | Meaning / default |
|------|--------|-------------------|
| `strat` | `'none' \| 'cold' \| 'double'` | seed-start dormancy. `'cold'` = ~30–60 day cold-moist (sow fall/winter flats); `'double'` = two winters (rare — some *Baptisia*, lilies); `'none'` = sow & germinate now. **Default `'cold'`** for natives, `'none'` for warm-season grasses. |
| `growOut` | small int (growing-days) | germination → plantable plug. Default e.g. 6. |
| `spreads` | `'clump' \| 'seed' \| 'run'` | aggressiveness. clump = stays put; seed = self-sows into gaps; run = rhizome colonizer (the thugs). **Default `'clump'`** (safe). |
| `seedSeason` | `'Summer' \| 'Fall' \| 'Winter'` | when collectible seed is ripe. Default `'Fall'`. |
| `wild` | `'common' \| 'uncommon' \| 'rare'` | forage discovery rarity. Cultivars default `'rare'`. |

**Worked examples** (real botany):

```js
// warm-season clumper, easy from seed, stays put
bluestem:    { …, strat:'none', spreads:'clump', seedSeason:'Fall', wild:'common' }
// self-sows around — birds spread it; needs a cold start
switchgrass: { …, strat:'cold', spreads:'seed',  seedSeason:'Winter', wild:'common' }
// a rhizome thug — the 80/20 "divide me back" case
mtn_mint:    { …, strat:'cold', spreads:'run',   seedSeason:'Fall', wild:'uncommon' }
// double-dormancy classic — two winters before it grows
baptisia:    { …, strat:'double', spreads:'clump', seedSeason:'Fall', wild:'uncommon' }
```

### 5.2 New Story-Mode game state (gate everything on `game.gameMode==='story'`)

```js
game.seeds   = { [key]: count }                 // foraged/earned seed inventory
game.flats   = [ { s, v, sown, strat, stage,    // sown trays in the cold frame
                   ready } ]                     // stage: sown|stratifying|germinated|plug
game.stock   = { [key]: count }                 // grown-out plugs ready to plant
game.unlocked = Set(keys)                        // species available in Story (all earnable)
game.commissions = [ { npc, brief, palette,      // NPC jobs
                       constraints, reward, status } ]
```

- Cold frame / potting bench: implement as a **placeable yard structure keyed
  by origin tile**, following the existing `firepits` / `lights` precedent
  (`game.coldframes`, `drawColdframe`, footprint reservation, sync) — a
  well-worn, low-risk pattern in this codebase.
- Volunteers from spreading: add plants to `game.plants` with a `volunteer`
  flag so tending/undo treat them normally.

### 5.3 Integration hooks (existing code to lean on)

- **Time**: reuse `absDay()` / `growingDays()` for stratification & grow-out
  timers (winter is skipped for growth but *is* the stratification window).
- **Planting**: Story planting funnels through the same `applyToolAt`, but the
  brush is gated on having `game.stock` for that species (you plant your grown
  plugs, not an infinite palette).
- **Tray**: in Story Mode the catalog shows your seed/stock inventory; unearned
  species render locked.
- **Movement**: foraging uses the existing avatar walk (`tryMove`/`stepMove`).
- **Photo/share**: `takePhoto()` → commission submission & My Gardens shelf.

---

## 6. Phased build order

Each phase is independently testable and leaves Story Mode playable.

| Phase | Deliverable | De-risks |
|------|-------------|----------|
| **1 — Propagation spine** | seed inventory → sow (stratify vs direct) → grow-out → plant a plug, all on your own yard. Cold frame as a placeable structure. | the core *feel*: does the delay read as anticipation? Build & playtest this **alone** first. |
| **2 — Foraging + yard** | wild seed collection while walking; your yard as home base; rare cultivar finds. | the input side of the economy + reason to roam. |
| **3 — Commissions + wildlife** | NPC jobs with constrained palettes; the teaching ladder; pollinators as visible grading; photo-to-submit. | goals/horizon + the teaching payoff. |
| **4 — Spreading + tending** | aggressiveness-driven spread; volunteers; divide/tend. Tune the 80/20. | the recurring pull (and the part most likely to annoy if mistuned). |
| **5 — Cosmetics + sharing + Plus** | avatar/yard cosmetics; My Gardens shelves incl. shared; Pocket Prairie+ boundary. | retention & revenue, layered last. |

---

## 7. Open decisions (resolve as we build)

1. **Stratification timescale** — tie to the in-game season clock (a "winter" =
   one stratification cycle) or an accelerated real-time timer? Leaning:
   season clock, so it's legible and winter-anchored.
2. **Where seeds come from first** — start the player with a small starter seed
   packet, or forage from turn one? (Affects Phase 1 vs 2 ordering of the very
   first session.)
3. **How spreading reads on screen** — drift-fill animation vs. discrete new
   plugs appearing between visits. Must read as "alive."
4. **Commission framing** — freeform "design to a brief" vs. a target layout to
   approximate. Freeform teaches more; target is easier to grade.
5. **Cultivar economy** — are rare cultivars purely cosmetic variants, or do
   they carry mechanical perks (less aggressive, longer bloom)? Keep cosmetic
   to avoid pay-to-win pressure on Plus.
6. **Plus boundary precision** — confirm Story-found species are *never* behind
   the paywall, only the Design-Mode palette + cosmetics.

---

## 8. World structure (multi-location Story mode)

Story Mode grows from "edit one plot" into a small connected world: your
yard, your greenhouse, a town with a store, and NPC yards you design on
commission. This is an **expansion, not an engine rewrite** — the current
engine already does the hard parts.

### 8.1 Why the engine already supports it

- **Data-swap loading.** `enterGarden()`/`loadSolo()` already swap a whole
  plot's data into `game` and render it. Travelling between locations is the
  same move generalized: bank the current place, load the target, drop the
  avatar at the entrance. To the renderer every place is just "the tiles in
  `game`."
- **Windowed render.** Cost scales with *screen size, not world size*, and
  only the active location renders — so more/bigger locations don't tax FPS.
- **Stateless/lazy time.** A plant's size and a flat's stage are computed from
  elapsed time, not simulated per frame. So your greenhouse trays and yard
  keep "progressing" while you're in town and **catch up for free** on return.

### 8.2 Location taxonomy

| Kind | Examples | Editable? |
|------|----------|-----------|
| **Home** | your yard, your greenhouse | yes (greenhouse trays are interactive) |
| **Authored / fixed** | town, store interior | no — hand-designed, you walk and interact |
| **Commission** | an NPC's yard | yes, temporarily, under a brief (§4.4) |

### 8.3 The pieces to build (all additive)

1. **Location/scene manager** — the keystone. A registry of places + a
   `goTo(id, entrance)` that generalizes `enterGarden` (bank current, load
   target, place the avatar). A `game.location` pointer for "where am I."
2. **Travel / portals** — door or plot-edge tiles carrying a target location +
   entry point; walking onto one transitions.
3. **NPCs** — reuse the existing `drawCritter` avatar renderer. Data: who,
   where, role (vendor | commissioner | flavor), dialogue. Non-player critters.
4. **Shop + currency** — a vendor NPC opens a buy UI; a simple ledger
   (`game.coins` or similar). Sells seeds, cosmetics, tools, and bench/
   greenhouse capacity upgrades.
5. **Save bundle** — a Story save becomes a *set* of location plots (keyed by
   location id) **plus** location-independent player state (currency, seed/
   stock inventory, unlocks, commission progress). Generalizes the one-blob
   solo save.

None of this touches the iso renderer, camera, movement, tile editing, or the
plant/propagation sim — those already run on "whatever is loaded."

### 8.4 Authoring with Design Mode (the big shortcut)

**Design Mode is already a map editor**, and authored locations are just saved
plots. So the town, the store exterior, and NPC-yard starting states are
**built in Design Mode**, visually — not hand-coded tile arrays. Kevin authors
content with the same tool players use; it dogfoods the planner.

Design Mode gains a thin **location-authoring layer** — extra tools only the
developer sees:
- a **portal** tool (mark a tile → target location + entry point),
- a **place-NPC** tool (drop an NPC, set role/dialogue/inventory),
- an **interactive-spot** tag (this counter opens the shop; this bench is the
  potting station),
- an **authored-location** flag on the save (fixed map vs. player garden),
- an **export** action (download the plot + its NPCs/portals/tags as JSON).

**Players never see these tools.** Design Mode stays exactly as it is for
players — a *garden planner* that produces their own garden saves. The
level-authoring layer is the dev-only addition.

**Dev-gating: a flag, not a separate build.** No build step / no second app —
that would fight the no-build, GitHub-Pages-serves-`master` setup. Instead the
authoring tools ship present-but-dormant and switch on behind a flag
(`?author=1` / a localStorage toggle), the same proven pattern as the existing
`?debug` perf HUD ("zero-cost off"). The risk of a player finding the flag is
nil: all effects are local (`localStorage`, no backend), so worst case they
place an NPC in their own copy. (If stricter isolation is ever wanted, the
tools can move to a separate `author.html` + `author.js` that the player
`index.html` simply doesn't load — same shared `game.js`. Start with the flag.)

**Tooling is dev-gated; content ships as data.** The authoring *power* lives
only on the dev side; the authored *maps* are committed content everyone loads:

```
flip ?author  →  lay out town / NPC plot in Design Mode + author tools
              →  Export  →  locations/town.json (committed to the repo)
              →  the location manager loads it as a fixed place for all players
```

Players consume the JSON; they never touch the editor that made it. This keeps
the whole authoring story inside the existing engine with no new pipeline.

### 8.5 Build order for the world system (foundation first)

1. **Location manager + travel** between two real places — your yard ↔ your
   greenhouse — proving bank/load/portal/avatar-entry.
2. **Design-Mode authoring tools** (portal / NPC / interactive) + the
   authored-location flag.
3. **Town + store** (authored in Design Mode) + a vendor NPC + shop UI +
   currency — the first fixed location and the first place to *buy* seeds.
4. **NPC yards + commissions** — the teaching ladder from §4.4, now as
   travel-to locations.

This **reorders the earlier phases**: the greenhouse-you-walk-into and the
seed *sourcing* (shop/forage) both ride on the location system, so the
location foundation (step 1) becomes the prerequisite for the embodied
versions of Phases 2–4. The headless propagation loop (Phase 1) already
works and is independent.

### 8.6 Open decisions (world structure)

1. **Greenhouse: its own location, or an object on your yard?** Once the
   location system exists, a walk-in greenhouse is cheap — lean toward making
   it a location for the embodiment you wanted.
2. **One town for everyone, or procedural/personal?** Lean: one authored town
   (simpler, hand-crafted character).
3. **Currency source** — commissions + selling your surplus plants/divisions,
   vs. a simpler allowance. Tie to the §3 economy.
4. **How authored maps are stored/shipped** — bundled JSON vs. seeded into
   localStorage on first run.

---

## 9. Explicitly out of scope

- **Design Mode (player-facing)** — unchanged as the pro planner: full palette,
  no economy, no collecting. The new **location-authoring tools** (§8.4) are a
  separate authoring layer, not part of the normal planner UX.
- **Multiplayer backend** — sharing in Phase 5 can ride the existing
  photo/export paths; real cross-device sync is still the separate big-ticket
  backlog item (`sGet`/`sSet` against a server).
- Anything that adds fail states, timers, or grind — see §2.
