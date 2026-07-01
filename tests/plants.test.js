/* Tier 1 — the PLANTS data contract.  Runs concatenated after plants.js, so
   PLANTS and REGIONS are in scope.  Uses injected test()/assert(). */

const TYPES  = ['grass', 'sedge', 'forb', 'bulb', 'water', 'shrub', 'tree'];
const SUNS   = ['full', 'part'];
const MOISTS = ['dry', 'medium', 'moist'];
const PHENS  = ['cool', 'mid', 'warm'];
const SEASON_KEYS = ['Spring', 'Summer', 'Fall', 'Winter'];
const COLOR_KEYS  = ['fol', 'bloom', 'seed', 'eye', 'bract', 'edge'];
const keys = Object.keys(PLANTS);

test('PLANTS is a non-empty object', () => {
  assert(PLANTS && typeof PLANTS === 'object', 'PLANTS missing');
  assert(keys.length > 50, `expected a full palette, got ${keys.length}`);
});

test('every species has the required string fields', () => {
  for (const k of keys){
    const P = PLANTS[k];
    assert(P && typeof P === 'object', `${k}: not an object`);
    assert(typeof P.name === 'string' && P.name.length, `${k}: bad name`);
    assert(typeof P.latin === 'string' && P.latin.length, `${k}: bad latin`);
    assert(typeof P.form === 'string' && P.form.length, `${k}: bad form`);
  }
});

test('type / sun / moist are from the allowed sets', () => {
  for (const k of keys){
    const P = PLANTS[k];
    assert(TYPES.includes(P.type), `${k}: type "${P.type}"`);
    assert(SUNS.includes(P.sun), `${k}: sun "${P.sun}"`);
    assert(MOISTS.includes(P.moist), `${k}: moist "${P.moist}"`);
    if (P.phen !== undefined) assert(PHENS.includes(P.phen), `${k}: phen "${P.phen}"`);
  }
});

test('height / spacing / spread are positive numbers', () => {
  for (const k of keys){
    const P = PLANTS[k];
    for (const f of ['h', 'space', 'spread']){
      assert(typeof P[f] === 'number' && P[f] > 0, `${k}: ${f} = ${P[f]}`);
    }
  }
});

test('zones are a sane USDA range', () => {
  for (const k of keys){
    const z = PLANTS[k].zones;
    assert(Array.isArray(z) && z.length === 2, `${k}: zones not a pair`);
    assert(z[0] >= 1 && z[1] <= 13 && z[0] <= z[1], `${k}: zones [${z}]`);
  }
});

test('native flag + eco array are consistent', () => {
  for (const k of keys){
    const P = PLANTS[k];
    assert(typeof P.native === 'boolean', `${k}: native not boolean`);
    assert(Array.isArray(P.eco), `${k}: eco not an array`);
    if (!P.native) assert(P.eco.length === 0, `${k}: non-native should have empty eco`);
  }
});

test('seasonal appearance (sea) is well-formed', () => {
  for (const k of keys){
    const sea = PLANTS[k].sea;
    assert(sea && typeof sea === 'object', `${k}: no sea`);
    const present = SEASON_KEYS.filter(s => sea[s]);
    assert(present.length >= 1, `${k}: sea has no seasons`);
    for (const s of Object.keys(sea)){
      assert(SEASON_KEYS.includes(s), `${k}: unknown season "${s}"`);
      const v = sea[s];
      assert(v && typeof v === 'object', `${k}: sea.${s} not an object`);
      for (const ck of Object.keys(v)){
        assert(COLOR_KEYS.includes(ck), `${k}: sea.${s} unknown key "${ck}"`);
        assert(typeof v[ck] === 'string' && v[ck][0] === '#', `${k}: sea.${s}.${ck} not a hex color`);
      }
    }
  }
});

test('woody species declare years-to-size (grow)', () => {
  for (const k of keys){
    const P = PLANTS[k];
    if (P.type === 'shrub' || P.type === 'tree')
      assert(typeof P.grow === 'number' && P.grow > 0, `${k}: woody needs grow years`);
  }
});

test('bulb-only fields are valid when present', () => {
  for (const k of keys){
    const P = PLANTS[k];
    if (P.bulbSeason !== undefined)
      assert(['summer', 'fall'].includes(P.bulbSeason), `${k}: bulbSeason "${P.bulbSeason}"`);
    if (P.bloomDay !== undefined)
      assert(typeof P.bloomDay === 'number' && P.bloomDay >= 0, `${k}: bloomDay ${P.bloomDay}`);
    // a bulbSeason only makes sense on an actual bulb
    if (P.bulbSeason !== undefined) assert(P.type === 'bulb', `${k}: bulbSeason on a non-bulb`);
  }
});

test('cultivars (cv) are well-formed', () => {
  for (const k of keys){
    const cv = PLANTS[k].cv;
    if (!cv) continue;
    assert(typeof cv === 'object', `${k}: cv not an object`);
    for (const v of Object.keys(cv)){
      const C = cv[v];
      assert(C && typeof C === 'object', `${k}.${v}: cultivar not an object`);
      assert(typeof C.name === 'string' && C.name.length, `${k}.${v}: cultivar needs a name`);
      if (C.sea){
        for (const s of Object.keys(C.sea)){
          assert(SEASON_KEYS.includes(s), `${k}.${v}: cultivar season "${s}"`);
          for (const ck of Object.keys(C.sea[s])){
            assert(COLOR_KEYS.includes(ck), `${k}.${v}: cultivar sea.${s} key "${ck}"`);
            assert(typeof C.sea[s][ck] === 'string' && C.sea[s][ck][0] === '#', `${k}.${v}: cultivar sea.${s}.${ck} not hex`);
          }
        }
      }
    }
  }
});

test('sunflower species keep distinct visual signatures', () => {
  assertEqual(PLANTS.willowsunflower.look.leafStyle, 'willow', 'willowleaf should read as fine spring foliage');
  assert(PLANTS.willowsunflower.look.leaves >= 30, 'willowleaf needs dense threadlike spring leaves');
  assert(PLANTS.maximiliansunflower.look.heads >= 4, 'maximilian should render as a flower burst');
  assert(PLANTS.maximiliansunflower.look.stems >= 12, 'maximilian should carry many flowering stems');
});

test('ornamental grass forms keep distinct silhouettes and picker entries', () => {
  assertEqual(PLANTS.sesleria.form, 'moorgrass', 'autumn moor grass should not reuse the airy cloudgrass silhouette');
  assert(PLANTS.sesleria.look.seedBeads >= 4, 'autumn moor grass needs short upright seed wands');
  assertEqual(PLANTS.tuftedhair.form, 'cloudgrass', 'tufted hairgrass keeps the airy seed-cloud form');
  assertEqual(PLANTS.hakone.form, 'forestgrass', 'japanese forest grass keeps its cascading forestgrass form');
  assert(PLANTS.hakone.look.leaves >= 20, 'japanese forest grass needs a fuller flowing mound');
  assert(PLANTS.hakone.look.sweep > 0.85, 'japanese forest grass leaves should sweep outward');
  assertEqual(PLANTS.mexicanfeather.latin, 'Nassella tenuissima', 'mexican feather grass uses the current Nassella name');
  assert(PLANTS.mexicanfeather.zones[0] <= 6, 'mexican feather grass should remain visible in a zone 6 garden');
  assert(!PLANTS.mexicanfeather.group, 'mexican feather grass should appear as its own tray button');
});

test('rudbeckia group keeps species distinct and trims redundant cultivars', () => {
  assertEqual(PLANTS.rudbeckia.group, 'rudbeckia', 'black-eyed susan should anchor the rudbeckia group');
  assertEqual(PLANTS.rudbeckiatriloba.group, 'rudbeckia', 'brown-eyed susan should share the rudbeckia picker');
  assertEqual(PLANTS.rudbeckiamaxima.group, 'rudbeckia', 'great coneflower should share the rudbeckia picker');
  assert(PLANTS.rudbeckiatriloba.look.heads >= 3, 'brown-eyed susan needs many small flower heads');
  assert(PLANTS.rudbeckiamaxima.look.seedH >= 9, 'great coneflower needs long winter seedheads');
  assert(PLANTS.rudbeckia.cv.americangoldrush.look.heads >= 2, 'american gold rush stays as a dense flowered cultivar');
  assert(!PLANTS.rudbeckia.cv.goldsturm, 'goldsturm is intentionally omitted as redundant');
  assert(!PLANTS.rudbeckia.cv.littlegoldstar, 'little goldstar is intentionally omitted as redundant');
});

test('shrub-form forbs use distinct foliage habits', () => {
  assertEqual(PLANTS.amsonia.look.habit, 'threadleaf', 'hubrichtii amsonia should have fine foliage');
  assertEqual(PLANTS.amsonia.cv.butterscotch.sea.Fall.fol, '#d99a3a', 'butterscotch keeps its warm fall color on the threadleaf form');
  assertEqual(PLANTS.ozarkamsonia.look.habit, 'broadamsonia', 'ozark amsonia should read as broader-leaved');
  assertEqual(PLANTS.baptisia.look.habit, 'baptisia', 'baptisia should use upright pea-shrub foliage');
  assertEqual(PLANTS.aster.look.habit, 'asterdome', 'aromatic aster should be a low dome');
  assertEqual(PLANTS.newengland.look.habit, 'asterupright', 'new england aster should be taller and upright');
  assertEqual(PLANTS.smoothaster.look.habit, 'asterclean', 'smooth blue aster should keep its clean blue-gray habit');
});

test('liatris species have distinct spike habits', () => {
  assertEqual(PLANTS.liatris.group, 'liatris', 'dotted blazing star should anchor the liatris group');
  assertEqual(PLANTS.liatrispycnostachya.group, 'liatris', 'prairie blazing star should share the liatris picker');
  assert(PLANTS.liatrispycnostachya.h > PLANTS.liatrisspicata.h, 'prairie blazing star should be the tallest');
  assert(PLANTS.liatrispycnostachya.look.wildLean > PLANTS.liatrisspicata.look.wildLean, 'prairie blazing star should be wilder');
  assert(PLANTS.liatriscylindracea.h < PLANTS.liatris.h, 'cylindrical blazing star should stay compact');
  assert(PLANTS.liatrisspicata.look.florets > PLANTS.liatris.look.florets, 'dense blazing star should have the packed spike');
  assertEqual(PLANTS.liatrisspicata.cv.alba.sea.Summer.bloom, '#f0ede8', 'dense blazing star keeps an alba cultivar');
});

test('grouped species share one groupLabel per group', () => {
  const label = {};
  for (const k of keys){
    const P = PLANTS[k];
    if (!P.group) continue;
    assert(typeof P.group === 'string', `${k}: group not a string`);
    const gl = P.groupLabel || P.group;
    if (label[P.group] === undefined) label[P.group] = gl;
    else assert(label[P.group] === gl, `group "${P.group}" has clashing labels: "${label[P.group]}" vs "${gl}"`);
  }
});

test('REGIONS is a valid picker list', () => {
  assert(Array.isArray(REGIONS) && REGIONS.length > 0, 'REGIONS missing');
  for (const R of REGIONS){
    assert(typeof R.name === 'string' && R.name.length, `region bad name: ${JSON.stringify(R)}`);
    assert(typeof R.zone === 'number' && R.zone >= 1 && R.zone <= 13, `region ${R.name}: zone ${R.zone}`);
    assert(typeof R.blurb === 'string', `region ${R.name}: blurb`);
  }
});
