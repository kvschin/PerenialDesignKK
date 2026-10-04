#!/usr/bin/env node
'use strict';
/* Solve a woody cultivar's px-art h and cw from its REAL height and spread.

     node dev/cultivar-size.cjs <speciesKey> <heightIn> <spreadIn> [<heightIn> <spreadIn> ...]
     node dev/cultivar-size.cjs redbud 144 144 72 96

   A cultivar's drawing must sit on its species' drawn-size curve, or a narrow
   selection carrying its species' px-art draws TALLER than the species (that is
   what 'Slender Silhouette' did). Across the catalog's broadleaf trees, drawn
   width grows as real spread^0.76 and drawn height as real height^0.70, so a
   tree cultivar is anchored on its own species with those exponents. A shrub
   draws close to true scale, so it scales linearly. The test "a sized tree
   cultivar draws at its species' scale for its real size" holds the result.

   Uses the app's own woodyVisualCw / plantVisualH through the test sandbox,
   so it cannot disagree with what the renderer draws. Writes nothing. */
const path = require('path');
const sb = require(path.join(__dirname, '..', 'tests', 'sandbox.js'));

const [key, ...nums] = process.argv.slice(2);
if (!key || nums.length < 2 || nums.length % 2){
  console.log('usage: node dev/cultivar-size.cjs <speciesKey> <heightIn> <spreadIn> [...]');
  process.exit(1);
}
const pairs = [];
for (let i = 0; i < nums.length; i += 2) pairs.push([+nums[i], +nums[i + 1]]);

const probe = `
(function(){
  const B=PLANTS[${JSON.stringify(key)}];
  if (!B || !isWoodyDef(B)) return __report({error:'not a tree or shrub: '+${JSON.stringify(key)}});
  const tree=isTreeDef(B), W0=woodyVisualCw(B), H0=plantVisualH(B), out=[];
  for (const [hIn,spread] of ${JSON.stringify(pairs)}){
    let cw, h;
    if (tree){
      const W=W0*Math.pow(spread/B.spread,0.7635), H=H0*Math.pow(hIn/B.heightIn,0.698);
      // invert woodyVisualCw's log blend for cw, then take h from the drawn aspect
      const R=(spread/TILE_IN)*TILE_W;
      cw=Math.max(20,Math.round(W>=R?W:Math.exp((Math.log(W)-0.42*Math.log(R))/0.58)));
      const D=Object.assign({},B,{cw,spread,heightIn:hIn});
      h=Math.max(16,Math.round(H*cw/woodyVisualCw(D)));
    } else {
      cw=Math.max(12,Math.round(B.cw*spread/B.spread));
      const D=Object.assign({},B,{cw,spread,heightIn:hIn});
      h=Math.max(10,Math.round(H0*(hIn/B.heightIn)*cw/woodyVisualCw(D)));
    }
    const D=Object.assign({},B,{h,cw,spread,heightIn:hIn});
    out.push({hIn,spread,h,cw,W:Math.round(woodyVisualCw(D)),H:Math.round(plantVisualH(D))});
  }
  __report({tree,base:{h:B.h,cw:B.cw,heightIn:B.heightIn,spread:B.spread,W:Math.round(W0),H:Math.round(H0)},out});
})();`;

let result;
const r = sb.runTier('cultivar-size', [...sb.gameSources(), probe], true, { __report: o => { result = o; } });
if (!r.ok){ console.error(r.err); process.exit(1); }
if (result.error){ console.error(result.error); process.exit(1); }
const ft = n => (n / 12).toFixed(n % 12 ? 1 : 0);
const b = result.base;
console.log(`${key} (${result.tree ? 'tree' : 'shrub'}): ${ft(b.heightIn)} x ${ft(b.spread)} ft, h:${b.h} cw:${b.cw}, drawn ${b.W} x ${b.H}`);
for (const o of result.out)
  console.log(`  ${ft(o.hIn)} x ${ft(o.spread)} ft  ->  h:${o.h}, cw:${o.cw}, heightIn:${o.hIn}, spread:${o.spread}   (drawn ${o.W} x ${o.H})`);
