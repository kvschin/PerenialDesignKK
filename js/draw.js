'use strict';
/* ---------- tiny seeded RNG so each plant clump is unique but stable ---------- */
function mulberry(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0;
  let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

/* ---------- ART PASS PROTOTYPE (ART2) ---------------------------------------
   Filled, shaded botanical primitives to replace the constant-width strokes and
   flat fills the classic path uses. Everything is gated on ART2.on, so the
   shipped renderer is byte-for-byte unchanged while we A/B it — the prototype
   page (art-prototype.html) is the only thing that flips it on.

   Three ideas, in the order they move the needle:
     1. leaves are SHAPES with a per-species silhouette, not one stroked fan
     2. every fill carries a value gradient, so shapes read as form, not diagram
     3. a clump has depth: stems get a z, recede, and paint back-to-front
   All of it bakes into PSPRITE, so the cost lands on bake, not on the frame.

   TWO gates, and both must pass. ART2.on is the master switch (off with
   ?art2=0, which is how you A/B it in the real app). look.art2 is the
   PER-SPECIES opt-in: without it a species keeps the classic art, so rolling
   this out is one data key at a time rather than a flag day. Cultivar look
   overrides merge over the base look in plantDef, so a dwarf habit or leaf
   treatment can stay a small data-only override. */
const ART2 = { on: typeof location==='undefined' || !/[?&]art2=0(&|$)/.test(location.search) };
const LIT = {x:-0.55, y:-0.83};          // direction TO the light: upper left
function art2On(L){ return ART2.on && !!(L && L.art2); }

/* Fill the current path with a value gradient along the light axis. `r` is the
   shape's rough radius; lift/drop are the highlight/shadow deltas from `col`.
   Below GRAD_MIN_R a three-stop gradient is invisible at any zoom but still
   costs a CanvasGradient per shape per frame — and ray florets are most of the
   shapes in a flower. Those flat-fill at the blended tone instead. */
const GRAD_MIN_R = 6;
function litFill(ctx, cx, cy, r, col, lift, drop){
  const lo = lift===undefined? 26: lift, hi = drop===undefined? -30: drop;
  if (r < GRAD_MIN_R){ ctx.fillStyle=shade(col,(lo+hi)/4); ctx.fill(); return; }
  const g=ctx.createLinearGradient(cx+LIT.x*r, cy+LIT.y*r, cx-LIT.x*r, cy-LIT.y*r);
  g.addColorStop(0,    shade(col, lo));
  g.addColorStop(0.52, col);
  g.addColorStop(1,    shade(col, hi));
  ctx.fillStyle=g; ctx.fill();
}

/* Scratch for ribbonPath. It runs per leaf and per ray on EVERY procedural
   frame, and sway means every frame is a fresh one — allocating points here
   was thousands of short-lived arrays per frame, the same GC-churn stutter the
   persistent scene list was built to kill. Reused buffers, no allocation. */
const RIB_MAX = 24;
const _ribA = new Float64Array((RIB_MAX+1)*2), _ribB = new Float64Array((RIB_MAX+1)*2);

/* A tapered ribbon swept along a QUADRATIC spine (x0,y0)-(cx,cy)-(x1,y1). This
   one primitive builds leaves and ray florets — only the width PROFILE differs.
   `prof` is a BAKED half-width table (see below), `hw` scales it, and teeth/tn
   serrate the margin. Taking a table rather than a hw(t) callback drops both a
   closure allocation and a Math.pow per sample from the inner loop.
   The tangent is the analytic derivative B'(t), not a finite difference:
   cheaper, and exact at the endpoints. Math.sqrt, not Math.hypot — hypot does
   overflow-safe scaling nobody needs at these magnitudes and costs several x. */
function ribbonPath(ctx, x0,y0, cx,cy, x1,y1, prof, hw, teeth, tn){
  const n = prof.length-1;
  for (let i=0;i<=n;i++){
    const t=i/n, u=1-t;
    const px = u*u*x0 + 2*u*t*cx + t*t*x1;
    const py = u*u*y0 + 2*u*t*cy + t*t*y1;
    let dx = 2*(u*(cx-x0) + t*(x1-cx));
    let dy = 2*(u*(cy-y0) + t*(y1-cy));
    const l = Math.sqrt(dx*dx+dy*dy)||1; dx/=l; dy/=l;
    let w = hw*prof[i];
    if (teeth && t>0.10 && t<0.96) w *= 1+teeth*Math.abs(((t*tn)%1)*2-1);
    const j = i*2;
    _ribA[j]=px-dy*w; _ribA[j+1]=py+dx*w;
    _ribB[j]=px+dy*w; _ribB[j+1]=py-dx*w;
  }
  ctx.beginPath(); ctx.moveTo(_ribA[0],_ribA[1]);
  for (let i=1;i<=n;i++) ctx.lineTo(_ribA[i*2],_ribA[i*2+1]);
  for (let i=n;i>=0;i--)  ctx.lineTo(_ribB[i*2],_ribB[i*2+1]);
  ctx.closePath();
}

/* Leaf silhouettes. wAt = where along the blade it is widest; baseW/tipW are
   the width there as a fraction of the widest. Four shapes cover most of the
   catalog's herbaceous foliage; `teeth` serrates the margin. */
const LEAF_SHAPES = {
  linear:  {wAt:0.45, baseW:0.62, tipW:0.10, tipEase:1.60},
  lance:   {wAt:0.34, baseW:0.16, tipW:0.03, tipEase:1.25},
  ovate:   {wAt:0.42, baseW:0.34, tipW:0.05, tipEase:1.50},
  cordate: {wAt:0.30, baseW:0.62, tipW:0.04, tipEase:1.15},
};
function leafWidth(t, S){
  if (t<=S.wAt) return S.baseW + (1-S.baseW)*Math.pow(t/S.wAt, S.baseEase||0.65);
  const u=(t-S.wAt)/(1-S.wAt);
  return S.tipW + (1-S.tipW)*Math.pow(1-u, S.tipEase||1.3);
}

/* Baked width tables. These profiles are sampled at the SAME fixed t steps on
   every ribbon of every plant of every frame, and a fractional Math.pow was the
   most expensive thing in that loop. The steps never change, so evaluate each
   profile once at load and index it thereafter. */
/* Two resolutions. 10 samples is plenty for a 30px prairie leaf and visibly
   POLYGONAL on a 110px hosta blade — the straight segments between samples
   read as facets and the leaf comes out looking like broken glass. Big leaves
   take the 18-sample table instead; the extra cost is 8 lineTo calls on the
   few forms whose leaves are actually that large. */
const LEAF_N = 10, LEAF_N_HI = 18, RAY_N = 7;
const LEAF_HI_LEN = 26;                  // draw-units above which to use profHi
for (const S of Object.values(LEAF_SHAPES)){
  S.prof = new Float64Array(LEAF_N+1);
  for (let i=0;i<=LEAF_N;i++) S.prof[i] = leafWidth(i/LEAF_N, S);
  S.profHi = new Float64Array(LEAF_N_HI+1);
  for (let i=0;i<=LEAF_N_HI;i++) S.profHi[i] = leafWidth(i/LEAF_N_HI, S);
}
// a ray is a STRAP, not a spear: it holds most of its width almost to the tip,
// then rounds off. Taper it too early and the flower reads smaller.
const RAY_PROF = new Float64Array(RAY_N+1);
for (let i=0;i<=RAY_N;i++){ const t=i/RAY_N;
  RAY_PROF[i] = t<0.16 ? 0.50+t/0.16*0.50
                       : 0.55+0.45*Math.pow(1-(t-0.16)/0.84, 0.42); }
/* Emergent rays (RAY_FIT) start at the DISC EDGE, not at the centre. RAY_PROF
   opens at half width because a ray converging on a centre has to — but a ray
   that begins already out at the crowding radius does not, and starting it
   narrow leaves wedges of background between neighbours. That is what made a
   black-eyed Susan read as a cog even after the width cap was fixed: the rays
   overlapped along their length but pulled apart at the base, where the
   0.75 y-squash spreads them furthest. Full width from the base, rounding off
   only at the tip. */
const RAY_PROF_EM = new Float64Array(RAY_N+1);
for (let i=0;i<=RAY_N;i++){ const t=i/RAY_N;
  RAY_PROF_EM[i] = t<0.72 ? 0.95+0.05*(t/0.72)
                          : 1-0.62*Math.pow((t-0.72)/0.28, 1.5); }

/* One leaf: base -> tip, bowed sideways by `bow`, filled with a value gradient
   and finished with a midrib. `hw` is the half-width at its widest point. */
function drawLeaf(ctx, bx,by, tx,ty, hw, col, opt){
  opt=opt||{};
  const S=LEAF_SHAPES[opt.shape]||LEAF_SHAPES.lance;
  const dx=tx-bx, dy=ty-by, bow=opt.bow||0;
  const cx=(bx+tx)/2 - dy*bow, cy=(by+ty)/2 + dx*bow;   // spine control point
  const teeth=opt.teeth?(opt.teeth===true?0.15:opt.teeth):0, tn=opt.teethN||6;
  const L=Math.sqrt(dx*dx+dy*dy)||1;
  // big leaves need the denser table or the sample segments read as facets
  const prof=L>LEAF_HI_LEN ? S.profHi : S.prof;
  ribbonPath(ctx,bx,by,cx,cy,tx,ty,prof,hw,teeth,tn);
  if (opt.edge){
    litFill(ctx,(bx+tx)/2,(by+ty)/2,Math.max(hw,L*0.42),opt.edge,opt.lift,opt.drop);
    ribbonPath(ctx,bx,by,cx,cy,tx,ty,prof,hw*0.72,0,tn);
  }
  litFill(ctx,(bx+tx)/2,(by+ty)/2, Math.max(hw,L*0.42), col, opt.lift, opt.drop);
  if (opt.rib!==false){                  // the midrib is the cue that says "leaf"
    ctx.strokeStyle=shade(col,-34); ctx.lineWidth=Math.max(0.5,hw*0.17);
    ctx.globalAlpha=0.55;
    ctx.beginPath(); ctx.moveTo(bx,by); ctx.quadraticCurveTo(cx,cy,tx,ty); ctx.stroke();
    ctx.globalAlpha=1;
  }
}

/* A ray floret: a strap that swells past the base, tapers to a soft tip and
   droops away from the cone. The classic path draws this as one lineTo. */
function drawRay(ctx, cx,cy, ang, len, hw, droop, col, opt){
  opt=opt||{};
  const ex=cx+Math.cos(ang)*len,     ey=cy+Math.sin(ang)*len*0.75+droop;
  const mx=cx+Math.cos(ang)*len*0.5, my=cy+Math.sin(ang)*len*0.38+droop*0.28;
  ribbonPath(ctx, cx,cy, mx,my, ex,ey, opt.emergent?RAY_PROF_EM:RAY_PROF, hw, 0, 0);
  litFill(ctx,(cx+ex)/2,(cy+ey)/2, len*0.6, col,
          opt.lift===undefined?20:opt.lift, opt.drop===undefined?-26:opt.drop);
  // A vein is a whole extra path+stroke per ray, and there are dozens of rays
  // per plant per frame. On a short ray it is a sub-pixel line nobody sees, so
  // only the genuinely long straps (pallida, paradoxa) pay for one.
  if (opt.vein!==false && len>9){
    ctx.strokeStyle=shade(col,-22); ctx.lineWidth=0.45; ctx.globalAlpha=0.5;
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.quadraticCurveTo(mx,my,ex,ey); ctx.stroke();
    ctx.globalAlpha=1;
  }
}

/* A single small floret: a lit blob with the highlight offset toward the light.
   This is the drop-in replacement for the flat ctx.arc / ctx.ellipse fills that
   spike, umbel, globe and panicle heads use — those are where most of the
   catalog's flat colour lives. Deliberately cheap: at floret scale a gradient
   is invisible, so this is two fills, and the second is skipped once the blob
   is small enough that nobody could resolve it. */
function drawFloret(ctx, cx,cy, r, col, opt){
  opt=opt||{};
  const sq=opt.squash===undefined?1:opt.squash;
  ctx.fillStyle=shade(col, opt.drop===undefined?-8:opt.drop);
  ctx.beginPath(); ctx.ellipse(cx,cy,r,r*sq,opt.rot||0,0,7); ctx.fill();
  if (r < 1.1) return;                       // below this the highlight is noise
  ctx.fillStyle=shade(col, opt.lift===undefined?24:opt.lift);
  ctx.beginPath();
  ctx.ellipse(cx+LIT.x*r*0.34, cy+LIT.y*r*sq*0.34, r*0.56, r*sq*0.56, opt.rot||0, 0, 7);
  ctx.fill();
}

/* Shared shrub flowers. At shrub scale the placement and petal language carry
   more identity than botanical detail: a ribbon witch-hazel flower, a rose
   rosette and a four-petal mock-orange cup must not collapse to the same dot. */
function drawShrubFlower(ctx,cx,cy,r,col,shape,rnd,ang,accent){
  shape=shape||'single'; ang=ang||0;
  if (shape==='ribbon'){
    ctx.strokeStyle=shade(col,8); ctx.lineWidth=Math.max(0.75,r*0.38); ctx.lineCap='round';
    ctx.beginPath();
    for (let p=0;p<4;p++){ const a=ang+p*Math.PI/2+(rnd? (rnd()-0.5)*0.35:0), ex=cx+Math.cos(a)*r*2.4, ey=cy+Math.sin(a)*r*1.45;
      ctx.moveTo(cx,cy); ctx.quadraticCurveTo(cx+Math.cos(a+0.8)*r,cy+Math.sin(a+0.8)*r*0.75,ex,ey); }
    ctx.stroke(); drawFloret(ctx,cx,cy,Math.max(0.8,r*0.42),shade(col,-18),{squash:1}); return;
  }
  if (shape==='trumpet'||shape==='funnel'||shape==='bell'){
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(ang);
    ctx.fillStyle=shade(col,-12); ctx.beginPath();
    ctx.moveTo(-r*0.45,r*0.85); ctx.quadraticCurveTo(-r*0.9,0,-r*1.05,-r*0.55);
    ctx.quadraticCurveTo(0,-r*1.05,r*1.05,-r*0.55); ctx.quadraticCurveTo(r*0.9,0,r*0.45,r*0.85); ctx.closePath(); ctx.fill();
    ctx.fillStyle=shade(col,24); ctx.beginPath(); ctx.ellipse(0,-r*0.5,r*0.78,r*0.36,0,0,7); ctx.fill(); ctx.restore(); return;
  }
  const petals=shape==='star'?4:shape==='cup'?4:shape==='doubleCup'?8:shape==='calico'?5:
    shape==='camellia'?10:shape==='rosette'?9:5;
  const rings=(shape==='camellia'||shape==='rosette'||shape==='doubleCup')?2:1;
  for (let ring=0;ring<rings;ring++) for (let p=0;p<petals;p++){
    const a=ang+p*Math.PI*2/petals+(ring?Math.PI/petals:0), rr=r*(ring?0.52:0.78);
    drawFloret(ctx,cx+Math.cos(a)*rr,cy+Math.sin(a)*rr*0.72,r*(ring?0.46:0.58),
      shade(col,ring?12:0),{squash:shape==='star'?0.56:0.76,rot:a});
  }
  drawFloret(ctx,cx,cy,r*(shape==='calico'?0.34:0.3),accent||(shape==='calico'?shade(col,-34):shade(col,20)),{squash:1});
}

/* The cone: a domed, bristly head instead of a flat ellipse. Radial gradient
   offset toward the light, shadowed underside, spines catching light on the rim.
   The contrast is deliberately HALF what reads well in isolation: at full
   strength the cone separates from the rays and floats as its own object
   instead of sitting in the flower. The bristle lift is halved with it — a rim
   brighter than the dome's own highlight re-creates the same detachment. */
function drawConeDome(ctx, cx,cy, rw,rh, col, rnd){
  const g=ctx.createRadialGradient(cx+LIT.x*rw*0.5, cy+LIT.y*rh*0.55, rw*0.12,
                                   cx, cy, Math.max(rw,rh)*1.15);
  g.addColorStop(0,    shade(col, 26));
  g.addColorStop(0.45, shade(col,  6));
  g.addColorStop(1,    shade(col,-19));
  ctx.fillStyle=g;
  ctx.beginPath(); ctx.ellipse(cx,cy,rw,rh,0,0,7); ctx.fill();
  const n=Math.max(5, Math.round(rw*2.6));
  ctx.strokeStyle=shade(col,22); ctx.lineWidth=Math.max(0.4,rw*0.13);
  ctx.globalAlpha=0.7;
  // one path, one stroke — the bristles share a style, so eight separate
  // stroke calls per cone (times every cone, every frame) bought nothing
  ctx.beginPath();
  for (let i=0;i<n;i++){                             // bristle rim, lower arc only
    const a=Math.PI*(0.06+0.88*(i/(n-1))), j=rnd?(rnd()-0.5)*0.14:0;
    const ca=Math.cos(a+j), sa=Math.sin(a+j);
    ctx.moveTo(cx+ca*rw*0.86, cy+sa*rh*0.86);
    ctx.lineTo(cx+ca*rw*1.20, cy+sa*rh*1.24);
  }
  ctx.stroke();
  ctx.globalAlpha=1;
}

/* ---------- ART2 shared addition — WAVE B ------------------------------------
   NEW SHARED PRIMITIVE. Added here per the spec's "new shared primitive goes in
   a marked block at the end of the primitives section" rule, so it can be
   reconciled rather than duplicated by another wave.

   Why drawLeaf could not be reused as-is: it derives its spine control point
   from `bow`, a PERPENDICULAR offset at the midpoint. Every grass branch
   already carries its own hand-tuned quadratic control point (arch, sweep,
   cascade), and those are not expressible as a perpendicular offset — solving
   for `bow` only works when the blade's rise equals its run. drawBlade is the
   same idea taking the control point explicitly, so twenty years of hand-tuned
   arcs survive the art pass.

   Two deliberate differences from LEAF_SHAPES.linear:
     - the profile is MONOTONE from the sheath. A grass/sedge blade is widest
       where it leaves the sheath and tapers to an acuminate tip; `linear`
       bulges at 45% because it describes a leaf.
     - it bakes at 6 steps rather than 10. A blade is a simple arc, and this is
       the most numerous form in the catalog — 14 lineTo per blade instead of
       22, on up to 34 blades per plant, on every procedural frame.

   Calibration note: the exponent below is 0.62, i.e. the blade HOLDS its width
   and then points off quickly, rather than tapering linearly. A linear taper
   (exponent ~1) averaged only 0.55 of peak width, so a clump came out visibly
   thinner than the constant stroke it replaced and drifts lost their mass.
   Mean width of this table is 0.64 of peak, which is why the default bladeHW
   is ~0.85: half of leafW would halve the ink. */
const BLADE_N = 6;
const BLADE_PROF = new Float64Array(BLADE_N+1);
for (let i=0;i<=BLADE_N;i++){ const t=i/BLADE_N;
  BLADE_PROF[i] = t<0.14 ? 0.82+t/0.14*0.18
                         : 0.06+0.94*Math.pow(1-(t-0.14)/0.86, 0.62); }

/* The lit face. Zero over the sheath half, then a sliver that nests inside
   BLADE_PROF along the same spine, so it needs no curve subdivision.

   This is why drawBlade does NOT call litFill. Measured on this machine, on a
   bluestem-sized blade (~80px long, 4px at its widest):

       flat fill                  3.8us
       fill with a 3-stop gradient 14.5us
       creating the gradient       0.7us   <- allocation is NOT the cost
       building the path           0.3us

   The expense is rasterising through a gradient shader, and a bunchgrass draws
   13-34 blades. Per-blade gradients alone put little bluestem at 7.5x classic,
   over the 5x budget on their own. Dark body + lit sliver costs ~5.6us and, on
   an upright blade, is visually the same thing: a gradient along the light axis
   on a near-vertical shape IS a lighter tip. Every other primitive keeps its
   gradient — this is a blade-specific trade, taken because blades are both the
   most numerous shape in the catalog and the thinnest, i.e. where a smooth
   ramp buys the least per microsecond. */
const BLADE_LIT = new Float64Array(BLADE_N+1);
for (let i=0;i<=BLADE_N;i++){ const t=i/BLADE_N;
  BLADE_LIT[i] = t<0.40 ? 0 : BLADE_PROF[i]*0.70*Math.min(1,(t-0.40)/0.16); }

/* One grass blade along an explicit quadratic, tapered and lit. No midrib —
   a blade has none at this scale, and the suppressed stroke is a whole
   path+stroke saved per blade per frame.

   `lit` false skips the highlight pass. Callers pass the blade's depth, so the
   skirt of a clump — which is in the mass's own shadow and has no lit face to
   show — costs one fill instead of two. Cheaper AND more correct. */
function drawBlade(ctx, bx,by, cx,cy, tx,ty, hw, col, lit){
  ribbonPath(ctx, bx,by, cx,cy, tx,ty, BLADE_PROF, hw, 0, 0);
  ctx.fillStyle = shade(col, -14); ctx.fill();
  if (lit!==false && hw > 0.6){     // below this the sliver is sub-pixel noise
    ribbonPath(ctx, bx,by, cx,cy, tx,ty, BLADE_LIT, hw, 0, 0);
    ctx.fillStyle = shade(col, 26); ctx.fill();
  }
}

/* Draw order for a fan: outermost blades first, centre last. The classic loop
   runs left to right, so the rightmost blade always over-paints the clump and
   a tuft reads as a flat comb. Walking in from both edges makes it read as a
   dome — and because depth then tracks |side|, the recession can be derived
   arithmetically instead of sorted, which keeps the hot path allocation-free
   (no {z} records, no comparator, no sort). */
function fanIdx(k, n){ return (k&1) ? n-1-(k>>1) : (k>>1); }

/* Scratch for a panicle's spikelets. The branch lines have to batch into one
   stroke, and a fill cannot run inside an open path, so the cloud needs two
   passes over the same positions. Buffering them is the allocation-free way to
   do that — a second seeded RNG would mean a closure per stem per frame. */
const CLOUD_MAX = 40;
const _cloudX = new Float64Array(CLOUD_MAX), _cloudY = new Float64Array(CLOUD_MAX),
      _cloudR = new Float64Array(CLOUD_MAX), _cloudS = new Float64Array(CLOUD_MAX);
/* ===== ADDED BY WAVE A — batched floret cluster ==============================
   drawFloret is two fills per blob, which is right for a head of a dozen. It is
   not right for the forms Wave A inherited: one rough goldenrod draws ~360
   panicle dots, an aromatic aster ~48 disc florets, a moss phlox ~110 petals.
   At those counts a per-blob highlight is both unaffordable and — at r≈1.2 —
   invisible.

   So: stage a whole same-coloured cluster in module-level scratch, then paint it
   as TWO paths. One fill for every body, one fill for the highlights of only the
   blobs large enough to resolve one. A cluster of any size costs 2 fills instead
   of n (classic) or 2n (drawFloret), so the value gradient arrives while the op
   count goes DOWN. Nothing allocates; fcDraw resets the scratch itself.

   Use drawFloret for a head you can count on one hand, fcPush/fcDraw for a
   spray. Overflow past FC_MAX is dropped rather than grown — a cluster that big
   is a data bug, and silently reallocating would reintroduce the churn. */
const FC_MAX = 96;
const _fcX=new Float64Array(FC_MAX), _fcY=new Float64Array(FC_MAX),
      _fcR=new Float64Array(FC_MAX), _fcS=new Float64Array(FC_MAX);
let _fcN=0;
function fcReset(){ _fcN=0; }
function fcPush(x,y,r,squash){
  if (_fcN>=FC_MAX) return;
  _fcX[_fcN]=x; _fcY[_fcN]=y; _fcR[_fcN]=r; _fcS[_fcN]=squash===undefined?1:squash; _fcN++;
}
function fcDraw(ctx, col, lift, drop){
  if (!_fcN) return;
  ctx.fillStyle=shade(col, drop===undefined?-9:drop);
  ctx.beginPath();
  for (let i=0;i<_fcN;i++){                 // moveTo first: ellipse() would else
    ctx.moveTo(_fcX[i]+_fcR[i], _fcY[i]);   // join the previous subpath with a line
    ctx.ellipse(_fcX[i],_fcY[i],_fcR[i],_fcR[i]*_fcS[i],0,0,7);
  }
  ctx.fill();
  let any=false; ctx.beginPath();
  for (let i=0;i<_fcN;i++){
    if (_fcR[i] < 1.15) continue;           // sub-pixel highlight: skip, as drawFloret does
    any=true;
    const hr=_fcR[i]*0.55, hx=_fcX[i]+LIT.x*_fcR[i]*0.34, hy=_fcY[i]+LIT.y*_fcR[i]*_fcS[i]*0.34;
    ctx.moveTo(hx+hr,hy); ctx.ellipse(hx,hy,hr,hr*_fcS[i],0,0,7);
  }
  if (any){ ctx.fillStyle=shade(col, lift===undefined?24:lift); ctx.fill(); }
  _fcN=0;
}
/* A dense composite draws 200+ ray florets per plant per frame, so the options
   object that tells drawRay whether to vein one is the highest-count allocation
   site in the whole form. It never escapes the call, so one reused module-level
   object does. (The per-leaf option objects stay as the prototype wrote them —
   an order of magnitude fewer, and changing that pattern here would just make
   the four waves disagree about it.) */
const _rayOpt = {vein:true};

/* Ray-floret fit for composite heads. Two numbers, both calibrated against the
   classic render of the many-rayed species (rudbeckia, the sunflower-types).

   `crowd` — how much neighbouring rays may OVERLAP where they emerge from the
   disc. Crowding happens there, not at the tips, and a real composite's rays
   visibly lie over each other: a black-eyed Susan is a solid yellow mass with
   a scalloped edge, not eleven separate spokes. Capping on tip tangency (an
   earlier cut of this) gave every ray its own wedge and turned the flower into
   a gear. Overlap is allowed to exceed 1 on purpose, and rays paint
   back-to-front so it reads as depth.

   `emerge` — RAY_PROF peaks at 16% of the ray's length, so on a head whose
   disc is a large fraction of the ray, the widest part of every petal is
   buried and only the tapering tail shows: a spike, not a paddle. Above this
   disc:ray ratio AND at 9+ rays, the ribbon STARTS at the disc edge instead of
   the centre, so the blunt paddle is the part you actually see. The ray-count
   half of that test is what keeps the five pre-calibrated Echinacea out —
   E. angustifolia's disc:ray is 0.64, over the ratio, but it carries 8 rays.
   It is also the honest predictor: the spike read is a crowding artefact, and
   crowding is what many rays on a wide disc means. */
/* `disc` shrinks the dome on emergent heads only. drawConeDome throws its
   bristle rim out to 1.20x the radii it is handed, so a dome drawn at the
   classic disc size covers ~45% more area than the flat ellipse it replaced —
   which is what let the eye dominate the rays on a black-eyed Susan. 1/1.20
   lands the RIM on the classic disc edge. Uncrowded heads pass 1 and keep the
   dome the prototype calibrated. */
const RAY_FIT = { crowd: 2.2, emerge: 0.60, base: 0.78, disc: 0.83 };
/* ===== end Wave A addition ================================================= */

/* Conifers share one renderer, but not one silhouette. The data-facing
   `look.coniferHabit` switch keeps the useful differences at the plant entry:
   whorled spruce/fir, open pine tufts, shelf-like true cedar, flattened scale
   sprays, and pendulous curtains. These helpers only draw reusable branch
   material; species never get their own code path. */
function coniferHalfWidth(L,cw,u){
  const taper=Math.pow(Math.max(0.025,1-u),L.taper||0.72);
  const column=L.columnar||0;
  return cw*0.5*((1-column)*taper+column*(0.42+0.58*taper));
}
function coniferLeaderX(L,H,u,seed){
  if (!L || L.coniferHabit!=='weeping') return 0;
  const bendRate=L.leaderBend===undefined?0.11:L.leaderBend;
  const side=(seed&1)?-1:1, bend=H*bendRate*side;
  // Cubic-bezier x carriage: the leader bows strongly through its middle,
  // then returns toward the crown instead of reading as a tilted pole.
  const v=1-u;
  return bend*(3*v*v*u*1.05+3*v*u*u*0.62+u*u*u*0.24);
}
function coniferLeaderUAtY(top,y){
  if (!(top<1)) return 0;
  return Math.max(0,Math.min(1,(y-1)/(top-1)));
}
function coniferLeaderAt(L,H,u,seed,ox){
  return ox*u+coniferLeaderX(L,H,u,seed);
}
function coniferLeaderAtY(L,H,top,y,seed,ox){
  return coniferLeaderAt(L,H,coniferLeaderUAtY(top,y),seed,ox);
}
// Weeping curtains cap at five per side. Reuse these buffers across draws so
// a procedural preview or pre-cache frame does not allocate ~90 drop objects.
const CONIFER_DROP_MAX=10;
const _coniferDropX=new Float64Array(CONIFER_DROP_MAX);
const _coniferDropY=new Float64Array(CONIFER_DROP_MAX);
const _coniferDropLen=new Float64Array(CONIFER_DROP_MAX);
const _coniferDropSide=new Int8Array(CONIFER_DROP_MAX);
const _coniferDropJ=new Uint8Array(CONIFER_DROP_MAX);
function drawConiferSpray(ctx,cx,cy,len,thick,ang,col,tone,rib){
  if (!(len>0) || !(thick>0)) return;
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(ang||0);
  ctx.fillStyle=shade(col,tone||0); ctx.beginPath();
  ctx.moveTo(-len*0.18,0);
  ctx.quadraticCurveTo(len*0.08,-thick*0.92,len*0.94,-thick*0.10);
  ctx.quadraticCurveTo(len,0,len*0.94,thick*0.10);
  ctx.quadraticCurveTo(len*0.08,thick*0.92,-len*0.18,0);
  ctx.closePath(); ctx.fill();
  if (rib && len>18){
    ctx.strokeStyle=shade(col,-34); ctx.globalAlpha=0.46;
    ctx.lineWidth=Math.max(0.55,thick*0.12); ctx.beginPath();
    ctx.moveTo(-len*0.12,0); ctx.quadraticCurveTo(len*0.35,thick*0.08,len*0.86,0); ctx.stroke();
  }
  ctx.restore();
}
function drawConiferTuft(ctx,cx,cy,r,ang,col,rnd,soft){
  if (!(r>0)) return;
  const n=soft?9:7, fan=soft?1.22:0.88;
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(ang||0);
  ctx.strokeStyle=col; ctx.lineCap='round'; ctx.lineWidth=Math.max(0.55,r*(soft?0.055:0.075));
  ctx.beginPath();
  for (let i=0;i<n;i++){
    const a=-fan/2+fan*(i/(n-1))+(rnd()-0.5)*0.10;
    const rr=r*(0.72+rnd()*0.32);
    ctx.moveTo(-r*0.12,0); ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);
  }
  ctx.stroke(); ctx.fillStyle=shade(col,-30); ctx.beginPath(); ctx.arc(0,0,Math.max(0.8,r*0.11),0,7); ctx.fill();
  ctx.restore();
}
/* A pendulous foliage strand. One tapering ribbon that drifts sideways as it
   falls, so a curtain costs what a single spray costs — which is what makes it
   affordable to hang several per limb and still read as drapery. */
function drawConiferCurtain(ctx,cx,cy,len,wide,drift,col,tone){
  if (!(len>0) || !(wide>0)) return;
  const tipX=cx+drift, midX=cx+drift*0.4;
  ctx.fillStyle=shade(col,tone||0); ctx.beginPath();
  ctx.moveTo(cx-wide*0.5,cy);
  ctx.quadraticCurveTo(midX-wide*0.66,cy+len*0.52,tipX,cy+len);
  ctx.quadraticCurveTo(midX+wide*0.66,cy+len*0.52,cx+wide*0.5,cy);
  ctx.closePath(); ctx.fill();
}
/* Evergreen crowns are a MASS carrying texture, not a stack of bars. Measured
   on the branch-plate passes alone, only ~30% of a spruce's crown box held ink
   — so every whorl had sky behind it and the tree read as a lattice. This is
   the underwash the deciduous canopy already uses, sampled off the SAME
   half-width profile the plates use so mass and silhouette cannot disagree:
   one path, one fill, and the plates stay the thing you actually look at.
   `crownMass` is the openness knob — naturally airy habits author it down
   rather than the renderer branching per species. */
/* `inset` is what keeps this from flattening the open habits. A pine and a
   true cedar ARE see-through at the rim — that is the species, and the first
   cut of this mass took white pine from 13-41% crown ink to 61-99% and Atlas
   cedar from 7-51% to 75-97%, i.e. it turned two deliberately airy trees into
   solid cones. They get a narrow CORE mass instead: real openness lives at the
   edge of the crown, where the whorls now stick out past the wash and keep
   their sky. Weeping gets none at all — its density is the curtains, and a
   conical underwash behind them is the exact silhouette the habit avoids. */
const CONIFER_MASS={
  pine:   {a:0.30, inset:0.50},
  cedar:  {a:0.30, inset:0.46},
  scale:  {a:0.40, inset:0.90},
  spruce: {a:0.38, inset:0.86},
  weeping:{a:0,    inset:0},
};
function drawConiferCrownMass(ctx,L,habit,cw,top,base,ox,fol,fullness){
  const crownH=base-top, m=CONIFER_MASS[habit]||CONIFER_MASS.spruce;
  const a=L.crownMass===undefined?m.a:L.crownMass;
  const inset=(L.crownMassW===undefined?m.inset:L.crownMassW)*fullness;
  if (!(crownH>0) || !(cw>0) || !(a>0) || !(inset>0)) return;
  const steps=9;
  ctx.save(); ctx.globalAlpha=a; ctx.beginPath();
  for (let i=0;i<=steps;i++){
    const u=1-i/steps, hw=coniferHalfWidth(L,cw,u)*(0.90+0.12*(i&1))*inset;
    const y=base-crownH*u, x=ox*u+hw;
    if (i) ctx.lineTo(x,y); else ctx.moveTo(x,y);
  }
  for (let i=steps;i>=0;i--){
    const u=1-i/steps, hw=coniferHalfWidth(L,cw,u)*(0.90+0.12*(i&1))*inset;
    ctx.lineTo(ox*u-hw,base-crownH*u);
  }
  ctx.closePath();
  litFill(ctx,ox*0.5,(top+base)/2,Math.max(cw*0.5,crownH*0.5),shade(fol,-26),22,-20);
  ctx.restore();
}
/* How far a weeping conifer's foliage falls BELOW its placement point, at full
   growth, in draw units. renderer.js sizes the sprite box from this, so the
   cached and live silhouettes read one function and cannot drift apart. */
/* The cast ground shadow's ellipse radius. drawPlant paints it and
   `makePlantSprite` has to reserve it, so both read this rather than each
   carrying the constants: measured, every woody plant's bake was guillotining
   the shadow along the bottom edge of the canvas at alpha 61/255 — a hard dark
   line under every tree — because the box floored the allowance at 18 draw
   units while the ellipse wanted 29 (arborvitae) to 102 (cottonwood). It only
   showed once the sprite governor engaged, i.e. on dense gardens, which is
   exactly the cached-vs-live divergence the weeping reserve exists to stop. */
function plantShadowR(P, growth){
  const w = woodyVisualCw(P) || (P.type==='grass' ? (P.spread||P.space||16)*HERB_SCALE : 0);
  return (w ? w*0.42 : 14)*growth + 6;
}
// How far below its placement point a plant paints, in draw units: the cast
// shadow, or a weeping conifer's cascade, whichever hangs lower.
function plantDrawBelow(P, growth, H){
  const shR = plantShadowR(P, growth);
  return Math.max(3+shR*0.36+1.8, coniferWeepBelow(P,H));
}
const WEEP_LEN_MAX=1.24, WEEP_SCAFFOLD=0.55;  // product of the two length jitters
function coniferWeepBelow(P,H){
  const L=P.look||{};
  if (P.form!=='conifer' || L.coniferHabit!=='weeping') return 0;
  const crownTop=L.crownTop||0.96, crownBase=L.crownBase||0.08;
  const tierGap=H*(crownTop-crownBase)/Math.max(1,(L.tiers||8)-1);
  const vs=(woodyVisualCw(P)||P.cw||80)/(P.cw||80);
  const full=Math.max(0.75,L.fullness===undefined?1.12:L.fullness);
  // A strand falls `weepFall` of the way to the ground from the highest limb;
  // over 1/WEEP_LEN_MAX that breaks the ground line. The second term covers the
  // short-strand floor on a limb already sitting near grade.
  const reach=H*(crownTop+(L.branchLift||0.035));
  const weepFall=L.weepFall===undefined?0.86:L.weepFall;
  const tip=L.weepTufts?(L.needleLen||7)*vs*full:(L.padThick||2.7)*vs*Math.sqrt(full);
  return Math.max(0, reach*(weepFall*WEEP_LEN_MAX-1), tierGap*0.6-H*crownBase)+tip+4;
}

/* ---------- procedural plant renderer ----------
   Draws a species at screen (x,y) given growth 0..1, season, and a stable seed. */
function drawPlant(ctx, x, y, key, growth, season, seed, sway, variant, bloomLvl, detail){
  const P = plantDef(key, variant), baseS = P.sea[season]||{};
  // Month-window plants may bridge a real-world boundary even when their
  // seasonal colour was authored in the neighbouring `sea` block. Exact
  // bloomDay species deliberately use the visual season as a gate (bulbs and
  // onions must not repeat their one seasonal flower cycle year-round).
  const bloomS=(bloomLvl===undefined || (detail&&detail.bloomFallback))
    ? bloomAppearanceFor(P,season) : null;
  const S=bloomS&&!baseS.bloom ? Object.assign({},baseS,{bloom:bloomS.bloom,
    eye:baseS.eye||bloomS.eye, bract:baseS.bract||bloomS.bract}) : baseS;
  const rnd = mulberry(seed);
  // how far into its bloom window this species is (1 = forced full bloom,
  // used by tray icons / previews); gates and thins the flower pass
  const blv = bloomLvl!==undefined ? bloomLvl : (S.bloom ? bloomLevel(key) : 0);
  const blooming = !!S.bloom && blv>0.08;
  // trees: display-rescaled height (T10) — and a LOWER growth floor, because
  // 25% of a rescaled oak (~480px) reads as a 20-ft "sapling"; day-one trees
  // should look like whips. Everything else keeps the classic 0.25 floor.
  const gFloor = isTreeDef(P) ? 0.12 : 0.25;
  const H = plantVisualH(P) * (gFloor + (1-gFloor)*growth);   // H1: herbaceous scaled up too
  const mature = growth > 0.55;
  ctx.save(); ctx.translate(x, y);
  // soft ground shadow (canopy-wide for woody plants)
  const shR = plantShadowR(P, growth);
  drawSoftShadow(ctx,0,3,shR,shR*0.36+1.8,P.cw?0.19:0.15);
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.beginPath(); ctx.ellipse(0, 3, shR*0.58, shR*0.16+1.2, 0, 0, 7); ctx.fill();
  ctx.scale(plantVisualWidthScale(P,key),1);

  const stemFor = (n)=> Math.max(3, Math.round(n * (0.4+0.6*growth)));
  let snowAnchors=null;

  if (P.form === 'bunchgrass'){
    const L=P.look||{}, n = stemFor(L.leaves||13);
    const a2 = art2On(L);
    ctx.lineCap='round';
    const drawSedgeSeed=(style,sx,sy,a,col)=>{
      col=col||S.seed;                     // fresh bloom tint if given, else dried seed
      ctx.fillStyle=col;
      if (a2 && !style){                   // the plain oval nutlet, lit
        drawFloret(ctx,sx,sy,1.35,col,{squash:2.6,rot:a*0.4}); return;
      }
      if (style==='mace'){
        ctx.strokeStyle=shade(col,-12); ctx.lineWidth=0.9;
        for (let p=0;p<5;p++){
          const ang=p*Math.PI*0.4+a*0.25;
          ctx.beginPath(); ctx.moveTo(sx,sy);
          ctx.lineTo(sx+Math.cos(ang)*4.6,sy+Math.sin(ang)*4.6); ctx.stroke();
        }
        // the fruit is the point of a `mace`/`brush`/`pendant` sedge — these are
        // the shapes the seedStyle knob exists to tell apart, so they are worth
        // a lit blob each (3-5 per plant, not per blade)
        if (a2) drawFloret(ctx,sx,sy,3.25,col);
        else { ctx.beginPath(); ctx.ellipse(sx,sy,3.25,3.25,0,0,7); ctx.fill(); }
      } else if (style==='brush'){
        ctx.strokeStyle=shade(col,-10); ctx.lineWidth=0.7;
        for (let p=0;p<5;p++){
          const ox=(p-2)*1.25;
          ctx.beginPath(); ctx.moveTo(sx+ox,sy+2.4); ctx.lineTo(sx+ox*1.5,sy-3.6); ctx.stroke();
        }
        if (a2) drawFloret(ctx,sx,sy,2.15,col,{squash:1.95,rot:a*0.25});
        else { ctx.beginPath(); ctx.ellipse(sx,sy,2.15,4.2,a*0.25,0,7); ctx.fill(); }
      } else if (style==='pendant'){
        const drop=5.4;
        ctx.strokeStyle=shade(S.fol,-12); ctx.lineWidth=0.75;
        ctx.beginPath(); ctx.moveTo(sx,sy-1); ctx.quadraticCurveTo(sx+3.8,sy+1.5,sx+3.2,sy+drop); ctx.stroke();
        ctx.fillStyle=col;
        if (a2) drawFloret(ctx,sx+3.2,sy+drop+1.8,1.75,col,{squash:2.06,rot:0.45});
        else { ctx.beginPath(); ctx.ellipse(sx+3.2,sy+drop+1.8,1.75,3.6,0.45,0,7); ctx.fill(); }
      } else {
        ctx.beginPath(); ctx.ellipse(sx,sy,1.25,3.4,a*0.4,0,7); ctx.fill();
      }
    };
    if (L.sedgeHabit==='palm'){
      // Palm sedge carries leaf ranks up short stems; a basal tuft cannot show
      // the graphic, almost radial architecture that makes it useful in a plan.
      const stems=stemFor(L.palmStems||5), ranks=L.palmRanks||3;
      for (let i=0;i<stems;i++){
        const side=stems>1?i/(stems-1)-0.5:0, baseX=side*H*(L.palmSpread||0.38);
        const stemH=H*(L.palmStemLen||0.76)*(0.86+rnd()*0.14);
        ctx.strokeStyle=shade(S.fol,-12); ctx.lineWidth=L.stemW||1.05;
        ctx.beginPath(); ctx.moveTo(baseX,0); ctx.quadraticCurveTo(baseX,-stemH*0.5,baseX+side*2,-stemH); ctx.stroke();
        for (let r=0;r<ranks;r++){
          const y=-stemH*(0.3+r*0.22), leafLen=H*(L.palmLeafLen||0.29)*(0.88+rnd()*0.17);
          for (const dir of [-1,1]){
            const tipX=baseX+dir*leafLen*(0.78+rnd()*0.22)+sway*leafLen*0.025;
            const tipY=y-leafLen*(0.22+rnd()*0.09);
            const lc=shade(S.fol,(rnd()-0.5)*(L.colorJitter||18));
            if (a2){
              // upper ranks read as nearer: brighter, a shade wider
              const zr=0.72+0.28*(r/Math.max(1,ranks-1));
              drawBlade(ctx, baseX,y, baseX+dir*leafLen*0.34,y-leafLen*0.08, tipX,tipY,
                        (L.leafW||1.75)*(L.bladeHW||0.85)*zr, shade(lc,(zr-0.86)*26), zr>0.85);
              continue;
            }
            ctx.strokeStyle=lc; ctx.lineWidth=L.leafW||1.75;
            ctx.beginPath(); ctx.moveTo(baseX,y);
            ctx.quadraticCurveTo(baseX+dir*leafLen*0.34,y-leafLen*0.08,tipX,tipY); ctx.stroke();
          }
        }
        if (S.seed && mature && i%2===0) drawSedgeSeed(L.seedStyle,baseX+side*2,-stemH-2,side);
      }
    } else if (L.mound){
      const fan=L.fan||2.15, spread=L.spread||0.68, lift=L.dome||0.68, edgeDrop=L.edgeDrop||0.42;
      const seedEvery=L.seedStems ? Math.max(2,Math.floor(n/L.seedStems)) : 0;
      // Fresh spring inflorescence tints the same tiny seed heads; drops back to
      // dried seed out of bloom. No-op for mound sedges with no in-season bloom.
      const moundHead=(blooming?S.bloom:null)||S.seed;
      for (let k=0;k<n;k++){
        // ART2 walks the fan from both edges inward so the mound over-paints as
        // a dome; classic keeps its left-to-right order exactly.
        const i = a2 ? fanIdx(k,n) : k;
        const u=n>1?i/(n-1):0.5, side=u-0.5;
        const a=side*fan+(rnd()-0.5)*(L.jitter||0.26);
        const len=H*(L.leafLen||0.86)*(0.78+rnd()*0.26);
        const arc=Math.max(0,1-Math.abs(side)*2);
        const bx=Math.sin(a)*len*spread+sway*len*0.025;
        const by=-len*(lift-edgeDrop*Math.abs(side)*1.35+arc*0.12+(rnd()-0.5)*0.07);
        const baseX=(rnd()-0.5)*(L.baseW||5);
        const jit=(rnd()-0.5)*(L.colorJitter||22);
        if (a2){
          // depth tracks centrality: skirt blades sit back and dull, the crown
          // comes forward and takes the light. Free — no z record, no sort.
          const z=arc*0.78+rnd()*0.22;
          drawBlade(ctx, baseX,-(1-z)*H*0.02, baseX+bx*0.22,-len*0.46, bx,by,
                    (L.leafW||1.2)*(L.bladeHW||0.85)*(0.84+z*0.16),
                    shade(S.fol, jit-(1-z)*(L.bladeShade||17)), z>0.42);
        } else {
          ctx.strokeStyle = shade(S.fol, jit);
          ctx.lineWidth = L.leafW||1.2; ctx.beginPath(); ctx.moveTo(baseX,0);
          ctx.quadraticCurveTo(baseX+bx*0.22, -len*0.46, bx, by); ctx.stroke();
        }
        if (moundHead && mature && seedEvery && i%seedEvery===0){
          const sx=baseX+(rnd()-0.5)*4, sy=-H*(0.82+rnd()*0.22);
          ctx.strokeStyle=shade(S.fol,-12); ctx.lineWidth=0.75;
          ctx.beginPath(); ctx.moveTo(baseX,0); ctx.quadraticCurveTo(sx*0.45,-H*0.42,sx,sy); ctx.stroke();
          drawSedgeSeed(L.seedStyle,sx,sy,a,moundHead);
        }
      }
    } else {
      const fan=L.fan||1.5, spread=L.spread||0.55;
      for (let k=0;k<n;k++){
        const i = a2 ? fanIdx(k,n) : k;
        const a = (i/(n-1)-0.5)*fan + (rnd()-0.5)*0.3;
        const len = H*(L.leafLen||1)*(0.6+rnd()*0.45);
        const bx = Math.sin(a)*len*spread + sway*len*0.06;
        const by = -Math.cos(a*0.5)*len;
        const jit=(rnd()-0.5)*24, baseX=(rnd()-0.5)*6;
        if (a2){
          const z=Math.max(0,1-Math.abs(i/(n-1)-0.5)*2)*0.78+rnd()*0.22;
          drawBlade(ctx, baseX,-(1-z)*H*0.02, bx*0.4,by*0.62, bx,by,
                    (L.leafW||1.4)*(L.bladeHW||0.85)*(0.84+z*0.16),
                    shade(S.fol, jit-(1-z)*(L.bladeShade||17)), z>0.42);
        } else {
          ctx.strokeStyle = shade(S.fol, jit);
          ctx.lineWidth = L.leafW||1.4; ctx.beginPath(); ctx.moveTo(baseX,0);
          ctx.quadraticCurveTo(bx*0.4, by*0.62, bx, by); ctx.stroke();
        }
        if (S.seed && mature && i%(L.seedEvery||2)===0){
          if (a2) drawFloret(ctx,bx,by,2.1,S.seed,{squash:1.62,rot:a});
          else { ctx.fillStyle=S.seed;
            ctx.beginPath(); ctx.ellipse(bx,by,2.1,3.4,a,0,7); ctx.fill(); }
        }
      }
    }
  }
  else if (P.form === 'vertgrass'){
    // upright vase (miscanthus/indiangrass/Karl Foerster): blades rise from a
    // tight base and SPLAY outward at the tips, so the clump reads as a real
    // fountain of width, not the pencil it used to be (H2). look.fan tunes the
    // splay (arching miscanthus wide, stiff feather reed narrow).
    const L=P.look||{}, n = stemFor(L.leaves||9), fan=L.fan!==undefined?L.fan:1.25;
    const a2=art2On(L);
    for (let k=0;k<n;k++){
      const i = a2 ? fanIdx(k,n) : k;
      const a=(i/(n-1)-0.5)*fan+(rnd()-0.5)*0.18, len=H*(0.8+rnd()*0.25);
      const baseX=(rnd()-0.5)*6, tip=baseX+Math.sin(a)*len*0.42+sway*len*0.05;
      const jit=(rnd()-0.5)*20;
      if (a2){
        const z=Math.max(0,1-Math.abs(i/(n-1)-0.5)*2)*0.78+rnd()*0.22;
        drawBlade(ctx, baseX,-(1-z)*H*0.02, (baseX+tip)*0.5,-len*0.62, tip,-len,
                  1.6*(L.bladeHW||0.85)*(0.86+z*0.14),
                  shade(S.fol, jit-(1-z)*(L.bladeShade||16)), z>0.42);
      } else {
        ctx.strokeStyle = shade(S.fol,jit); ctx.lineWidth=1.6;
        ctx.beginPath(); ctx.moveTo(baseX,0); ctx.quadraticCurveTo((baseX+tip)*0.5,-len*0.62,tip,-len); ctx.stroke();
      }
      if (S.seed && mature){
        if (a2){
          // The classic head is ONE fat ellipse, which reads as a cattail on a
          // stick — wrong for all three species here. Give each its real
          // inflorescence: miscanthus a silky fan, Karl a tight vertical spike,
          // indiangrass a loose open panicle. Rays batch into a single stroke.
          const st=L.plumeStyle||'spike', ph=Math.max(9,H*(L.plumeLen||0.17));
          const py0=-len, lean=a*2.4+sway*0.6;
          if (st!=='fan'){                                  // lit tapered axis
            drawBlade(ctx, tip,py0, tip+lean*0.4,py0-ph*0.5, tip+lean,py0-ph,
                      st==='spike'?2.5:1.5, S.seed);
          }
          const rays=st==='fan'?8:(st==='open'?6:5);
          // The fan is a narrow UPRIGHT plume, not a radial burst: rays rise
          // steeply off a short axis. At +-35 degrees and full plume length it
          // read as a dandelion clock across a whole drift.
          const spr=st==='fan'?0.42:(st==='open'?0.5:0.2);
          ctx.strokeStyle=shade(S.seed,st==='fan'?16:-10);
          ctx.lineWidth=st==='fan'?0.6:0.55; ctx.lineCap='round';
          ctx.beginPath();
          for (let r2=0;r2<rays;r2++){
            const u2=rays>1?r2/(rays-1)-0.5:0, ra=u2*2*spr;
            const rl=ph*(st==='fan'?(0.52+rnd()*0.40):(0.3+rnd()*0.26));
            const ry=py0-ph*(st==='fan'?0.12:(0.34+r2/rays*0.5));
            ctx.moveTo(tip+lean*0.1,ry);
            ctx.lineTo(tip+lean+Math.sin(ra)*rl*0.80, ry-Math.cos(ra)*rl);
          }
          ctx.stroke(); ctx.lineCap='butt';
          if (st==='fan'){                                  // silky core
            drawFloret(ctx,tip+lean*0.25,py0-ph*0.20,1.9,S.seed,{squash:1.7});
          }
        } else { ctx.fillStyle=S.seed;
          ctx.beginPath(); ctx.ellipse(tip,-len-4,2.6,9,a*0.5+sway*0.05,0,7); ctx.fill(); }
      }
    }
  }
  else if (P.form === 'turkeyfoot'){ // big bluestem: very tall, 3-pronged tips
    const L=P.look||{}, a2=art2On(L);
    const bn = stemFor(7); // low basal blades
    for (let k=0;k<bn;k++){ const i=a2?fanIdx(k,bn):k;
      const a=(i/(bn-1)-0.5)*1.5, l=H*0.3, jit=(rnd()-0.5)*24;
      if (a2){
        const z=Math.max(0,1-Math.abs(i/(bn-1)-0.5)*2)*0.78+rnd()*0.22;
        drawBlade(ctx, 0,0, Math.sin(a)*l*0.7,-l*0.5, Math.sin(a)*l,-l*0.55,
                  1.4*(L.bladeHW||0.85)*(0.84+z*0.16),
                  shade(S.fol, jit-(1-z)*(L.bladeShade||18)), z>0.42);
      } else {
        ctx.strokeStyle=shade(S.fol,jit); ctx.lineWidth=1.4;
        ctx.beginPath(); ctx.moveTo(0,0);
        ctx.quadraticCurveTo(Math.sin(a)*l*0.7,-l*0.5,Math.sin(a)*l,-l*0.55); ctx.stroke(); }
    }
    const n = stemFor(8);
    for (let i=0;i<n;i++){
      const ox=(rnd()-0.5)*14, len=H*(0.78+rnd()*0.25), tip=ox+sway*len*0.07;
      const jit=(rnd()-0.5)*22;
      if (a2){
        // the culm is the whole plant here — a flat 1.5px bar for 78px of
        // height is what makes it read as a diagram. Taper and light it.
        const z=0.55+rnd()*0.45;
        drawBlade(ctx, ox,0, ox,-len*0.6, tip,-len,
                  1.5*(L.culmHW||0.90)*(0.86+z*0.14),
                  shade(S.fol, jit-(1-z)*(L.bladeShade||18)), z>0.42);
      } else {
        ctx.strokeStyle=shade(S.fol,jit); ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(ox,0); ctx.quadraticCurveTo(ox,-len*0.6,tip,-len); ctx.stroke(); }
      if (S.seed && mature && i%2===0){ // the turkey foot
        ctx.strokeStyle=S.seed; ctx.lineWidth=1.6;
        for (let p3=-1;p3<=1;p3++){ ctx.beginPath(); ctx.moveTo(tip,-len);
          ctx.lineTo(tip+p3*3.6, -len-6-(p3===0?2.5:0)); ctx.stroke(); }
        // the racemes carry spikelets — three lit beads, not three bare lines
        if (a2) for (let p3=-1;p3<=1;p3++)
          drawFloret(ctx, tip+p3*3.2, -len-5.2-(p3===0?2.2:0), 1.35, S.seed,
                     {squash:1.5, rot:p3*0.5});
      }
    }
  }
  else if (P.form === 'cloudgrass'){ // switchgrass/muhly/lovegrass: foliage clump under an airy seed cloud
    const L=P.look||{}, n = stemFor(L.leaves||11), a2=art2On(L);
    const leafFan=L.leafFan||1.3, leafSpread=L.bladeSpread!==undefined?L.bladeSpread:0.6;
    const leafArch=L.leafArch||0.7, leafLean=L.leafLean!==undefined?L.leafLean:0.05;
    ctx.lineCap='round';
    for (let k=0;k<n;k++){ // arching or upright blades
      const i=a2?fanIdx(k,n):k;
      const u=n>1?i/(n-1):0.5;
      const a=(u-0.5)*leafFan+(rnd()-0.5)*(L.leafJitter||0.2), len=H*(L.leafLen||0.55)*(0.7+rnd()*0.4);
      const bx=Math.sin(a)*len*leafSpread+sway*len*leafLean;
      const by=-len*(L.leafUpright||1);
      const jit=(rnd()-0.5)*24, baseX=(rnd()-0.5)*5;
      if (a2){
        const z=Math.max(0,1-Math.abs(u-0.5)*2)*0.78+rnd()*0.22;
        drawBlade(ctx, baseX,-(1-z)*H*0.015, bx*0.4,-len*leafArch, bx,by,
                  (L.leafW||1.4)*(L.bladeHW||0.85)*(0.84+z*0.16),
                  shade(S.fol, jit-(1-z)*(L.bladeShade||17)), z>0.42);
      } else {
        ctx.strokeStyle=shade(S.fol,jit); ctx.lineWidth=L.leafW||1.4;
        ctx.beginPath(); ctx.moveTo(baseX,0);
        ctx.quadraticCurveTo(bx*0.4,-len*leafArch,bx,by); ctx.stroke();
      }
    }
    const sn = stemFor(L.stems||6), cloud=S.seed||(blooming?S.bloom:null);
    const stemFan=L.stemFan!==undefined?L.stemFan:null, topF=L.cloudTop||0.92;
    for (let i=0;i<sn;i++){
      const u=sn>1?i/(sn-1):0.5, side=u-0.5;
      const len=H*(0.85+rnd()*0.2);
      const ox=stemFan!==null ? side*(L.stemBase||12)+(rnd()-0.5)*(L.stemJitter||4) : (rnd()-0.5)*10;
      const tip=stemFan!==null ? ox+side*len*stemFan*0.34+sway*len*(L.stemLean!==undefined?L.stemLean:0.06) : ox+sway*len*0.06;
      ctx.strokeStyle=shade(S.fol,-12); ctx.lineWidth=L.stemW||1.1;
      ctx.beginPath(); ctx.moveTo(ox*0.5,0); ctx.quadraticCurveTo(ox,-len*0.6,tip,-len*topF); ctx.stroke();
      if (cloud && mature){ ctx.fillStyle=cloud;
        const dots=L.cloudDots||9, cloudW=L.cloudWidth||15, cloudH=L.cloudHeight||11, dotR=L.cloudRadius||0.9;
        // ART2 batches all of a stem's panicle branches into ONE stroke instead
        // of a path+stroke per dot, which pays for the richer florets below.
        if (a2){
          const nd=Math.min(dots,CLOUD_MAX);
          for (let d2=0;d2<nd;d2++){
            const fy=rnd();
            _cloudX[d2]=tip+(rnd()-0.5)*cloudW; _cloudY[d2]=-len*topF+2-fy*cloudH;
            _cloudR[d2]=dotR*(0.72+rnd()*1.06); _cloudS[d2]=fy;
          }
          if (L.panicle){                    // every branch in ONE stroke
            const oldAlpha=ctx.globalAlpha; ctx.globalAlpha=0.42;
            ctx.strokeStyle=shade(cloud,-6); ctx.lineWidth=0.45;
            ctx.beginPath();
            for (let d2=0;d2<nd;d2++){ ctx.moveTo(tip,-len*topF+1); ctx.lineTo(_cloudX[d2],_cloudY[d2]); }
            ctx.stroke(); ctx.globalAlpha=oldAlpha;
          }
          // Volume, not uniform dust: spikelets vary in size, and the ones
          // riding the crown of the cloud take the light.
          for (let d2=0;d2<nd;d2++)
            drawFloret(ctx,_cloudX[d2],_cloudY[d2],_cloudR[d2],
                       shade(cloud,(_cloudS[d2]-0.45)*20),{squash:L.cloudSquash||1});
        } else
        for (let d2=0;d2<dots;d2++){
          const px=tip+(rnd()-0.5)*cloudW, py=-len*topF+2-rnd()*cloudH;
          if (L.panicle){
            const oldAlpha=ctx.globalAlpha;
            ctx.globalAlpha=0.45; ctx.strokeStyle=shade(cloud,(rnd()-0.5)*18); ctx.lineWidth=0.45;
            ctx.beginPath(); ctx.moveTo(tip,-len*topF+1); ctx.lineTo(px,py); ctx.stroke();
            ctx.globalAlpha=oldAlpha; ctx.fillStyle=cloud;
          }
          ctx.beginPath(); ctx.arc(px, py, dotR, 0, 7); ctx.fill();
        } }
    }
  }
  else if (P.form === 'feathergrass'){ // Nassella: fine green hair under loose blond, wind-combed awns
    const L=P.look||{}, leafN=stemFor(L.leaves||30), fan=L.fan||2.3;
    ctx.lineCap='round';
    for (let i=0;i<leafN;i++){
      const u=leafN>1?i/(leafN-1):0.5, side=u-0.5;
      const a=side*fan+(rnd()-0.5)*0.32, len=H*(L.leafLen||0.72)*(0.68+rnd()*0.44);
      const bx=Math.sin(a)*len*(L.leafSpread||0.55)+sway*len*0.08;
      const by=-len*(0.48+rnd()*0.18);
      ctx.strokeStyle=shade(S.fol,(rnd()-0.5)*20); ctx.lineWidth=L.leafW||0.78;
      ctx.beginPath(); ctx.moveTo((rnd()-0.5)*5,0);
      ctx.quadraticCurveTo(bx*0.24,-len*0.72,bx,by); ctx.stroke();
    }
    const plume=(blooming?S.bloom:null)||S.seed, plumeN=stemFor(L.plumes||20);
    for (let i=0;i<plumeN;i++){
      const u=plumeN>1?i/(plumeN-1):0.5, side=u-0.5;
      const a=side*fan+(rnd()-0.5)*0.44, len=H*(L.plumeLen||0.95)*(0.75+rnd()*0.32);
      const baseX=(rnd()-0.5)*5;
      const tipX=baseX+Math.sin(a)*len*(L.plumeSpread||0.78)+sway*len*0.16;
      const tipY=-len*(0.66+rnd()*0.2);
      ctx.strokeStyle=shade(S.fol,-8); ctx.lineWidth=L.stemW||0.65;
      ctx.beginPath(); ctx.moveTo(baseX,0);
      ctx.quadraticCurveTo(tipX*0.25,-len*0.65,tipX,tipY); ctx.stroke();
      if (plume && mature){
        const wisps=L.wisps||5, oldAlpha=ctx.globalAlpha;
        for (let w=0;w<wisps;w++){
          const f=0.42+rnd()*0.38;
          const sx=baseX+(tipX-baseX)*f+(rnd()-0.5)*2;
          const sy=-len*f*(0.68+rnd()*0.08);
          const curlDir=side===0 ? (rnd()<0.5?-1:1) : (side<0?-1:1);
          const ex=tipX+(rnd()-0.5)*H*0.5+curlDir*H*(0.08+rnd()*0.12);
          const ey=tipY+(rnd()-0.5)*H*0.22+rnd()*4;
          ctx.globalAlpha=0.42+rnd()*0.24;
          ctx.strokeStyle=shade(plume,(rnd()-0.5)*24+8); ctx.lineWidth=0.45+rnd()*0.2;
          ctx.beginPath(); ctx.moveTo(sx,sy);
          ctx.quadraticCurveTo((sx+ex)*0.5+(rnd()-0.5)*8, sy-H*(0.12+rnd()*0.12), ex, ey); ctx.stroke();
          if (rnd()>0.54){
            ctx.fillStyle=shade(plume,-4); ctx.beginPath(); ctx.arc(sx,sy,0.55,0,7); ctx.fill();
          }
        }
        ctx.globalAlpha=oldAlpha;
      }
    }
  }
  else if (P.form === 'moorgrass'){ // Sesleria: tidy mound with short upright seed wands
    const L=P.look||{}, n=stemFor(L.leaves||14), a2=art2On(L);
    for (let k=0;k<n;k++){
      const i=a2?fanIdx(k,n):k;
      const a=(i/(n-1)-0.5)*(L.fan||1.05)+(rnd()-0.5)*0.16;
      const len=H*(L.leafLen||0.58)*(0.82+rnd()*0.26);
      const bx=Math.sin(a)*len*0.5+sway*len*0.025;
      const by=-len*(0.72+rnd()*0.14);
      const jit=(rnd()-0.5)*18, baseX=(rnd()-0.5)*5;
      if (a2){
        const z=Math.max(0,1-Math.abs(i/(n-1)-0.5)*2)*0.78+rnd()*0.22;
        drawBlade(ctx, baseX,-(1-z)*H*0.02, bx*0.28,-len*0.42, bx,by,
                  1.45*(L.bladeHW||0.85)*(0.84+z*0.16),
                  shade(S.fol, jit-(1-z)*(L.bladeShade||16)), z>0.42);
      } else {
        ctx.strokeStyle=shade(S.fol,jit); ctx.lineWidth=1.45; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(baseX,0);
        ctx.quadraticCurveTo(bx*0.28,-len*0.42,bx,by); ctx.stroke();
      }
    }
    const seed=S.seed||(blooming?S.bloom:null), sn=stemFor(L.stems||5);
    if (seed && mature){
      for (let i=0;i<sn;i++){
        const ox=(rnd()-0.5)*8, len=H*(0.76+rnd()*0.14), tip=ox+sway*len*0.025;
        ctx.strokeStyle=shade(S.fol,-14); ctx.lineWidth=0.95;
        ctx.beginPath(); ctx.moveTo(ox*0.45,0);
        ctx.quadraticCurveTo(ox*0.8,-len*0.45,tip,-len); ctx.stroke();
        ctx.fillStyle=seed;
        const beads=L.seedBeads||5;
        for (let b=0;b<beads;b++){
          const py=-len+b*2.0, px=tip+(rnd()-0.5)*2.0, rot=(rnd()-0.5)*0.6;
          if (a2) drawFloret(ctx,px,py,1.2,seed,{squash:1.42,rot:rot});
          else { ctx.beginPath(); ctx.ellipse(px,py,1.2,1.7,rot,0,7); ctx.fill(); }
        }
      }
    }
  }
  else if (P.form === 'oatgrass'){ // gramas and sea oats: species-specific one-sided heads
    const L=P.look||{}, n=stemFor(L.leaves||9), leafFan=L.leafFan===undefined?1.4:L.leafFan;
    const a2=art2On(L);
    for (let k=0;k<n;k++){ const i=a2?fanIdx(k,n):k;
      const a=(i/(n-1)-0.5)*leafFan+(rnd()-0.5)*0.2, len=H*(L.leafLen||0.5)*(0.6+rnd()*0.5);
      const bx=Math.sin(a)*len*(L.leafSpread||0.55)+sway*len*0.05;
      const jit=(rnd()-0.5)*24, baseX=(rnd()-0.5)*5;
      if (a2){
        const z=Math.max(0,1-Math.abs(i/(n-1)-0.5)*2)*0.78+rnd()*0.22;
        drawBlade(ctx, baseX,-(1-z)*H*0.02, bx*0.4,-len*0.6, bx,-len,
                  (L.leafW||1.3)*(L.bladeHW||0.85)*(0.84+z*0.16),
                  shade(S.fol, jit-(1-z)*(L.bladeShade||17)), z>0.42);
      } else {
        ctx.strokeStyle=shade(S.fol,jit); ctx.lineWidth=L.leafW||1.3;
        ctx.beginPath(); ctx.moveTo(baseX,0);
        ctx.quadraticCurveTo(bx*0.4,-len*0.6,bx,-len); ctx.stroke(); } }
    // Bloom-first, then dried seed (matches fountaingrass): the same eyelash
    // combs / dangling spikelets tint to the fresh bloom colour while blooming,
    // then read as tan seed. A no-op for any oatgrass season without a bloom.
    const sn=stemFor(L.stems||5), oat=(blooming?S.bloom:null)||S.seed;
    for (let i=0;i<sn;i++){
      const ox=(rnd()-0.5)*(L.stemSpread||8), len=H*((L.stemLen||0.8)+rnd()*(L.stemJitter===undefined?0.25:L.stemJitter));
      const tip=ox+(L.tipOffset===undefined?5:L.tipOffset)+sway*len*0.05;
      ctx.strokeStyle=shade(S.fol,-10); ctx.lineWidth=1.2;
      ctx.beginPath(); ctx.moveTo(ox*0.5,0); ctx.quadraticCurveTo(ox+2.5,-len*0.6,tip,-len); ctx.stroke();
      if (!oat || !mature) continue;
      ctx.fillStyle=oat;
      if (L.headStyle==='eyelash'){
        const heads=L.heads||1, headLen=L.headLen||9, teeth=L.teeth||8, toothLen=L.toothLen||2.2;
        for(let h2=0;h2<heads;h2++){
          const side=h2%2?-1:1, fy=-len*(0.7+h2*0.1), fx=tip+sway*0.6;
          ctx.strokeStyle=shade(oat,-12); ctx.lineWidth=1.15;
          ctx.beginPath(); ctx.moveTo(fx,fy); ctx.lineTo(fx+side*headLen,fy+side*(L.headTilt||0)); ctx.stroke();
          ctx.strokeStyle=oat; ctx.lineWidth=0.85;
          for(let tooth=0;tooth<teeth;tooth++){
            const t=teeth===1?0.5:tooth/(teeth-1), tx=fx+side*headLen*t, ty=fy+side*(L.headTilt||0)*t;
            ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(tx,ty+toothLen); ctx.stroke();
          }
        }
      } else {
        const spikelets=L.spikelets||6, step=L.spikeletStep===undefined?0.09:L.spikeletStep;
        const sw=L.spikeletW||1.9, sh=L.spikeletH||1.1;
        for (let s2=0;s2<spikelets;s2++){ const f=0.45+s2*step;
          const px=ox*0.5+(tip-ox*0.5)*f+(L.spikeletSide===undefined?-2.4:L.spikeletSide), py=-len*f;
          // The flat dangling oat is this form's whole signature. Lit, it reads
          // as a hanging scale; flat, it reads as a rung on a ladder.
          if (a2) drawFloret(ctx,px,py,sw,oat,{squash:sh/sw,rot:0.5});
          else { ctx.beginPath(); ctx.ellipse(px,py,sw,sh,0.5,0,7); ctx.fill(); } }
      }
    }
  }
  else if (P.form === 'fountaingrass'){ // pennisetum: arching blades with bottlebrush plumes
    const L=P.look||{}, n=stemFor(L.leaves||13), a2=art2On(L);
    for (let k=0;k<n;k++){
      const i=a2?fanIdx(k,n):k;
      const a=(i/(n-1)-0.5)*(L.fan||1.9)+(rnd()-0.5)*0.18, len=H*(L.leafLen||0.54)*(0.7+rnd()*0.45);
      const bx=Math.sin(a)*len*0.78+sway*len*0.06, by=-len*(0.46+rnd()*0.18);
      const jit=(rnd()-0.5)*22, baseX=(rnd()-0.5)*5;
      if (a2){
        const z=Math.max(0,1-Math.abs(i/(n-1)-0.5)*2)*0.78+rnd()*0.22;
        drawBlade(ctx, baseX,-(1-z)*H*0.02, bx*0.28,-len*0.72, bx,by,
                  (L.leafW||1.35)*(L.bladeHW||0.85)*(0.84+z*0.16),
                  shade(S.fol, jit-(1-z)*(L.bladeShade||17)), z>0.42);
      } else {
        ctx.strokeStyle=shade(S.fol,jit); ctx.lineWidth=L.leafW||1.35;
        ctx.beginPath(); ctx.moveTo(baseX,0);
        ctx.quadraticCurveTo(bx*0.28,-len*0.72,bx,by); ctx.stroke();
      }
    }
    const brush=(blooming?S.bloom:null)||S.seed, sn=stemFor(L.stems||6);
    for (let i=0;i<sn;i++){
      const a=(i/(sn-1)-0.5)*(L.fan||1.7)+(rnd()-0.5)*0.18, len=H*(0.74+rnd()*0.24);
      const tip=Math.sin(a)*len*0.62+sway*len*0.06, topY=-len*(0.68+rnd()*0.08);
      ctx.strokeStyle=shade(S.fol||brush,-18); ctx.lineWidth=1.05;
      ctx.beginPath(); ctx.moveTo((rnd()-0.5)*4,0);
      ctx.quadraticCurveTo(tip*0.36,-len*0.58,tip,topY); ctx.stroke();
      if (brush && mature){
        ctx.fillStyle=brush;
        const br=L.brush||5.5, shown=blooming?Math.max(3,Math.ceil(7*blv)):5;
        for (let b=0;b<shown;b++){
          const jx=(rnd()-0.5)*2;
          if (a2){
            // A pennisetum bottlebrush is a fat cylinder that tapers off at the
            // tip; a stack of equal flat ellipses reads as a caterpillar.
            const tp=1-0.42*(b/Math.max(1,shown-1));
            drawFloret(ctx,tip+jx,topY-b*2.1,br*0.40*tp,shade(brush,b*3),
                       {squash:0.58,rot:a*0.5});
          } else {
            ctx.beginPath();
            ctx.ellipse(tip+jx,topY-b*2.1,br*0.38,br*0.22,a*0.5,0,7); ctx.fill();
          }
        }
        // fine bristles are what make it a BOTTLEBRUSH — one batched stroke
        if (a2){
          ctx.strokeStyle=shade(brush,20); ctx.lineWidth=0.4;
          const oa=ctx.globalAlpha; ctx.globalAlpha=0.55; ctx.beginPath();
          for (let b=0;b<shown;b++){ const by2=topY-b*2.1;
            for (const dir of [-1,1]){
              ctx.moveTo(tip+dir*br*0.28, by2);
              ctx.lineTo(tip+dir*br*0.72, by2-1.6-rnd()*1.4); } }
          ctx.stroke(); ctx.globalAlpha=oa;
        }
      }
    }
  }
  else if (P.form === 'forestgrass'){ // Hakonechloa: low cascading ribbons for shade
    const L=P.look||{}, n=stemFor(L.leaves||16), a2=art2On(L);
    for (let k=0;k<n;k++){
      const i=a2?fanIdx(k,n):k;
      const a=(i/(n-1)-0.5)*(L.fan||2.2)+(rnd()-0.5)*0.12, len=H*(L.leafLen||0.7)*(0.72+rnd()*0.34);
      const bx=Math.sin(a)*len*(L.sweep||0.78)+sway*len*0.04;
      const by=-len*((L.tipLift||0.28)+rnd()*0.12);
      const jit=(rnd()-0.5)*18, baseX=(rnd()-0.5)*5;
      const arch=-len*(L.arch||0.72);
      if (a2){
        // These are the broadest blades in the wave (leafW 2.6) and a real
        // Hakonechloa blade narrows to a fine drawn-out point, so the constant
        // stroke was reading as a flat gold worm.
        const z=Math.max(0,1-Math.abs(i/(n-1)-0.5)*2)*0.78+rnd()*0.22;
        drawBlade(ctx, baseX,-(1-z)*H*0.02, bx*0.18,arch, bx,by,
                  (L.leafW||2.2)*(L.bladeHW||0.85)*(0.84+z*0.16),
                  shade(S.fol, jit-(1-z)*(L.bladeShade||19)), z>0.42);
        if (L.stripe){                       // the variegation rides the blade
          ctx.strokeStyle=shade(L.stripe,(rnd()-0.5)*12);
          ctx.lineWidth=Math.max(0.6,(L.leafW||2.2)*0.26);
          ctx.beginPath(); ctx.moveTo(baseX,-1);
          ctx.quadraticCurveTo(bx*0.18,arch,bx*0.94,by*0.96); ctx.stroke();
        }
      } else {
        ctx.strokeStyle=shade(S.fol,jit); ctx.lineWidth=L.leafW||2.2; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(baseX,0);
        ctx.quadraticCurveTo(bx*0.18,arch,bx,by); ctx.stroke();
        if (L.stripe){
          ctx.strokeStyle=shade(L.stripe,(rnd()-0.5)*12); ctx.lineWidth=Math.max(0.7,(L.leafW||2.2)*0.32);
          ctx.beginPath(); ctx.moveTo((rnd()-0.5)*3,-1);
          ctx.quadraticCurveTo(bx*0.18,arch,bx,by); ctx.stroke();
        }
      }
    }
    if (S.seed && mature){
      ctx.strokeStyle=shade(S.fol||S.seed,-18); ctx.lineWidth=0.85;
      for (let i=0;i<3;i++){ const ox=(rnd()-0.5)*10, len=H*(0.62+rnd()*0.16), tip=ox+sway*2;
        ctx.beginPath(); ctx.moveTo(ox*0.4,0); ctx.quadraticCurveTo(ox,-len*0.5,tip,-len); ctx.stroke();
        if (a2) drawFloret(ctx,tip,-len,1.2,S.seed,{squash:3.17,rot:0.2});
        else { ctx.fillStyle=S.seed; ctx.beginPath(); ctx.ellipse(tip,-len,1.2,3.8,0.2,0,7); ctx.fill(); } }
    }
  }
  else if (P.form === 'cone' || P.form === 'globe' || P.form === 'spike' || P.form === 'umbel'){
    const L = P.look||{}; // per-species carriage: leafiness, wispiness, droop
    // basal foliage (skipped in seasons with no foliage color)
    if (S.fol){
      const fn = stemFor(L.leaves||8);
      ctx.strokeStyle = S.fol; ctx.lineWidth = L.leafW||1.8;
      ctx.lineCap = L.leafCap || 'round';
      if (art2On(L) && L.leafShape && L.leafStyle==='willow'){
        // Willow-leaf sunflower is a column of drooping threads, not a basal
        // fan — the architecture IS the species, so ART2 keeps the classic
        // layout and only swaps the stroked line for a filled blade.
        const spread=L.leafSpread||1.8, fan=L.leafFan||0.42;
        for (let i=0;i<fn;i++){
          const u=fn>1 ? i/(fn-1) : 0.5, side=Math.sin((u-0.5)*Math.PI);
          const l=H*(L.leafLen||0.6)*(0.82+rnd()*0.32);
          const bx=(rnd()-0.5)*7, by=(rnd()-0.5)*3;
          const ex=bx+side*l*fan*spread+(rnd()-0.5)*2.5, ey=by-l*(0.68+rnd()*0.24);
          drawLeaf(ctx, bx,by, ex,ey, (L.leafW||0.85)*(L.leafHW||1.6), shade(S.fol,(rnd()-0.5)*16),
                   {shape:L.leafShape, bow:side*0.10, rib:false});
        }
        const crowns = stemFor(L.crowns||0);
        for (let c=0;c<crowns;c++){
          const cx=(rnd()-0.5)*16, cy=-H*(0.28+rnd()*0.42), cn=L.crownLeaves||6;
          for (let j=0;j<cn;j++){
            const a=(j/cn)*Math.PI*2, ll=H*0.11*(0.75+rnd()*0.45);
            drawLeaf(ctx, cx,cy, cx+Math.cos(a)*ll*0.8, cy+Math.sin(a)*ll*0.55,
                     (L.leafW||0.85)*(L.leafHW||1.6), S.fol, {shape:L.leafShape, rib:false});
          }
        }
      }
      else if (art2On(L) && L.leafShape){
        // ART2: filled foliage with a species silhouette, sorted back-to-front.
        // The classic `else` below draws every species as the same stroked fan,
        // which is why purpurea and pallida are near-indistinguishable today.
        // globeStyle:'rattlesnake' funnels here too — its classic branch is a
        // wider fan of the same stroked blade, so leafFan/leafRise carry it.
        const blades=[];
        for (let i=0;i<fn;i++) blades.push({
          a:(i/Math.max(1,fn-1)-0.5)*(L.leafFan||1.5)+(rnd()-0.5)*0.14,
          l:H*(L.leafLen||0.34)*(0.80+rnd()*0.34),
          z:rnd() });
        blades.sort((p,q)=>q.z-p.z);
        for (const b of blades){
          const rec=0.82+0.18*(1-b.z);                  // back leaves recede
          // basal foliage rises more than it splays — the vertical factor has
          // to exceed sin(fan/2) or the clump reads as a flat tropical rosette
          drawLeaf(ctx, (rnd()-0.5)*3, -b.z*2,
                   Math.sin(b.a)*b.l*rec + sway*b.l*0.03, -b.l*(L.leafRise||0.74)*rec,
                   (L.leafW||1.8)*(L.leafHW||1.5)*rec,
                   shade(S.fol,(b.z-0.5)*-20),
                   {shape:L.leafShape, teeth:L.leafTeeth, teethN:L.leafTeethN,
                    bow:L.leafBow===undefined?0.06:L.leafBow, rib:L.leafRib});
        }
      }
      else if (L.globeStyle==='rattlesnake'){
        const fan=L.fan||2.45;
        for(let i=0;i<fn;i++){
          const a=(i/(fn-1)-0.5)*fan+(rnd()-0.5)*0.10, l=H*(L.leafLen||0.52)*(0.82+rnd()*0.24);
          const ex=Math.sin(a)*l*(L.leafSpread||0.62)+sway*l*0.025, ey=-l*(0.72+rnd()*0.12);
          ctx.strokeStyle=shade(S.fol,(rnd()-0.5)*18); ctx.lineWidth=L.leafW||1.35;
          ctx.beginPath(); ctx.moveTo((rnd()-0.5)*3,0);
          ctx.quadraticCurveTo(ex*0.20,-l*0.46,ex,ey); ctx.stroke();
        }
      } else if (L.leafStyle === 'willow'){
        const spread = L.leafSpread || 1.8, fan = L.leafFan || 0.42;
        for (let i=0;i<fn;i++){
          const u=fn>1 ? i/(fn-1) : 0.5, side=Math.sin((u-0.5)*Math.PI);
          const l=H*(L.leafLen||0.6)*(0.82+rnd()*0.32);
          const bx=(rnd()-0.5)*7, by=(rnd()-0.5)*3;
          const ex=bx+side*l*fan*spread+(rnd()-0.5)*2.5, ey=by-l*(0.68+rnd()*0.24);
          ctx.beginPath(); ctx.moveTo(bx,by);
          ctx.quadraticCurveTo(bx+side*l*0.18,by-l*0.42,ex,ey); ctx.stroke();
        }
        const crowns = stemFor(L.crowns||0);
        for (let c=0;c<crowns;c++){
          const cx=(rnd()-0.5)*16, cy=-H*(0.28+rnd()*0.42), n=L.crownLeaves||6;
          for (let j=0;j<n;j++){
            const a=(j/n)*Math.PI*2, ll=H*0.11*(0.75+rnd()*0.45);
            ctx.beginPath(); ctx.moveTo(cx,cy);
            ctx.lineTo(cx+Math.cos(a)*ll*0.8, cy+Math.sin(a)*ll*0.55); ctx.stroke();
          }
        }
      } else {
        for (let i=0;i<fn;i++){ const a=(i/(fn-1)-0.5)*1.8, l=H*(L.leafLen||0.34);
          ctx.beginPath(); ctx.moveTo(0,0);
          ctx.quadraticCurveTo(Math.sin(a)*l*0.7,-l*0.5,Math.sin(a)*l,-l*0.55); ctx.stroke(); }
      }
      ctx.lineCap = 'butt';
    }
    // flower stems
    const sn = stemFor(P.form==='spike'?(L.stems||7):(L.stems||6));
    // ART2: give the clump depth. Each stem takes a z — back stems root further
    // away, draw smaller and duller, and paint FIRST. The classic path draws
    // them flat in loop order, so a back flower can paint over a front one.
    let ord=null;
    if (art2On(L)){ ord=[]; for (let i=0;i<sn;i++) ord.push({i,z:rnd()}); ord.sort((a,b)=>b.z-a.z); }
    for (let k=0;k<sn;k++){
      const i   = ord? ord[k].i : k;
      const z   = ord? ord[k].z : 0.5;
      const rec = ord? 0.84+0.16*(1-z) : 1;      // recession scale
      const by0 = ord? -z*H*0.05 : 0;            // back stems root further away
      if (ord) ctx.globalAlpha = 0.84+0.16*(1-z);
      const ox=(rnd()-0.5)*(L.stemSpread||14);
      const len=H*((L.lenBase||0.75)+rnd()*(L.lenJitter||0.3))*rec;
      const tx=ox+sway*len*0.05+(P.form==='spike'?(rnd()-0.5)*(L.wildLean||0):0);
      ctx.strokeStyle = P.stem || shade(S.fol,-18);
      ctx.lineWidth=1.3*rec; ctx.beginPath(); ctx.moveTo(ox*0.4,by0);
      ctx.quadraticCurveTo(ox,by0-len*0.55,tx,by0-len); ctx.stroke();
      if (S.fol && L.stemLeaves){
        const leafPairs = Math.max(1, Math.round(L.stemLeaves));
        ctx.strokeStyle = S.fol; ctx.lineWidth = L.stemLeafW || 1;
        ctx.lineCap = 'round';
        for (let lp=0; lp<leafPairs; lp++){
          const f=(lp+1)/(leafPairs+1), px=ox*0.35+(tx-ox*0.35)*f*0.75, py=by0-len*(0.18+f*0.54);
          const side=((lp+i)%2===0?-1:1), ll=(L.stemLeafLen||7)*(0.8+rnd()*0.35)*rec;
          if (art2On(L) && L.leafShape){
            drawLeaf(ctx, px,py, px+side*ll, py-ll*0.30,
                     (L.stemLeafW||1)*(L.leafHW||1.6), S.fol,
                     // same size gate as the mound: a false sunflower carries
                     // 36 of these, and under ~9px the midrib is not resolvable
                     {shape:L.leafShape, teeth:L.leafTeeth, teethN:L.leafTeethN,
                      bow:side*0.05, rib:ll>=9});
            ctx.strokeStyle=S.fol;
          } else {
            ctx.beginPath(); ctx.moveTo(px,py);
            ctx.quadraticCurveTo(px+side*ll*0.45,py-ll*0.08,px+side*ll,py-ll*0.28);
            ctx.stroke();
          }
        }
        ctx.lineCap = 'butt';
      }
      if (!mature){ ctx.globalAlpha=1; continue; }
      const hx=tx, hy=by0-len;
      // bloom staggering: only the leading fraction of stems flower
      const headOn = blooming && i < Math.max(1, Math.ceil(sn*blv));
      if (P.form==='cone'){
        const headCount = Math.max(1, Math.round(L.heads||1));
        const headOffset = (n,total)=>{
          if (total<=1) return {x:0,y:0,s:1};
          const side=n-(total-1)/2, row=Math.abs(side);
          return {
            x:side*(L.headSpread||4)+(rnd()-0.5)*1.5,
            y:row*(L.headDrop||2)+rnd()*1.3,
            s:row<0.3 ? 1 : (L.sideHeadScale||0.84)*(0.88+rnd()*0.2)
          };
        };
        const drawConeHead = (cx,cy,sc)=>{
          const rays=L.rays||7, rl=(L.rayLen||6)*sc, dr=(L.droop===undefined?2.5:L.droop)*sc;
          const dw=(L.discW||3.2)*sc, dh=(L.discH||3.6)*sc, dy=(L.discY===undefined?-1:L.discY)*sc;
          const rw=(L.rayW||2.2)*sc;
          if (art2On(L)){
            // ART2: rays are filled, tapered, veined straps and the cone is a
            // lit dome. Back rays paint first so the cone occludes them.
            // rayShape is real botany and stays load-bearing: a spoon ray
            // (rudbeckia) is a broad blunt paddle, a round ray (desert daisies)
            // is short and broad, a notched ray (helenium, coreopsis) ends in
            // teeth. drawRay already gives the blunt-tipped strap the first two
            // want; the teeth are a batched second pass, gated on being big
            // enough to see at all.
            const rsh=L.rayShape;
            const hwK = rsh==='spoon'?1.10 : rsh==='round'?1.18 : rsh==='notched'?0.90 : 0.92;
            // rayW is a classic STROKE width; drawRay's hw is a HALF-width, so
            // taking it straight doubles the petal. Echinacea absorbs that (it
            // wants full petals) but at 11 rays a black-eyed Susan merges into
            // one flat annulus, so the width is capped by how much the rays may
            // overlap AT THE DISC EDGE, where they actually crowd. See RAY_FIT.
            const dEdge = Math.max(dw, rl*0.30);
            const rw2 = Math.min(rw*hwK, RAY_FIT.crowd*Math.PI*dEdge/Math.max(3,rays));
            // and where the disc buries the profile's shoulder, start the
            // ribbon at the disc edge so the petal reads as a paddle
            const em = (rays >= 9 && dw >= rl*RAY_FIT.emerge) ? dw*RAY_FIT.base : 0;
            // SIZE GATE. A tapered ribbon costs ~18 path calls, a fill and a
            // shade() lookup; a round-capped stroke costs four, and the whole
            // head batches into ONE. Below ~5px of ray they are the same three
            // pixels on screen, and the species that draw them are exactly the
            // ones that draw the MOST of them (desert marigold: 12 stems x 20
            // rays = 240 per plant per frame). So many-rayed small heads get
            // the cheap path and keep the ART2 dome and foliage. The threshold
            // sits below E. angustifolia's rayLen 5 on purpose — none of the
            // five already-calibrated Echinacea may cross it.
            if (rl < 4.7 && rays >= 6){
              ctx.strokeStyle=shade(S.bloom,4); ctx.lineWidth=rw2*1.5;
              ctx.lineCap=L.rayCap||'round'; ctx.beginPath();
              for(let p=0;p<rays;p++){ const pa=p/rays*Math.PI*2;
                ctx.moveTo(cx,cy);
                ctx.lineTo(cx+Math.cos(pa)*rl, cy+Math.sin(pa)*rl*0.75+dr); }
              ctx.stroke();
            } else {
              _rayOpt.vein = rsh!=='round';
              _rayOpt.emergent = em>0;   // starts at the disc edge: full-width base
              const order=[];
              for(let p=0;p<rays;p++) order.push({p, s:Math.sin(p/rays*Math.PI*2)});
              order.sort((a,b)=>a.s-b.s);
              for(const o of order){
                const pa=o.p/rays*Math.PI*2;
                // same tip either way: the emergent start just moves the ORIGIN
                // out to the disc edge and shortens the ribbon to match
                drawRay(ctx, cx+Math.cos(pa)*em, cy+Math.sin(pa)*em*0.75,
                        pa, rl-em, rw2, dr, shade(S.bloom,(o.s)*7), _rayOpt);
              }
            }
            if (rsh==='notched' && rl>=4.2){
              // three-toothed tips, all rays in one path: a coreopsis ray ends
              // in notches, and at 14 rays a path each would cost more than the
              // whole rest of the head.
              ctx.strokeStyle=shade(S.bloom,-26); ctx.lineWidth=Math.max(0.4,rw*0.30);
              ctx.beginPath();
              for(let p=0;p<rays;p++){
                const pa=p/rays*Math.PI*2, ca=Math.cos(pa), sa=Math.sin(pa);
                const ex=cx+ca*rl, ey=cy+sa*rl*0.75+dr;
                ctx.moveTo(ex-ca*rl*0.22, ey-sa*rl*0.165);
                ctx.lineTo(ex, ey);
              }
              ctx.stroke();
            }
            // drawConeDome throws its bristle rim out to 1.20/1.24 of the
            // radii it is given, so a dome drawn at the classic disc size
            // occupies ~45% more area than the flat ellipse it replaced. On the
            // crowded heads that is exactly what tips the balance and lets the
            // eye dominate the rays. Pull the dome in so the RIM lands on the
            // classic disc edge; the uncrowded heads (Echinacea among them)
            // keep the dome the prototype calibrated.
            const ds = em ? RAY_FIT.disc : 1;
            drawConeDome(ctx,cx,cy+dy,dw*ds,dh*ds,S.eye||'#b5651d',rnd);
            ctx.lineCap='butt';
            return;
          }
          ctx.strokeStyle=S.bloom; ctx.lineWidth=rw; ctx.lineCap=L.rayCap||'round';
          for(let p=0;p<rays;p++){ const pa=p/rays*Math.PI*2;
            ctx.beginPath(); ctx.moveTo(cx,cy);
            const ex=cx+Math.cos(pa)*rl, ey=cy+Math.sin(pa)*rl*0.75+dr;
            if (L.rayShape==='notched'){
              ctx.quadraticCurveTo(cx+Math.cos(pa)*rl*0.55,cy+Math.sin(pa)*rl*0.28+dr*0.45,ex,ey); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(ex,ey);
              ctx.lineTo(ex+Math.cos(pa+0.55)*1.5*sc,ey+Math.sin(pa+0.55)*1.1*sc); ctx.stroke();
            } else if (L.rayShape==='spoon'){
              ctx.quadraticCurveTo(cx+Math.cos(pa)*rl*0.45,cy+Math.sin(pa)*rl*0.25+dr*0.4,ex,ey); ctx.stroke();
              ctx.beginPath(); ctx.ellipse(ex,ey,rw*0.72,rw*0.42,pa,0,7); ctx.fillStyle=S.bloom; ctx.fill();
            } else {
              ctx.lineTo(ex,ey); ctx.stroke();
            } }
          ctx.fillStyle=S.eye||'#b5651d';
          ctx.beginPath(); ctx.ellipse(cx,cy+dy,dw,dh,0,0,7); ctx.fill();
          ctx.lineCap='butt';
        };
        const drawSeedHead = (cx,cy,sc)=>{
          // The winter seedhead is the whole Oudolf argument, and classic draws
          // it as one flat ellipse. It is the same cone with the rays gone, so
          // it gets the same lit, bristly dome — that bristle rim IS the thing
          // that catches frost.
          if (art2On(L)){
            drawConeDome(ctx,cx,cy,(L.seedW||3)*sc,(L.seedH||3.8)*sc,S.seed,rnd);
            return;
          }
          ctx.fillStyle=S.seed;
          ctx.beginPath(); ctx.ellipse(cx,cy,(L.seedW||3)*sc,(L.seedH||3.8)*sc,0,0,7); ctx.fill();
        };
        // heads take only HALF the stem's recession — a flower further back is
        // barely smaller on screen, and scaling it fully makes the clump read
        // as a size gradient rather than as depth.
        const hRec=(1+rec)/2;
        if (headOn){
          for(let h=0; h<headCount; h++){ const o=headOffset(h,headCount); drawConeHead(hx+o.x,hy+o.y,o.s*hRec); }
        } else if (S.seed){
          const seedCount = Math.max(1, Math.round(L.seedHeads || Math.min(headCount,3)));
          for(let h=0; h<seedCount; h++){ const o=headOffset(h,seedCount); drawSeedHead(hx+o.x,hy+o.y,o.s*hRec); }
        }
      }
      else if (P.form==='globe'){
        const col = (headOn?S.bloom:null) || S.seed;
        if (col){ ctx.fillStyle=col;
          const hr = L.headR || (key==='allium'?5:4.2);
          const ghx = hx + (L.nod?4:0), ghy = hy + (L.nod?5:0);
          if (L.nod){
            ctx.strokeStyle=shade(S.fol||col,-25); ctx.lineWidth=1;
            ctx.beginPath(); ctx.moveTo(hx,hy);
            ctx.quadraticCurveTo(hx+2,hy+3,ghx,ghy-hr*0.45); ctx.stroke();
          }
          if (art2On(L)){
            // ART2 globe: the head stops being a flat disc and becomes a lit
            // sphere carrying separate florets. An allium is not a ball — it is
            // an umbel of pedicels each ending in a star — so the spokes stay
            // (batched into one stroke instead of one per spoke) and a floret
            // lands on every spoke tip, with a few more scattered inside.
            const gs=L.globeStyle;
            if (gs==='seaHolly' || gs==='rattlesnake'){
              // spiny ruff: every bract in ONE path, so the whole collar is a
              // single gradient fill rather than 9-18 flat triangles
              const seaH=gs==='seaHolly';
              const bracts=Math.max(seaH?8:6,Math.round(L.bracts||(seaH?12:9)));
              const bractLen=L.bractLen||(seaH?4.6:2.1), bractW=L.bractW||1.2;
              const inR=seaH?hr*0.38:(L.headW||3.4)*0.45, inRy=seaH?hr*0.38:(L.headH||4.8)*0.35;
              ctx.beginPath();
              for(let p=0;p<bracts;p++){
                const a=p/bracts*Math.PI*2, ca=Math.cos(a), sa=Math.sin(a);
                const bx=ghx+ca*inR, by=ghy+sa*inRy;
                const tx=ghx+ca*(seaH?hr+bractLen:inR+bractLen), ty=ghy+sa*(seaH?hr+bractLen:inRy+bractLen);
                const px=Math.cos(a+Math.PI/2)*bractW, py=Math.sin(a+Math.PI/2)*bractW*(seaH?1:0.75);
                ctx.moveTo(bx+px,by+py); ctx.lineTo(tx,ty); ctx.lineTo(bx-px,by-py); ctx.closePath();
              }
              litFill(ctx,ghx,ghy,hr+bractLen,S.bract||shade(S.fol||col,seaH?24:18));
            }
            ctx.beginPath();
            if (gs==='seaHolly') ctx.ellipse(ghx,ghy,hr*0.84,hr*1.08,0,0,7);
            else if (gs==='rattlesnake') ctx.ellipse(ghx,ghy,L.headW||3.4,L.headH||4.8,0,0,7);
            else ctx.arc(ghx,ghy,hr,0,7);
            litFill(ctx,ghx,ghy,hr,col,22,-26);
            const spokes=L.spokes||6;
            const spokeR=gs==='seaHolly'?hr*1.02:(gs==='rattlesnake'?(L.headW||3.4)*1.08:hr*1.22);
            ctx.strokeStyle=shade(col,-30); ctx.lineWidth=0.7; ctx.beginPath();
            for(let p=0;p<spokes;p++){ const pa=p/spokes*Math.PI*2;
              ctx.moveTo(ghx,ghy);
              ctx.lineTo(ghx+Math.cos(pa)*spokeR,ghy+Math.sin(pa)*spokeR); }
            ctx.stroke();
            // Rattlesnake master's button is defined by headW/headH, not headR,
            // so it needs its own radius here or it silently skips the floret
            // pass and renders as a smooth white ball — the one thing a
            // bristly Eryngium head is not.
            const gr = gs==='rattlesnake' ? (L.headW||3.4) : hr;
            if (gr>=2.6){
              const fr=Math.max(0.85,gr*0.21);
              for(let p=0;p<spokes;p++){ const pa=p/spokes*Math.PI*2;
                fcPush(ghx+Math.cos(pa)*spokeR*0.92, ghy+Math.sin(pa)*spokeR*0.92, fr*(0.85+rnd()*0.3)); }
              const inner=Math.round(gr*0.7);
              for(let p=0;p<inner;p++){ const pa=rnd()*Math.PI*2, rr=Math.sqrt(rnd())*gr*0.62;
                fcPush(ghx+Math.cos(pa)*rr, ghy+Math.sin(pa)*rr, fr*(0.8+rnd()*0.3)); }
              fcDraw(ctx,col,26,-4);
            }
            if (L.topknot) drawFloret(ctx,ghx,ghy-hr*1.15,hr*0.42,L.topknot,{squash:0.66});
          }
          else {
          // NOTE: the bract collars below are a PREFIX to the shared ball, not
          // alternatives to it. Chaining the ART2 branch on as another `else if`
          // put the ball in the final `else` and silently deleted the head of
          // every classic sea holly and rattlesnake master — caught only by
          // diffing the classic render against the base build, which is why
          // that check exists alongside the flag-on/off scope proof.
          if (L.globeStyle==='seaHolly'){
            const bracts=Math.max(8,Math.round(L.bracts||12)), bractLen=L.bractLen||4.6, bractW=L.bractW||1.2;
            ctx.fillStyle=S.bract||shade(S.fol||col,24);
            for(let p=0;p<bracts;p++){
              const a=p/bracts*Math.PI*2, bx=ghx+Math.cos(a)*hr*0.38, by=ghy+Math.sin(a)*hr*0.38;
              const tx=ghx+Math.cos(a)*(hr+bractLen), ty=ghy+Math.sin(a)*(hr+bractLen);
              const px=Math.cos(a+Math.PI/2)*bractW, py=Math.sin(a+Math.PI/2)*bractW;
              ctx.beginPath(); ctx.moveTo(bx+px,by+py); ctx.lineTo(tx,ty); ctx.lineTo(bx-px,by-py); ctx.closePath(); ctx.fill();
            }
          } else if (L.globeStyle==='rattlesnake'){
            const bracts=Math.max(6,Math.round(L.bracts||9)), bractLen=L.bractLen||2.1;
            ctx.fillStyle=shade(S.fol||col,18);
            for(let p=0;p<bracts;p++){
              const a=p/bracts*Math.PI*2, bx=ghx+Math.cos(a)*(L.headW||3.4)*0.45, by=ghy+Math.sin(a)*(L.headH||4.8)*0.35;
              ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(bx+Math.cos(a)*bractLen,by+Math.sin(a)*bractLen); ctx.lineTo(ghx,ghy); ctx.closePath(); ctx.fill();
            }
          }
          ctx.fillStyle=col; ctx.beginPath();
          if (L.globeStyle==='seaHolly') ctx.ellipse(ghx,ghy,hr*0.84,hr*1.08,0,0,7);
          else if (L.globeStyle==='rattlesnake') ctx.ellipse(ghx,ghy,L.headW||3.4,L.headH||4.8,0,0,7);
          else ctx.arc(ghx,ghy,hr,0,7);
          ctx.fill();
          ctx.strokeStyle=shade(col,-30); ctx.lineWidth=0.7;
          const spokes=L.spokes||6;
          for(let p=0;p<spokes;p++){ const pa=p/spokes*Math.PI*2;
            ctx.beginPath(); ctx.moveTo(ghx,ghy);
            const spokeR=L.globeStyle==='seaHolly'?hr*1.02:(L.globeStyle==='rattlesnake'?(L.headW||3.4)*1.08:hr*1.3);
            ctx.lineTo(ghx+Math.cos(pa)*spokeR,ghy+Math.sin(pa)*spokeR); ctx.stroke(); }
          if (L.topknot){
            ctx.fillStyle=L.topknot;
            ctx.beginPath(); ctx.ellipse(ghx, ghy-hr*1.15, hr*0.42, hr*0.28, 0, 0, 7); ctx.fill();
          } } }
      }
      else if (P.form==='umbel'){ // flat-to-domed corymb of tiny florets
        const col=(headOn?S.bloom:null)||S.seed;
        if (col){ ctx.fillStyle=col;
          const rad=L.head||6, dome=(L.dome===undefined?0.4:L.dome), dots=Math.round(rad*2);
          if (art2On(L)){
            // A corymb is a dome of florets, and classic paints every one the
            // same flat colour, so a milkweed umbel and a yarrow plate read
            // identically. Batched two-pass: the whole head is 2 fills (down
            // from `dots`), and the near florets carry a highlight so `dome`
            // finally shows as depth. Painted back-to-front by staging the far
            // half first — fcDraw preserves push order.
            const fr=L.floretR||1.5;
            for(let d2=0;d2<dots;d2++){
              const a2=rnd()*Math.PI*2, rr=Math.sqrt(rnd())*rad;
              const depth=(Math.sin(a2)+1)/2;             // 0 = far side of the dome
              fcPush(hx+Math.cos(a2)*rr, hy-rad*dome*0.5-Math.sin(a2)*rr*dome,
                     fr*(0.80+depth*0.34), 0.88);
            }
            fcDraw(ctx,col,26,-12);
            // A few buds crowning the dome: cheap, and it stops a big umbel
            // (joe-pye, filipendula) reading as a flat sprayed disc.
            if (rad>=5.5 && dome>=0.35){
              const crown=Math.round(rad*0.7);
              for(let d2=0;d2<crown;d2++){
                const a2=rnd()*Math.PI, rr=Math.sqrt(rnd())*rad*0.7;
                fcPush(hx+Math.cos(a2)*rr, hy-rad*dome*0.5-rad*dome*0.55-rnd()*1.6, fr*0.72, 0.9);
              }
              fcDraw(ctx,shade(col,14),22,-6);
            }
          } else
          for(let d2=0;d2<dots;d2++){ const a2=rnd()*Math.PI*2, rr=Math.sqrt(rnd())*rad;
            ctx.beginPath();
            ctx.ellipse(hx+Math.cos(a2)*rr, hy-rad*dome*0.5-Math.sin(a2)*rr*dome, 1.5,1.3,0,0,7);
            ctx.fill(); } }
      }
      else { // spike
        const col=(headOn?S.bloom:null)||S.seed;
        const a2=art2On(L);
        if (col){
          if (L.spikeStyle==='bell'){
            const bells=Math.max(2,Math.round(L.bellCount||5)), bellW=L.bellW||2.8, bellH=L.bellH||4.2;
            // The pedicels all share a style, so ART2 draws them as one path.
            if (a2){
              ctx.strokeStyle=shade(S.fol||col,-24); ctx.lineWidth=0.85; ctx.beginPath();
              for(let b=0;b<bells;b++){
                const side=b%2?-1:1, rootY=hy+b*bellH*0.8, bx=hx+side*(L.bellLean||2.6);
                ctx.moveTo(hx,rootY-1); ctx.quadraticCurveTo(hx+side*1.4,rootY,bx,rootY);
              }
              ctx.stroke();
            }
            for(let b=0;b<bells;b++){
              const side=b%2?-1:1, rootY=hy+b*bellH*0.8, bx=hx+side*(L.bellLean||2.6), by=rootY+bellH*0.36;
              if (a2){
                // an inflated tubular bell reads as a lit body with a pale
                // throat; drawFloret is exactly that pair, in one call
                drawFloret(ctx,bx,by,bellW,shade(col,(rnd()-0.5)*16),
                           {squash:bellH/bellW, rot:side*0.18, lift:20, drop:-14});
                drawFloret(ctx,bx+side*bellW*0.30,by+bellH*0.30,bellW*0.52,shade(col,24),
                           {squash:0.48, rot:side*0.16, lift:16, drop:0});
                continue;
              }
              ctx.strokeStyle=shade(S.fol||col,-24); ctx.lineWidth=0.85;
              ctx.beginPath(); ctx.moveTo(hx,rootY-1); ctx.quadraticCurveTo(hx+side*1.4,rootY,bx,by-bellH*0.36); ctx.stroke();
              ctx.fillStyle=shade(col,(rnd()-0.5)*16);
              ctx.beginPath(); ctx.ellipse(bx,by,bellW,bellH,side*0.18,0,7); ctx.fill();
              ctx.fillStyle=shade(col,22);
              ctx.beginPath(); ctx.ellipse(bx+side*bellW*0.22,by+bellH*0.26,bellW*0.62,bellH*0.28,side*0.16,0,7); ctx.fill();
            }
          } else if (L.spikeStyle==='penstemon'){
            const tubes=Math.max(3,Math.round(L.tubeCount||7)), tubeLen=L.tubeLen||4.8,
              tubeW=L.tubeW||2.4, lean=L.tubeLean||3, drop=L.tubeDrop||0;
            for(let t=0;t<tubes;t++){
              const u=tubes===1?0.5:t/(tubes-1), side=t%2?-1:1;
              const rootY=hy+u*(L.tubeSpan||H*0.34), rootX=hx+(rnd()-0.5)*1.2;
              const tx=rootX+side*lean, ty=rootY+drop+(rnd()-0.5)*1.2;
              ctx.strokeStyle=shade(S.fol||col,-22); ctx.lineWidth=0.75;
              ctx.beginPath(); ctx.moveTo(rootX,rootY); ctx.quadraticCurveTo(rootX+side*1.5,rootY+0.4,tx,ty); ctx.stroke();
              if (a2){
                // penstemon's tube is a lit cylinder with a two-lobed lip; the
                // lip is what says "penstemon", so it keeps its two ellipses —
                // they just carry a highlight now instead of one flat tint
                drawFloret(ctx,tx,ty,tubeLen*0.58,shade(col,(rnd()-0.5)*14),
                           {squash:tubeW/(tubeLen*0.58), rot:side*0.10, lift:22, drop:-16});
                fcPush(tx+side*tubeLen*0.40,ty-tubeW*0.34,tubeW*0.72,0.66);
                fcPush(tx+side*tubeLen*0.40,ty+tubeW*0.34,tubeW*0.80,0.60);
                fcDraw(ctx,shade(col,18),18,-4);
                continue;
              }
              ctx.fillStyle=shade(col,(rnd()-0.5)*14);
              ctx.beginPath(); ctx.ellipse(tx,ty,tubeLen*0.58,tubeW,side*0.10,0,7); ctx.fill();
              ctx.fillStyle=shade(col,18);
              ctx.beginPath(); ctx.ellipse(tx+side*tubeLen*0.40,ty-tubeW*0.34,tubeW*0.72,tubeW*0.48,side*0.12,0,7); ctx.fill();
              ctx.beginPath(); ctx.ellipse(tx+side*tubeLen*0.40,ty+tubeW*0.34,tubeW*0.80,tubeW*0.48,side*0.12,0,7); ctx.fill();
            }
          } else if (L.spikeStyle==='culvers'){
            const arms=Math.max(3,Math.round(L.candelabraArms||5)), buds=Math.max(3,Math.round(L.candelabraBuds||5));
            for(let a=0;a<arms;a++){
              const side=a%2?-1:1, f=arms===1?0.5:a/(arms-1), by=hy+f*H*0.27;
              const ex=hx+side*(L.candelabraReach||8)*(0.65+rnd()*0.35), ey=by-(L.candelabraLift||7)*(0.70+rnd()*0.25);
              ctx.strokeStyle=shade(S.fol||col,-22); ctx.lineWidth=0.85;
              ctx.beginPath(); ctx.moveTo(hx,by); ctx.quadraticCurveTo(hx+side*3,by-2,ex,ey); ctx.stroke();
              if (a2){
                for(let b=0;b<buds;b++){ const u=b/(buds-1);
                  fcPush(ex+(rnd()-0.5)*1.2, ey+u*(L.candelabraSpike||9), 1.35, 1.22); }
                fcDraw(ctx,shade(col,(rnd()-0.5)*16),24,-10);
                continue;
              }
              ctx.fillStyle=shade(col,(rnd()-0.5)*16);
              for(let b=0;b<buds;b++){ const u=b/(buds-1);
                ctx.beginPath(); ctx.ellipse(ex+(rnd()-0.5)*1.2,ey+u*(L.candelabraSpike||9),1.35,1.65,0,0,7); ctx.fill(); }
            }
          } else if (L.spikeStyle==='prairieClover'){
            const spikeLen=L.spikeLen||10, florets=Math.max(5,Math.round(L.florets||7));
            ctx.strokeStyle=shade(S.fol||col,-24); ctx.lineWidth=1.05;
            ctx.beginPath(); ctx.moveTo(hx,hy+spikeLen+1); ctx.lineTo(hx,hy-2); ctx.stroke();
            const shown=blooming ? Math.max(1,Math.ceil(florets*blv)) : florets;
            if (a2){
              // Dalea flowers as a ring creeping up a bare cylinder. The whole
              // ring is one 2-fill batch, so the wreath finally has a lit side.
              for(let f=0;f<shown;f++){
                const yy=hy+spikeLen-(f/(florets-1))*spikeLen;
                fcPush(hx-(1.4+rnd()*0.9),yy,1.4,0.78);
                fcPush(hx+(1.4+rnd()*0.9),yy,1.4,0.78);
              }
              fcDraw(ctx,col,26,-14);
            } else
            for(let f=0;f<shown;f++){
              const yy=hy+spikeLen-(f/(florets-1))*spikeLen;
              ctx.fillStyle=shade(col,(rnd()-0.5)*16);
              for(const side of [-1,1]){ ctx.beginPath(); ctx.ellipse(hx+side*(1.4+rnd()*0.9),yy,1.4,1.05,side*0.35,0,7); ctx.fill(); }
            }
          } else if (L.spikeStyle==='goldenrodPanicle'){
            const panicles=Math.max(3,Math.round(L.panicles||6)), dots=Math.max(3,Math.round(L.panicleDots||6));
            // ART2 batches the rachis strokes AND the dots. Rough goldenrod
            // draws ~360 dots per plant, so per-dot paths were the single
            // biggest op sink in this form — one stroke plus two fills for the
            // whole spray instead. Staged in the same loop so nothing has to be
            // remembered in an array: allocating one per head per frame is
            // precisely the GC churn the perf rules exist to prevent.
            if (a2){ ctx.strokeStyle=shade(S.fol||col,-22); ctx.lineWidth=0.8; ctx.beginPath(); }
            for(let p=0;p<panicles;p++){
              const u=panicles===1?0.5:p/(panicles-1), side=p%2?-1:1;
              const baseY=hy+u*H*0.30, reach=(L.panicleSpread||13)*(0.58+rnd()*0.42);
              const endX=hx+side*reach, endY=baseY+(L.panicleDrop||6)*(0.55+rnd()*0.45);
              if (a2){
                ctx.moveTo(hx,baseY); ctx.quadraticCurveTo(hx+side*reach*0.52,baseY-1,endX,endY);
                for(let d=0;d<dots;d++){
                  const f=0.38+d/(dots-1)*0.62;
                  fcPush(hx+(endX-hx)*f+(rnd()-0.5)*2.2, baseY+(endY-baseY)*f+(rnd()-0.5)*2.2,
                         1.15+rnd()*0.35, 0.92);
                }
                continue;
              }
              ctx.strokeStyle=shade(S.fol||col,-22); ctx.lineWidth=0.8;
              ctx.beginPath(); ctx.moveTo(hx,baseY); ctx.quadraticCurveTo(hx+side*reach*0.52,baseY-1,endX,endY); ctx.stroke();
              ctx.fillStyle=shade(col,(rnd()-0.5)*16);
              for(let d=0;d<dots;d++){
                const f=0.38+d/(dots-1)*0.62, px=hx+(endX-hx)*f+(rnd()-0.5)*2.2, py=baseY+(endY-baseY)*f+(rnd()-0.5)*2.2;
                ctx.beginPath(); ctx.arc(px,py,1.15+(rnd()*0.35),0,7); ctx.fill();
              }
            }
            if (a2){ ctx.stroke(); fcDraw(ctx,col,24,-13); }
          } else if (L.spikeStyle==='liatris'){
            const spikeLen=L.spikeLen||18, florets=Math.max(3,Math.round(L.florets||8));
            const dense=L.dense||1, capW=L.capW||2.3, capH=L.capH||2.8;
            // Liatris is a signature plant and its wand was 16-18 flat ellipses.
            // ART2 stages the whole wand as one lit batch, then lays the fuzz
            // over it in a single stroke. Both go DOWN in op count.
            if (a2){
              const fuzzOn = blooming && L.fuzz;
              if (fuzzOn){ ctx.strokeStyle=shade(col,20); ctx.lineWidth=0.65;
                           ctx.lineCap='round'; ctx.beginPath(); }
              for(let s=0;s<florets;s++){
                const u=florets>1?s/(florets-1):0, yy=hy+u*spikeLen;
                const side=(s%2?-1:1), xx=hx+side*(L.zigzag||1.1)*(0.55+rnd())+(rnd()-0.5)*(L.ragged||1.4);
                const w=capW*(0.85+rnd()*0.3);
                fcPush(xx,yy,w,(capH*(0.85+rnd()*0.3))/w);
                if (fuzzOn){                       // staged in the same pass, so
                  for(let f=0;f<Math.max(1,Math.round(dense));f++){   // no array
                    const a=(rnd()-0.5)*Math.PI;                      // to remember
                    ctx.moveTo(xx,yy);
                    ctx.lineTo(xx+Math.cos(a)*L.fuzz, yy+Math.sin(a)*L.fuzz);
                  }
                }
              }
              // fuzz under the caps: the protruding half still shows and the
              // half that would be hidden anyway costs nothing to overpaint
              if (fuzzOn){ ctx.stroke(); ctx.lineCap='butt'; }
              fcDraw(ctx,col,26,-16);
            } else
            for(let s=0;s<florets;s++){
              const u=florets>1?s/(florets-1):0, yy=hy+u*spikeLen;
              const side=(s%2?-1:1), xx=hx+side*(L.zigzag||1.1)*(0.55+rnd())+(rnd()-0.5)*(L.ragged||1.4);
              ctx.fillStyle=shade(col,(rnd()-0.5)*18);
              ctx.beginPath(); ctx.ellipse(xx,yy,capW*(0.85+rnd()*0.3),capH*(0.85+rnd()*0.3),0,0,7); ctx.fill();
              if (blooming && L.fuzz){
                ctx.strokeStyle=shade(col,20); ctx.lineWidth=0.65; ctx.lineCap='round';
                for(let f=0;f<Math.max(1,Math.round(dense));f++){
                  const a=(rnd()-0.5)*Math.PI;
                  ctx.beginPath(); ctx.moveTo(xx,yy);
                  ctx.lineTo(xx+Math.cos(a)*L.fuzz,yy+Math.sin(a)*L.fuzz); ctx.stroke();
                }
                ctx.lineCap='butt';
              }
            }
          } else if (a2){
            // The unstyled spike was five identical flat ellipses stacked on
            // the stem tip — the same five for salvia, camassia, muscari and
            // astilbe. ART2 makes it a real raceme: florets down a wand,
            // opening from the bottom, tapering to unopened buds at the tip.
            // Three optional keys tune it (a2Spike/a2Florets/a2FloretR); the
            // defaults already separate a fat grape hyacinth from a wiry
            // camassia because they scale off the species' own height.
            const sl=(L.a2Spike===undefined?0.30:L.a2Spike)*H;
            const fn2=Math.max(3,Math.round(L.a2Florets||7));
            const fr=L.a2FloretR||2.0, sq=L.a2FloretSq||1.15;
            const wob=L.a2Wobble===undefined?1.5:L.a2Wobble;
            for(let s=0;s<fn2;s++){
              const u=fn2>1?s/(fn2-1):0;             // 0 at the tip, 1 at the base
              const taper=0.55+0.45*Math.min(1,u*2.6);   // buds are smaller
              const side=(s%2?-1:1);
              fcPush(hx+side*wob*(0.4+rnd()*0.7), hy+u*sl, fr*taper*(0.86+rnd()*0.28), sq);
            }
            fcDraw(ctx,col,26,-15);
          } else {
            ctx.fillStyle=col;
            for(let s=0;s<5;s++){ ctx.beginPath();
              ctx.ellipse(hx+(rnd()-0.5)*1.5, hy+s*3.2, 1.8,2.2,0,0,7); ctx.fill(); }
          }
        }
      }
      if (ord) ctx.globalAlpha=1;
    }
  }
  else if (P.form === 'bractstack'){ // spotted bee balm: stacked bracts with small spotted tubes
    const L=P.look||{}, a2=art2On(L);
    if (S.fol){
      const n=stemFor(L.leaves||8);
      ctx.strokeStyle=S.fol; ctx.lineWidth=L.leafW||1.4;
      if (a2 && L.leafShape){
        for(let i=0;i<n;i++){
          const a=(i/Math.max(1,n-1)-0.5)*(L.leafFan||1.45)+(rnd()-0.5)*0.22;
          const l=H*(L.leafLen||0.32)*(0.7+rnd()*0.4);
          drawLeaf(ctx,(rnd()-0.5)*3,0, Math.sin(a)*l+sway*l*0.03, -l*(L.leafRise||0.72),
                   (L.leafW||1.4)*(L.leafHW||1.5), shade(S.fol,(rnd()-0.5)*18),
                   {shape:L.leafShape, teeth:L.leafTeeth, teethN:L.leafTeethN,
                    bow:L.leafBow===undefined?0.06:L.leafBow});
        }
      } else
      for(let i=0;i<n;i++){
        const a=(i/(n-1)-0.5)*1.45+(rnd()-0.5)*0.22, l=H*(L.leafLen||0.32)*(0.7+rnd()*0.4);
        ctx.beginPath(); ctx.moveTo(0,0);
        ctx.quadraticCurveTo(Math.sin(a)*l*0.5,-l*0.48,Math.sin(a)*l,-l*0.62); ctx.stroke();
      }
    }
    const sn=stemFor(L.stems||4);
    for(let i=0;i<sn;i++){
      const ox=(rnd()-0.5)*12, len=H*(0.78+rnd()*0.2), tip=ox+sway*len*0.04;
      ctx.strokeStyle=shade(S.fol||S.seed||'#6b6248',-18); ctx.lineWidth=1.2;
      ctx.beginPath(); ctx.moveTo(ox*0.35,0); ctx.quadraticCurveTo(ox,-len*0.55,tip,-len); ctx.stroke();
      if (!mature) continue;
      const tiers=L.tiers||3, shown=blooming?Math.max(1,Math.ceil(tiers*blv)):tiers;
      for(let tr=0;tr<shown;tr++){
        const y=-len*(0.42+tr*0.15), w=(L.bractW||8)*(1-tr*0.12), br=(S.bract||S.bloom||S.seed);
        if (br){
          if (a2){
            for(let b=-2;b<=2;b++) fcPush(tip+b*w*0.28,y+(Math.abs(b)%2)*1.5,w*0.22,2.1/(w*0.22));
            fcDraw(ctx,br,24,-14);        // the whorl of pale bracts, lit as one
          } else {
          ctx.fillStyle=shade(br,(rnd()-0.5)*16);
          for(let b=-2;b<=2;b++){
            ctx.beginPath(); ctx.ellipse(tip+b*w*0.28,y+(Math.abs(b)%2)*1.5,w*0.22,2.1,b*0.2,0,7); ctx.fill();
          } }
        }
        const col=(blooming?S.bloom:null)||S.seed;
        if (col){
          if (a2){
            for(let f=0;f<5;f++) fcPush(tip+(rnd()-0.5)*w,y-2-rnd()*3,1.2,1.5);
            fcDraw(ctx,col,26,-14);
          } else {
          ctx.fillStyle=col;
          for(let f=0;f<5;f++){
            ctx.beginPath(); ctx.ellipse(tip+(rnd()-0.5)*w,y-2-rnd()*3,1.2,1.8,0,0,7); ctx.fill();
          } }
          if (blooming && S.eye){
            ctx.fillStyle=S.eye;
            for(let d=0;d<3;d++){ ctx.beginPath(); ctx.arc(tip+(rnd()-0.5)*w,y-2-rnd()*3,0.45,0,7); ctx.fill(); }
          }
        }
      }
    }
  }
  else if (P.form === 'pincushion'){ // scabiosa: wiry stems and pincushion disks
    const L=P.look||{}, a2=art2On(L);
    if (S.fol){
      const n=stemFor(L.leaves||7);
      ctx.strokeStyle=S.fol; ctx.lineWidth=L.leafW||1.1;
      if (L.pincushionStyle==='astrantia'){
        // Astrantia's leaf is palmate — five lobes radiating from one point.
        // ART2 keeps that exact radial layout and fills each lobe.
        for(let i=0;i<n;i++){
          const ox=(rnd()-0.5)*16, oy=(rnd()-0.5)*4-H*0.08, l=H*(L.leafLen||0.32)*(0.75+rnd()*0.3);
          for(let p=0;p<5;p++){
            const a=-Math.PI/2+p/5*Math.PI*2+(rnd()-0.5)*0.12;
            if (a2 && L.leafShape){
              drawLeaf(ctx,ox,oy, ox+Math.cos(a)*l, oy+Math.sin(a)*l,
                       (L.leafW||1.1)*(L.leafHW||1.5), shade(S.fol,(rnd()-0.5)*18),
                       {shape:L.leafShape, teeth:L.leafTeeth, teethN:L.leafTeethN, bow:0.04});
              continue;
            }
            ctx.beginPath(); ctx.moveTo(ox,oy);
            ctx.quadraticCurveTo(ox+Math.cos(a)*l*0.38,oy+Math.sin(a)*l*0.38,
              ox+Math.cos(a)*l,oy+Math.sin(a)*l); ctx.stroke();
          }
        }
      } else if (a2 && L.leafShape){
        for(let i=0;i<n;i++){
          const a=(i/Math.max(1,n-1)-0.5)*(L.leafFan||1.7)+(rnd()-0.5)*0.2;
          const l=H*(L.leafLen||0.3)*(0.82+rnd()*0.3);
          drawLeaf(ctx,(rnd()-0.5)*3,0, Math.sin(a)*l+sway*l*0.03, -l*(L.leafRise||0.72),
                   (L.leafW||1.1)*(L.leafHW||1.5), shade(S.fol,(rnd()-0.5)*18),
                   {shape:L.leafShape, teeth:L.leafTeeth, teethN:L.leafTeethN,
                    bow:L.leafBow===undefined?0.06:L.leafBow});
        }
      } else {
        for(let i=0;i<n;i++){
          const a=(i/(n-1)-0.5)*1.7+(rnd()-0.5)*0.2, l=H*(L.leafLen||0.3);
          ctx.beginPath(); ctx.moveTo(0,0);
          ctx.quadraticCurveTo(Math.sin(a)*l*0.5,-l*0.5,Math.sin(a)*l,-l*0.52); ctx.stroke();
        }
      }
    }
    const sn=stemFor(L.stems||7);
    for(let i=0;i<sn;i++){
      const ox=(rnd()-0.5)*16, len=H*(0.72+rnd()*0.32), tip=ox+sway*len*0.08;
      ctx.strokeStyle=shade(S.fol||S.seed||'#6b6248',-18); ctx.lineWidth=0.9;
      ctx.beginPath(); ctx.moveTo(ox*0.3,0); ctx.quadraticCurveTo(ox,-len*0.56,tip,-len); ctx.stroke();
      if (!mature) continue;
      const headOn=blooming && i < Math.max(1,Math.ceil(sn*blv));
      const col=(headOn?S.bloom:null)||S.seed;
      if (col){
        const r=L.headR||4.6;
        if (L.pincushionStyle==='astrantia'){
          const bracts=Math.max(10,Math.round(L.bracts||16)), bractLen=L.bractLen||3.8, bractW=L.bractW||1;
          if (a2){
            // the papery bract collar is one path, so the whole ruff shades
            // together instead of eighteen identical flat spikes
            ctx.beginPath();
            for(let p=0;p<bracts;p++){
              const a=p/bracts*Math.PI*2, bx=tip+Math.cos(a)*r*0.42, by=-len+Math.sin(a)*r*0.32;
              const tx=tip+Math.cos(a)*(r+bractLen), ty=-len+Math.sin(a)*(r*0.78+bractLen);
              const px=Math.cos(a+Math.PI/2)*bractW, py=Math.sin(a+Math.PI/2)*bractW*0.75;
              ctx.moveTo(bx+px,by+py); ctx.lineTo(tx,ty); ctx.lineTo(bx-px,by-py); ctx.closePath();
            }
            litFill(ctx,tip,-len,r+bractLen,S.bract||shade(col,30));
          } else {
          ctx.fillStyle=S.bract||shade(col,30);
          for(let p=0;p<bracts;p++){
            const a=p/bracts*Math.PI*2, bx=tip+Math.cos(a)*r*0.42, by=-len+Math.sin(a)*r*0.32;
            const tx=tip+Math.cos(a)*(r+bractLen), ty=-len+Math.sin(a)*(r*0.78+bractLen);
            const px=Math.cos(a+Math.PI/2)*bractW, py=Math.sin(a+Math.PI/2)*bractW*0.75;
            ctx.beginPath(); ctx.moveTo(bx+px,by+py); ctx.lineTo(tx,ty); ctx.lineTo(bx-px,by-py); ctx.closePath(); ctx.fill();
          } }
        }
        if (a2){
          // The name of the form is the thing classic never drew: a pincushion
          // is a domed cushion studded with florets, not a flat disc. Lit dome,
          // batched radial florets, then the pins.
          ctx.beginPath(); ctx.ellipse(tip,-len,r,r*0.78,0,0,7);
          litFill(ctx,tip,-len,r,col,24,-28);
          const pins=Math.max(6,Math.round(r*2.2));
          for(let p=0;p<pins;p++){ const pa=rnd()*Math.PI*2, rr=Math.sqrt(rnd())*r*0.80;
            fcPush(tip+Math.cos(pa)*rr,-len+Math.sin(pa)*rr*0.78,r*0.20*(0.8+rnd()*0.4),0.9); }
          fcDraw(ctx,col,28,-4);
          ctx.strokeStyle=shade(col,-25); ctx.lineWidth=0.7; ctx.beginPath();
          for(let p=0;p<8;p++){ const pa=p/8*Math.PI*2;
            ctx.moveTo(tip,-len);
            ctx.lineTo(tip+Math.cos(pa)*r*1.1,-len+Math.sin(pa)*r*0.82); }
          ctx.stroke();
        } else {
        ctx.fillStyle=col;
        ctx.beginPath(); ctx.ellipse(tip,-len,r,r*0.78,0,0,7); ctx.fill();
        ctx.strokeStyle=shade(col,-25); ctx.lineWidth=0.7;
        for(let p=0;p<8;p++){ const pa=p/8*Math.PI*2;
          ctx.beginPath(); ctx.moveTo(tip,-len);
          ctx.lineTo(tip+Math.cos(pa)*r*1.1,-len+Math.sin(pa)*r*0.82); ctx.stroke(); }
        }
        if (headOn && S.eye){
          ctx.fillStyle=S.eye;
          for(let d=0;d<6;d++){ ctx.beginPath(); ctx.arc(tip+(rnd()-0.5)*r,-len+(rnd()-0.5)*r*0.7,0.55,0,7); ctx.fill(); }
        }
      }
    }
  }
  else if (P.form === 'pyramid'){ // Scilla peruviana: low straps below a dense pyramidal raceme
    const L=P.look||{};
    if (S.fol){
      const n=stemFor(L.leaves||9);
      ctx.strokeStyle=S.fol; ctx.lineWidth=L.leafW||1.7;
      for(let i=0;i<n;i++){
        const a=(i/(n-1)-0.5)*1.45+(rnd()-0.5)*0.18, l=H*(L.leafLen||0.42)*(0.7+rnd()*0.35);
        ctx.beginPath(); ctx.moveTo((rnd()-0.5)*4,0);
        ctx.quadraticCurveTo(Math.sin(a)*l*0.35,-l*0.5,Math.sin(a)*l*0.75,-l); ctx.stroke();
      }
    }
    if (mature && ((blooming&&S.bloom)||S.seed)){
      const col=(blooming?S.bloom:null)||S.seed;
      const stems=Math.max(1,L.stems||1), dots=L.dots||28;
      for(let st=0;st<stems;st++){
        const ox=(st-(stems-1)/2)*5+(rnd()-0.5)*2, len=H*(0.74+rnd()*0.12);
        const topY=-len, baseY=-len*0.38, headW=L.headW||11;
        ctx.strokeStyle=shade(S.fol||col,-22); ctx.lineWidth=1.2;
        ctx.beginPath(); ctx.moveTo(ox*0.35,0); ctx.lineTo(ox+sway*1.5,topY); ctx.stroke();
        ctx.fillStyle=col;
        const shown=blooming?Math.max(5,Math.ceil(dots*blv)):Math.max(8,Math.ceil(dots*0.55));
        for(let d=0;d<shown;d++){
          const f=rnd(), rowY=baseY+(topY-baseY)*f, w=headW*(1-f)*0.9+2;
          ctx.beginPath();
          ctx.arc(ox+sway*1.5+(rnd()-0.5)*w, rowY+(rnd()-0.5)*2, 1.25, 0, 7); ctx.fill();
        }
      }
    }
  }
  else if (P.form === 'drumstick'){ // burnet: small buttons bobbing on wiry stems
    const L = P.look||{}, a2=art2On(L);
    if (S.fol){ const fn=stemFor(7); // low pinnate basal foliage
      ctx.strokeStyle=S.fol; ctx.lineWidth=1.3;
      if (a2 && L.leafShape){
        // Burnet foliage is pinnate with saw-toothed leaflets and is most of
        // what you see out of bloom, so it is worth a silhouette rather than
        // seven identical strokes. leafTeeth carries the serration.
        for(let i=0;i<fn;i++){
          const a=(i/Math.max(1,fn-1)-0.5)*(L.leafFan||1.8)+(rnd()-0.5)*0.12;
          const l=H*(L.leafLen||0.26)*(0.82+rnd()*0.3);
          drawLeaf(ctx,(rnd()-0.5)*3,0, Math.sin(a)*l+sway*l*0.03, -l*(L.leafRise||0.62),
                   1.3*(L.leafHW||1.5), shade(S.fol,(rnd()-0.5)*18),
                   {shape:L.leafShape, teeth:L.leafTeeth, teethN:L.leafTeethN,
                    bow:L.leafBow===undefined?0.06:L.leafBow});
        }
      } else
      for(let i=0;i<fn;i++){ const a=(i/(fn-1)-0.5)*1.8, l=H*0.26;
        ctx.beginPath(); ctx.moveTo(0,0);
        ctx.quadraticCurveTo(Math.sin(a)*l*0.7,-l*0.5,Math.sin(a)*l,-l*0.55); ctx.stroke(); } }
    const sn=stemFor(L.stems||7);
    for(let i=0;i<sn;i++){
      const ox=(rnd()-0.5)*17, len=H*(0.65+rnd()*0.4), tip=ox+sway*len*0.09;
      const nod=!!L.nod, hx=nod?tip+((i%2)?-3.6:3.6):tip, hy=-len+(nod?3.8:0);
      ctx.strokeStyle=shade(S.fol||'#6b6248',-14); ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(ox*0.3,0); ctx.quadraticCurveTo(ox,-len*0.6,hx,hy); ctx.stroke();
      if (!mature) continue;
      const headOn = blooming ? (i < Math.max(1,Math.ceil(sn*blv))) : false;
      const col=(headOn?S.bloom:null)||S.seed;
      if (col && L.seedStyle==='smoke' && S.seed && !headOn){
        const plumes=L.plumeCount||13, plumeLen=L.plumeLen||10;
        ctx.strokeStyle=shade(col,12); ctx.lineWidth=0.55; ctx.lineCap='round';
        if (a2) ctx.beginPath();      // prairie smoke's whole plume, one stroke
        for(let p=0;p<plumes;p++){ const a=(p/plumes)*Math.PI*2, ex=hx+Math.cos(a)*(L.plumeW||9)*(0.55+rnd()*0.45), ey=hy+Math.sin(a)*plumeLen;
          if (!a2) ctx.beginPath();
          ctx.moveTo(hx,hy); ctx.quadraticCurveTo((hx+ex)*0.5+(rnd()-0.5)*2,(hy+ey)*0.5-2,ex,ey);
          if (!a2) ctx.stroke(); }
        if (a2) ctx.stroke();
        ctx.lineCap='butt';
      } else if (col && L.flowerStyle==='noddingBell' && headOn){
        if (a2) drawFloret(ctx,hx,hy+1.5,(L.button||1.8)*1.35,col,
                           {squash:((L.buttonLen||3.2)*0.9)/((L.button||1.8)*1.35), rot:0.2, lift:24, drop:-18});
        else { ctx.fillStyle=col; ctx.beginPath(); ctx.ellipse(hx,hy+1.5,(L.button||1.8)*1.35,(L.buttonLen||3.2)*0.9,0.2,0,7); ctx.fill(); }
        if (S.eye){ ctx.fillStyle=S.eye; ctx.beginPath(); ctx.arc(hx,hy+2,0.75,0,7); ctx.fill(); }
      } else if (col){
        const bw=L.button||1.8, bl=L.buttonLen||3.2;
        // A burnet button is a bottlebrush of tiny florets, not a solid bead:
        // ART2 gives it a lit body plus a few catching the light on the sunward
        // shoulder, which is what makes a drift of them read as texture.
        if (a2){
          drawFloret(ctx,hx,hy-bl*0.4,bw,col,{squash:bl/bw, rot:sway*0.12, lift:22, drop:-18});
          const bumps=Math.max(3,Math.round(bl*0.9));
          for(let b=0;b<bumps;b++){
            const t=(b+0.5)/bumps;
            fcPush(hx+(rnd()-0.5)*bw*1.1, hy-bl*0.4-bl*0.82+t*bl*1.64, bw*0.42, 1);
          }
          fcDraw(ctx,col,26,2);
        } else { ctx.fillStyle=col;
          ctx.beginPath(); ctx.ellipse(hx,hy-bl*0.4,bw,bl,sway*0.12,0,7); ctx.fill(); } }
    }
  }
  else if (P.form === 'iris'){ // sword-leaf fans plus standards and falls
    const L=P.look||{}, leaves=stemFor(L.leaves||14), fan=L.fan||0.52;
    if (S.fol){
      ctx.lineCap='round';
      for(let i=0;i<leaves;i++){
        const side=i%2?-1:1, rank=Math.floor(i/2), spread=(rank/(Math.ceil(leaves/2)-1||1)-0.5)*fan;
        const len=H*(L.leafLen||0.70)*(0.72+rnd()*0.28), bx=side*(2+Math.abs(spread)*len*0.46)+sway*len*0.02;
        if (art2On(L)){
          // an iris fan is flat blades edge-on — drawBlade takes the explicit
          // quadratic this branch already carries, and the lit sliver reads as
          // the blade twisting toward the light
          drawBlade(ctx, side*rank*0.22,0, bx*0.42,-len*0.54, bx,-len,
                    (L.leafW||2)*(L.bladeHW||0.85), S.fol, rank<2);
        } else {
          ctx.strokeStyle=shade(S.fol,(rnd()-0.5)*18); ctx.lineWidth=L.leafW||2;
          ctx.beginPath(); ctx.moveTo(side*rank*0.22,0);
          ctx.quadraticCurveTo(bx*0.42,-len*0.54,bx,-len); ctx.stroke(); }
      }
      ctx.lineCap='butt';
    }
    const scapes=stemFor(L.scapes||3);
    for(let st=0;st<scapes;st++){
      const ox=(st-(scapes-1)/2)*5+(rnd()-0.5)*2, len=H*(L.scapeLen||0.92)*(0.82+rnd()*0.16), tip=ox+sway*len*0.025;
      ctx.strokeStyle=shade(S.fol||S.seed||'#6b6248',-20); ctx.lineWidth=1.15;
      ctx.beginPath(); ctx.moveTo(ox*0.35,0); ctx.quadraticCurveTo(ox,-len*0.56,tip,-len); ctx.stroke();
      if (!mature) continue;
      const count=blooming?Math.max(1,Math.ceil((L.blooms||2)*blv)):0;
      for(let b=0;b<count;b++){
        const branch=b?(L.branches||1):0, fx=tip+branch*((b%2)?-1:1)*(L.branchReach||4), fy=-len+b*6;
        if (branch){ ctx.beginPath(); ctx.moveTo(tip,fy+4); ctx.quadraticCurveTo(tip+branch*2,fy+2,fx,fy); ctx.stroke(); }
        if (S.bloom){
          const fallL=L.fallLen||5, fallW=L.fallW||3.8, standL=L.standardLen||4, standW=L.standardW||2.8;
          ctx.fillStyle=shade(S.bloom,(rnd()-0.5)*12);
          for(let p=0;p<3;p++){ const a=Math.PI/2+p*Math.PI*2/3;
            ctx.beginPath(); ctx.ellipse(fx+Math.cos(a)*fallL*0.52,fy+Math.sin(a)*fallL*0.42+((L.fallDrop||0)*0.5),fallL*0.52,fallW*0.42,a,0,7); ctx.fill(); }
          for(let p=0;p<3;p++){ const a=-Math.PI/2+p*Math.PI*2/3;
            ctx.beginPath(); ctx.ellipse(fx+Math.cos(a)*standL*0.34,fy+Math.sin(a)*standL*0.30,standW*0.46,standL*0.45,a,0,7); ctx.fill(); }
          if (S.eye){ ctx.strokeStyle=S.eye; ctx.lineWidth=L.beard?1.35:0.9;
            ctx.beginPath(); ctx.moveTo(fx-1.6,fy+0.8); ctx.lineTo(fx+1.8,fy+0.8); ctx.stroke(); }
        }
      }
      if (S.seed && !blooming){ ctx.fillStyle=S.seed; ctx.beginPath(); ctx.ellipse(tip,-len+2,1.8,3.1,0,0,7); ctx.fill(); }
    }
  }
  else if (P.form === 'airywand'){ // gaura: wiry open panicles with butterfly flowers
    const L=P.look||{}, stems=stemFor(L.stems||9), a2=art2On(L);
    if (S.fol){
      ctx.strokeStyle=S.fol; ctx.lineWidth=L.leafW||1.1;
      const ln=stemFor(L.leaves||7);
      if (a2 && L.leafShape){
        for(let i=0;i<ln;i++){
          const a=(i/Math.max(1,ln-1)-0.5)*(L.leafFan||1.65)+(rnd()-0.5)*0.16;
          const l=H*(L.leafLen||0.28)*(0.75+rnd()*0.32);
          drawLeaf(ctx,(rnd()-0.5)*3,0, Math.sin(a)*l+sway*l*0.03, -l*(L.leafRise||0.76),
                   (L.leafW||1.1)*(L.leafHW||1.4), shade(S.fol,(rnd()-0.5)*18),
                   {shape:L.leafShape, teeth:L.leafTeeth, teethN:L.leafTeethN,
                    bow:L.leafBow===undefined?0.06:L.leafBow, rib:L.leafRib});
        }
      } else
      for(let i=0;i<ln;i++){ const a=(i/(ln-1)-0.5)*1.65, len=H*(L.leafLen||0.28)*(0.75+rnd()*0.32);
        ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(Math.sin(a)*len*0.45,-len*0.45,Math.sin(a)*len,-len*0.62); ctx.stroke(); }
    }
    for(let i=0;i<stems;i++){
      const ox=(rnd()-0.5)*(L.stemSpread||24), len=H*((L.lenBase||0.84)+rnd()*(L.lenJitter||0.26));
      const tip=ox+(rnd()-0.5)*7+sway*len*0.08;
      ctx.strokeStyle=shade(S.fol||S.seed||'#6b6248',-20); ctx.lineWidth=0.85;
      ctx.beginPath(); ctx.moveTo(ox*0.25,0); ctx.quadraticCurveTo(ox,-len*0.56,tip,-len); ctx.stroke();
      const flowers=blooming?Math.max(1,Math.ceil((L.flowerCount||5)*blv)):0, branches=Math.max(0,Math.round(L.branches||0));
      for(let f=0;f<flowers;f++){
        const at=0.42+f/(flowers+1)*0.56, side=(f+i)%2?-1:1, branch=f>0&&branches;
        const rootAt=branch ? Math.min(0.93,(L.branchAt||0.52)+((f-1)%branches)/(branches+1)*0.28) : at;
        const rootX=ox+(tip-ox)*rootAt, rootY=-len*rootAt;
        const bx=rootX+side*(L.flowerOffset||4), by=rootY+(L.flowerDrop||0)-(branch?1.8:0);
        ctx.strokeStyle=shade(S.fol||S.bloom,-18); ctx.lineWidth=0.65;
        ctx.beginPath(); ctx.moveTo(rootX,rootY); ctx.quadraticCurveTo(rootX+side*1.4,rootY-1,bx,by); ctx.stroke();
        if (a2){
          // Gaura is four clawed petals held to one side with the stamens
          // arching out past them — that whiskered silhouette is the whole
          // reason the plant is called whirling butterflies, and classic drew
          // only the petals. Petals as tapered straps, then one stroke of hairs.
          const pl=L.petalLen||2.5, pw=L.petalW||1.25, pn=L.petals||4;
          // Petals batched, not ribboned: a gaura carries 10 stems x 5 flowers
          // x 4 petals = 200 of them, each about 3px. Ribbons there cost ~18
          // path calls apiece to draw something a lit ellipse already says.
          for(let p=0;p<pn;p++){
            const a=-Math.PI*0.62+p/pn*Math.PI*0.92;
            fcPush(bx+Math.cos(a)*pl*0.62, by+Math.sin(a)*pl*0.62, pl*0.72, pw/pl);
          }
          fcDraw(ctx,S.bloom,26,-14);
          ctx.strokeStyle=shade(S.bloom,-22); ctx.lineWidth=0.45; ctx.beginPath();
          for(let s2=0;s2<4;s2++){
            const a=0.30+s2*0.30, r2=pl*(1.5+rnd()*0.9);
            ctx.moveTo(bx,by); ctx.lineTo(bx+Math.cos(a)*r2*0.7, by+Math.sin(a)*r2);
          }
          ctx.stroke();
        } else {
        ctx.fillStyle=shade(S.bloom,(rnd()-0.5)*14);
        for(let p=0;p<(L.petals||4);p++){ const a=p/(L.petals||4)*Math.PI*2;
          ctx.beginPath(); ctx.ellipse(bx+Math.cos(a)*(L.petalLen||2.5)*0.44,by+Math.sin(a)*(L.petalLen||2.5)*0.30,L.petalLen||2.5,L.petalW||1.25,a,0,7); ctx.fill(); } }
      }
      if (S.seed && !blooming){ ctx.fillStyle=S.seed; ctx.beginPath(); ctx.ellipse(tip,-len,1.25,2.2,0,0,7); ctx.fill(); }
    }
  }
  else if (P.form === 'sotol'){ // dense serrated spoon rosette and tall, fine panicle
    const L=P.look||{}, leaves=stemFor(L.leaves||46), cy=-H*(L.rosetteLift||0.16), squash=L.rosetteSquash||0.44;
    if (S.fol){
      for(let i=0;i<leaves;i++){
        const a=i/leaves*Math.PI*2+(rnd()-0.5)*0.10, len=H*(L.leafLen||0.82)*(0.76+rnd()*0.30);
        const tx=Math.cos(a)*len+sway*len*0.02, ty=cy+Math.sin(a)*len*squash;
        ctx.strokeStyle=shade(S.edge||S.fol,-24); ctx.lineWidth=(L.leafW||0.9)+0.9;
        ctx.beginPath(); ctx.moveTo(0,cy); ctx.quadraticCurveTo(tx*0.46,cy-len*0.18,tx,ty); ctx.stroke();
        ctx.strokeStyle=shade(S.fol,(rnd()-0.5)*16); ctx.lineWidth=L.leafW||0.9;
        ctx.beginPath(); ctx.moveTo(0,cy); ctx.quadraticCurveTo(tx*0.46,cy-len*0.18,tx,ty); ctx.stroke();
        if (i%(L.toothEvery||3)===0){ ctx.strokeStyle=S.edge||shade(S.fol,-30); ctx.lineWidth=0.45;
          for(let t=0;t<(L.teeth||12);t++){ const f=(t+1)/((L.teeth||12)+2), px=tx*f, py=cy+(ty-cy)*f-len*0.12*f*(1-f);
            ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(px+Math.sin(a)*1.1,py-Math.cos(a)*1.1*squash); ctx.stroke(); }
        }
      }
    }
    if (mature && ((blooming&&S.bloom)||S.seed)){
      const col=(blooming?S.bloom:null)||S.seed, len=H*(L.scapeLen||1.7), tip=sway*len*0.02;
      ctx.strokeStyle=shade(S.fol||col,-24); ctx.lineWidth=1.25;
      ctx.beginPath(); ctx.moveTo(0,cy); ctx.quadraticCurveTo(0,-len*0.52,tip,-len); ctx.stroke();
      const branches=Math.max(8,Math.round(L.panicleBranches||18)), dots=L.panicleDots||3, start=L.panicleStart||0.42;
      for(let b=0;b<branches;b++){
        const f=start+(b/(branches-1))*(1-start), side=b%2?-1:1, by=-len*f, reach=(1-f)*(L.panicleReach||13)*(0.72+rnd()*0.35);
        ctx.strokeStyle=shade(S.fol||col,-18); ctx.lineWidth=0.52;
        ctx.beginPath(); ctx.moveTo(tip,by); ctx.lineTo(tip+side*reach,by+1.5+rnd()*2); ctx.stroke();
        ctx.fillStyle=shade(col,(rnd()-0.5)*14);
        for(let d=0;d<dots;d++){ ctx.beginPath(); ctx.arc(tip+side*reach*(0.45+d/(dots+1)*0.55),by+1+rnd()*2,0.75,0,7); ctx.fill(); }
      }
    }
  }
  else if (P.form === 'archbell'){ // Solomon's seal: arched stems, alternating leaves, pendant bells
    const L=P.look||{}, sn=stemFor(L.stems||4);
    for (let i=0;i<sn;i++){
      const ox=(i/(sn-1)-0.5)*12+(rnd()-0.5)*2;
      const len=H*(0.72+rnd()*0.18), tip=ox+12+sway*len*0.04;
      const ctrlX=ox+4+sway*2, ctrlY=-len*0.72;
      const stemCol=shade(S.fol||S.seed||'#6b6248',-18);
      ctx.strokeStyle=stemCol; ctx.lineWidth=1.3;
      ctx.beginPath(); ctx.moveTo(ox,0);
      ctx.quadraticCurveTo(ctrlX,ctrlY,tip,-len*0.55); ctx.stroke();
      const bez=(f)=>{
        const u=1-f;
        return [u*u*ox+2*u*f*ctrlX+f*f*tip, 2*u*f*ctrlY+f*f*(-len*0.55)];
      };
      if (S.fol){
        const leaves=L.leaves||8;
        for (let j=0;j<leaves;j++){
          const f=0.12+j/(leaves+1)*0.74, side=j%2?-1:1, p=bez(f);
          ctx.fillStyle=shade(S.fol,(rnd()-0.5)*22);
          ctx.beginPath();
          ctx.ellipse(p[0]+side*4, p[1]+1.5, 5.2, 1.8, side*0.45, 0, 7); ctx.fill();
        }
      }
      if (mature && ((blooming&&S.bloom)||S.seed)){
        const headOn = blooming && i < Math.max(1, Math.ceil(sn*blv));
        const bells=headOn ? Math.max(2,Math.ceil((L.bells||5)*blv)) : (S.seed?Math.min(4,L.bells||5):0);
        ctx.fillStyle=(headOn?S.bloom:null)||S.seed;
        for (let b=0;b<bells;b++){
          const f=0.36+b*0.1, p=bez(f);
          ctx.beginPath();
          ctx.ellipse(p[0]+3, p[1]+4, headOn?2.1:1.8, headOn?3.3:2.1, -0.2, 0, 7); ctx.fill();
        }
      }
    }
  }
  else if (P.form === 'martagon'){ // martagon lily: whorled leaves and recurved, nodding bells
    const L=P.look||{}, stemCol=shade(S.fol||S.seed||'#6b6248',-18);
    const sn=Math.max(1,L.stems||1);
    for(let st=0;st<sn;st++){
      const ox=(st-(sn-1)/2)*7+(rnd()-0.5)*2, len=H*(0.9+rnd()*0.08), tip=ox+sway*len*0.03;
      ctx.strokeStyle=stemCol; ctx.lineWidth=1.4;
      ctx.beginPath(); ctx.moveTo(ox,0); ctx.quadraticCurveTo(ox+sway*1.5,-len*0.48,tip,-len); ctx.stroke();
      if (S.fol){
        const whorls=L.whorls||4;
        for(let w=0;w<whorls;w++){
          const wy=-len*(0.18+w*0.14), leaves=5+(w%2);
          for(let j=0;j<leaves;j++){
            const a=j/leaves*Math.PI*2+(w*0.4), r=5.5-rnd()*1.2;
            const lx2=ox+Math.cos(a)*r, ly2=wy+Math.sin(a)*r*0.35;
            if (art2On(L)){
              // a martagon whorl is narrow leaves radiating in a ring; the lit
              // sliver is what separates the near ones from the far ones
              drawBlade(ctx, ox,wy, (ox+lx2)/2,(wy+ly2)/2-0.6, lx2,ly2,
                        (L.whorlHW||1.5), S.fol, Math.sin(a)>-0.2);
            } else {
              ctx.fillStyle=shade(S.fol,(rnd()-0.5)*22);
              ctx.beginPath();
              ctx.ellipse(lx2, ly2, 4.5, 1.5, a*0.4, 0, 7); ctx.fill(); }
          }
        }
      }
      if (mature && ((blooming&&S.bloom)||S.seed)){
        const flowers=blooming?Math.max(1,Math.ceil((L.flowers||5)*blv)):Math.min(4,L.flowers||5);
        for(let f=0;f<flowers;f++){
          const side=f%2?-1:1, fy=-len*(0.72+f*0.045), fx=tip+side*(3+rnd()*3);
          ctx.strokeStyle=stemCol; ctx.lineWidth=0.9;
          ctx.beginPath(); ctx.moveTo(tip,fy-4); ctx.quadraticCurveTo(fx,fy-2,fx,fy+2); ctx.stroke();
          if (blooming && S.bloom){
            ctx.strokeStyle=S.bloom; ctx.lineWidth=1.8;
            for(let p=0;p<6;p++){
              const a=p/6*Math.PI*2;
              ctx.beginPath(); ctx.moveTo(fx,fy);
              ctx.quadraticCurveTo(fx+Math.cos(a)*3,fy+Math.sin(a)*2,fx+Math.cos(a)*4.6,fy+Math.sin(a)*4.2-2);
              ctx.stroke();
            }
            if (S.eye){ ctx.fillStyle=S.eye;
              ctx.beginPath(); ctx.arc(fx,fy,1.2,0,7); ctx.fill(); }
          } else if (S.seed){
            ctx.fillStyle=S.seed;
            ctx.beginPath(); ctx.ellipse(fx,fy,1.6,3.2,0,0,7); ctx.fill();
          }
        }
      }
    }
  }
  else if (P.form === 'rosette'){ // yucca: evergreen sword-leaf crown + bell tower
    const L=P.look||{};
    if (S.fol){
      const n=stemFor(L.leaves||18), baseLen=H*(L.leafLen||0.5), lw=L.leafW||2.8;
      ctx.lineCap='round';
      for (let i=0;i<n;i++){
        const a=(i/(n-1)-0.5)*2.35+(rnd()-0.5)*0.18;
        const len=baseLen*(0.72+rnd()*0.36), bx=Math.sin(a)*len*0.82+sway*len*0.025;
        const by=-Math.cos(a*0.45)*len*0.62;
        if (S.edge){
          ctx.strokeStyle=shade(S.edge,(rnd()-0.5)*12); ctx.lineWidth=lw+2.2;
          ctx.beginPath(); ctx.moveTo((rnd()-0.5)*3,0);
          ctx.quadraticCurveTo(bx*0.34,by*0.55,bx,by); ctx.stroke();
        }
        if (art2On(L)){
          drawBlade(ctx, (rnd()-0.5)*3,0, bx*0.34,by*0.55, bx,by,
                    lw*(L.bladeHW||0.85), S.fol, true);
          continue;
        }
        ctx.strokeStyle=shade(S.fol,(rnd()-0.5)*18); ctx.lineWidth=lw;
        ctx.beginPath(); ctx.moveTo((rnd()-0.5)*3,0);
        ctx.quadraticCurveTo(bx*0.34,by*0.55,bx,by); ctx.stroke();
        if (L.filaments && i%3===0){
          ctx.strokeStyle='rgba(239,230,211,0.55)'; ctx.lineWidth=0.55;
          ctx.beginPath(); ctx.moveTo(bx*0.72,by*0.78);
          ctx.quadraticCurveTo(bx*0.88+2,by*0.88+2,bx+1.8,by+4); ctx.stroke();
        }
      }
      ctx.lineCap='butt';
    }
    if (mature && (blooming || S.seed)){
      const sn=Math.max(1,L.stems||1), bells=L.bells||7;
      for (let st=0;st<sn;st++){
        const ox=(st-(sn-1)/2)*5+(rnd()-0.5)*2, len=H*(0.86+rnd()*0.1);
        const tip=ox+sway*len*0.025;
        ctx.strokeStyle=shade(S.fol||'#7d8f80',-24); ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(ox*0.35,0); ctx.quadraticCurveTo(ox,-len*0.55,tip,-len); ctx.stroke();
        if (blooming && S.bloom && L.flowerStyle==='daylily'){
          const flowers=Math.max(1,Math.ceil((L.blooms||2)*blv));
          for(let b=0;b<flowers;b++){
            const side=(b+st)%2?-1:1, reach=(L.branchReach||5)*(0.75+b*0.25);
            const fx=tip+side*reach, fy=-len+b*3.5;
            ctx.strokeStyle=shade(S.fol,-18); ctx.lineWidth=0.9;
            ctx.beginPath(); ctx.moveTo(tip,-len+5); ctx.quadraticCurveTo(tip+side*reach*0.45,-len+2,fx,fy); ctx.stroke();
            const pl=L.petalLen||5.2, pw=L.petalW||1.6;
            if (art2On(L)){
              for(let p=0;p<6;p++){
                const a=-Math.PI/2+p/6*Math.PI*2;
                drawLeaf(ctx,fx,fy,fx+Math.cos(a)*pl,fy+Math.sin(a)*pl*0.72,
                  pw,shade(S.bloom,(p%2?5:-4)),{shape:'lance',rib:false,bow:0.05});
              }
            } else {
              ctx.fillStyle=S.bloom;
              for(let p=0;p<6;p++){
                const a=-Math.PI/2+p/6*Math.PI*2;
                ctx.beginPath(); ctx.ellipse(fx+Math.cos(a)*pl*0.48,fy+Math.sin(a)*pl*0.34,
                  pl*0.52,pw,a,0,7); ctx.fill();
              }
            }
            if(S.eye){ ctx.fillStyle=S.eye; ctx.beginPath(); ctx.arc(fx,fy,pw*0.75,0,7); ctx.fill(); }
          }
        } else if (blooming && S.bloom){
          ctx.fillStyle=S.bloom;
          const shown=Math.max(2,Math.ceil(bells*blv));
          for (let b=0;b<shown;b++){
            const side=b%2?-1:1, py=-len*(0.35+b*0.065), px=tip+side*(3+rnd()*2);
            ctx.beginPath(); ctx.ellipse(px,py,2.3,4.1,side*0.35,0,7); ctx.fill();
            ctx.fillStyle=shade(S.bloom,-12);
            ctx.beginPath(); ctx.ellipse(px,py+2.2,1.6,1.0,0,0,7); ctx.fill();
            ctx.fillStyle=S.bloom;
          }
        } else if (S.seed){
          ctx.fillStyle=S.seed;
          for (let b=0;b<Math.min(5,bells);b++){
            const side=b%2?-1:1, py=-len*(0.38+b*0.08), px=tip+side*3;
            ctx.beginPath(); ctx.ellipse(px,py,1.8,3.2,side*0.2,0,7); ctx.fill();
          }
        }
      }
    }
  }
  else if (P.form === 'agave'){ // succulent rosette: thick pointed leaves radiating from a tight crown
    const L=P.look||{};
    const n=stemFor(L.leaves||30), maxLen=H*(L.leafLen||0.5);
    const cy=-H*0.32, squash=0.58;                 // iso foreshortening of the radial star
    const fol=S.fol||'#8ba3a0', spine=S.edge||shade(fol,-45);
    const leaves=[];
    for (let i=0;i<n;i++){
      const a=(i/n)*Math.PI*2 + (rnd()-0.5)*0.12;
      leaves.push({dx:Math.cos(a), dy:Math.sin(a), len:maxLen*(0.72+rnd()*0.4)});
    }
    leaves.sort((p,q)=>p.dy-q.dy);                 // dy>0 points toward the viewer — paint back-to-front
    ctx.lineCap='round';
    for (const lf of leaves){
      const tipX=lf.dx*lf.len + sway*lf.len*0.02;
      const tipY=cy + lf.dy*lf.len*squash;
      const midX=lf.dx*lf.len*0.55, midY=cy + lf.dy*lf.len*squash*0.55 - lf.len*0.12; // slight upward recurve
      const dep=(lf.dy+1)/2;                        // 0 back .. 1 front
      const w=(L.leafW||3.2)*(0.9+0.2*dep);
      ctx.strokeStyle=shade(fol,-34); ctx.lineWidth=w+1.6;   // dark undershadow
      ctx.beginPath(); ctx.moveTo(0,cy); ctx.quadraticCurveTo(midX,midY,tipX,tipY); ctx.stroke();
      if (art2On(L)){
        // an agave leaf is a thick wedge tapering to its spine, not a strap.
        // The dark undershadow stroke above stays — it is what separates
        // overlapping leaves in a rosette this tight.
        drawBlade(ctx, 0,cy, midX,midY, tipX,tipY,
                  w*(L.bladeHW||0.62), shade(fol,-6+dep*20), dep>0.35);
      } else {
        ctx.strokeStyle=shade(fol,-10+dep*20+(rnd()-0.5)*8); ctx.lineWidth=w;   // leaf body
        ctx.beginPath(); ctx.moveTo(0,cy); ctx.quadraticCurveTo(midX,midY,tipX,tipY); ctx.stroke(); }
      ctx.strokeStyle=spine; ctx.lineWidth=1.2;              // dark terminal spine
      ctx.beginPath(); ctx.moveTo(tipX,tipY); ctx.lineTo(tipX+lf.dx*2.2,tipY+lf.dy*squash*2.2); ctx.stroke();
    }
    ctx.lineCap='butt';
    ctx.fillStyle=shade(fol,16);                   // tight new leaves in the crown
    ctx.beginPath(); ctx.ellipse(0,cy,(L.leafW||3.2)*1.1,(L.leafW||3.2)*0.7,0,0,7); ctx.fill();
  }
  else if (P.form === 'ocotillo'){ // a spray of tall bare canes, flame-red at the tips in spring
    const L=P.look||{};
    const n=stemFor(L.canes||L.leaves||11), spread=L.spread||0.95;
    const caneCol=S.edge||shade(S.fol||'#8a8a6e',-30);
    const hasLeaves=!!S.fol, leafCol=S.fol||'#6f8a5a';
    for (let i=0;i<n;i++){
      const t=n>1?(i/(n-1)-0.5):0;                  // -0.5 .. 0.5 across the fan
      const ang=t*spread, len=H*(0.82+rnd()*0.3), baseX=t*4;
      const tipX=baseX+Math.sin(ang)*len + sway*len*0.05, tipY=-Math.cos(ang)*len;
      const midX=baseX+Math.sin(ang)*len*0.5, midY=-Math.cos(ang)*len*0.52;
      ctx.strokeStyle=shade(caneCol,(rnd()-0.5)*16); ctx.lineWidth=2.4*(0.5+0.5*growth); ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(baseX,0); ctx.quadraticCurveTo(midX,midY,tipX,tipY); ctx.stroke();
      if (hasLeaves && mature){                      // leaf flush along the cane after rain
        ctx.fillStyle=leafCol;
        for (let s=0.28;s<0.95;s+=0.13){
          const lx=baseX+(tipX-baseX)*s+(rnd()-0.5)*2, ly=tipY*s+(rnd()-0.5)*2;
          ctx.beginPath(); ctx.ellipse(lx,ly,1.5,2.3,ang,0,7); ctx.fill();
        }
      }
      if (blooming && S.bloom){                      // flame-red cluster at the tip
        ctx.fillStyle=S.bloom;
        const fn=Math.max(1,Math.round(3*blv));
        for (let f=0;f<fn;f++){
          ctx.beginPath(); ctx.ellipse(tipX+(rnd()-0.5)*3, tipY-2-f*2.5, 1.8, 3.4, 0, 0, 7); ctx.fill();
        }
      } else if (S.seed){
        ctx.fillStyle=S.seed;
        ctx.beginPath(); ctx.ellipse(tipX,tipY-2,1.3,2.4,0,0,7); ctx.fill();
      }
    }
    ctx.lineCap='butt';
  }
  else if (P.form === 'shrub'){
    const L=P.look||{}, habit=L.habit||'mound', fol=S.fol||'#6f8f5a';
    const a2=art2On(L);
    // Every habit in this form places foliage through leafDot, so opting a
    // species in upgrades its whole mound at once: the ellipse becomes a real
    // silhouette swept between the two ends of the same axis, at the same
    // centre and angle, so the layout the habits worked out is untouched. A
    // species with no leafShape (the threadleaf artemisias, moss phlox) keeps
    // its ellipse — a thread-fine leaf has no silhouette to draw.
    const leafDot=(px,py,w,h,a,col)=>{
      if (a2 && L.leafShape){
        const ca=Math.cos(a), sa=Math.sin(a);
        drawLeaf(ctx, px-ca*w, py-sa*w, px+ca*w, py+sa*w,
                 h*(L.leafHW||1.4), shade(col||fol,(rnd()-0.5)*26),
                 // rib gates on the leaf's LENGTH (2*w), not its width: a
                 // baptisia mound is 144 leaflets, and a midrib on a 7px
                 // leaflet is an invisible stroke paid for 144 times a frame.
                 {shape:L.leafShape, teeth:L.leafTeeth, teethN:L.leafTeethN,
                  bow:L.leafBow===undefined?0.05:L.leafBow, rib:w>=4.5});
        return;
      }
      ctx.fillStyle=shade(col||fol,(rnd()-0.5)*26);
      ctx.beginPath(); ctx.ellipse(px,py,w,h,a,0,7); ctx.fill();
    };
    if (S.fol){
      ctx.save(); ctx.globalAlpha=0.20; ctx.fillStyle=shade(fol,-25);
      const sw=L.shadowW||18, sh=L.shadowH||H*0.24, sy=L.shadowY||-H*0.40;
      ctx.beginPath(); ctx.ellipse(sway, sy, sw*(0.5+0.5*growth), sh, 0, 0, 7); ctx.fill();
      ctx.restore();
    }
    if (S.fol && habit==='threadleaf'){
      const stems=stemFor(L.stems||22);
      ctx.strokeStyle=fol; ctx.lineWidth=L.leafW||0.82; ctx.lineCap='round';
      for(let i=0;i<stems;i++){
        const a=(i/(stems-1)-0.5)*(L.spread||2.2)+(rnd()-0.5)*0.18;
        const len=H*(0.45+rnd()*0.45), bx=(rnd()-0.5)*7;
        const tx=Math.sin(a)*len*0.58+sway*len*0.035, ty=-len;
        ctx.beginPath(); ctx.moveTo(bx,0);
        ctx.quadraticCurveTo(bx+Math.sin(a)*len*0.18,-len*0.48,tx,ty); ctx.stroke();
        if (i%3===0){
          ctx.strokeStyle=shade(fol,14);
          ctx.beginPath(); ctx.moveTo(tx,ty);
          ctx.lineTo(tx+(rnd()-0.5)*5,ty-3-rnd()*5); ctx.stroke();
          ctx.strokeStyle=fol;
        }
      }
      ctx.lineCap='butt';
    } else if (S.fol && habit==='broadamsonia'){
      const stems=stemFor(L.stems||12);
      for(let i=0;i<stems;i++){
        const ox=(rnd()-0.5)*13, len=H*(0.55+rnd()*0.35), tx=ox+sway*1.6;
        ctx.strokeStyle=shade(fol,-18); ctx.lineWidth=1.1;
        ctx.beginPath(); ctx.moveTo(ox*0.35,0); ctx.quadraticCurveTo(ox,-len*0.52,tx,-len); ctx.stroke();
        const leaves=L.leaves||5;
        for(let j=0;j<leaves;j++){
          const f=(j+1)/(leaves+1), side=j%2?-1:1, px=ox+(tx-ox)*f*0.7, py=-len*(0.18+f*0.64);
          const leafL=L.leafL||4.2, leafH=L.leafH||2.6;
          leafDot(px+side*(leafL*0.72+rnd()*leafL*0.48),py,leafL,leafH,side*0.35,fol);
        }
      }
    } else if (S.fol && habit==='baptisia'){
      const stems=stemFor(L.stems||11), baseW=L.baseW||18;
      for(let i=0;i<stems;i++){
        const ox=(i/(stems-1)-0.5)*baseW+(rnd()-0.5)*2.5, len=H*(0.68+rnd()*0.23);
        const tx=ox*0.45+(rnd()-0.5)*6+sway*1.5;
        ctx.strokeStyle=P.stem||shade(fol,-25); ctx.lineWidth=1.8;
        ctx.beginPath(); ctx.moveTo(ox,2); ctx.quadraticCurveTo(ox*0.7,-len*0.42,tx,-len); ctx.stroke();
        const whorls=L.leafWhorls||4;
        for(let w=0;w<whorls;w++){
          const f=0.42+w/(whorls+0.2)*0.50, px=ox+(tx-ox)*f, py=-len*f;
          for(let l=0;l<3;l++){
            const aa=(-0.9+l*0.9)+(rnd()-0.5)*0.18, side=Math.sin(aa);
            leafDot(px+side*(4.6+rnd()*1.6),py-Math.cos(aa)*2,3.8,2.5,aa,fol);
          }
        }
      }
    } else if (S.fol && habit==='mossphlox'){
      const runners=stemFor(L.runners||16), matW=L.matW||24, matH=H*(L.foliageH||0.18);
      ctx.strokeStyle=fol; ctx.lineWidth=L.leafW||0.8; ctx.lineCap='round';
      for(let i=0;i<runners;i++){
        const side=i%2?-1:1, y=-matH*(0.18+rnd()*0.82), endX=side*(matW*(0.28+rnd()*0.28))+sway;
        ctx.beginPath(); ctx.moveTo((rnd()-0.5)*4,0); ctx.quadraticCurveTo(endX*0.45,y-matH*0.32,endX,y); ctx.stroke();
        leafDot(endX-side*1.2,y,1.4,0.6,side*0.2,fol);
      }
      ctx.lineCap='butt';
    } else if (S.fol && habit==='matflower'){
      const runners=stemFor(L.runners||14), matW=L.matW||25, matH=H*(L.foliageH||0.18);
      ctx.strokeStyle=fol; ctx.lineWidth=L.leafW||1.05; ctx.lineCap='round';
      for(let i=0;i<runners;i++){
        const side=i%2?-1:1, y=-matH*(0.18+rnd()*0.82), ex=side*matW*(0.26+rnd()*0.30)+sway;
        ctx.beginPath(); ctx.moveTo((rnd()-0.5)*4,0); ctx.quadraticCurveTo(ex*0.42,y-matH*0.40,ex,y); ctx.stroke();
        const leafN=L.runnerLeaves||3;
        for(let l=0;l<leafN;l++){ const f=(l+1)/(leafN+1), px=ex*f, py=y*f-matH*0.20;
          leafDot(px+side*(1+rnd()*1.4),py,1.6,0.8,side*0.32,fol); }
      }
      ctx.lineCap='butt';
    } else {
      const n = stemFor(L.leaves||26);
      const wide=L.foliageW||16, high=L.foliageH||0.55, leafW=L.leafW||3.4, leafH=L.leafH||2.6;
      for (let i=0;i<n;i++){
        const a=rnd()*Math.PI*2, r=rnd();
        const px=Math.cos(a)*wide*r*(0.5+0.5*growth)+sway*2;
        const py=-H*high*(0.25+rnd()*0.75);
        leafDot(px,py,leafW,leafH,a,fol);
      }
    }
    if (mature && ((blooming&&S.bloom)||S.seed)){
      const col=(blooming?S.bloom:null)||S.seed;
      const m0=stemFor((habit==='mossphlox'||habit==='matflower')?(L.flowers||18):(L.flowerStems||7)), m=S.bloom&&!S.seed ? Math.max(1,Math.ceil(m0*blv)) : m0;
      // The stems stay one stroke apiece even under ART2. Batching them into a
      // single path would mean walking the loop twice, and the rnd() stream
      // that sites each stem also sites its flower — a second pass would put
      // the flowers somewhere else entirely. The florets are where the ops are.
      for (let i=0;i<m;i++){
        const ox=(rnd()-0.5)*(L.flowerW||20), len=H*((L.flowerLen||0.85)+rnd()*(L.flowerJitter||0.2));
        ctx.strokeStyle=shade(fol,-25); ctx.lineWidth=habit==='baptisia'?1.5:1.1;
        ctx.beginPath(); ctx.moveTo(ox*0.5,0); ctx.lineTo(ox+sway*2,-len); ctx.stroke();
        ctx.fillStyle=col;
        if (habit==='baptisia'&&season==='Spring'){
          const pods=S.seed&&!blooming, count=pods?3:(L.raceme||6);
          if (a2){
            for(let s=0;s<count;s++)
              fcPush(ox+sway*2+(s%2?-1.8:1.8),-len+s*3.3,pods?2.1:2.0,(pods?3.1:2.4)/(pods?2.1:2.0));
            fcDraw(ctx,col,pods?18:26,-16);
          } else
          for(let s=0;s<count;s++){
            ctx.beginPath();
            ctx.ellipse(ox+sway*2+(s%2?-1.8:1.8),-len+s*3.3,pods?2.1:2.0,pods?3.1:2.4,0,0,7); ctx.fill();
          }
        }
        else if ((habit==='threadleaf'||habit==='broadamsonia')&&season==='Spring'){
          if (a2){
            for(let p=0;p<5;p++){ const pa=p/5*Math.PI*2;
              fcPush(ox+sway*2+Math.cos(pa)*3,-len+Math.sin(pa)*3,1.3); }
            fcDraw(ctx,col,26,-14);
          } else
          for(let p=0;p<5;p++){ const pa=p/5*Math.PI*2;
            ctx.beginPath(); ctx.ellipse(ox+sway*2+Math.cos(pa)*3,-len+Math.sin(pa)*3,1.3,1.3,0,0,7); ctx.fill(); }
        }
        else if (habit==='mossphlox'){
          const petals=L.petals||5, petal=L.petal||2.2, cx=ox+sway*2+(rnd()-0.5)*(L.flowerSpread||24), cy=-H*(0.08+rnd()*(L.foliageH||0.18));
          if (a2){
            // A phlox mat is ~110 petal ellipses. Flushed per flower rather
            // than per plant so the eye can land on top of its own corolla.
            for(let p=0;p<petals;p++){ const a=p/petals*Math.PI*2;
              fcPush(cx+Math.cos(a)*petal*0.72,cy+Math.sin(a)*petal*0.58,petal,0.56); }
            fcDraw(ctx,col,24,-16);
          } else
          for(let p=0;p<petals;p++){ const a=p/petals*Math.PI*2;
            ctx.beginPath(); ctx.ellipse(cx+Math.cos(a)*petal*0.72,cy+Math.sin(a)*petal*0.58,petal,petal*0.56,a,0,7); ctx.fill(); }
          if (S.eye){ ctx.fillStyle=S.eye; ctx.beginPath(); ctx.arc(cx,cy,petal*0.34,0,7); ctx.fill(); ctx.fillStyle=col; }
        }
        else if (habit==='matflower'){
          const petals=L.petals||5, petalLen=L.petalLen||4.8, petalW=L.petalW||2.9;
          const cx=ox+sway*2+(rnd()-0.5)*(L.matW||25)*0.42, cy=-H*(0.08+rnd()*(L.foliageH||0.18))-1;
          if (!blooming && S.seed){
            ctx.fillStyle=shade(col,-14); ctx.beginPath(); ctx.ellipse(cx,cy,1.35,2.15,0.18,0,7); ctx.fill();
            ctx.strokeStyle=shade(col,-28); ctx.lineWidth=0.55;
            if (a2){                        // the schizocarp's beaks, one path
              ctx.beginPath();
              for(let p=0;p<5;p++){ const a=p/5*Math.PI*2;
                ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(a)*1.5,cy+Math.sin(a)*1.1); }
              ctx.stroke();
            } else
            for(let p=0;p<5;p++){ const a=p/5*Math.PI*2; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(a)*1.5,cy+Math.sin(a)*1.1); ctx.stroke(); }
          } else {
            if (a2){
              for(let p=0;p<petals;p++){ const a=p/petals*Math.PI*2;
                fcPush(cx+Math.cos(a)*petalLen*0.42,cy+Math.sin(a)*petalLen*0.25,petalLen*0.56,(petalW*0.52)/(petalLen*0.56)); }
              fcDraw(ctx,col,24,-16);
            } else
            for(let p=0;p<petals;p++){ const a=p/petals*Math.PI*2;
              ctx.beginPath(); ctx.ellipse(cx+Math.cos(a)*petalLen*0.42,cy+Math.sin(a)*petalLen*0.25,petalLen*0.56,petalW*0.52,a,0,7); ctx.fill(); }
            if (S.eye){ ctx.fillStyle=S.eye; ctx.beginPath(); ctx.arc(cx,cy,petalW*0.30,0,7); ctx.fill(); ctx.fillStyle=col; }
          }
        }
        else if (habit==='asterdome'||habit==='asterupright'||habit==='asterclean'){
          const heads=L.headsPerStem||(habit==='asterdome'?3:(habit==='asterclean'?2:1)), rad=habit==='asterupright'?3.0:2.4;
          for(let h=0;h<heads;h++){
            const hx=ox+sway*2+(h-(heads-1)/2)*4, hy=-len+rnd()*3;
            if (L.flowerStyle==='aster'){
              const rays=Math.max(7,Math.round(L.rays||10)), rayLen=L.rayLen||1.8, rayW=L.rayW||0.7;
              ctx.strokeStyle=col; ctx.lineWidth=rayW; ctx.lineCap='round';
              if (a2){
                // An aromatic aster carries ~480 of these rays. At rayLen<2px
                // a tapered ribbon is invisible, so what it gets instead is one
                // path per head — 10 strokes down to 1 — and a lit disc.
                ctx.beginPath();
                for(let r=0;r<rays;r++){ const a=r/rays*Math.PI*2;
                  ctx.moveTo(hx+Math.cos(a)*0.7,hy+Math.sin(a)*0.55);
                  ctx.lineTo(hx+Math.cos(a)*rayLen,hy+Math.sin(a)*rayLen*0.75); }
                ctx.stroke(); ctx.lineCap='butt';
                drawFloret(ctx,hx,hy,L.discR||0.95,S.eye||shade(col,-30),{lift:30});
                ctx.fillStyle=col;
              } else {
              for(let r=0;r<rays;r++){ const a=r/rays*Math.PI*2;
                ctx.beginPath(); ctx.moveTo(hx+Math.cos(a)*0.7,hy+Math.sin(a)*0.55);
                ctx.lineTo(hx+Math.cos(a)*rayLen,hy+Math.sin(a)*rayLen*0.75); ctx.stroke(); }
              ctx.lineCap='butt'; ctx.fillStyle=S.eye||shade(col,-30);
              ctx.beginPath(); ctx.arc(hx,hy,L.discR||0.95,0,7); ctx.fill(); ctx.fillStyle=col;
              }
            } else if (a2){
              drawFloret(ctx,hx,hy,rad,col,{lift:24,drop:-16});
              if (S.eye){ ctx.fillStyle=S.eye; ctx.beginPath(); ctx.arc(hx,hy,rad*0.35,0,7); ctx.fill(); ctx.fillStyle=col; }
            } else {
              ctx.beginPath(); ctx.arc(hx,hy,rad,0,7); ctx.fill();
              if (S.eye){ ctx.fillStyle=S.eye; ctx.beginPath(); ctx.arc(hx,hy,rad*0.35,0,7); ctx.fill(); ctx.fillStyle=col; }
            }
          }
        }
        else if (L.flowerStyle==='double'&&blooming){
          const cx=ox+sway*2, cy=-len, rad=L.flowerR||5.5;
          const petals=Math.max(10,Math.round(L.flowerPetals||14));
          if (a2){
            for(let p=0;p<petals;p++){
              const a=p/petals*Math.PI*2, pr=rad*(0.68+(p%2)*0.08);
              fcPush(cx+Math.cos(a)*rad*0.56,cy+Math.sin(a)*rad*0.34,pr,0.46);
            }
            for(let p=0;p<Math.ceil(petals*0.62);p++){
              const a=p/Math.ceil(petals*0.62)*Math.PI*2;
              fcPush(cx+Math.cos(a)*rad*0.27,cy+Math.sin(a)*rad*0.17,rad*0.48,0.52);
            }
            fcDraw(ctx,col,28,-18);
            drawFloret(ctx,cx,cy,rad*0.28,shade(col,-10),{lift:24});
          } else {
            ctx.fillStyle=col;
            for(let p=0;p<petals;p++){
              const a=p/petals*Math.PI*2;
              ctx.beginPath(); ctx.ellipse(cx+Math.cos(a)*rad*0.55,cy+Math.sin(a)*rad*0.32,
                rad*0.68,rad*0.31,a,0,7); ctx.fill();
            }
            ctx.fillStyle=shade(col,-10); ctx.beginPath(); ctx.arc(cx,cy,rad*0.28,0,7); ctx.fill();
          }
        }
        else if (a2){
          // The unstyled head is a mint/milkweed cyme: a single flat disc in
          // classic. ART2 makes it a small dome of florets instead — still
          // 2 fills, but it stops mountain mint reading as a painted dot.
          const rad=key==='mountainmint'?3.4:2.6;
          const fx=ox+sway*2, fy=-len, dn=Math.max(4,Math.round(rad*2.2));
          for(let d=0;d<dn;d++){ const a=rnd()*Math.PI*2, rr=Math.sqrt(rnd())*rad*0.82;
            fcPush(fx+Math.cos(a)*rr, fy+Math.sin(a)*rr*0.72, rad*0.42*(0.8+rnd()*0.4), 0.9); }
          fcDraw(ctx,col,26,-14);
        }
        else { ctx.beginPath(); ctx.arc(ox+sway*2,-len,key==='mountainmint'?3.4:2.6,0,7); ctx.fill(); }
      }
    }
  }
  else if (P.form === 'bulbcup'){ // crocus/tulip/daffodil: straps and cups
    const L2=P.look||{};
    if (S.fol){
      const n=stemFor(5);
      ctx.strokeStyle=S.fol; ctx.lineWidth=1.4;
      for (let i=0;i<n;i++){ const a=(i/(n-1)-0.5)*1.2+(rnd()-0.5)*0.2, l=H*(0.5+rnd()*0.4);
        if (art2On(L2)){
          // bulb straps are broad and fleshy, not wire — a tulip's foliage is
          // half of what you see before the flower opens
          drawLeaf(ctx, 0,0, Math.sin(a)*l*0.8+sway*0.4, -l,
                   (L2.strapHW||2.1), S.fol, {shape:'linear', rib:false, bow:0.07});
        } else {
          ctx.beginPath(); ctx.moveTo(0,0);
          ctx.quadraticCurveTo(Math.sin(a)*l*0.5,-l*0.6,Math.sin(a)*l*0.8,-l); ctx.stroke(); }
      }
    }
    if (blooming){
      const sn=Math.max(1,Math.ceil((L2.stems||3)*blv)), cup=L2.cup||3;
      for (let i=0;i<sn;i++){
        const ox=(rnd()-0.5)*8, len=H*(0.7+rnd()*0.3);
        ctx.strokeStyle=shade(S.fol,-12); ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(ox*0.5,0); ctx.lineTo(ox+sway,-len); ctx.stroke();
        if (art2On(L2)){
          // the cup is three TEPALS, not three lines. Outer pair first so the
          // near one overlaps them, which is how a tulip actually closes.
          for (const p2 of [-1,1,0]){
            drawLeaf(ctx, ox+sway, -len,
                     ox+sway+p2*cup*0.85, -len-cup*(p2?1.55:1.75),
                     cup*(L2.tepalHW||0.44), shade(S.bloom, p2*6),
                     {shape:'lance', rib:false, bow:p2*0.05});
          }
          if (S.eye) drawFloret(ctx, ox+sway, -len-cup*0.55, cup*0.5, S.eye, {squash:0.92});
        } else {
          ctx.strokeStyle=S.bloom; ctx.lineWidth=1.8;
          for (let p2=-1;p2<=1;p2++){ ctx.beginPath();
            ctx.moveTo(ox+sway,-len);
            ctx.lineTo(ox+sway+p2*cup*0.8,-len-cup*1.6); ctx.stroke(); }
          if (S.eye){ ctx.fillStyle=S.eye;
            ctx.beginPath(); ctx.arc(ox+sway,-len-cup*0.5,cup*0.45,0,7); ctx.fill(); }
        }
      }
    }
  }
  else if (P.form === 'waterleaf'){ // lotus / water lily: pads ride flat on the water
    const L=P.look||{}, fol=S.fol||'#5f7f55';
    const pads=stemFor(L.pads||6), padW=L.padW||16, padH=L.padH||9;
    if (S.fol){
      for (let i=0;i<pads;i++){
        const a=rnd()*Math.PI*2, rr=Math.sqrt(rnd())*(L.upright?13:18);
        const px=Math.cos(a)*rr+sway*0.8, py=-4+Math.sin(a)*rr*0.35;
        if (art2On(L)){
          // a lily pad is big enough to carry a real gradient, and it is a flat
          // disc on water — the light falls across it, which is most of what
          // tells you it is lying down rather than standing up
          const pw=padW*(0.65+rnd()*0.25), ph=padH*(0.65+rnd()*0.25), prot=rnd()*0.4;
          ctx.beginPath(); ctx.ellipse(px,py,pw,ph,prot,0,7);
          litFill(ctx,px,py,Math.max(pw,ph),fol);
        } else {
          // NB: the rnd() calls here must stay in their original ORDER. Hoisting
          // them above the branch changed which value fed which argument, which
          // silently moved the classic render of every water plant.
          ctx.fillStyle=shade(fol,(rnd()-0.5)*20);
          ctx.beginPath(); ctx.ellipse(px,py,padW*(0.65+rnd()*0.25),padH*(0.65+rnd()*0.25),rnd()*0.4,0,7); ctx.fill(); }
        ctx.fillStyle='rgba(25,40,25,0.16)';
        ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(px+padW*0.45,py-padH*0.12); ctx.lineTo(px+padW*0.12,py+padH*0.16); ctx.closePath(); ctx.fill();
      }
    }
    if (blooming && mature && S.bloom){
      const flowers=Math.max(1,Math.ceil((L.flower==='lotus'?2:3)*blv));
      for (let f=0;f<flowers;f++){
        const px=(rnd()-0.5)*22+sway, py=-(L.upright?H*0.50:10)-rnd()*8;
        if (L.upright){
          ctx.strokeStyle=shade(fol,-18); ctx.lineWidth=1.5;
          ctx.beginPath(); ctx.moveTo(px*0.25,0); ctx.lineTo(px,py+5); ctx.stroke();
        }
        for (let p=0;p<8;p++){
          const a=p/8*Math.PI*2, pet=L.flower==='lotus'?5.5:4.4;
          ctx.fillStyle=shade(S.bloom,(rnd()-0.5)*12);
          ctx.beginPath(); ctx.ellipse(px+Math.cos(a)*pet*0.55,py+Math.sin(a)*pet*0.28,pet*0.42,pet*0.72,a,0,7); ctx.fill();
        }
        ctx.fillStyle=L.flower==='lotus'?'#caa45d':'#d7b85a';
        ctx.beginPath(); ctx.arc(px,py,2.2,0,7); ctx.fill();
      }
    }
    if (S.seed && mature){
      const pods=L.seedPods||2;
      ctx.fillStyle=S.seed;
      for (let i=0;i<pods;i++){
        const px=(rnd()-0.5)*22, py=-(L.upright?H*0.45:8)-rnd()*8;
        if (L.upright){ ctx.strokeStyle=shade(fol,-22); ctx.lineWidth=1.2;
          ctx.beginPath(); ctx.moveTo(px*0.25,0); ctx.lineTo(px,py+4); ctx.stroke(); }
        ctx.beginPath(); ctx.ellipse(px,py,3.6,2.6,0,0,7); ctx.fill();
      }
    }
  }
  else if (P.form === 'fern'){ // arching fronds, leaflets tapering to the tip
    const Lf=P.look||{};
    if (S.fol && art2On(Lf)){
      // A fern draws ~9 fronds x 6 leaflets. Shading each one would be 54
      // fills; batching every leaflet into a dark pass and a lit pass is 2,
      // and at leaflet scale that IS the shading. Rachis batches to one stroke.
      const n=stemFor(9), rach=[];
      for (let i=0;i<n;i++){
        const a=(i/Math.max(1,n-1)-0.5)*1.9+(rnd()-0.5)*0.2, len=H*(0.65+rnd()*0.4);
        rach.push({a, px:Math.sin(a)*len*0.8+sway*len*0.06, py:-Math.cos(a*0.55)*len});
      }
      ctx.strokeStyle=shade(S.fol,-20); ctx.lineWidth=1.1; ctx.beginPath();
      for (const r of rach){ ctx.moveTo(0,0);
        ctx.quadraticCurveTo(r.px*0.35, r.py*0.7, r.px, r.py); }
      ctx.stroke();
      for (let pass=0; pass<2; pass++){
        ctx.fillStyle = pass ? shade(S.fol,30) : shade(S.fol,-12);
        const k = pass ? 0.60 : 1, off = pass ? 0.34 : 0;
        ctx.beginPath();
        for (const r of rach){
          const cxc=r.px*0.35, cyc=r.py*0.7, rot=r.a*0.5;
          for (let f=0.25;f<=0.95;f+=0.14){
            const u=1-f, bx=2*u*f*cxc+f*f*r.px, by=2*u*f*cyc+f*f*r.py;
            const rr=((1-f)*4.2+0.8)*k, ry=1.1*k;
            const ox2=bx+LIT.x*rr*off, oy2=by+LIT.y*ry*off;
            ctx.moveTo(ox2+rr*Math.cos(rot), oy2+rr*Math.sin(rot));   // no join line
            ctx.ellipse(ox2, oy2, rr, ry, rot, 0, 7);
          }
        }
        ctx.fill();
      }
    }
    else if (S.fol){
      const n=stemFor(9);
      for (let i=0;i<n;i++){
        const a=(i/(n-1)-0.5)*1.9+(rnd()-0.5)*0.2;
        const len=H*(0.65+rnd()*0.4);
        const p1x=Math.sin(a)*len*0.8+sway*len*0.06, p1y=-Math.cos(a*0.55)*len;
        const cxc=p1x*0.35, cyc=p1y*0.7;
        const col=shade(S.fol,(rnd()-0.5)*22);
        ctx.strokeStyle=col; ctx.lineWidth=1.1;
        ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(cxc,cyc,p1x,p1y); ctx.stroke();
        ctx.fillStyle=col;
        for (let f=0.25;f<=0.95;f+=0.14){ // leaflets along the rachis
          const u=1-f;
          const bx=2*u*f*cxc+f*f*p1x, by=2*u*f*cyc+f*f*p1y;
          ctx.beginPath(); ctx.ellipse(bx,by,(1-f)*4.2+0.8,1.1,a*0.5,0,7); ctx.fill();
        }
      }
    }
    if (S.seed && (mature||!S.fol)){ // ostrich fern's stiff fertile fronds hold all winter
      ctx.strokeStyle=S.seed; ctx.lineWidth=1.8;
      for (let i=0;i<3;i++){ const ox=(rnd()-0.5)*6;
        ctx.beginPath(); ctx.moveTo(ox,0); ctx.lineTo(ox+sway*2,-H*(0.5+rnd()*0.2)); ctx.stroke(); }
    }
  }
  else if (P.form === 'leafmound'){ // hosta and shade mounds: broad overlapping leaves, scapes above
    const Lm=P.look||{};
    if (S.fol){
      const n=stemFor(Lm.leaves||11);
      if (art2On(Lm)){
        // A hosta IS its leaves — broad, ribbed, overlapping, and the whole
        // reason anyone plants one. Flat rotated ellipses made it a pile of
        // coins; a cordate silhouette with a midrib is the entire species read.
        const blades=[];
        for (let i=0;i<n;i++) blades.push({
          a:(i/Math.max(1,n-1)-0.5)*2.4+(rnd()-0.5)*0.25,
          l:H*0.62*(0.6+rnd()*0.45), z:rnd() });
        blades.sort((p,q)=>q.z-p.z);            // back leaves first
        for (const b of blades){
          const rec=0.84+0.16*(1-b.z);
          const lx=Math.sin(b.a)*b.l*rec, ly=-Math.cos(b.a*0.5)*b.l*0.7*rec;
          drawLeaf(ctx, 0, -b.z*2, lx*0.92+sway, ly*1.04,
                   b.l*(Lm.moundHW||0.28)*rec, shade(S.fol,(b.z-0.5)*-24),
                   {shape:Lm.leafShape||'cordate',
                    bow:Lm.leafBow===undefined?0.10:Lm.leafBow});
        }
      } else
      for (let i=0;i<n;i++){
        const a=(i/(n-1)-0.5)*2.4+(rnd()-0.5)*0.25;
        const l=H*0.62*(0.6+rnd()*0.45);
        const lx=Math.sin(a)*l, ly=-Math.cos(a*0.5)*l*0.7;
        ctx.fillStyle=shade(S.fol,(rnd()-0.5)*26);
        ctx.beginPath();
        ctx.ellipse(lx*0.7+sway, ly*0.8, l*0.42, l*0.24, Math.atan2(ly,lx), 0, 7);
        ctx.fill();
      }
    }
    if (blooming && mature){
      ctx.strokeStyle=shade(S.fol||'#6f8f5a',-18); ctx.lineWidth=1.1;
      const m=Math.max(1,Math.ceil((Lm.scapes||3)*blv));
      for (let i=0;i<m;i++){ const ox=(rnd()-0.5)*10, len=H*(1.0+rnd()*0.2);
        ctx.beginPath(); ctx.moveTo(ox*0.4,0); ctx.lineTo(ox+sway*2,-len); ctx.stroke();
        if (art2On(Lm)){
          for (let s2=0;s2<(Lm.florets||4);s2++)
            drawFloret(ctx, ox+sway*2+(rnd()-0.5)*2, -len+s2*(Lm.floretGap||2.8), Lm.floretR||1.8, S.bloom, {squash:Lm.floretSquash||1.3});
        } else {
          ctx.fillStyle=S.bloom;
          const rr=Lm.floretR||1.8;
          for (let s2=0;s2<(Lm.florets||4);s2++){ ctx.beginPath();
            ctx.ellipse(ox+sway*2+(rnd()-0.5)*2,-len+s2*(Lm.floretGap||2.8),rr*0.84,rr*(Lm.floretSquash||1.3),0,0,7); ctx.fill(); }
        } }
    }
  }
  else if (P.form === 'tree'){ // deciduous: trunk + branches always, canopy by season
    const L=P.look||{};
    // vs = the T10 display-rescale factor; absolute strokes (trunk, branches,
    // flowers) scale with it so a big canopy doesn't sit on toothpick wood
    const vs=(woodyVisualCw(P)||100)/(P.cw||100);
    const cw=(woodyVisualCw(P)||100)*(L.cwMul||1)*(0.12+0.88*growth), trunkH=H*(L.trunkH||0.42);
    const cy=-trunkH-H*(L.canopyY||0.30); // canopy center
    ctx.strokeStyle=L.bark||'#5e4a38'; ctx.lineCap='round';
    const trunks=Math.max(1,L.trunks||1), trunkW=Math.max(2,(L.trunkW||6)*vs*growth);
    for (let tr=0;tr<trunks;tr++){
      const spread=(tr-(trunks-1)/2)*(L.trunkSpread||7)*vs*(0.5+growth*0.5);
      const lean=(tr-(trunks-1)/2)*(L.trunkLean||2.5)*vs;
      ctx.lineWidth=trunkW*(trunks>1?0.72:1);
      ctx.beginPath(); ctx.moveTo(spread,0);
      ctx.quadraticCurveTo(spread*0.55,-trunkH*0.42,sway*2+lean,-trunkH); ctx.stroke();
      if (L.barkStripe){
        ctx.strokeStyle=L.barkStripe; ctx.lineWidth=Math.max(0.7,trunkW*0.16);
        for(let bs=0;bs<3;bs++){ ctx.beginPath();
          const y=-trunkH*(0.18+bs*0.22);
          ctx.moveTo(spread-2*vs,y); ctx.lineTo(spread+3*vs,y-1); ctx.stroke(); }
        ctx.strokeStyle=L.bark||'#5e4a38';
      }
    }
    const tips=[];
    ctx.lineWidth=Math.max(1.2, (L.branchW||2.2)*vs*growth);
    const branchN=L.branches||5;
    for (let i=0;i<branchN;i++){
      const a=(i/(branchN-1)-0.5)*(L.branchSpread||1.7)+(rnd()-0.5)*0.2;
      const bx=Math.sin(a)*cw*(L.branchReach||0.34)+sway*3, by=cy-Math.cos(a)*H*(L.branchLift||0.18);
      ctx.beginPath(); ctx.moveTo(sway*1.4,-trunkH*0.92);
      ctx.quadraticCurveTo(bx*0.35,-trunkH-H*(L.branchY||0.12),bx,by); ctx.stroke();
      tips.push([bx,by]);
    }
    if (S.fol){ // leaf canopy
      // T10: leaf blobs are cw-relative, so a rescaled giant would read as a
      // few huge lobes — trade blob size for blob count (coverage constant)
      const leafMul=Math.min(3,Math.max(1,vs*0.75)), leafDim=1/Math.sqrt(leafMul);
      const n=stemFor(Math.round((L.leafN||26)*leafMul));
      const cwv=cw*(L.canopyW||0.48), chv=H*(L.canopyH||0.26);
      const bw=cw*(L.leafW||0.15)*leafDim, bh=cw*(L.leafH||0.10)*leafDim;
      if (art2On(L)){
        /* ART2 canopy. The blob BUDGET is deliberately unchanged: on a
           T10-rescaled oak the canopy is ~85 of the tree's ~117 paint ops, so
           converting each blob to a shaped drawLeaf would multiply the single
           most expensive plant in the catalog — and it would buy nothing,
           because at this scale one blob is ~54px across. That is a foliage
           MASS, not a leaf. What the classic pass actually lacks is value:
           it shades every blob by (rnd()-0.5)*30, which is noise, so a crown
           reads as flat confetti poured into an ellipse.
           Two changes, both free at the same op count:
             1. shade by POSITION along the light axis instead of at random
             2. cluster the blobs into lobes, so the crown has masses and
                sky-holes and its edge is broken rather than a drawn ellipse
           The classic +22 highlight pass is folded in (the lit side now falls
           out of the same loop), and those ~16 saved fills pay for the one
           gradient the underwash costs. Net: fewer ops than classic. */
        ctx.save(); ctx.globalAlpha=0.30;
        ctx.beginPath();
        ctx.ellipse(sway*2, cy+H*0.06, cwv*0.94, chv*0.90, 0, 0, 7);
        litFill(ctx, sway*2, cy+H*0.06, Math.max(cwv,chv)*0.85, shade(S.fol,-30), 24, -22);
        ctx.restore();
        const lobes=Math.max(4,Math.min(8,Math.round(3+vs*0.9)));
        const per=Math.max(2,Math.round(n/lobes));
        let left=n;
        for (let lo=0; lo<lobes && left>0; lo++){
          const cnt=(lo===lobes-1)?left:Math.min(left,per); left-=cnt;
          // One lobe sits over the trunk, the rest ring the crown near its rim:
          // a canopy is a few merged masses and the gaps between them read as
          // sky. The ring radius is deliberately high — an earlier pass put the
          // lobes at 0.30-0.62 and the crown came out visibly SMALLER than the
          // classic uniform scatter, which is a size regression on the most
          // recognisable object in the garden.
          const la=((lo+rnd()*0.72)/lobes)*Math.PI*2;
          const lr=lo===0 ? rnd()*0.22 : 0.50+rnd()*0.24;
          const lcx=Math.cos(la)*cwv*lr+sway*3, lcy=cy-Math.sin(la)*chv*lr;
          for (let j=0;j<cnt;j++){
            // Two blobs in three of an outer lobe are thrown along the lobe's
            // own radius. Real canopy masses ELONGATE outward from the trunk,
            // and it also holds the crown's overall WIDTH up: lobed placement
            // reaches the rim less often than a uniform scatter does, and the
            // drawn size of a tree must not quietly shrink. Measured by alpha
            // bounding box across 10 species: 0.87-0.92x of classic before
            // this bias, 0.90-0.99x (mean 0.95x) after, and always inside the
            // classic envelope, so no sprite-bounds clipping is introduced.
            const ba=(lo>0 && j%3) ? la+(rnd()-0.5)*1.1 : rnd()*Math.PI*2;
            const br=Math.sqrt(rnd())*0.40;
            const px=lcx+Math.cos(ba)*cwv*br, py=lcy-Math.sin(ba)*chv*br;
            // -1 in the shadowed lower right .. +1 on the lit upper left.
            // Normalising by the crown radii means a wide flat crown and a
            // narrow upright one both light correctly.
            const u=((px-sway*3)/cwv)*LIT.x+((py-cy)/chv)*LIT.y;
            ctx.fillStyle=shade(S.fol, u*27+(rnd()-0.5)*13);
            // rim blobs run a little smaller so the silhouette feathers out
            const e=0.86+0.14*(1-Math.min(1,(lr+br)/1.05));
            ctx.beginPath(); ctx.ellipse(px,py,bw*e,bh*e,ba,0,7); ctx.fill();
          }
        }
      } else {
      ctx.save();
      ctx.globalAlpha=0.24;
      ctx.fillStyle=shade(S.fol,-26);
      ctx.beginPath();
      ctx.ellipse(sway*2, cy+H*0.06, cw*(L.canopyW||0.48)*0.92, H*(L.canopyH||0.26)*0.88, 0, 0, 7);
      ctx.fill();
      ctx.restore();
      for (let i=0;i<n;i++){
        const a=rnd()*Math.PI*2, r=Math.sqrt(rnd());
        ctx.fillStyle=shade(S.fol,(rnd()-0.5)*30);
        ctx.beginPath();
        ctx.ellipse(Math.cos(a)*cw*(L.canopyW||0.48)*r+sway*3, cy-Math.sin(a)*H*(L.canopyH||0.26)*r,
          bw, bh, a, 0, 7);
        ctx.fill();
      }
      }
      if (L.weep){
        ctx.strokeStyle=shade(S.fol,-10); ctx.lineWidth=Math.max(1,vs*0.7);
        for (let w=0;w<8;w++){
          const wx=(rnd()-0.5)*cw*0.7+sway*3, wy=cy+rnd()*H*0.12;
          ctx.beginPath(); ctx.moveTo(wx,wy);
          ctx.quadraticCurveTo(wx+(rnd()-0.5)*5,wy+H*0.16,wx+(rnd()-0.5)*7,wy+H*(0.24+rnd()*0.1)); ctx.stroke();
        }
      }
      if (!art2On(L)){          // ART2 folds the lit side into the main loop
        ctx.save(); ctx.globalAlpha=0.18; ctx.fillStyle=shade(S.fol,22);
        for (let i=0;i<Math.max(4,Math.round(n*0.18));i++){
          const a=-Math.PI*0.65+rnd()*Math.PI*0.42, r=Math.sqrt(rnd());
          ctx.beginPath();
          ctx.ellipse(Math.cos(a)*cw*(L.canopyW||0.48)*r+sway*3, cy-Math.sin(a)*H*(L.canopyH||0.26)*r,
            bw*0.65, bh*0.62, a, 0, 7);
          ctx.fill();
        }
        ctx.restore();
      }
    }
    if (blooming){ // flowers: on the canopy, or straight on bare branches (redbud)
      const spots=Math.max(2,Math.ceil((L.flowerN||(S.fol?10:14))*blv));
      if (L.smoke){
        // smokebush haze: deliberately still flat. It draws at alpha 0.48 as
        // overlapping translucent puffs, and a specular highlight inside a
        // translucent veil is invisible — it would only cost the second fill.
        // ART2 gives it directional VALUE instead, for the same op count.
        ctx.save(); ctx.globalAlpha=0.48;
        const a2=art2On(L);
        for (let i=0;i<spots;i++){
          const [tx2,ty2]=tips[i%tips.length];
          const f=0.5+rnd()*0.45, hx=sway*1.4+(tx2-sway*1.4)*f, hy=-trunkH*0.92+(ty2+trunkH*0.92)*f;
          ctx.fillStyle=a2
            ? shade(S.bloom, ((hx/(cw*0.6||1))*LIT.x+((hy-cy)/(H*0.3||1))*LIT.y)*20+(rnd()-0.5)*14)
            : shade(S.bloom,(rnd()-0.5)*26);
          for (let p=0;p<4;p++){ ctx.beginPath();
            ctx.ellipse(hx+(rnd()-0.5)*12*vs,hy+(rnd()-0.5)*10*vs,3.2*vs,2.1*vs,(rnd()-0.5)*1.2,0,7); ctx.fill(); }
        }
        ctx.restore();
      } else if (art2On(L)){
        // Blossom on a cherry or redbud IS the plant for that fortnight, so
        // this is the one place on a tree worth a second fill per shape.
        // drawFloret self-gates its highlight below r=1.1, so a small-flowered
        // tree pays nothing extra.
        const fr=(L.flowerSize||1.8)*vs;
        for (let i=0;i<spots;i++){
          const [tx2,ty2]=tips[i%tips.length];
          const f=0.45+rnd()*0.55;
          drawFloret(ctx, sway*1.4+(tx2-sway*1.4)*f, -trunkH*0.92+(ty2+trunkH*0.92)*f,
                     fr, shade(S.bloom,(rnd()-0.5)*10), {squash:0.92});
        }
      } else {
        ctx.fillStyle=S.bloom;
        for (let i=0;i<spots;i++){
          const [tx2,ty2]=tips[i%tips.length];
          const f=0.45+rnd()*0.55;
          ctx.beginPath();
          ctx.arc(sway*1.4+(tx2-sway*1.4)*f, -trunkH*0.92+(ty2+trunkH*0.92)*f, (L.flowerSize||1.8)*vs, 0, 7);
          ctx.fill();
        }
      }
    }
    if (S.seed && mature){ // cottonwood fluff, oak's held leaves handled via fol
      const seeds=L.seedN||8, seedR=(L.seedR||1.4)*vs;
      if (art2On(L)){       // acorns, samaras and fluff all read better lit
        for (let i=0;i<seeds;i++)
          drawFloret(ctx, (rnd()-0.5)*cw*0.8+sway*3, cy-(rnd()-0.5)*H*0.4, seedR, S.seed, {squash:0.9});
      } else {
        ctx.fillStyle=S.seed;
        for (let i=0;i<seeds;i++){ ctx.beginPath();
          ctx.arc((rnd()-0.5)*cw*0.8+sway*3, cy-(rnd()-0.5)*H*0.4, seedR, 0, 7); ctx.fill(); }
      }
    }
  }
  else if (P.form === 'conifer'){ // evergreen habits share primitives, not silhouettes
    const L=P.look||{}, habit=S.fol?(L.coniferHabit||'spruce'):'bare';
    const fol=S.fol||'#4f6f50', vs=(woodyVisualCw(P)||60)/(P.cw||60);
    const cw=(woodyVisualCw(P)||60)*(0.12+0.88*growth);
    const bark=L.bark||shade(fol,-72), top=-H*(L.crownTop||0.96), base=-H*(L.crownBase||0.08);
    const crownH=Math.max(8,base-top), ox=sway*(L.sway||1.2);
    const fullness=Math.max(0.75,L.fullness===undefined?1.12:L.fullness), mass=Math.sqrt(fullness);
    const tierCount=stemFor(L.tiers||(habit==='cedar'?7:habit==='pine'?7:habit==='scale'?10:8));
    // The gap between whorls is what a branch plate has to span to stop the
    // crown reading as a lattice, so plate depth is floored against it rather
    // than left purely to the authored `padThick` — a species that asks for
    // more tiers gets finer plates for free, and none of it costs a shape.
    const tierGap=crownH/Math.max(1,tierCount-1);
    if (art2On(L) && habit!=='bare')
      drawConiferCrownMass(ctx,L,habit,cw,top,base,ox,fol,fullness);
    ctx.strokeStyle=bark; ctx.lineCap='round'; ctx.lineWidth=Math.max(1.2,(L.trunkW||3.4)*vs*growth);
    ctx.beginPath(); ctx.moveTo(0,1);
    if (habit==='weeping'){
      for (let i=1;i<=6;i++){
        const u=i/6, mu=(i-0.5)/6;
        ctx.quadraticCurveTo(coniferLeaderAt(L,H,mu,seed,ox),1+(top-1)*mu,
          coniferLeaderAt(L,H,u,seed,ox),1+(top-1)*u);
      }
    } else ctx.quadraticCurveTo(ox*0.18,-H*0.55,ox,top);
    ctx.stroke();
    snowAnchors=[];

    if (!art2On(L) && S.fol){
      // Preserve the global ?art2=0 A/B and emergency performance fallback.
      // The data-rich renderer is the normal path; this is deliberately the
      // old low-cost three-tier silhouette.
      for (let t=0;t<3;t++){
        const w=cw*(0.95-t*0.27), yb=-H*(0.16+t*0.26), yt=-H*(0.46+t*0.27);
        ctx.fillStyle=shade(S.fol,(t-1)*10); ctx.beginPath();
        ctx.moveTo(-w/2+sway*(t+1)*0.6,yb); ctx.lineTo(w/2+sway*(t+1)*0.6,yb);
        ctx.lineTo(sway*(t+1.6),yt); ctx.closePath(); ctx.fill();
      }
    } else if (habit==='bare'){
      // Deciduous conifers keep a fine, whorled winter skeleton instead of
      // borrowing an evergreen foliage colour just to stay visible.
      for (let t=0;t<tierCount;t++){
        const u=t/Math.max(1,tierCount-1), y=base-crownH*u, hw=coniferHalfWidth(L,cw,u);
        ctx.strokeStyle=shade(bark,4+(t%2)*8); ctx.lineWidth=Math.max(0.65,1.05*vs*(1-u*0.35)); ctx.beginPath();
        for (const side of [-1,1]){
          const ex=side*hw+ox*u, ey=y+H*(L.droop||0.025)*(1-u);
          ctx.moveTo(ox*u,y); ctx.quadraticCurveTo(side*hw*0.45,y-H*0.012,ex,ey);
          for (let j=1;j<=3;j++){
            const f=j/4, tx=side*hw*f+ox*u, ty=y+(ey-y)*f;
            ctx.moveTo(tx,ty); ctx.lineTo(tx+side*H*0.018,ty-H*(0.025+0.008*j));
          }
          if (t%2===0) snowAnchors.push([ex,ey,Math.max(2.2,3.2*vs)]);
        }
        ctx.stroke();
      }
    } else if (habit==='pine'){
      // Pines keep visible whorls and carry needles in tufts at branch tips.
      // `softNeedles` opens the five-needle pines; a dense limber/stone pine
      // stays shorter and stiffer without a new renderer branch.
      for (let t=0;t<tierCount;t++){
        const u=t/Math.max(1,tierCount-1), y=base-crownH*u, hw=coniferHalfWidth(L,cw,u);
        const lift=(L.branchLift||0.02)*H, droop=(L.droop||0.02)*H*(1-u);
        ctx.strokeStyle=shade(bark,8); ctx.lineWidth=Math.max(0.8,1.25*vs*(1-u*0.35)); ctx.beginPath();
        ctx.moveTo(ox*u,y); ctx.quadraticCurveTo(-hw*0.42,y-lift,-hw,y+droop);
        ctx.moveTo(ox*u,y); ctx.quadraticCurveTo(hw*0.42,y-lift,hw,y+droop); ctx.stroke();
        const tufts=Math.max(2,Math.round((L.tufts||3)*(0.82+0.18*(1-u))));
        for (const side of [-1,1]) for (let j=0;j<tufts;j++){
          const f=(j+0.55)/tufts, tx=side*hw*f+ox*u, ty=y+droop*f-lift*4*f*(1-f);
          const nr=Math.max(2.2,(L.needleLen||7)*vs*(0.72+0.28*(1-u))*fullness,tierGap*0.30);
          drawConiferTuft(ctx,tx,ty,nr,side<0?Math.PI:0,shade(fol,(side<0?-12:7)+(rnd()-0.5)*10),rnd,!!L.softNeedles);
          if (j===tufts-1) snowAnchors.push([tx,ty-nr*0.25,nr*0.6]);
        }
      }
      drawConiferTuft(ctx,ox,top,Math.max(3,(L.needleLen||7)*vs*fullness),-Math.PI/2,shade(fol,12),rnd,!!L.softNeedles);
      snowAnchors.push([ox,top,Math.max(3,(L.needleLen||7)*vs*fullness)*0.55]);
    } else if (habit==='cedar'){
      // True cedars read as separated horizontal shelves with visible wood,
      // not a Christmas-tree triangle. Deodar's drooping leader and Atlas
      // cedar's stiffer plates are the same geometry at different droop/open.
      for (let t=0;t<tierCount;t++){
        const u=t/Math.max(1,tierCount-1), y=base-crownH*u, hw=coniferHalfWidth(L,cw,u);
        const drop=(L.droop||0.05)*H*(0.35+0.65*(1-u)), pads=Math.max(2,Math.round((L.pads||4)*(1-u*0.28)));
        ctx.strokeStyle=shade(bark,8); ctx.lineWidth=Math.max(0.8,1.35*vs*(1-u*0.4)); ctx.beginPath();
        ctx.moveTo(ox*u,y); ctx.quadraticCurveTo(-hw*0.45,y-drop*0.15,-hw,y+drop);
        ctx.moveTo(ox*u,y); ctx.quadraticCurveTo(hw*0.45,y-drop*0.15,hw,y+drop); ctx.stroke();
        for (const side of [-1,1]) for (let j=0;j<pads;j++){
          const f=(j+0.55)/pads, px=side*hw*f+ox*u, py=y+drop*f*f;
          drawConiferSpray(ctx,px,py,Math.max(5,hw/pads*0.86*fullness),
            Math.max(1.7,(L.padThick||3.2)*vs*mass,tierGap*0.28*mass),side<0?Math.PI:0,
            fol,(side<0?-12:10)+(rnd()-0.5)*8,true);
          if (j===pads-1) snowAnchors.push([px,py,Math.max(2.5,hw/pads*0.45)]);
        }
      }
      if (L.leaderDroop){
        ctx.strokeStyle=shade(fol,-18); ctx.lineWidth=Math.max(0.8,1.3*vs); ctx.beginPath();
        ctx.moveTo(ox,top); ctx.quadraticCurveTo(ox+H*0.035,top-H*0.015,ox+H*0.045,top+H*0.045); ctx.stroke();
      }
    } else if (habit==='weeping'){
      /* What makes a weeper read is not the bend in its leader — it is foliage
         hanging FAR below the limb that carries it. The first cut sized each
         strand as a fraction of H, which came out at ~1.2x the gap between
         whorls: the strands only filled the gap they hung in, so the tree
         measured 90% ink inside a plain cone, i.e. an ordinary conifer with
         tassels. Both quantities are now measured against THE GROUND instead:
         an arm falls a fraction of the way down, and a strand falls most of
         the rest. That one change is what produces the habit — upper limbs
         carry the long drapes because they have the room, lower limbs only
         reach down to the skirt, and the outline stops being a triangle. It
         also self-scales: a low broad cascade and a tall narrow curtain come
         out of the same numbers. `weepFall` slightly exceeds 1 at its longest,
         so the skirt breaks the ground line rather than hemming along it —
         `coniferWeepBelow` reserves exactly that much sprite box. */
      const armFall=L.scaffoldDroop===undefined?WEEP_SCAFFOLD:L.scaffoldDroop;
      const weepFall=L.weepFall===undefined?0.86:L.weepFall;
      for (let t=0;t<tierCount;t++){
        const u=t/Math.max(1,tierCount-1), y=base-crownH*u, hw=coniferHalfWidth(L,cw,u);
        const cx=coniferLeaderAtY(L,H,top,y,seed,ox), arch=(L.branchLift||0.035)*H;
        // Distance this limb has to work with. Nothing below is a fraction of
        // H, so a tier near the ground cannot overshoot it.
        const toGround=Math.max(tierGap*0.5,-y);
        const armDrop=Math.min(hw*armFall,toGround*0.45);
        /* Needle plumes and scale drapes crowd differently, so they are thinned
           differently. A pine's fascicle is `needleLen` long whatever the
           branch does, so capping its RADIUS by the spacing (tried first) just
           produced wisps and hemmed the skirt flat — the strand COUNT is what
           has to give, which also thins the plumes toward the leader for free.
           A drape is continuous foliage and may run edge to edge. */
        const nrBase=L.weepTufts?Math.max(2.5,(L.needleLen||7)*vs*fullness):0;
        const curtains=L.weepTufts
          ? Math.max(2,Math.min(Math.round(L.curtains||4),Math.round(hw/Math.max(6,nrBase*1.25))))
          : Math.max(3,Math.min(5,Math.round(L.curtains||4)));
        const asym=L.asymmetry===undefined?0.16:L.asymmetry, longSide=((t+(seed&1))&1)?1:-1;
        const leftScale=longSide===-1?1-asym*0.12*rnd():1-asym*(0.65+0.35*rnd());
        const rightScale=longSide===1?1-asym*0.12*rnd():1-asym*(0.65+0.35*rnd());
        ctx.strokeStyle=shade(bark,5); ctx.lineWidth=Math.max(0.75,1.2*vs*(1-u*0.35)); ctx.beginPath();
        for (let si=0;si<2;si++){
          const side=si?1:-1, armScale=si?rightScale:leftScale;
          // Out, then down: the tip finishes below its own origin, which is
          // the difference between a scaffold limb and a spruce branch.
          ctx.moveTo(cx,y);
          ctx.quadraticCurveTo(cx+side*hw*0.55,y-arch,cx+side*hw*armScale,y+armDrop*armScale);
        }
        ctx.stroke();
        let dropN=0;
        for (let si=0;si<2;si++){
          const side=si?1:-1, armScale=si?rightScale:leftScale;
          for (let j=0;j<curtains;j++){
            const f=(j+0.55)/curtains;
            const py=y-arch*4*f*(1-f)+armDrop*armScale*f*f;
            _coniferDropSide[dropN]=side; _coniferDropJ[dropN]=j;
            _coniferDropX[dropN]=cx+side*hw*armScale*f;
            _coniferDropY[dropN]=py;
            // Ragged on purpose: a hemline reads as a clipped hedge, and the
            // fringe is most of what says "weeping" at garden zoom.
            _coniferDropLen[dropN]=Math.max(tierGap*0.6,
              (-py)*weepFall*(0.62+0.56*rnd())*(0.84+0.22*f));
            dropN++;
          }
        }
        // All hanging secondary branches in a tier share one batched stroke.
        ctx.strokeStyle=shade(bark,12); ctx.lineWidth=Math.max(0.55,0.75*vs*(1-u*0.3)); ctx.beginPath();
        for (let i=0;i<dropN;i++){
          const side=_coniferDropSide[i], px=_coniferDropX[i], py=_coniferDropY[i], len=_coniferDropLen[i];
          ctx.moveTo(px,py); ctx.quadraticCurveTo(px+side*len*0.06,py+len*0.5,px+side*len*0.04,py+len);
        }
        ctx.stroke();
        const strandGap=Math.max(4,hw/curtains);
        for (let i=0;i<dropN;i++){
          const side=_coniferDropSide[i];
          const px=_coniferDropX[i], py=_coniferDropY[i], len=_coniferDropLen[i];
          const drift=side*len*0.05;
          if (L.weepTufts){
            // Pines hang needle-clad shoots, so the strand is tufted down its
            // length rather than filled — a solid ribbon would lose the needle.
            const steps=Math.max(2,Math.min(5,Math.round(len/Math.max(6,nrBase*1.5))));
            for (let s=1;s<=steps;s++){
              const f=s/steps;
              drawConiferTuft(ctx,px+drift*f,py+len*f,nrBase*(0.66+0.34*f),Math.PI/2,
                shade(fol,(side<0?-16:8)+(rnd()-0.5)*13),rnd,!!L.softNeedles);
            }
            snowAnchors.push([px,py+len,nrBase*0.5]);
          } else {
            // Scale foliage hangs as a drape: one tapering ribbon per strand,
            // edge to edge, so the LIGHT is what separates them. The tone jitter
            // is deliberately wide — vertical streaking is the whole read on a
            // dense column, and thinning the drapes to open real gaps instead
            // measured flatter (tone 33.9 -> 19.6) as well as looking shaved.
            const wide=Math.max(2.4,Math.min((L.padThick||2.7)*vs*mass,strandGap*1.05));
            drawConiferCurtain(ctx,px,py,len,wide,drift,fol,(side<0?-19:9)+(rnd()-0.5)*16);
            if (len>tierGap*1.6)
              drawConiferCurtain(ctx,px-side*wide*0.45,py+len*0.14,len*0.62,wide*0.66,drift*0.5,
                fol,(side<0?-27:1)+(rnd()-0.5)*12);
            snowAnchors.push([px,py,Math.max(2.5,len*0.10)]);
          }
        }
      }
    } else if (habit==='scale'){
      // Arborvitae, juniper and true/false cypresses are built from upright
      // overlapping sprays. `fanFlat` keeps Thuja/Hinoki planar; a juniper's
      // rounder, bristlier tufts use the same spray at a steeper fan angle.
      // Overlapping sprays ARE the plant here, so the fan count is what carries
      // its density — a Thuja that shows crown between its fans has stopped
      // being a screen. Two per rung (left and right of the leader) instead of
      // alternating sides down one column, which left every other rung half bare.
      const rungs=Math.max(6,Math.min(16,Math.round(tierCount*(L.density||1.15)*fullness*0.62)));
      const fans=rungs*2;
      for (let i=0;i<fans;i++){
        const u=((i>>1)+0.35+(i&1)*0.5)/rungs, y=base-crownH*u, hw=coniferHalfWidth(L,cw,u);
        const across=(i&1?-1:1)*(0.25+0.65*rnd()), px=across*hw+ox*u;
        const len=Math.max(8,H*(L.sprayLen||0.13)*(0.75+0.35*rnd())*fullness);
        const ang=-Math.PI/2+across*(L.fanFlat?0.12:0.24)+(rnd()-0.5)*(L.sprayJitter||0.20);
        drawConiferSpray(ctx,px,y,len,Math.max(2,(L.padThick||4.2)*vs*mass,crownH/rungs*0.60*mass),ang,fol,
          (across<0?-14:10)+(rnd()-0.5)*9,true);
        if (i%2===0) snowAnchors.push([px,y-len*0.3,Math.max(2.5,len*0.18)]);
        if (L.fanFlat && hw>20 && i%3===0)
          drawConiferSpray(ctx,px*0.52,y+len*0.1,len*0.72,Math.max(1.5,(L.padThick||4.2)*vs*mass*0.72),ang*0.72,
            fol,(across<0?-7:15),true);
      }
      // Close the base without turning the whole plant back into one triangle.
      for (const side of [-1,1]) drawConiferSpray(ctx,0,base,Math.max(8,cw*0.45),Math.max(2.5,(L.padThick||4.2)*vs*mass),side<0?Math.PI:0,
        fol,side<0?-14:8,true);
    } else {
      // Spruce/fir/hemlock: whorled branch plates with scalloped gaps. The
      // number, droop, openness and columnar profile are all authored in data.
      for (let t=0;t<tierCount;t++){
        const u=t/Math.max(1,tierCount-1), y=base-crownH*u, hw=coniferHalfWidth(L,cw,u);
        const drop=(L.droop||0.025)*H*(0.45+0.55*(1-u)), pads=Math.max(2,Math.round((L.pads||4)*(1-u*0.22)));
        ctx.strokeStyle=shade(fol,-40); ctx.lineWidth=Math.max(0.65,0.95*vs); ctx.beginPath();
        ctx.moveTo(ox*u,y); ctx.quadraticCurveTo(-hw*0.5,y-drop*0.15,-hw,y+drop);
        ctx.moveTo(ox*u,y); ctx.quadraticCurveTo(hw*0.5,y-drop*0.15,hw,y+drop); ctx.stroke();
        for (const side of [-1,1]) for (let j=0;j<pads;j++){
          const f=(j+0.55)/pads, px=side*hw*f+ox*u, py=y+drop*f*f;
          const plen=Math.max(4.5,hw/pads*(L.open||0.92)*fullness);
          drawConiferSpray(ctx,px,py,plen,Math.max(1.8,(L.padThick||3.8)*vs*mass,tierGap*0.52*mass),side<0?Math.PI:0,
            fol,(side<0?-15:9)+(rnd()-0.5)*8,true);
          if (j===pads-1) snowAnchors.push([px,py,Math.max(2.5,plen*0.45)]);
        }
      }
    }

    if (L.leaderDroop && habit!=='cedar'){
      const lx=coniferLeaderAt(L,H,1,seed,ox), side=(seed&1)?-1:1;
      const hook=typeof L.leaderDroop==='number'?L.leaderDroop:0.065;
      ctx.strokeStyle=shade(fol,-18); ctx.lineWidth=Math.max(0.8,1.3*vs); ctx.beginPath();
      ctx.moveTo(lx,top); ctx.quadraticCurveTo(lx+side*H*hook*0.62,top-H*0.012,lx+side*H*hook,top+H*hook); ctx.stroke();
    }

    if (S.seed && mature){
      const seeds=L.seedN||6, round=!!L.roundSeed;
      ctx.fillStyle=S.seed;
      for (let i=0;i<seeds;i++){
        const u=0.18+rnd()*0.62, hw=coniferHalfWidth(L,cw,u);
        const sy=base-crownH*u, sx=coniferLeaderAtY(L,H,top,sy,seed,ox)+(rnd()-0.5)*hw*1.2;
        ctx.beginPath(); ctx.ellipse(sx,sy,Math.max(1,1.15*vs),Math.max(1,1.15*vs*(round?1:1.7)),(rnd()-0.5)*0.35,0,7); ctx.fill();
      }
    }
  }
  else if (P.form === 'bamboo'){ // linked cane grove / screen
    const L=P.look||{}, fol=S.fol||'#4f7c50', cane=L.cane||'#5f7f42';
    const vs=(woodyVisualCw(P)||80)/(P.cw||80);
    const cw=(woodyVisualCw(P)||80)*(0.14+0.86*growth), dirs=(detail&&detail.bambooDirs)||[];
    if (dirs.length && S.fol){
      ctx.save(); ctx.globalAlpha=0.18; ctx.fillStyle=shade(fol,-20);
      dirs.forEach(([dx,dy])=>{
        const len=Math.hypot(dx,dy)||1, ux=dx/len, uy=dy/len;
        ctx.beginPath();
        ctx.ellipse(ux*cw*0.30, -H*0.54+uy*8, cw*0.48, H*0.18, Math.atan2(uy,ux), 0, 7);
        ctx.fill();
      });
      ctx.restore();
    }
    const canes=stemFor((L.canes||11)+dirs.length*3);
    for (let i=0;i<canes;i++){
      const pull=dirs.length && i%3===0 ? dirs[(i/3|0)%dirs.length] : null;
      let ox=(rnd()-0.5)*cw*0.62, lean=(rnd()-0.5)*6+sway*2;
      if (pull){ const len=Math.hypot(pull[0],pull[1])||1; ox+=(pull[0]/len)*cw*0.20; lean+=(pull[0]/len)*4; }
      const ht=H*(0.72+rnd()*0.34);
      ctx.strokeStyle='rgba(0,0,0,0.18)'; ctx.lineWidth=3.2*vs;
      ctx.beginPath(); ctx.moveTo(ox+1,0); ctx.quadraticCurveTo(ox+lean*0.25,-ht*0.45,ox+lean,-ht); ctx.stroke();
      ctx.strokeStyle=shade(cane,(rnd()-0.5)*24); ctx.lineWidth=2.1*vs;
      ctx.beginPath(); ctx.moveTo(ox,0); ctx.quadraticCurveTo(ox+lean*0.25,-ht*0.45,ox+lean,-ht); ctx.stroke();
      ctx.strokeStyle='rgba(246,236,202,0.24)'; ctx.lineWidth=0.8*vs;
      if (art2On(L)){
        // The four node rings on a cane share one style and are contiguous, so
        // they are one path and one stroke instead of four. On a 13-cane grove
        // that is 52 stroke calls a frame down to 13 — which is what pays for
        // the shaped leaves below.
        ctx.beginPath();
        for (let n=1;n<5;n++){ const yy=-ht*n/5, xx=ox+lean*(n/5);
          ctx.moveTo(xx-2.4*vs,yy); ctx.lineTo(xx+2.4*vs,yy); }
        ctx.stroke();
      } else {
        for (let n=1;n<5;n++){ const yy=-ht*n/5, xx=ox+lean*(n/5);
          ctx.beginPath(); ctx.moveTo(xx-2.4*vs,yy); ctx.lineTo(xx+2.4*vs,yy); ctx.stroke(); }
      }
      if (S.fol){
        const leaves=Math.max(2,Math.round((L.leafN||36)/canes));
        for (let j=0;j<leaves;j++){
          const f=0.45+rnd()*0.48, lx=ox+lean*f, ly=-ht*f;
          const side=rnd()<0.5?-1:1;
          if (art2On(L)){
            // Bamboo leaves are narrow lance straps that hang off the node in
            // one plane. rib:false — a midrib is invisible at 16px and costs a
            // whole stroke per leaf, so the leaf count stays the fill count.
            const bx=lx+side*(1.5+rnd()*2)*vs, by=ly+(rnd()-0.5)*4;
            drawLeaf(ctx, bx,by, bx+side*(11+rnd()*5)*vs, by+(2.5+rnd()*4)*vs,
                     2.4*vs, shade(fol,(rnd()-0.5)*22),
                     {shape:'lance', rib:false, bow:side*0.10});
          } else {
            ctx.fillStyle=shade(fol,(rnd()-0.5)*26);
            ctx.beginPath(); ctx.ellipse(lx+side*(5+rnd()*7)*vs,ly+(rnd()-0.5)*5,8*vs,2.1*vs,side*0.35,0,7); ctx.fill();
          }
        }
      }
    }
  }
  else if (P.form === 'bush'){ // woody shrub: twigs hold through winter
    const L=P.look||{};
    const cw=(woodyVisualCw(P)||50)*(0.35+0.65*growth);
    if (L.clip){
      const fol=S.fol||S.seed||'#4f6f45', shape=L.shape||'round';
      const bodyH=H*(L.bodyH||0.58), bodyW=cw*(L.bodyW||0.76), baseY=0;
      const hedgeDirs=(detail&&detail.hedgeDirs)||[];
      const connectedSquare=shape==='square' && hedgeDirs.length;
      if (L.broadleaf){
        // Informal BROADLEAF evergreen (inkberry, Ilex glabra): a dense mound
        // of small dark leaves, NOT a smooth clipped topiary ball. Leaves hold
        // every season and the leafy edge breaks the outline; a little woody
        // structure shows low down, the way inkberry legs out with age.
        const bw=bodyW, bh=Math.max(bodyH,16);
        ctx.strokeStyle=shade(fol,-36); ctx.lineWidth=1.4; ctx.lineCap='round';
        for (let i=0;i<3;i++){ const sx=(i-1)*bw*0.16;
          ctx.beginPath(); ctx.moveTo(sx*0.25,baseY);
          ctx.quadraticCurveTo(sx*0.7,baseY-bh*0.42,sx,baseY-bh*0.60); ctx.stroke(); }
        ctx.beginPath(); ctx.ellipse(0,baseY-bh*0.36,bw*0.48,bh*0.34,0,0,7);
        if (art2On(L)) litFill(ctx,0,baseY-bh*0.36,Math.max(bw,bh)*0.4,shade(fol,-26),20,-20);
        else { ctx.fillStyle=shade(fol,-26); ctx.fill(); } // shadowed underbody grounds the mass
        const n=Math.max(30,Math.min(84,Math.round(bw*bh/80)));
        for (let i=0;i<n;i++){
          const t=Math.pow(rnd(),0.72);                     // biased low → fuller base
          const prof=Math.sqrt(Math.max(0.05,1-t*t));       // rounded dome half-width
          const px=(rnd()*2-1)*bw*0.5*prof;
          const py=baseY-bh*(0.05+t*0.94);
          // ART2: the classic lit term is top-lit with a fixed left/right step;
          // resolve it against the real light vector instead so the mound has a
          // continuous terminator rather than two flat halves. Same op count.
          const lit=art2On(L)
            ? ((px/(bw*0.5||1))*LIT.x+((py-(baseY-bh*0.5))/(bh*0.5||1))*LIT.y)*26+t*10+(rnd()-0.5)*16
            : t*24+(px<0?7:-4)+(rnd()-0.5)*22;               // top-lit, warmer to the left
          ctx.fillStyle=shade(fol,-12+lit);
          ctx.beginPath();
          ctx.ellipse(px,py,2.5*(0.75+rnd()*0.55),1.7*(0.75+rnd()*0.55),(rnd()-0.5)*1.5,0,7);
          ctx.fill();
        }
      } else if (L.needles){
        // yew (Taxus): dense LAYERED SPRAYS, never smooth topiary — even a
        // clipped yew keeps a soft, feathery surface. Column = an upright
        // irregular pillar (Hicksii); mound/round = wide layered masses.
        // Mature plants carry scattered red arils in fall/winter (S.seed).
        const col=shape==='column';
        const bw=bodyW*(col?0.56:1.0), bh=Math.max(bodyH,12);
        const span=col?0.92:(shape==='mound'?0.62:0.76);   // spray reach up the body
        ctx.beginPath();
        if (col) ctx.ellipse(0,baseY-bh*0.50,bw*0.44,bh*0.48,0,0,7);
        else ctx.ellipse(0,baseY-bh*0.26,bw*0.50,bh*0.30,0,0,7);
        if (art2On(L)) litFill(ctx,0,baseY-bh*(col?0.50:0.26),Math.max(bw*0.5,bh*0.4),shade(fol,-30),18,-16);
        else { ctx.fillStyle=shade(fol,-30); ctx.fill(); }   // dark underbody grounds the mass
        const n=Math.max(16,Math.min(60,Math.round(bw*bh/210)));
        const sprayW=Math.max(7,bw*(col?0.20:0.13)), sprayH=sprayW*0.40;
        const arils=[];
        for (let i=0;i<n;i++){
          const t=rnd();                                    // 0 base .. 1 top
          const wf=col ? (0.92-t*0.28) : Math.sqrt(Math.max(0.06,1-t*t));
          const px2=(rnd()*2-1)*bw*0.5*wf, py2=baseY-bh*(0.08+t*span);
          const ang=(px2/Math.max(1,bw))*0.9+(rnd()-0.5)*0.5; // sprays sweep outward
          // ART2: light the sprays by their position on the body, not by height
          // alone — a yew is a solid mass and needs a shadowed right flank.
          ctx.fillStyle=art2On(L)
            ? shade(fol,-10+(((px2/(bw*0.5||1))*LIT.x+((py2-(baseY-bh*0.5))/(bh*0.5||1))*LIT.y)*24)+t*12+(rnd()-0.5)*12)
            : shade(fol,-16+t*26+(rnd()-0.5)*14);             // lighter toward the light
          ctx.beginPath();
          ctx.ellipse(px2,py2,sprayW*(0.7+rnd()*0.5),sprayH*(0.7+rnd()*0.5),ang,0,7);
          ctx.fill();
          if (rnd()<0.22) arils.push([px2+(rnd()-0.5)*sprayW,py2+(rnd()-0.5)*sprayH]);
        }
        // feathery upswept shoot tips break the outline along the top.
        // They all share one style, so ART2 draws them as a single path and a
        // single stroke — up to 24 stroke calls a frame on a tall yew.
        ctx.strokeStyle=shade(fol,30); ctx.lineWidth=1.1; ctx.lineCap='round';
        const batchTips=art2On(L);
        if (batchTips) ctx.beginPath();
        for (let i=0;i<Math.max(6,Math.round(n*0.4));i++){
          const t=0.55+rnd()*0.45;
          const wf=col ? (0.92-t*0.28) : Math.sqrt(Math.max(0.06,1-t*t));
          const px2=(rnd()*2-1)*bw*0.5*wf, py2=baseY-bh*(0.08+t*span);
          const dx=(px2>=0?1:-1)*(1.5+rnd()*2.5);
          if (!batchTips) ctx.beginPath();
          ctx.moveTo(px2,py2);
          ctx.quadraticCurveTo(px2+dx*0.6,py2-2.5,px2+dx,py2-(3.5+rnd()*3));
          if (!batchTips) ctx.stroke();
        }
        if (batchTips) ctx.stroke();
        if (S.seed && mature && arils.length){              // red arils, female plants in fruit
          if (art2On(L)) arils.slice(0,7).forEach(([ax,ay])=>drawFloret(ctx,ax,ay,1.9,S.seed));
          else { ctx.fillStyle=S.seed;
            arils.slice(0,7).forEach(([ax,ay])=>{ ctx.beginPath(); ctx.arc(ax,ay,1.5,0,7); ctx.fill(); }); }
        }
      } else if (shape==='sphere'){
        if (art2On(L)){
          // A clipped boxwood ball was three flat ellipses — 19 paint ops for
          // the whole plant, and the single most diagram-like drawing in the
          // catalog. It stays three fills; what changes is that each one is
          // value-graded. The stack matters: a lone linear gradient across the
          // ball reads as a lit flat DISC (an earlier pass did exactly that and
          // came out less spherical than the classic art). A sphere needs the
          // terminator plus a tighter, brighter specular sitting inside it.
          ctx.beginPath(); ctx.ellipse(0,baseY-bodyH*0.47,bodyW*0.50,bodyH*0.52,0,0,7);
          litFill(ctx,0,baseY-bodyH*0.47,Math.max(bodyW*0.5,bodyH*0.52)*0.86,fol,26,-46);
          ctx.save(); ctx.globalAlpha=0.55;   // mid-tone body, pulled toward the light
          ctx.beginPath(); ctx.ellipse(-bodyW*0.06,baseY-bodyH*0.53,bodyW*0.38,bodyH*0.38,0,0,7);
          litFill(ctx,-bodyW*0.06,baseY-bodyH*0.53,bodyW*0.38*0.8,shade(fol,10),20,-24);
          ctx.restore();
          ctx.save(); ctx.globalAlpha=0.66;   // specular sheen on the lit shoulder
          ctx.beginPath(); ctx.ellipse(-bodyW*0.14,baseY-bodyH*0.70,bodyW*0.25,bodyH*0.15,-0.12,0,7);
          litFill(ctx,-bodyW*0.14,baseY-bodyH*0.70,bodyW*0.25*0.7,shade(fol,34),14,-22);
          ctx.restore();
        } else {
        ctx.fillStyle=shade(fol,-20);
        ctx.beginPath(); ctx.ellipse(0,baseY-bodyH*0.47,bodyW*0.50,bodyH*0.52,0,0,7); ctx.fill();
        ctx.fillStyle=shade(fol,-6);
        ctx.beginPath(); ctx.ellipse(0,baseY-bodyH*0.36,bodyW*0.46,bodyH*0.34,0,0,7); ctx.fill();
        ctx.fillStyle=shade(fol,14);
        ctx.beginPath(); ctx.ellipse(-bodyW*0.12,baseY-bodyH*0.66,bodyW*0.30,bodyH*0.19,-0.1,0,7); ctx.fill();
        }
      } else if (shape==='square'){
        if (connectedSquare){
          const axis=detail.hedgeAxis||[Math.cos(detail.hedgeAngle||0),Math.sin(detail.hedgeAngle||0)];
          const step=detail.hedgeStep||bodyW, len=step*1.08, thick=Math.max(12,Math.min(bodyW*0.54,bodyH*0.78));
          const height=bodyH*0.76;
          const left=-len/2, right=len/2, endNeg=detail.hedgeEndNeg!==false, endPos=detail.hedgeEndPos!==false;
          const ux=axis[0], uy=axis[1];
          let nx=-uy, ny=ux; if (ny<0){ nx=-nx; ny=-ny; }
          const pt=(a,b,top)=>[ux*a+nx*b, uy*a+ny*b-(top?height:0)];
          const poly=(pts,fill)=>{ ctx.fillStyle=fill; ctx.beginPath();
            pts.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py)); ctx.closePath(); ctx.fill(); };
          const back=-thick/2, front=thick/2;
          const A=pt(left,back,0), B=pt(right,back,0), C=pt(right,front,0), D=pt(left,front,0);
          const At=pt(left,back,1), Bt=pt(right,back,1), Ct=pt(right,front,1), Dt=pt(left,front,1);
          poly([D,C,Ct,Dt],shade(fol,-18));             // front face
          if (endNeg) poly([A,D,Dt,At],shade(fol,-24)); // outside end cap
          if (endPos) poly([B,C,Ct,Bt],shade(fol,-24));
          poly([At,Bt,Ct,Dt],shade(fol,8));             // clipped top
          ctx.save(); ctx.strokeStyle=shade(fol,-31); ctx.lineWidth=1; ctx.globalAlpha=0.20;
          ctx.beginPath();
          [At,Bt,Ct,Dt,At].forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));
          ctx.moveTo(Dt[0],Dt[1]); ctx.lineTo(D[0],D[1]); ctx.lineTo(C[0],C[1]); ctx.lineTo(Ct[0],Ct[1]);
          if (endNeg){ ctx.moveTo(A[0],A[1]); ctx.lineTo(At[0],At[1]); }
          if (endPos){ ctx.moveTo(B[0],B[1]); ctx.lineTo(Bt[0],Bt[1]); }
          ctx.stroke(); ctx.restore();
          if (L.fleck){
            ctx.save();
            ctx.strokeStyle=shade(fol,-12); ctx.lineWidth=0.8; ctx.lineCap='round';
            const bf=art2On(L); if (bf) ctx.beginPath();   // nine flecks, one style
            for (let i=0;i<9;i++){ const a=left+rnd()*len, b=back+rnd()*thick, p1=pt(a-2,b,1), p2=pt(a+2,b+(rnd()-0.5)*2,1);
              if (!bf) ctx.beginPath();
              ctx.moveTo(p1[0],p1[1]); ctx.lineTo(p2[0],p2[1]);
              if (!bf) ctx.stroke(); }
            if (bf) ctx.stroke();
            ctx.restore();
          }
          ctx.restore();
          return;
        }
        const top=baseY-bodyH*0.92, frontTop=top+bodyH*(connectedSquare?0.18:0.14), bottom=baseY;
        const left=-bodyW/2, right=bodyW/2, inset=connectedSquare?0:bodyW*0.12;
        if (art2On(L)){   // faceted already; the gradient is what stops each face reading as paper
          ctx.beginPath(); ctx.rect(left,frontTop,bodyW,bottom-frontTop);
          litFill(ctx,0,(frontTop+bottom)/2,bodyW*0.5,shade(fol,-18),22,-22);
        } else { ctx.fillStyle=shade(fol,-18); ctx.fillRect(left,frontTop,bodyW,bottom-frontTop); }
        ctx.beginPath();
        ctx.moveTo(left,frontTop); ctx.lineTo(left+inset,top);
        ctx.lineTo(right-inset,top); ctx.lineTo(right,frontTop);
        ctx.closePath();
        if (art2On(L)) litFill(ctx,0,(top+frontTop)/2,bodyW*0.5,shade(fol,10),18,-16);
        else { ctx.fillStyle=shade(fol,10); ctx.fill(); }
        ctx.fillStyle=shade(fol,-25); ctx.fillRect(left,bottom-bodyH*0.08,bodyW,bodyH*0.08);
        ctx.save();
        ctx.strokeStyle=shade(fol,-31); ctx.lineWidth=1; ctx.globalAlpha=connectedSquare?0.14:0.25;
        ctx.beginPath();
        if (!connectedSquare){
          ctx.moveTo(left,frontTop); ctx.lineTo(left,bottom);
          ctx.moveTo(right,frontTop); ctx.lineTo(right,bottom);
        }
        ctx.moveTo(left,frontTop); ctx.lineTo(right,frontTop);
        ctx.moveTo(left,bottom-bodyH*0.08); ctx.lineTo(right,bottom-bodyH*0.08);
        ctx.stroke(); ctx.restore();
      } else if (shape==='cone' || shape==='pyramid'){
        const layers=shape==='cone'?3:2;
        for (let q=0;q<layers;q++){
          const y=baseY-bodyH*(q/layers)*0.58, w=bodyW*(1-q*0.2);
          ctx.beginPath(); ctx.moveTo(-w/2,y);
          ctx.lineTo(w/2,y); ctx.lineTo(sway*1.2,baseY-bodyH*(0.95+q*0.06)); ctx.closePath();
          if (art2On(L)) litFill(ctx,0,y-bodyH*0.3,w*0.5,shade(fol,(q-1)*10),26,-24);
          else { ctx.fillStyle=shade(fol,(q-1)*10); ctx.fill(); }
        }
      } else if (shape==='column'){
        const w=bodyW*0.62;
        if (art2On(L)){
          // a clipped column is a CYLINDER: the value ramp runs across its
          // width, which one gradient gives for the same single fill
          ctx.beginPath(); ctx.rect(-w/2,baseY-bodyH,w,bodyH*0.94);
          litFill(ctx,0,baseY-bodyH*0.5,w*0.5,shade(fol,-13),30,-30);
        } else { ctx.fillStyle=shade(fol,-13); ctx.fillRect(-w/2,baseY-bodyH,w,bodyH*0.94); }
        ctx.fillStyle=shade(fol,8);
          ctx.beginPath(); ctx.ellipse(0,baseY-bodyH,w/2,bodyH*0.16,0,0,7); ctx.fill();
          ctx.beginPath(); ctx.ellipse(0,baseY-bodyH*0.08,w/2,bodyH*0.12,0,0,7); ctx.fill();
      } else {
        const isMound=shape==='mound';
        ctx.beginPath(); ctx.ellipse(0,baseY-bodyH*(isMound?0.30:0.38),bodyW*(isMound?0.58:0.54),bodyH*(isMound?0.30:0.38),0,0,7);
        if (art2On(L)) litFill(ctx,0,baseY-bodyH*(isMound?0.30:0.38),bodyW*(isMound?0.58:0.54),fol,26,-32);
        else { ctx.fillStyle=shade(fol,-20); ctx.fill(); }
        ctx.beginPath(); ctx.ellipse(-bodyW*0.05,baseY-bodyH*(isMound?0.46:0.57),bodyW*(isMound?0.48:0.44),bodyH*(isMound?0.22:0.30),0,0,7);
        if (art2On(L)){ ctx.save(); ctx.globalAlpha=0.45;
          litFill(ctx,-bodyW*0.05,baseY-bodyH*(isMound?0.46:0.57),bodyW*(isMound?0.48:0.44),shade(fol,20),14,-10);
          ctx.restore(); }
        else { ctx.fillStyle=shade(fol,8); ctx.fill(); }
      }
      if (L.fleck){   // boxwood leaf flecks; yews texture themselves via sprays
        ctx.strokeStyle=shade(fol,-12); ctx.lineWidth=0.8; ctx.lineCap='round';
        const bf=art2On(L); if (bf) ctx.beginPath();
        for (let i=0;i<9;i++){ const fx=(rnd()-0.5)*bodyW*0.8, fy=baseY-bodyH*(0.18+rnd()*0.64);
          if (!bf) ctx.beginPath();
          ctx.moveTo(fx-2,fy); ctx.lineTo(fx+2,fy+(rnd()-0.5)*2);
          if (!bf) ctx.stroke(); }
        if (bf) ctx.stroke();
      }
    } else {
      const tn=stemFor(L.twigN||7), tips=[], a2=art2On(L), habit=L.habit||'round';
      const spread=habit==='upright'?0.88:habit==='vase'?1.35:habit==='open'?1.72:
        habit==='lowMound'?2.05:habit==='arching'||habit==='fountain'?2.12:habit==='layered'?1.48:1.5;
      const h0=habit==='lowMound'?0.40:habit==='fountain'||habit==='arching'?0.52:habit==='upright'?0.72:0.55;
      const hr=habit==='lowMound'?0.28:habit==='upright'?0.28:0.43;
      const ctrlX=habit==='vase'?0.58:habit==='upright'?0.46:habit==='fountain'||habit==='arching'?0.28:0.4;
      const ctrlY=habit==='fountain'?1.28:habit==='arching'?1.15:habit==='layered'?0.74:0.55;
      ctx.strokeStyle=S.twig||'#6e5a48'; ctx.lineWidth=1.6; ctx.lineCap='round';
      // Every twig on a shrub shares one colour and width, so ART2 draws the
      // whole armature as ONE path and ONE stroke. On red-twig dogwood that is
      // 12 stroke calls a frame down to 1 — the budget that funds shaped leaves.
      if (a2) ctx.beginPath();
      for (let i=0;i<tn;i++){
        const a=(i/(tn-1)-0.5)*spread+(rnd()-0.5)*0.2;
        const tx2=Math.sin(a)*cw*0.5+sway*2, ty2=-H*(h0+rnd()*hr);
        if (!a2) ctx.beginPath();
        ctx.moveTo((rnd()-0.5)*4,0);
        ctx.quadraticCurveTo(tx2*ctrlX,ty2*ctrlY,tx2,ty2);
        if (!a2) ctx.stroke();
        tips.push([tx2,ty2,ctrlX,ctrlY]);
      }
      if (a2) ctx.stroke();
    if (S.fol){
        // Two spellings of the same fill, kept separate so the classic path
        // emits its ops in the original ORDER (fillStyle, then beginPath).
        // Nothing renders differently either way, but a baseline that drifts
        // for cosmetic reasons hides the next real regression in the noise.
        ctx.save(); ctx.globalAlpha=L.evergreen?0.38:0.20;
        const massW=habit==='lowMound'?0.49:habit==='upright'?0.34:habit==='fountain'||habit==='arching'?0.51:0.45;
        const massH=habit==='lowMound'?0.20:habit==='upright'?0.36:habit==='layered'?0.23:0.28;
        const massY=habit==='lowMound'?0.30:habit==='upright'?0.48:0.42;
        if (a2){
          ctx.beginPath(); ctx.ellipse(sway, -H*massY, cw*massW, H*massH, 0, 0, 7);
          litFill(ctx, sway, -H*massY, Math.max(cw*massW,H*massH)*0.8, shade(S.fol,-24), 22, -20);
        } else {
          ctx.fillStyle=shade(S.fol,-24);
          ctx.beginPath(); ctx.ellipse(sway, -H*massY, cw*massW, H*massH, 0, 0, 7); ctx.fill();
        }
        if (habit==='layered'){
          ctx.globalAlpha*=0.75; ctx.fillStyle=shade(S.fol,6);
          ctx.beginPath(); ctx.ellipse(-cw*0.08,-H*0.57,cw*0.34,H*0.16,0,0,7); ctx.fill();
        }
        ctx.restore();
        // ART2 carries more leaves: shaped foliage is legible where a blur of
        // blobs was not, so 20 scattered leaves read as a bare armature with
        // leaves stuck on it rather than as a leafy shrub.
        const n=stemFor(a2 ? (L.leafN||40) : 20);
        for (let i=0;i<n;i++){
          const a=rnd()*Math.PI*2, r=rnd();
          if (a2){
            /* A shrub is the scale at which an individual leaf IS readable — a
               200px viburnum shows its foliage, unlike a 600px oak canopy — so
               this is where the wave spends its drawLeaf budget. The leaves are
               placed ALONG the twigs rather than scattered through the crown
               ellipse: once a leaf has a shape you can see that it is attached
               to nothing. The twig is the quadratic (0,0)-(tx*0.4,ty*0.55)-
               (tx,ty), so B(t) = (tx(0.8t+0.2t^2), ty(1.1t-0.1t^2)) — the same
               spine the 'spray' bloom style rides. Midribs are gated on size
               (rule 6), so small-leaved species pay nothing for an invisible
               line. */
            const [tx2,ty2,cx1,cy1]=tips[i%tips.length];
            const t=0.26+rnd()*0.68;
            const q=2*(1-t)*t, px=tx2*(q*cx1+t*t)+(rnd()-0.5)*3, py=ty2*(q*cy1+t*t)+(rnd()-0.5)*3;
            const lw=(L.leafHW||1)*3.1, ll=lw*(L.leafLong||2.6);
            const side=(rnd()<0.5?-1:1);
            const dir=side*(0.55+rnd()*0.75);       // out from the cane and drooping
            const u=(px/(cw*0.5||1))*LIT.x+((py+H*0.42)/(H*0.28||1))*LIT.y;
            const leafCol=L.newGrowth && season!=='Winter' && t>0.72 ? L.newGrowth : S.fol;
            drawLeaf(ctx, px,py, px+Math.sin(dir)*ll, py+Math.cos(dir)*ll*0.42-ll*0.12,
                     lw, shade(leafCol, u*20+(rnd()-0.5)*14),
                     {shape:L.leafShape||'ovate', teeth:L.leafTeeth, teethN:L.leafTeethN, edge:L.leafEdge,
                      bow:(L.leafBow===undefined?0.09:L.leafBow)*side,
                      rib:lw>=4.2});
            if (L.compound){
              const lc=shade(leafCol,u*16-5), small=lw*0.68, sl=ll*0.58;
              drawLeaf(ctx,px,py,px-side*sl*0.72,py-sl*0.22,small,lc,{shape:L.leafShape||'lance',rib:false});
              drawLeaf(ctx,px,py,px+side*sl*0.72,py-sl*0.22,small,lc,{shape:L.leafShape||'lance',rib:false});
            }
          } else {
            // rnd() ORDER is load-bearing on the classic path. The original
            // drew the COLOUR before the Y position; hoisting py above the
            // fillStyle swapped which random value fed which, and silently
            // moved every classic shrub. Keep colour first.
            const px=Math.cos(a)*cw*0.5*r+sway*2;
            ctx.fillStyle=shade(S.fol,(rnd()-0.5)*28);
            const py=-H*(0.35+rnd()*0.55);
            ctx.beginPath();
            ctx.ellipse(px, py, 3.6, 2.6, a, 0, 7);
            ctx.fill();
          }
        }
      }
      if (blooming && mature){
        const heads=tips.slice(0,Math.max(1,Math.ceil(tips.length*blv)));
        if (L.bloomStyle==='bareStem'||L.bloomStyle==='stemAxil'){
          const count=L.flowerN||6, shape=L.flowerShape||'star';
          heads.forEach(tip=>{ const [tx2,ty2,cx1,cy1]=tip;
            for (let k=0;k<count;k++){ const t=0.28+k*(0.64/Math.max(1,count-1)), q=2*(1-t)*t;
              const fx=tx2*(q*cx1+t*t)+(rnd()-0.5)*2.4, fy=ty2*(q*cy1+t*t)+(rnd()-0.5)*2;
              drawShrubFlower(ctx,fx,fy,shape==='ribbon'?2.0:shape==='trumpet'?2.5:1.9,
                shade(S.bloom,(rnd()-0.5)*10),shape,rnd,tx2<0?-0.6:0.6); }
          });
        } else if (L.bloomStyle==='truss'||L.bloomStyle==='looseCluster'){
          const cr=L.clusterR||5, shape=L.flowerShape||'cup', n=L.bloomStyle==='truss'?9:(L.flowerN||5);
          heads.forEach(([tx2,ty2])=>{ for (let p=0;p<n;p++){ const a=p/n*Math.PI*2, ring=L.bloomStyle==='truss'?(p%3?0.75:0.32):0.7+rnd()*0.25;
            drawShrubFlower(ctx,tx2+Math.cos(a)*cr*ring,ty2-cr*0.35+Math.sin(a)*cr*ring*0.58,
              shape==='funnel'||shape==='calico'?2.1:1.8,shade(S.bloom,(rnd()-0.5)*10),shape,rnd,a,S.eye); }
          });
        } else if (L.bloomStyle==='rose'||L.bloomStyle==='scattered'){
          const n=stemFor(L.flowerN||12), shape=L.flowerShape||'single';
          for (let k=0;k<n;k++){ const tip=tips[k%tips.length], [tx2,ty2,cx1,cy1]=tip, t=0.45+rnd()*0.5, q=2*(1-t)*t;
            const fx=tx2*(q*cx1+t*t)+(rnd()-0.5)*cw*0.08, fy=ty2*(q*cy1+t*t)+(rnd()-0.5)*H*0.05;
            drawShrubFlower(ctx,fx,fy,shape==='camellia'?3.4:shape==='rosette'?2.8:2.2,
              shade(S.bloom,(rnd()-0.5)*12),shape,rnd,rnd()*Math.PI); }
        } else if (L.bloomStyle==='flatCorymb'){
          const cr=L.clusterR||8;
          heads.slice(0,Math.max(2,Math.ceil(heads.length*0.45))).forEach(([tx2,ty2])=>{
            for (let p=0;p<16;p++){ const a=p/16*Math.PI*2, rr=(0.25+0.75*Math.sqrt(rnd()))*cr;
              drawFloret(ctx,tx2+Math.cos(a)*rr,ty2-cr*0.35+Math.sin(a)*rr*0.28,1.55,
                shade(S.bloom,(rnd()-0.5)*10),{squash:0.9}); }
          });
        } else if (['raceme','droopingRaceme','pendantRaceme','shortSpike'].includes(L.bloomStyle)){
          const n=L.flowerN||10, down=L.bloomStyle==='droopingRaceme'||L.bloomStyle==='pendantRaceme';
          const len=(L.bloomStyle==='shortSpike'?10:18), shape=L.flowerShape||'bell';
          heads.forEach(([tx2,ty2])=>{ ctx.strokeStyle=shade(S.bloom,-35); ctx.lineWidth=0.9; ctx.beginPath();
            ctx.moveTo(tx2,ty2); ctx.quadraticCurveTo(tx2+(down?3:0),ty2+(down?len*0.5:-len*0.5),tx2+(down?2:0),ty2+(down?len:-len)); ctx.stroke();
            for (let k=0;k<n;k++){ const f=k/Math.max(1,n-1), fy=ty2+(down?1:-1)*(2+f*len), side=k%2?-1:1;
              drawShrubFlower(ctx,tx2+side*(2.2+f*1.8),fy,1.25,shade(S.bloom,(rnd()-0.5)*10),shape,rnd,down?Math.PI:0); }
          });
        } else if (L.bloomStyle==='bottlebrush'){
          heads.forEach(([tx2,ty2])=>{ ctx.strokeStyle=shade(S.bloom,-28); ctx.lineWidth=0.8; ctx.beginPath(); ctx.moveTo(tx2,ty2); ctx.lineTo(tx2,ty2-16); ctx.stroke();
            for (let k=0;k<(L.flowerN||10);k++){ const fy=ty2-2-k*1.35, span=2.1+Math.sin(k/Math.max(1,(L.flowerN||10)-1)*Math.PI)*2.8;
              ctx.strokeStyle=shade(S.bloom,(rnd()-0.5)*8); ctx.lineWidth=0.65; ctx.beginPath();
              ctx.moveTo(tx2,fy); ctx.lineTo(tx2-span,fy-1.15); ctx.moveTo(tx2,fy); ctx.lineTo(tx2+span,fy+1.15); ctx.stroke();
              drawFloret(ctx,tx2-span,fy-1.15,0.72,S.bloom,{}); drawFloret(ctx,tx2+span,fy+1.15,0.72,S.bloom,{}); }
          });
        } else if (L.bloomStyle==='globe'){
          const gr=L.clusterR||5;
          heads.forEach(([tx2,ty2])=>{ for (let p=0;p<12;p++){ const a=p/12*Math.PI*2, rr=gr*(0.35+0.65*(p%3)/2);
              drawFloret(ctx,tx2+Math.cos(a)*rr,ty2+Math.sin(a)*rr*0.78,1.35,shade(S.bloom,(rnd()-0.5)*8),{}); }
            ctx.strokeStyle=shade(S.bloom,-12); ctx.lineWidth=0.55; ctx.beginPath();
            for (let p=0;p<10;p++){ const a=p/10*Math.PI*2; ctx.moveTo(tx2+Math.cos(a)*gr*0.7,ty2+Math.sin(a)*gr*0.55); ctx.lineTo(tx2+Math.cos(a)*gr*1.3,ty2+Math.sin(a)*gr); } ctx.stroke();
          });
        } else if (L.smoke){
          ctx.save(); ctx.globalAlpha=0.52;
          heads.forEach(([tx2,ty2])=>{ for (let p=0;p<6;p++){ ctx.fillStyle=shade(S.bloom,(rnd()-0.5)*24);
            ctx.beginPath(); ctx.ellipse(tx2+(rnd()-0.5)*16,ty2-3+(rnd()-0.5)*12,3.4,2.2,(rnd()-0.5)*1.2,0,7); ctx.fill(); } });
          ctx.restore();
        } else if (L.bloomStyle==='panicle'){ // upright conical trusses (lilac)
          const pr=L.clusterR||4.5;
          heads.forEach(([tx2,ty2])=>{ for (let k=0;k<14;k++){ const f=k/14, wr=pr*(1-f*0.85);
            const fy=ty2-pr*0.2-f*pr*1.9;      // fy takes no rnd(); fx does
            // a lilac truss is hundreds of tiny lit florets; the highlight is
            // exactly what stops it reading as a solid lilac-coloured cone
            if (a2){
              const fx=tx2+(rnd()-0.5)*2*wr;
              drawFloret(ctx, fx,fy, 1.9, shade(S.bloom,(rnd()-0.5)*14), {squash:0.94});
            } else {                            // classic drew COLOUR before fx
              ctx.fillStyle=shade(S.bloom,(rnd()-0.5)*18);
              const fx=tx2+(rnd()-0.5)*2*wr;
              ctx.beginPath(); ctx.ellipse(fx, fy, 1.8,1.7,0,0,7); ctx.fill(); } } });
        } else if (L.bloomStyle==='spray'){ // flowers strung along arching canes (bridal wreath)
          // Ride the cane's actual curve, not the base->tip chord: the twig is
          // quadratic with control (0.4,0.55), so B(t) = (0.8t+0.2t^2, 1.1t-0.1t^2).
          // The chord bows several px off a long cane, and on this style the arch
          // IS the plant.
          heads.forEach(([tx2,ty2,cx1,cy1])=>{ for (let k=0;k<9;k++){ const t=0.30+k*0.075, q=2*(1-t)*t;
            const cx=tx2*(q*cx1+t*t), cy=ty2*(q*cy1+t*t);
            if (a2){
              const fx=cx+(rnd()-0.5)*3, fy=cy+(rnd()-0.5)*2.5;
              drawFloret(ctx, fx,fy, 2.1, shade(S.bloom,(rnd()-0.5)*12), {squash:0.9});
            } else {                            // classic drew COLOUR before fx/fy
              ctx.fillStyle=shade(S.bloom,(rnd()-0.5)*14);
              const fx=cx+(rnd()-0.5)*3, fy=cy+(rnd()-0.5)*2.5;
              ctx.beginPath(); ctx.ellipse(fx, fy, 2.1,1.9,0,0,7); ctx.fill(); } } });
        } else if (L.bloomStyle==='cluster'){ // domed corymbs/cymes (ninebark, spirea, viburnum)
          const cr=L.clusterR||4.5;
          heads.forEach(([tx2,ty2])=>{ for (let p=0;p<8;p++){ const a=rnd()*Math.PI*2, rr=Math.sqrt(rnd())*cr;
            const fx=tx2+Math.cos(a)*rr, fy=ty2-cr*0.5+Math.sin(a)*rr*0.6;
            // a corymb is a DOME of florets: light them by where they sit on it
            if (a2) drawFloret(ctx, fx,fy, 1.8,
                     shade(S.bloom, ((Math.cos(a)*rr/cr)*LIT.x+(Math.sin(a)*rr*0.6/cr)*LIT.y)*14+(rnd()-0.5)*10),
                     {squash:0.94});
            else { ctx.fillStyle=shade(S.bloom,(rnd()-0.5)*18);
              ctx.beginPath(); ctx.ellipse(fx, fy, 1.7,1.6,0,0,7); ctx.fill(); } } });
        } else if (a2){
          heads.forEach(([tx2,ty2])=>drawFloret(ctx,tx2,ty2-2,2.6,S.bloom,{squash:1.35}));
        } else { ctx.fillStyle=S.bloom;
          heads.forEach(([tx2,ty2])=>{
            ctx.beginPath(); ctx.ellipse(tx2,ty2-2,2.2,3.2,0,0,7); ctx.fill(); }); }
      }
      if (S.seed && mature){ ctx.fillStyle=S.seed; // berries/pods along upper twigs
        // Own RNG stream (the mulberry(seed+N) convention the snow caps use):
        // the bloom pass above burns a VARYING number of rnd() draws as bloom
        // rises and fades, so sharing the stream would make a heavy berry set
        // visibly jump on a species that blooms and fruits in one season.
        const brnd=mulberry(seed+5);
        // growth-scaled like the twig/leaf counts, so a just-mature shrub does
        // not carry a full fruit set on three twigs. stemFor's floor of 3 keeps
        // the default-3 species (coralberry, sumac) pixel-identical.
        const bn=stemFor(L.berryN||3), f0=bn>3?0.42:0.6, fs=(0.92-f0)/Math.max(1,bn-1);
        // A berry is a small glossy sphere, and the specular dot is the entire
        // reason winterberry reads as fruit rather than as red confetti — the
        // one place on a shrub where a second fill per shape is clearly earned.
        if (L.seedAlong){
          tips.forEach(([tx2,ty2,cx1,cy1])=>{ for (let node=0;node<4;node++){ const f=0.38+node*0.15, q=2*(1-f)*f;
            const nx=tx2*(q*cx1+f*f), ny=ty2*(q*cy1+f*f);
            for (let b=0;b<bn;b++){ const a=b/bn*Math.PI*2;
              drawFloret(ctx,nx+Math.cos(a)*3.1,ny+Math.sin(a)*1.7,1.45,S.seed,{lift:36}); }
          } });
        } else if (L.fruitStyle==='cluster'||L.fruitStyle==='terminalCluster'){
          tips.forEach(([tx2,ty2])=>{ for (let b=0;b<bn+3;b++){ const a=b/(bn+3)*Math.PI*2, rr=2.2+(b%3)*1.25;
            drawFloret(ctx,tx2+Math.cos(a)*rr,ty2+Math.sin(a)*rr*0.65,1.55,S.seed,{lift:36}); }
          });
        } else if (L.fruitStyle==='globe'){
          tips.forEach(([tx2,ty2])=>drawFloret(ctx,tx2,ty2,2.8,S.seed,{lift:28}));
        } else if (L.hipN){
          const hn=stemFor(L.hipN);
          tips.forEach(([tx2,ty2,cx1,cy1],i)=>{ if (i%2) return; for (let b=0;b<hn;b++){ const f=0.5+b*0.11, q=2*(1-f)*f;
            drawFloret(ctx,tx2*(q*cx1+f*f),ty2*(q*cy1+f*f),2.0,S.seed,{squash:1.2,lift:34}); }
          });
        } else tips.forEach(([tx2,ty2])=>{ for (let b=0;b<bn;b++){ const f=f0+b*fs;
          const jx=bn>3?(brnd()-0.5)*2.6:0, jy=bn>3?(brnd()-0.5)*2:0;
          if (a2) drawFloret(ctx, tx2*f+jx, ty2*f+jy, 1.8, S.seed, {lift:38});
          else { ctx.beginPath(); ctx.arc(tx2*f+jx,ty2*f+jy,1.6,0,7); ctx.fill(); } } }); }
    }
  }
  else if (P.form === 'hydrangea'){ // big mophead or panicle flowering shrub
    const L = P.look||{}, panicle = L.bloomShape==='panicle', lacecap = L.bloomShape==='lacecap';
    const cw=(woodyVisualCw(P)||70)*(0.4+0.6*growth), tn=stemFor(6), tips=[], a2=art2On(L);
    ctx.strokeStyle='#6e5a48'; ctx.lineWidth=2; ctx.lineCap='round';
    if (a2) ctx.beginPath();               // six canes, one style: one stroke
    for (let i=0;i<tn;i++){
      const a=(i/(tn-1)-0.5)*1.3+(rnd()-0.5)*0.2;
      const tx2=Math.sin(a)*cw*0.42+sway*2, ty2=-H*(0.6+rnd()*0.38);
      if (!a2) ctx.beginPath();
      ctx.moveTo((rnd()-0.5)*5,0);
      ctx.quadraticCurveTo(tx2*0.4,ty2*0.55,tx2,ty2);
      if (!a2) ctx.stroke();
      tips.push([tx2,ty2]);
    }
    if (a2) ctx.stroke();
    if (S.fol){ // broad leafy mound
      ctx.save(); ctx.globalAlpha=0.23;
      ctx.beginPath(); ctx.ellipse(sway, -H*0.40, cw*0.44, H*0.26, 0, 0, 7);
      if (a2) litFill(ctx, sway, -H*0.40, Math.max(cw*0.44,H*0.26)*0.8, shade(S.fol,-24), 22, -20);
      else { ctx.fillStyle=shade(S.fol,-24); ctx.fill(); }
      ctx.restore();
      const n=stemFor(22);
      for (let i=0;i<n;i++){ const a=rnd()*Math.PI*2, r=rnd();
        // px carries no rnd() and is shared; py DOES, so each branch takes it
        // in its own order — the classic path drew colour first and hoisting
        // py above the branch swapped which random value fed which.
        const px=Math.cos(a)*cw*0.46*r+sway*2;
        if (a2){
          const py=-H*(0.30+rnd()*0.5);
          // Hydrangea foliage is the coarsest, most individually legible leaf
          // in the wave — big, broad ovate, strongly veined and toothed. This
          // is the species the spec names for full drawLeaf, and at 22 leaves
          // per plant the fill count is unchanged.
          const lw=(L.leafHW||1)*4.6, ll=lw*(L.leafLong||2.4), dir=a-Math.PI*0.5;
          const u=(px/(cw*0.46||1))*LIT.x+((py+H*0.40)/(H*0.26||1))*LIT.y;
          drawLeaf(ctx, px,py, px+Math.cos(dir)*ll, py+Math.sin(dir)*ll*0.6-ll*0.2,
                   lw, shade(S.fol, u*20+(rnd()-0.5)*12),
                   {shape:L.leafShape||'ovate',
                    teeth:L.leafTeeth===undefined?0.12:L.leafTeeth, teethN:L.leafTeethN||7,
                    bow:Math.cos(dir)<0?-0.1:0.1, rib:lw>=4.2});
        } else {
          ctx.fillStyle=shade(S.fol,(rnd()-0.5)*26);
          const py=-H*(0.30+rnd()*0.5);
          ctx.beginPath(); ctx.ellipse(px, py, 4.4,3.2,a,0,7); ctx.fill();
        }
      }
    }
    const headR=L.headR||7;
    const drawHead=(hx,hy,col,scale)=>{
      const r=headR*(scale||1);
      if (panicle){ for (let k=0;k<16;k++){ const f=k/16; // taper to a point
        const wr=r*(1-f)*0.9;
        const fy=hy-r*0.3-f*r*1.7;         // fy takes no rnd(); fx does
        // a panicle is denser and paler toward its base; light it that way
        if (a2){
          const fx=hx+(rnd()-0.5)*2*wr;
          drawFloret(ctx, fx,fy, 2.0, shade(col,(1-f)*10-4+(rnd()-0.5)*12), {squash:0.95});
        } else {                           // classic drew COLOUR before fx
          ctx.fillStyle=shade(col,(rnd()-0.5)*16);
          const fx=hx+(rnd()-0.5)*2*wr;
          ctx.beginPath(); ctx.ellipse(fx, fy, 1.9,1.9,0,0,7); ctx.fill(); } } }
      else if (lacecap){ // flat disc: tiny fertile center ringed by showy florets
        const cy=hy-r*0.4;
        ctx.fillStyle=shade(col,-46);
        for (let k=0;k<12;k++){ const a=rnd()*Math.PI*2, rr=Math.sqrt(rnd())*r*0.6;
          ctx.beginPath(); ctx.ellipse(hx+Math.cos(a)*rr, cy+Math.sin(a)*rr*0.42, 1.1,1.1,0,0,7); ctx.fill(); }
        const ring=Math.round(7+r*0.5);
        for (let k=0;k<ring;k++){ const a=k/ring*Math.PI*2;
          // the showy ring florets are four flat sepals catching the light
          if (a2) drawFloret(ctx, hx+Math.cos(a)*r, cy+Math.sin(a)*r*0.45, 2.5,
                    shade(col, (Math.cos(a)*LIT.x+Math.sin(a)*0.45*LIT.y)*13+(rnd()-0.5)*10),
                    {squash:0.9, rot:a});
          else { ctx.fillStyle=shade(col,(rnd()-0.5)*14);
            ctx.beginPath(); ctx.ellipse(hx+Math.cos(a)*r, cy+Math.sin(a)*r*0.45, 2.4,2.2,a,0,7); ctx.fill(); } } }
      else { for (let k=0;k<20;k++){ const a=rnd()*Math.PI*2, rr=Math.sqrt(rnd())*r;
        const fx=hx+Math.cos(a)*rr, fy=hy-r*0.55+Math.sin(a)*rr*0.82;
        // A mophead is a SPHERE of florets. Shading each by where it sits on
        // that sphere is what turns a flat disc of dots into a ball — the
        // single biggest read in the hydrangea set, at the same fill count
        // plus drawFloret's highlight.
        if (a2) drawFloret(ctx, fx,fy, 2.1,
                  shade(col, ((Math.cos(a)*rr/r)*LIT.x+(Math.sin(a)*rr*0.82/r)*LIT.y)*20+(rnd()-0.5)*9),
                  {squash:0.96});
        else { ctx.fillStyle=shade(col,(rnd()-0.5)*16);
          ctx.beginPath(); ctx.ellipse(fx, fy, 2,2,0,0,7); ctx.fill(); } } }
    };
    if (blooming && mature && S.bloom){
      const heads=Math.max(1,Math.ceil(tips.length*blv));
      for (let t=0;t<heads;t++) drawHead(tips[t][0],tips[t][1],S.bloom,1);
    } else if (S.seed && mature){ // dried heads hold through winter
      tips.forEach(([hx,hy])=>drawHead(hx,hy,S.seed,0.8));
    }
  }
  // winter snow caps on mature structure (woody: spread across the drawn crown)
  if (AMBIENCE[season].snow && mature){
    ctx.fillStyle='rgba(240,244,250,0.85)';
    const capS=P.cw?Math.max(1,(woodyVisualCw(P)||60)/60):1;
    const rs=mulberry(seed+9), caps=isTreeDef(P)?7:4;
    if (snowAnchors && snowAnchors.length){
      // Open pines, cedars and weepers have real gaps. Pin snow to foliage
      // tops instead of scattering it through their empty crown rectangle.
      for (let i=0;i<Math.min(caps,snowAnchors.length);i++){
        const a=snowAnchors[(i*3+(rs()*snowAnchors.length|0))%snowAnchors.length], r=Math.max(2.2,a[2]||3.5*capS);
        ctx.beginPath(); ctx.ellipse(a[0],a[1]-r*0.12,r,r*0.42,0,0,7); ctx.fill();
      }
    } else if (P.form!=='conifer' || S.fol){
      const capW=P.cw?Math.max(18,(woodyVisualCw(P)||18)*0.5):18;
      for(let i=0;i<caps;i++){ ctx.beginPath();
        ctx.ellipse((rs()-0.5)*capW,-H*(0.5+rs()*0.45),3.5*capS,1.6*capS,0,0,7); ctx.fill(); }
    }
  }
  if (!AMBIENCE[season].snow && S.fol && growth>0.28){
    const hl=mulberry(seed+0x51f15e), col=mixHex(S.fol,'#fff1c4',0.42);
    ctx.save(); ctx.globalAlpha=isTreeDef(P)?0.16:0.13;
    ctx.strokeStyle=col; ctx.lineWidth=isTreeDef(P)?1.2:0.9; ctx.lineCap='round';
    const n=isTreeDef(P)?5:3;
    for (let i=0;i<n;i++){
      const px=(hl()-0.55)*(P.cw?(woodyVisualCw(P)||P.cw)*0.32:18), py=-H*(0.25+hl()*0.58);
      ctx.beginPath();
      ctx.moveTo(px-3,py+1);
      ctx.quadraticCurveTo(px,py-2,px+4,py-3-hl()*3);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

// colorParts/shade run per blade/petal (thousands of calls per frame) but with
// a small, bounded set of inputs (the PLANTS season colors), so memoize both.
// Returned arrays are treated read-only by callers; shade quantizes the jitter
// to whole steps for the cache key — imperceptible vs the old fractional value.
const _partsCache=new Map();
function colorParts(col){
  if (!col) col='#6b6248'; // seasons without that color: dead-stem brown
  const hit=_partsCache.get(col); if (hit) return hit;
  let out;
  if (col[0]==='#'){
    const n=parseInt(col.slice(1),16);
    if (Number.isFinite(n)) out=[(n>>16)&255,(n>>8)&255,n&255];
  }
  if (!out){
    const m=String(col).match(/rgba?\(([^)]+)\)/i);
    if (m){
      const parts=m[1].split(',').slice(0,3).map(v=>parseFloat(v));
      if (parts.every(Number.isFinite)) out=parts;
    }
  }
  if (!out) out=[107,98,72];
  _partsCache.set(col,out); return out;
}
const _shadeCache=new Map();
function shade(col, amt){
  const a=amt|0, key=col+'|'+a;
  const hit=_shadeCache.get(key); if (hit!==undefined) return hit;
  const [r0,g0,b0]=colorParts(col);
  const cl=v=>v<0?0:v>255?255:v;
  const out=`rgb(${cl(r0+a)},${cl(g0+a)},${cl(b0+a)})`;
  _shadeCache.set(key,out); return out;
}

/* ---------- garden pets: round-bodied cats & dogs ----------
   Recovered from the retired avatar renderer, with the animation resolved to
   its resting pose. The old one took (t, walking) and breathed; a decoration
   that breathed would have to be added to hasTransientGardenWork, which keeps
   the whole garden repainting forever for a 0.7px bob. So the sine terms are
   folded to their t=0 values and this draws one deterministic sprite. */
function drawPet(ctx, x, y, p, scale){
  const s=scale||1, C=petCoat(p&&p.coat), coat=C.c, dark=C.d;
  const species=petSpecies(p&&p.species).id, mark=petMark(p&&p.mark).id;
  const sock=petPaw(p&&p.paws).c;
  ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
  // shadow
  ctx.fillStyle='rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(0,3,13,5,0,0,7); ctx.fill();
  // tail — a cat's stands up, a dog's curls
  ctx.strokeStyle=dark; ctx.lineWidth=4; ctx.lineCap='round';
  ctx.beginPath();
  if (species==='cat'){ ctx.moveTo(8,-6); ctx.quadraticCurveTo(17,-10,15,-22); }
  else { ctx.moveTo(9,-7); ctx.quadraticCurveTo(16,-12,13,-16); }
  ctx.stroke();
  // legs, drawn before the body so only the feet show below it. A sock is the
  // whole visible portion rather than a band: below the body there are barely
  // two units of leg, and a band inside that reads as noise, not as socks.
  ctx.fillStyle=dark;
  ctx.fillRect(-7,-2,3.4,5); ctx.fillRect(3.6,-2,3.4,5);
  if (sock){ ctx.fillStyle=sock;
    ctx.fillRect(-7,0.4,3.4,2.6); ctx.fillRect(3.6,0.4,3.4,2.6); }
  // body
  ctx.fillStyle=coat; ctx.strokeStyle=dark; ctx.lineWidth=0.9;
  ctx.beginPath(); ctx.ellipse(0,-9,11,10,0,0,7); ctx.fill(); ctx.stroke();
  if (mark==='tuxedo'){ ctx.fillStyle='#f3ecdd';
    ctx.beginPath(); ctx.ellipse(0,-7,5.5,7,0,0,7); ctx.fill(); }
  // head — outlined for the same reason as the body: a pale coat needs an edge
  ctx.fillStyle=coat;
  ctx.beginPath(); ctx.arc(0,-22,8.6,0,7); ctx.fill(); ctx.stroke();
  if (mark==='patch'){ ctx.fillStyle=dark;
    ctx.beginPath(); ctx.ellipse(-3.6,-23.4,4.3,3.9,-0.25,0,7); ctx.fill(); }
  // ears
  ctx.fillStyle=coat;
  if (species==='cat'){
    ctx.beginPath(); ctx.moveTo(-7,-26); ctx.lineTo(-5,-34); ctx.lineTo(-1.5,-28); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(7,-26); ctx.lineTo(5,-34); ctx.lineTo(1.5,-28); ctx.closePath(); ctx.fill();
    ctx.fillStyle=dark;
    ctx.beginPath(); ctx.moveTo(-6,-27.5); ctx.lineTo(-5,-31.5); ctx.lineTo(-3,-28.5); ctx.closePath(); ctx.fill();
  } else { // floppy dog ears
    ctx.fillStyle=dark;
    ctx.beginPath(); ctx.ellipse(-8,-22,3.2,6,0.4,0,7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(8,-22,3.2,6,-0.4,0,7); ctx.fill();
  }
  // face. The catchlight is load-bearing, not decoration: without it a dark
  // eye on an eye patch (or on the Ink coat) vanishes, and the patch reads as
  // a monocle instead of a marking.
  ctx.fillStyle='#19120f';
  ctx.beginPath(); ctx.arc(-3,-23,1.35,0,7); ctx.fill();
  ctx.beginPath(); ctx.arc(3,-23,1.35,0,7); ctx.fill();
  ctx.fillStyle='rgba(255,252,245,0.92)';
  ctx.beginPath(); ctx.arc(-3.5,-23.5,0.5,0,7); ctx.fill();
  ctx.beginPath(); ctx.arc(2.5,-23.5,0.5,0,7); ctx.fill();
  ctx.fillStyle='#19120f';
  if (species==='dog'){ ctx.beginPath(); ctx.ellipse(0,-19.5,2.2,1.7,0,0,7); ctx.fill(); }
  else { ctx.beginPath(); ctx.moveTo(-1.4,-20); ctx.lineTo(1.4,-20); ctx.lineTo(0,-18.6); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}

/* ---------- building footprints ----------
   The planning mass is translucent and depth-sliced by tile: its footprint
   stays unmistakable without hiding planting context in front of or behind a
   large building. The strong perimeter carries the shape, not an opaque roof. */
function drawBuildingTile(ctx,W,H,b,x,y){
  if (!b) return;
  const set=buildingTileSet(b);
  const proposed=b.status==='proposed', roof=b.roof||'#9a5f3a', wall=b.wall||'#8a7a60';
  const lift=10, baseAlpha=ctx.globalAlpha;
  ctx.save();
  ctx.lineJoin='round'; ctx.lineWidth=1.15;
  const [sx,sy0]=screenOf(x,y,W,H), sy=sy0-lift;
  const top=[[sx,sy],[sx+TILE_W/2,sy+TILE_H/2],[sx,sy+TILE_H],[sx-TILE_W/2,sy+TILE_H/2]];
  ctx.globalAlpha=baseAlpha*(proposed?0.42:0.56);
  if (!set.has((x+1)+','+y)){
    ctx.fillStyle=shade(wall,-12); ctx.beginPath(); ctx.moveTo(...top[1]); ctx.lineTo(...top[2]);
    ctx.lineTo(top[2][0],top[2][1]+lift); ctx.lineTo(top[1][0],top[1][1]+lift); ctx.closePath(); ctx.fill();
  }
  if (!set.has(x+','+(y+1))){
    ctx.fillStyle=shade(wall,-24); ctx.beginPath(); ctx.moveTo(...top[2]); ctx.lineTo(...top[3]);
    ctx.lineTo(top[3][0],top[3][1]+lift); ctx.lineTo(top[2][0],top[2][1]+lift); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha=baseAlpha*(proposed?0.28:0.40);
  ctx.fillStyle=roof; ctx.beginPath(); ctx.moveTo(...top[0]); top.slice(1).forEach(p=>ctx.lineTo(...p)); ctx.closePath(); ctx.fill();
  ctx.globalAlpha=baseAlpha*(proposed?0.68:0.32);
  ctx.strokeStyle=proposed?'rgba(248,208,130,.94)':'rgba(46,33,26,.68)';
  if (proposed) ctx.setLineDash([4,3]);
  ctx.stroke();
  ctx.restore();
}
function drawBuildingOutline(ctx,W,H,b){
  if (!b || !Array.isArray(b.vertices) || b.vertices.length<3) return;
  const proposed=b.status==='proposed', lift=10;
  const pts=b.vertices.map(p=>buildingCornerScreenPoint(p,W,H,lift));
  ctx.save(); ctx.lineJoin='round'; ctx.lineCap='round'; ctx.lineWidth=2.2;
  ctx.strokeStyle=proposed?'rgba(246,190,103,.98)':'rgba(60,42,31,.84)';
  if (proposed) ctx.setLineDash([7,4]);
  ctx.beginPath(); ctx.moveTo(...pts[0]); pts.slice(1).forEach(p=>ctx.lineTo(...p)); ctx.closePath(); ctx.stroke();
  ctx.setLineDash([]);
  const bounds=buildingBounds(b);
  if (bounds){
    const [lx,ly]=screenOf((bounds.x0+bounds.x1)/2,(bounds.y0+bounds.y1)/2,W,H);
    ctx.fillStyle='rgba(35,24,18,.78)'; ctx.font='700 9px IBM Plex Sans, sans-serif'; ctx.textAlign='center';
    ctx.fillText(proposed?'PROPOSED':(b.label||'EXISTING').toUpperCase(),lx,ly+TILE_H/2-lift+3);
  }
  ctx.restore();
}
function drawBuilding(ctx,W,H,season,b){
  if (!b) return;
  buildingTiles(b).slice().sort((a,c)=>viewDepth(a[0],a[1])-viewDepth(c[0],c[1]))
    .forEach(p=>drawBuildingTile(ctx,W,H,b,p[0],p[1]));
  drawBuildingOutline(ctx,W,H,b);
}
function buildingEdgeFeetLabel(a,b){
  const feet=Math.hypot(b[0]-a[0],b[1]-a[1])*TILE_IN/12;
  return `${Number.isInteger(feet)?feet:feet.toFixed(1)} ft`;
}
function buildingCornerScreenPoint(p,W,H,lift){
  const q=screenOfFlat(p[0],p[1],W,H);
  return [q[0],q[1]-(lift||0)];
}
function drawBuildingDraftOverlay(ctx,W,H){
  const d=game.tool==='building' && game.buildingDraft;
  if (!d || !d.vertices || !d.vertices.length) return;
  // Draft corners sit on the ground lattice exactly where the pointer snaps.
  // The former half-tile subtraction shifted every point visibly upward.
  const pts=d.vertices.map(p=>buildingCornerScreenPoint(p,W,H,0));
  const hover=(typeof buildingHover!=='undefined' && buildingHover)
    ? buildingCornerScreenPoint(buildingHover,W,H,0) : null;
  ctx.save(); ctx.lineJoin='round'; ctx.lineCap='round';
  ctx.strokeStyle='rgba(246,203,124,.96)'; ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.moveTo(...pts[0]); pts.slice(1).forEach(p=>ctx.lineTo(...p));
  if (hover){ ctx.setLineDash([5,4]); ctx.lineTo(...hover); }
  ctx.stroke(); ctx.setLineDash([]);
  pts.forEach((p,i)=>{ ctx.fillStyle=i===0?'#f2c07c':'#efe6d3'; ctx.beginPath(); ctx.arc(p[0],p[1],i===0?4:3.3,0,7); ctx.fill();
    ctx.strokeStyle='rgba(45,28,18,.8)'; ctx.lineWidth=1; ctx.stroke(); });
  if (hover){
    ctx.fillStyle='rgba(242,192,124,.9)'; ctx.beginPath(); ctx.arc(hover[0],hover[1],3,0,7); ctx.fill();
    const last=pts[pts.length-1], lastWorld=d.vertices[d.vertices.length-1];
    const dx=hover[0]-last[0], dy=hover[1]-last[1], len=Math.hypot(dx,dy);
    if (len>1 && buildingHover && !samePoint(lastWorld,buildingHover)){
      let nx=-dy/len, ny=dx/len;
      if (ny>0){ nx=-nx; ny=-ny; }
      drawSelMetricLabel(ctx,(last[0]+hover[0])/2+nx*15,(last[1]+hover[1])/2+ny*15,
        buildingEdgeFeetLabel(lastWorld,buildingHover));
    }
  }
  ctx.restore();
}

/* ---------- the house renderer ----------
   Works in VIEW space so rotation just works: the footprint is mapped
   to a view-space rect, walls/roof/door are built on its lattice. Size
   and colors come from the passed house object. The door clings to its
   world tile — from behind the house it's simply out of sight. */
function drawHouse(ctx, W, H, season, hOv){
  const hh=hOv; if (!hh) return;
  const [va,vb]=worldToView(hh.x,hh.y), [vc,vd]=worldToView(hh.x+hh.w-1,hh.y+hh.h-1);
  const vx0=Math.min(va,vc), vy0=Math.min(vb,vd);
  const vw=Math.abs(va-vc)+1, vh=Math.abs(vb-vd)+1;
  const wH=Math.min(110, 28+Math.min(vw,vh)*9), rH=wH*0.55, dH=Math.min(wH-8,30);
  const P=(vx,vy)=>viewScreen(vx,vy,W,H);
  const T=P(vx0,vy0), R=P(vx0+vw,vy0), B=P(vx0+vw,vy0+vh), L=P(vx0,vy0+vh);
  const up=(p,h2)=>[p[0],p[1]-h2];
  const wall=hh.wall||'#8a7a60', roof=hh.roof||'#9a5f3a';
  const wallD=shade(wall,-24), roofD=shade(roof,-26);
  const quad=(a,b,c,d,col)=>{ ctx.fillStyle=col; ctx.beginPath();
    ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.lineTo(c[0],c[1]); ctx.lineTo(d[0],d[1]);
    ctx.closePath(); ctx.fill(); };
  const tri=(a,b,c,col)=>{ ctx.fillStyle=col; ctx.beginPath();
    ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.lineTo(c[0],c[1]);
    ctx.closePath(); ctx.fill(); };
  const cx0=(T[0]+R[0]+B[0]+L[0])/4, cy0=(T[1]+R[1]+B[1]+L[1])/4;
  drawSoftShadow(ctx,cx0,cy0+TILE_H*0.45,Math.max(TILE_W*vw*0.34,54),Math.max(TILE_H*vh*0.34,18),0.24);
  // ridge runs along the footprint's longer view axis
  let g1,g2,backRoof,frontRoof,gable;
  if (vw>=vh){
    g1=up(P(vx0,vy0+vh/2),wH+rH); g2=up(P(vx0+vw,vy0+vh/2),wH+rH);
    backRoof=[up(T,wH),up(R,wH),g2,g1]; frontRoof=[up(L,wH),up(B,wH),g2,g1];
    gable=[up(B,wH),up(R,wH),g2];
  } else {
    g1=up(P(vx0+vw/2,vy0),wH+rH); g2=up(P(vx0+vw/2,vy0+vh),wH+rH);
    backRoof=[up(T,wH),up(L,wH),g2,g1]; frontRoof=[up(R,wH),up(B,wH),g2,g1];
    gable=[up(L,wH),up(B,wH),g2];
  }
  quad(backRoof[0],backRoof[1],backRoof[2],backRoof[3],roofD);
  quad(L,B,up(B,wH),up(L,wH),wall);    // view-southwest wall
  quad(B,R,up(R,wH),up(B,wH),wallD);   // view-southeast wall
  tri(gable[0],gable[1],gable[2],wallD);
  quad(frontRoof[0],frontRoof[1],frontRoof[2],frontRoof[3],roof);
  ctx.strokeStyle='rgba(255,246,218,0.25)'; ctx.lineWidth=1.2; ctx.beginPath();
  ctx.moveTo(g1[0],g1[1]); ctx.lineTo(g2[0],g2[1]); ctx.stroke();
  ctx.strokeStyle='rgba(0,0,0,0.16)'; ctx.lineWidth=1;
  [frontRoof,backRoof].forEach(rf=>{
    ctx.beginPath(); ctx.moveTo(rf[0][0],rf[0][1]); ctx.lineTo(rf[1][0],rf[1][1]); ctx.stroke();
  });
  // door over its world tile, when that wall faces the camera
  const [dX,dY]=doorPos(hh); const [dvx,dvy]=worldToView(dX,dY);
  let doorWall=null; // 'sw' | 'se'
  if (Math.round(dvy)===vy0+vh && dvx>=vx0 && dvx<vx0+vw) doorWall='sw';
  else if (Math.round(dvx)===vx0+vw && dvy>=vy0 && dvy<vy0+vh) doorWall='se';
  if (doorWall){
    const d1=doorWall==='sw'?P(dvx+0.22,vy0+vh):P(vx0+vw,dvy+0.22);
    const d2=doorWall==='sw'?P(dvx+0.78,vy0+vh):P(vx0+vw,dvy+0.78);
    quad(d1,d2,up(d2,dH),up(d1,dH),HOUSE_TRIM.door);
    ctx.strokeStyle=HOUSE_TRIM.trim; ctx.lineWidth=1.2; ctx.beginPath();
    ctx.moveTo(d1[0],d1[1]); ctx.lineTo(d1[0],d1[1]-dH); ctx.lineTo(d2[0],d2[1]-dH);
    ctx.lineTo(d2[0],d2[1]); ctx.stroke();
  }
  // warm windows on the wall without the door
  const winWall=doorWall==='se'?'sw':'se';
  const len=winWall==='se'?vh:vw, n=Math.max(1,Math.min(4,Math.round(len/3)));
  for (let i=0;i<n;i++){
    const t=(i+0.5)/n;
    const w1=winWall==='se'?P(vx0+vw,vy0+vh*t-0.2):P(vx0+vw*t-0.2,vy0+vh);
    const w2=winWall==='se'?P(vx0+vw,vy0+vh*t+0.2):P(vx0+vw*t+0.2,vy0+vh);
    quad(up(w1,wH*0.34),up(w2,wH*0.34),up(w2,wH*0.62),up(w1,wH*0.62),HOUSE_TRIM.glow);
    ctx.strokeStyle='rgba(58,44,34,0.32)'; ctx.lineWidth=0.8;
    ctx.beginPath(); ctx.moveTo(w1[0],w1[1]-wH*0.34); ctx.lineTo(w2[0],w2[1]-wH*0.34); ctx.stroke();
  }
  // snow blankets the roof in winter
  if (AMBIENCE[season].snow){
    quad(frontRoof[0],frontRoof[1],frontRoof[2],frontRoof[3],'rgba(240,244,250,0.75)');
    quad(backRoof[0],backRoof[1],backRoof[2],backRoof[3],'rgba(240,244,250,0.45)');
  }
}
function fenceAnchor(x,y,W,H){
  const [sx,sy]=screenOf(x,y,W,H);
  return [sx,sy+TILE_H/2];
}
function drawFence(ctx,W,H,season,f,x,y){
  const st=fenceStyle(f.style), tall=f.height>=6, h=tall?36:26;
  const [ax,ay]=fenceAnchor(x,y,W,H);
  const drawPost=(px,py,w=3.8)=>{
    ctx.strokeStyle='rgba(0,0,0,0.22)'; ctx.lineWidth=w+1.6;
    ctx.beginPath(); ctx.moveTo(px,py+1); ctx.lineTo(px,py-h-2); ctx.stroke();
    ctx.strokeStyle=st.post; ctx.lineWidth=w;
    ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(px,py-h); ctx.stroke();
  };
  const drawRail=(x1,y1,x2,y2,off,width,col)=>{
    ctx.strokeStyle=col; ctx.lineWidth=width; ctx.beginPath();
    ctx.moveTo(x1,y1-off); ctx.lineTo(x2,y2-off); ctx.stroke();
  };
  const drawPickets=(x1,y1,x2,y2)=>{
    const steps=4;
    ctx.strokeStyle=st.fill; ctx.lineWidth=f.style==='chainlink'?0.8:1.5;
    for (let i=1;i<steps;i++){
      const t=i/steps, px=x1+(x2-x1)*t, py=y1+(y2-y1)*t;
      if (f.style==='chainlink'){
        ctx.beginPath(); ctx.moveTo(px-4,py-h*.18); ctx.lineTo(px+4,py-h*.76); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px+4,py-h*.18); ctx.lineTo(px-4,py-h*.76); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(px,py-h*.12); ctx.lineTo(px,py-h*.82); ctx.stroke();
      }
    }
  };
  const drawSegment=(dx,dy,force)=>{
    if (!force && !fenceNeighbor(x+dx,y+dy)) return false;
    const [ex,ey]=fenceAnchor(x+dx*0.48,y+dy*0.48,W,H);
    if (f.style==='brick'){
      drawRail(ax,ay,ex,ey,h*.24,11,shade(st.rail,-20));
      drawRail(ax,ay,ex,ey,h*.42,11,st.rail);
      drawRail(ax,ay,ex,ey,h*.60,9,shade(st.rail,18));
      ctx.strokeStyle='rgba(76,38,28,0.35)'; ctx.lineWidth=1;
      for (let i=1;i<4;i++){ const t=i/4, px=ax+(ex-ax)*t, py=ay+(ey-ay)*t;
        ctx.beginPath(); ctx.moveTo(px,py-h*.16); ctx.lineTo(px,py-h*.68); ctx.stroke(); }
    } else {
      const lw=f.style==='chainlink'?1.2:(f.style==='black'?2:2.6);
      drawRail(ax,ay,ex,ey,h*.30,lw,st.rail);
      drawRail(ax,ay,ex,ey,h*.68,lw,st.rail);
      drawPickets(ax,ay,ex,ey);
    }
    return true;
  };
  ctx.save(); ctx.lineCap='round'; ctx.lineJoin='round';
  const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  let connected=false;
  dirs.forEach(([dx,dy])=>{ if (drawSegment(dx,dy,false)) connected=true; });
  if (!connected){ drawSegment(1,0,true); drawSegment(-1,0,true); }
  drawPost(ax,ay,f.style==='brick'?7:3.8);
  if (f.gate){
    const gateCol=f.style==='vinyl'?'#6f6458':f.style==='black'?'#efe6d3':shade(st.fill,28);
    const hingeX=ax-13, latchX=ax+13, base=ay, top=ay-h*.72, mid=ay-h*.43;
    ctx.strokeStyle='rgba(0,0,0,0.28)'; ctx.lineWidth=5;
    ctx.beginPath(); ctx.moveTo(hingeX,base-3); ctx.lineTo(hingeX,top);
    ctx.moveTo(latchX,base-3); ctx.lineTo(latchX,top); ctx.stroke();
    ctx.strokeStyle=gateCol; ctx.lineWidth=2.6;
    ctx.beginPath(); ctx.moveTo(hingeX,base-3); ctx.lineTo(hingeX,top);
    ctx.moveTo(latchX,base-3); ctx.lineTo(latchX,top); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hingeX,top); ctx.lineTo(latchX,top);
    ctx.moveTo(hingeX,mid); ctx.lineTo(latchX,mid);
    ctx.moveTo(hingeX,base-h*.16); ctx.lineTo(latchX,base-h*.16);
    ctx.moveTo(hingeX,base-h*.16); ctx.lineTo(latchX,top);
    ctx.moveTo(hingeX,top); ctx.lineTo(latchX,base-h*.16);
    ctx.stroke();
    ctx.strokeStyle='rgba(239,230,211,0.55)'; ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.arc(hingeX+2,base-h*.18,22,-1.15,-0.12); ctx.stroke();
    ctx.fillStyle=f.style==='black'?'#c97f3f':'#efe6d3';
    ctx.beginPath(); ctx.arc(latchX-4,mid,2.5,0,7); ctx.fill();
  }
  if (AMBIENCE[season].snow){
    ctx.strokeStyle='rgba(240,244,250,0.66)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(ax-8,ay-h-1); ctx.lineTo(ax+8,ay-h-1); ctx.stroke();
  }
  ctx.restore();
}
function drawLightFixture(ctx,W,H,season,l,x,y,lit){
  const typ=lightType(l.type), tone=lightTone(l.tone);
  const [sx,sy]=screenOf(x,y,W,H), base=sy+TILE_H/2;
  const h=typ.h, metal='#3f4038', metalHi='#6c6958';
  ctx.save(); ctx.lineCap='round'; ctx.lineJoin='round';
  drawSoftShadow(ctx,sx,base+2,typ.kind==='path'?9:13,4,0.18);
  ctx.strokeStyle='rgba(0,0,0,0.22)'; ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(sx,base); ctx.lineTo(sx,base-h); ctx.stroke();
  ctx.strokeStyle=metal; ctx.lineWidth=2.2;
  ctx.beginPath(); ctx.moveTo(sx,base); ctx.lineTo(sx,base-h); ctx.stroke();
  if (typ.kind==='path'){
    ctx.fillStyle=metal;
    ctx.beginPath(); ctx.moveTo(sx-7,base-h); ctx.lineTo(sx+7,base-h); ctx.lineTo(sx+4,base-h-5); ctx.lineTo(sx-4,base-h-5); ctx.closePath(); ctx.fill();
    ctx.fillStyle=lit?tone.col:'#958f7f';
    ctx.beginPath(); ctx.ellipse(sx,base-h+1,4.5,2.2,0,0,7); ctx.fill();
  } else if (typ.kind==='post'){
    ctx.strokeStyle=metalHi; ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.moveTo(sx-7,base-h+7); ctx.lineTo(sx+7,base-h+7); ctx.stroke();
    ctx.fillStyle=metal;
    ctx.fillRect(sx-8,base-h-2,16,12);
    ctx.fillStyle=lit?tone.col:'#6f6a5e';
    ctx.fillRect(sx-5,base-h+1,10,7);
    ctx.strokeStyle=metal; ctx.lineWidth=1;
    ctx.strokeRect(sx-8,base-h-2,16,12);
    ctx.beginPath(); ctx.moveTo(sx-5,base-h-2); ctx.lineTo(sx,base-h-9); ctx.lineTo(sx+5,base-h-2); ctx.stroke();
  } else {
    ctx.fillStyle=metal;
    ctx.beginPath(); ctx.ellipse(sx,base-h,10,5,0,0,7); ctx.fill();
    ctx.fillStyle=lit?tone.col:'#777066';
    ctx.beginPath(); ctx.ellipse(sx,base-h+2,7,3,0,0,7); ctx.fill();
    ctx.strokeStyle=metalHi; ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.moveTo(sx-10,base-h); ctx.lineTo(sx+10,base-h); ctx.stroke();
  }
  if (AMBIENCE[season].snow){
    ctx.strokeStyle='rgba(240,244,250,0.72)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(sx-7,base-h-4); ctx.lineTo(sx+7,base-h-4); ctx.stroke();
  }
  ctx.restore();
}
function drawLightGlow(ctx,W,H,l,x,y){
  const typ=lightType(l.type), tone=lightTone(l.tone);
  const [sx,sy]=screenOf(x,y,W,H), base=sy+TILE_H/2, head=base-typ.h;
  const r=typ.kind==='path'?42:typ.kind==='post'?74:58;
  ctx.save();
  ctx.globalCompositeOperation='screen';
  let g=ctx.createRadialGradient(sx,head,0,sx,head,r);
  g.addColorStop(0,tone.glow+'0.58)');
  g.addColorStop(0.35,tone.glow+'0.22)');
  g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=g; ctx.fillRect(sx-r,head-r,r*2,r*2);
  g=ctx.createRadialGradient(sx,base,0,sx,base,r*0.72);
  g.addColorStop(0,tone.glow+'0.18)');
  g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=g; ctx.fillRect(sx-r,base-r*0.72,r*2,r*1.45);
  ctx.restore();
  ctx.save();
  ctx.fillStyle=tone.col;
  ctx.beginPath(); ctx.arc(sx,head,typ.kind==='path'?2.5:3.5,0,7); ctx.fill();
  ctx.restore();
}
function polyPath(ctx,pts){
  ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]);
  for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i][0],pts[i][1]);
  ctx.closePath();
}
function polyCenter(pts){
  let x=0,y=0;
  pts.forEach(p=>{ x+=p[0]; y+=p[1]; });
  return [x/pts.length,y/pts.length];
}
function scalePoly(pts,scale){
  const c=polyCenter(pts);
  return pts.map(p=>[c[0]+(p[0]-c[0])*scale,c[1]+(p[1]-c[1])*scale]);
}
function polyBounds(pts){
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  pts.forEach(p=>{ x0=Math.min(x0,p[0]); y0=Math.min(y0,p[1]); x1=Math.max(x1,p[0]); y1=Math.max(y1,p[1]); });
  return {x0,y0,x1,y1,w:x1-x0,h:y1-y0};
}
function footprintScreenPoly(W,H,x,y,sz,scale){
  const pts=[
    screenOf(x,y,W,H),
    screenOf(x+sz.w,y,W,H),
    screenOf(x+sz.w,y+sz.h,W,H),
    screenOf(x,y+sz.h,W,H)
  ];
  return scale===undefined ? pts : scalePoly(pts,scale);
}
function firepitScreenPoly(W,H,x,y,sz,scale){ return footprintScreenPoly(W,H,x,y,sz,scale); }
function irregularBoulderPath(ctx,sx,sy,rx,ry,seed,flatten){
  const r=mulberry(seed>>>0), n=12;
  ctx.beginPath();
  for (let i=0;i<n;i++){
    const a=(Math.PI*2*i/n)-Math.PI/2;
    const wob=0.88+r()*0.2;
    const px=sx+Math.cos(a)*rx*wob;
    const py=sy+Math.sin(a)*ry*wob*(flatten||1);
    if (!i) ctx.moveTo(px,py);
    else ctx.lineTo(px,py);
  }
  ctx.closePath();
}
function drawBoulder(ctx,W,H,season,b,x,y){
  const d=normalizeBoulderDraft(b), sz=boulderTileSize(d), spec=sz.spec;
  const footprint=footprintScreenPoly(W,H,x,y,sz,0.86), center=polyCenter(footprint), bounds=polyBounds(footprint);
  const sx=center[0], base=center[1], seed=(tileSeed(x,y)^0x6d2b79f5^boulderTypeId(d.type).length)>>>0;
  const tone=spec.tone||'#7f8178', side=shade(tone,-22), top=shade(tone,16), hi=shade(tone,36);
  const rx=Math.max(16,bounds.w*(spec.shape==='oblong'?0.56:0.48));
  const ry=Math.max(7,bounds.h*(spec.shape==='oblong'?0.46:0.54));
  ctx.save();
  drawSoftShadow(ctx,sx,base+6,rx*0.98,Math.max(5,ry*0.55),0.24);
  if (spec.shape==='rect'){
    const topPoly=scalePoly(footprint,0.76).map(p=>[p[0],p[1]-7]);
    const front=topPoly.map(p=>[p[0],p[1]+12]);
    ctx.fillStyle=side; polyPath(ctx,[topPoly[3],topPoly[2],front[2],front[3]]); ctx.fill();
    ctx.fillStyle=shade(tone,-10); polyPath(ctx,[topPoly[1],topPoly[2],front[2],front[1]]); ctx.fill();
    ctx.fillStyle=top; polyPath(ctx,topPoly); ctx.fill();
    ctx.strokeStyle='rgba(45,42,36,0.24)'; ctx.lineWidth=1.1; polyPath(ctx,topPoly); ctx.stroke();
    ctx.fillStyle='rgba(239,230,211,0.18)';
    ctx.fillRect(sx-rx*0.42,base-12,rx*0.55,4);
  } else {
    const flat=spec.shape==='oblong'?0.72:1;
    ctx.fillStyle=side;
    irregularBoulderPath(ctx,sx,base+3,rx,ry,seed,flat); ctx.fill();
    ctx.fillStyle=top;
    irregularBoulderPath(ctx,sx,base-4,rx*0.92,ry*0.92,seed+17,flat); ctx.fill();
    ctx.strokeStyle='rgba(48,45,38,0.22)'; ctx.lineWidth=1;
    irregularBoulderPath(ctx,sx,base-4,rx*0.92,ry*0.92,seed+17,flat); ctx.stroke();
    ctx.fillStyle='rgba(239,230,211,0.22)';
    ctx.beginPath(); ctx.ellipse(sx-rx*0.2,base-ry*0.35,rx*0.28,Math.max(2,ry*0.12),-0.12,0,7); ctx.fill();
    ctx.fillStyle=hi;
    ctx.beginPath(); ctx.ellipse(sx+rx*0.18,base-ry*0.12,rx*0.16,Math.max(1.5,ry*0.08),0.18,0,7); ctx.fill();
  }
  if (AMBIENCE[season].snow){
    ctx.strokeStyle='rgba(240,244,250,0.58)'; ctx.lineWidth=2.2;
    ctx.beginPath(); ctx.ellipse(sx,base-ry*0.28,rx*0.62,Math.max(2,ry*0.17),0,Math.PI*1.05,Math.PI*1.9); ctx.stroke();
  }
  ctx.restore();
}
function drawFirepit(ctx,W,H,season,f,x,y){
  const d=normalizeFirepitDraft(f), sz=firepitTileSize(d);
  const footprint=firepitScreenPoly(W,H,x,y,sz,0.82), center=polyCenter(footprint), bounds=polyBounds(footprint);
  const sx=center[0], base=center[1];
  const rx=Math.max(17,bounds.w*0.50), ry=Math.max(9,bounds.h*0.50);
  ctx.save();
  drawSoftShadow(ctx,sx,base+3,rx*0.92,ry*0.58,0.22);
  const outer='#6d6358', rimHi='#968b7d', inner='#2a211c', coal='#4a2418';
  if (d.shape==='round'){
    ctx.fillStyle=outer; ctx.beginPath(); ctx.ellipse(sx,base,rx,ry,0,0,7); ctx.fill();
    ctx.fillStyle=rimHi; ctx.beginPath(); ctx.ellipse(sx,base-2,rx*0.86,ry*0.72,0,0,7); ctx.fill();
    ctx.fillStyle=inner; ctx.beginPath(); ctx.ellipse(sx,base-1,rx*0.58,ry*0.46,0,0,7); ctx.fill();
  } else {
    const rim=scalePoly(footprint,0.78), hole=scalePoly(footprint,0.42);
    ctx.fillStyle=outer; polyPath(ctx,footprint); ctx.fill();
    ctx.fillStyle=rimHi; polyPath(ctx,rim.map(p=>[p[0],p[1]-2])); ctx.fill();
    ctx.fillStyle=inner; polyPath(ctx,hole.map(p=>[p[0],p[1]-1])); ctx.fill();
    ctx.strokeStyle='rgba(35,28,23,0.38)'; ctx.lineWidth=1.2;
    polyPath(ctx,footprint); ctx.stroke();
    ctx.strokeStyle='rgba(236,220,190,0.20)'; ctx.lineWidth=1;
    polyPath(ctx,rim.map(p=>[p[0],p[1]-2])); ctx.stroke();
  }
  ctx.fillStyle=coal;
  ctx.beginPath(); ctx.ellipse(sx,base,rx*0.28,Math.max(3,ry*0.22),0,0,7); ctx.fill();
  ctx.strokeStyle='rgba(238,127,55,0.82)'; ctx.lineWidth=1.5; ctx.lineCap='round';
  [-0.22,0,0.22].forEach((off,i)=>{ ctx.beginPath();
    ctx.moveTo(sx+off*rx,base-1); ctx.quadraticCurveTo(sx+(off+0.04)*rx,base-7-i,sx+(off-0.02)*rx,base-11+i); ctx.stroke(); });
  if (AMBIENCE[season].snow){
    ctx.strokeStyle='rgba(240,244,250,0.68)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(sx,base-3,rx*0.86,ry*0.72,0,Math.PI*1.05,Math.PI*1.92); ctx.stroke();
  }
  ctx.restore();
}
function drawFirepitGlow(ctx,W,H,f,x,y){
  const d=normalizeFirepitDraft(f), sz=firepitTileSize(d);
  const footprint=firepitScreenPoly(W,H,x,y,sz,0.84), center=polyCenter(footprint), b=polyBounds(footprint);
  const sx=center[0], sy=center[1]-5, r=Math.max(62,b.w*0.72,b.h*1.55);
  ctx.save();
  ctx.globalCompositeOperation='screen';
  let g=ctx.createRadialGradient(sx,sy,0,sx,sy,r);
  g.addColorStop(0,'rgba(255,138,56,0.46)');
  g.addColorStop(0.28,'rgba(255,156,74,0.22)');
  g.addColorStop(1,'rgba(255,180,96,0)');
  ctx.fillStyle=g; ctx.fillRect(sx-r,sy-r,r*2,r*2);
  g=ctx.createRadialGradient(sx,center[1]+2,0,sx,center[1]+2,r*0.72);
  g.addColorStop(0,'rgba(255,104,38,0.20)');
  g.addColorStop(1,'rgba(255,160,70,0)');
  ctx.fillStyle=g; ctx.fillRect(sx-r,center[1]-r*0.42,r*2,r*0.95);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation='screen';
  ctx.fillStyle='rgba(255,190,98,0.74)';
  ctx.beginPath(); ctx.ellipse(sx,sy+3,Math.max(5,b.w*0.055),Math.max(2.5,b.h*0.10),0,0,7); ctx.fill();
  ctx.restore();
}

