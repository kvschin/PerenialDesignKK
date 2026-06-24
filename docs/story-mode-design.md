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

## 8. Explicitly out of scope

- **Design Mode** — unchanged. Full palette, no economy, no collecting. It is
  the pro tool; Story Mode is the game.
- **Multiplayer backend** — sharing in Phase 5 can ride the existing
  photo/export paths; real cross-device sync is still the separate big-ticket
  backlog item (`sGet`/`sSet` against a server).
- Anything that adds fail states, timers, or grind — see §2.
