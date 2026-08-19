'use strict';
/* Regenerates demo-garden.json — the small finished garden a first-time
   gardener is offered on launch.
 *
 *   node dev/make-demo-garden.js
 *
 * It loads the REAL app modules in the test sandbox and calls the app's own
 * buildSaveBlob(), so the file is an ordinary exported garden — byte-compatible
 * with the one the Share button writes. That matters: the demo garden then
 * needs no bundled format and no seeding code, and openDemoGarden() reuses
 * installWorldBlob(), the same validator a friend's shared file goes through.
 *
 * THIS SCRIPT IS NOT THE ONLY WAY TO REPLACE THE DEMO GARDEN, and probably not
 * the best one. Planting by hand in the app and exporting over the top of
 * demo-garden.json produces a better garden than any amount of ellipse
 * arithmetic — see docs/demo-garden.md. This exists so the file can be rebuilt
 * from nothing, and so the first version had a defensible starting point.
 */

const fs = require('fs');
const path = require('path');
const { root, gameSources, runTier } = require('../tests/sandbox');

/* Authoring runs INSIDE the sandbox so it can use the app's own helpers —
   setWorldSize, setTile, mulberry, buildSaveBlob. A 40ft x 40ft square is
   27 tiles at 18in each: big enough for a real planting, small enough that a
   phone shows most of it at once. */
const AUTHOR = `
(function(){
  setWorldSize(27,27);
  for (const L of GAME_LAYERS)
    if (game[L.k] && typeof game[L.k]==='object' && !Array.isArray(game[L.k])) game[L.k]={};
  game.houses=[]; game.buildings=[]; game.underlay=null;
  game.edgeStyle='organic';            // prairie style seeds organic edges
  game.siteNorthDeg=0;
  game.design={zone:5,type:'prairie',nativeRegion:'north-america',nativeMode:'any',deer:false,rabbit:false,squirrel:false};
  game.filters=normalizeFilters(game.design);
  game.worldName='Demo garden';
  /* Open in late summer, not on bare spring ground. DAYS_PER_SEASON is 16, so
     the seasons run Spring 0-15, Summer 16-31, Fall 32-47, Winter 48-63 — day
     28 is late Summer, with the coneflowers and bergamot still going and the
     grasses starting to colour. (120 would be Winter of year 2, which is how
     the first cut of this shipped for about ten minutes.) */
  game.dayOffset=28;

  var R=mulberry(20260815);            // seeded: the same garden every rebuild
  var K=function(x,y){ return x+','+y; };
  var inPlot=function(x,y){ return x>=0&&y>=0&&x<27&&y<27; };

  // A path sweeping in from the south edge and bending twice, so the garden
  // reads as something you walk into rather than a rectangle of planting.
  var pathX=function(y){ return 13+Math.round(3.4*Math.sin((26-y)*0.20)); };
  var onPath=function(x,y){ return y>=2&&y<=26&&Math.abs(x-pathX(y))<=1; };

  // Beds as overlapping lobes either side of it — organic, never rectangles.
  var ell=function(x,y,cx,cy,rx,ry){ return ((x-cx)*(x-cx))/(rx*rx)+((y-cy)*(y-cy))/(ry*ry)<=1; };
  var bedRaw=function(x,y){ return ell(x,y,7,10,6.4,7.4)||ell(x,y,8,18,5.4,5.4)||
    ell(x,y,19.5,9,6,7)||ell(x,y,19.5,18,5.4,6)||ell(x,y,13,4,7,3.2); };
  var inBed=function(x,y){ return bedRaw(x,y)&&!onPath(x,y); };

  for(var y=0;y<27;y++) for(var x=0;x<27;x++){
    if (onPath(x,y)) setTile('terrain',K(x,y),{k:'path',c:'gravel',t:1});
    else if (inBed(x,y)) setTile('terrain',K(x,y),{k:'bed',c:'mulch',t:1});
  }

  // Trees first: they hold a trunk tile the planting has to flow around.
  var trees=[['serviceberry',5,5],['floweringdogwood',21,22],['redbud',22,4]];
  var taken={};
  for(var i=0;i<trees.length;i++){
    setTile('plants',K(trees[i][1],trees[i][2]),{s:trees[i][0],d:0,t:1});
    taken[K(trees[i][1],trees[i][2])]=1;
  }

  /* Feature drifts, then a grass matrix through whatever is left — the
     two-layer interplanting the Matrix brush exists to make, shown rather than
     explained. Drift centres are kept off the path; one that straddles it gets
     clipped to a handful of tiles and reads as a mistake instead of a drift. */
  var drifts=[
    ['echinacea',6,8,2.7],   ['liatris',10,12,2.1],  ['monarda',4,13,2.3],
    ['amsonia',9,19,2.3],    ['newengland',6,21,2.1],['phlox',7,5,2.0],
    ['rattlesnake',18,6,2.2],['baptisia',22,11,2.2], ['goldenrod',18,15,2.4],
    ['sedum',21,19,2.0],     ['culvers',19,21,2.1],  ['stachys',16,11,1.9],
    ['allium',13,3,2.4],     ['yarrow',22,16,2.0],   ['mountainmint',3,17,1.9]
  ];
  for(var di=0;di<drifts.length;di++){
    var s=drifts[di][0], cx=drifts[di][1], cy=drifts[di][2], r=drifts[di][3];
    for(var yy=Math.floor(cy-r);yy<=Math.ceil(cy+r);yy++)
      for(var xx=Math.floor(cx-r);xx<=Math.ceil(cx+r);xx++){
        if(!inPlot(xx,yy)||taken[K(xx,yy)]||!inBed(xx,yy)) continue;
        var d=Math.sqrt((xx-cx)*(xx-cx)+(yy-cy)*(yy-cy));
        if (d<=r-0.5 || (d<=r+0.35 && R()<0.55)){
          setTile('plants',K(xx,yy),{s:s,d:0,t:1}); taken[K(xx,yy)]=1;
        }
      }
  }
  var matrix=['bluestem','dropseed','bluestem','moorhexe'];
  for(var my=0;my<27;my++) for(var mx=0;mx<27;mx++){
    if(!inBed(mx,my)||taken[K(mx,my)]) continue;
    if(R()<0.62){ setTile('plants',K(mx,my),{s:matrix[Math.floor(R()*matrix.length)],d:0,t:1}); taken[K(mx,my)]=1; }
  }

  // A cat on the warm gravel and a boulder anchoring the far bed: both say
  // "there is more in here than plants" without a word of tutorial text.
  setTile('pets','12,20',{species:'cat',coat:'ginger',mark:'tabby',paws:'none',t:1});
  setTile('boulders','24,8',{type:'round',t:1});

  markModelChanged(); markGroundChanged();
  globalThis.__DEMO = { pocketPrairie:1, v:1, exported:0, world:buildSaveBlob() };
})();
`;

const r = runTier('demo-garden', [...gameSources(), AUTHOR], true);
if (!r.ok){ console.error('Failed to author the demo garden:\n' + r.err); process.exit(1); }

const env = r.sandbox.__DEMO;
if (!env || !env.world || !env.world.plants){
  console.error('Authoring produced no garden.'); process.exit(1);
}

/* Every clock reading is pinned so a rebuild that changes no code produces no
   diff — otherwise each regeneration churns three fields and the real change is
   buried. `exported` is zeroed, and buildSaveBlob's own Date.now() stamps are
   overwritten here: the garden's clock runs off `elapsedMs` and `dayOffset`, so
   these two are inert on load, and a demo garden has no meaningful "saved at"
   in any case. The app version is left as written, so the file records which
   build authored it. */
env.exported = 0;
env.world.startTs = 0;
env.world.savedAt = 0;

const out = path.join(root, 'demo-garden.json');
fs.writeFileSync(out, JSON.stringify(env) + '\n');

const counts = {};
for (const k in env.world.plants) counts[env.world.plants[k].s] = (counts[env.world.plants[k].s] || 0) + 1;
const kb = (fs.statSync(out).size / 1024).toFixed(1);
console.log(`demo-garden.json  ${kb} KB`);
console.log(`  plot     ${env.world.gw} x ${env.world.gh} tiles (${Math.round(env.world.gw * 18 / 12)} ft square)`);
console.log(`  plants   ${Object.keys(env.world.plants).length} across ${Object.keys(counts).length} species`);
console.log(`  terrain  ${Object.keys(env.world.terrain || {}).length} tiles`);
console.log(`  extras   ${Object.keys(env.world.pets || {}).length} pet, ${Object.keys(env.world.boulders || {}).length} boulder`);
