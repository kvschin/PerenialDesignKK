/* Tier 1 — the PLANTS data contract.  Runs concatenated after plants.js, so
   PLANTS is in scope.  Uses injected test()/assert(). */

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

test('native flag is a boolean', () => {
  for (const k of keys){
    const P = PLANTS[k];
    assert(typeof P.native === 'boolean', `${k}: native not boolean`);
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

test('trees declare a real mature height (heightIn)', () => {
  for (const k of keys){
    const P = PLANTS[k];
    if (P.type !== 'tree') continue;
    assert(typeof P.heightIn === 'number', `${k}: trees need heightIn (real inches)`);
    assert(P.heightIn >= 96 && P.heightIn <= 1440, `${k}: heightIn ${P.heightIn} outside 8-120 ft`);
    assert(P.heightIn > P.h, `${k}: heightIn should exceed the px-art h (that is the whole point)`);
    for (const cvk in (P.cv || {})){
      const c = P.cv[cvk];
      if (c.heightIn !== undefined)
        assert(typeof c.heightIn === 'number' && c.heightIn >= 48 && c.heightIn <= P.heightIn,
          `${k}.${cvk}: cultivar heightIn should be a plausible height at or under the species`);
    }
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

test('real-world bloom month metadata is valid when present', () => {
  assert(typeof BLOOM_MONTHS === 'object' && BLOOM_MONTHS, 'BLOOM_MONTHS missing');
  for (const k of Object.keys(BLOOM_MONTHS)){
    assert(PLANTS[k], `${k}: bloom month override points at no plant`);
  }
  for (const k of keys){
    const P = PLANTS[k];
    if (!P.bloomMonths) continue;
    assert(Array.isArray(P.bloomMonths) && P.bloomMonths.length, `${k}: bloomMonths not an array`);
    for (const m of P.bloomMonths)
      assert(Number.isInteger(m) && m >= 1 && m <= 12, `${k}: bad bloom month ${m}`);
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

test('grass cultivars use comparable mature height and spread data', () => {
  for (const k of keys){
    const P = PLANTS[k];
    if (P.type !== 'grass') continue;
    assert(P.h >= 9 && P.h <= 108, `${k}: grass height ${P.h} outside audited range`);
    assert(P.spread >= 9 && P.spread <= 72, `${k}: grass spread ${P.spread} outside audited range`);
    for (const v of Object.keys(P.cv || {})){
      const C = P.cv[v];
      assert(C.cw === undefined, `${k}.${v}: grass width must use spread, not woody-only cw`);
      const D = Object.assign({}, P, C);
      assert(D.h >= 9 && D.h <= 108, `${k}.${v}: grass height ${D.h} outside audited range`);
      assert(D.spread >= 9 && D.spread <= 72, `${k}.${v}: grass spread ${D.spread} outside audited range`);
    }
  }
});

test('native sedge collection is complete, distinct, and within herbaceous size bounds', () => {
  const phaseOne = {
    oaksedge:'Carex albicans', meadssedge:'Carex meadii', texassedge:'Carex texensis',
    cherokeesedge:'Carex cherokeensis', cedarsedge:'Carex planostachys',
    tussocksedge:'Carex stricta', lakesedge:'Carex lacustris',
    awlfruitedsedge:'Carex stipata', bristlysedge:'Carex comosa',
    bluewoodsedge:'Carex flaccosperma', whitebearsedge:'Carex albursina',
    longbeakedsedge:'Carex sprengelii', sunsedge:'Carex inops subsp. heliophila',
    clusteredfieldsedge:'Carex praegracilis',
  };
  const latin=new Set();
  for (const k in phaseOne){
    const P=PLANTS[k];
    assert(P, `${k}: phase-one sedge missing`);
    assertEqual(P.latin, phaseOne[k], `${k}: botanical name`);
    assertEqual(P.type, 'sedge', `${k}: must remain a sedge`);
    assert(P.native, `${k}: should be a North American native`);
    assert(P.h >= 10 && P.h <= 52, `${k}: height ${P.h} outside sedge range`);
    assert(P.space >= 10 && P.space <= 36, `${k}: spacing ${P.space} outside sedge range`);
    assert(P.spread >= 12 && P.spread <= 48, `${k}: spread ${P.spread} outside sedge range`);
    assert(!latin.has(P.latin), `${k}: duplicate botanical name ${P.latin}`);
    latin.add(P.latin);
  }
  assertEqual(PLANTS.palmsedge.latin, 'Carex muskingumensis',
    'Palm Sedge remains the catalog entry for Muskingum Sedge');
  assertEqual(PLANTS.oaksedge.name, 'Oak Sedge', 'Carex albicans uses the Oak Sedge label');
  assertEqual(PLANTS.whitebearsedge.name, 'White Bear Sedge', 'Carex albursina uses the White Bear Sedge label');
  assertEqual(PLANTS.sunsedge.name, 'Sun Sedge', 'the prairie Carex inops taxon is Sun Sedge');
  assert(keys.filter(k=>PLANTS[k].type==='sedge').length >= 26, 'expected the expanded sedge collection');
});

test('sedges carry visual archetypes and preserve signature seedheads', () => {
  const sedges=keys.filter(k=>PLANTS[k].type==='sedge');
  for (const k of sedges){
    const L=PLANTS[k].look||{};
    assert(L.mound || L.sedgeHabit==='palm', `${k}: sedge needs a deliberate preview habit`);
  }
  assertEqual(PLANTS.palmsedge.look.sedgeHabit, 'palm', 'Palm Sedge needs ranked leaves');
  assertEqual(PLANTS.grayssedge.look.seedStyle, 'mace', "Gray's Sedge needs its mace fruit");
  for (const k of ['foxsedge','awlfruitedsedge','bristlysedge'])
    assertEqual(PLANTS[k].look.seedStyle, 'brush', `${k}: needs a brush-like seedhead`);
  assertEqual(PLANTS.longbeakedsedge.look.seedStyle, 'pendant', 'Long-beaked Sedge needs pendent seedheads');
  assert(PLANTS.plantainsedge.look.leafW > 2 && PLANTS.whitebearsedge.look.leafW > 2,
    'broad woodland sedges need broader foliage than the fine carpets');
  assert(PLANTS.ivorysedge.look.leafW < 1 && PLANTS.pennsedge.look.leaves >= 20,
    'fine lawn sedges need their dense, narrow leaf texture');
  assert(PLANTS.lakesedge.look.dome > 0.85 && PLANTS.tussocksedge.look.dome > 0.85,
    'wet upright sedges need a hummock profile');
});

test('signature grass cultivars keep their real-world size hierarchy', () => {
  const effective = (k, v) => Object.assign({}, PLANTS[k], PLANTS[k].cv[v]);
  const northwind = effective('switchgrass', 'northwind');
  const heavyMetal = effective('switchgrass', 'heavymetal');
  const shenandoah = effective('switchgrass', 'shenandoah');
  assert(northwind.h > heavyMetal.h && heavyMetal.h > shenandoah.h,
    'Northwind should be taller than Heavy Metal, which should be taller than Shenandoah');
  assert(shenandoah.spread > northwind.spread && northwind.spread > heavyMetal.spread,
    'Shenandoah should be broader than Northwind, which should be broader than Heavy Metal');
  assert(effective('bigbluestem', 'blackhawks').h < PLANTS.bigbluestem.h,
    'Blackhawks should stay shorter than straight big bluestem');
  assert(effective('pinkmuhly', 'whitecloud').h > PLANTS.pinkmuhly.h,
    'White Cloud should stand taller than pink muhly');
  assert(PLANTS.giantstipa.h > PLANTS.karl.h, 'giant feather grass should overtop Karl Foerster');
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

test('native landscape-gap additions retain their botanical identity and intended roles', () => {
  const expected = {
    purpleprairieclover:['Dalea purpurea','forb'], whiteprairieclover:['Dalea candida','forb'],
    bluegrama:['Bouteloua gracilis','grass'], northernseaoats:['Chasmanthium latifolium','grass'],
    prairieironweed:['Vernonia fasciculata','forb'], bluestemmedgoldenrod:['Solidago caesia','forb'],
    whitewoodaster:['Eurybia divaricata','forb'], whiteturtlehead:['Chelone glabra','forb'],
    goldenragwort:['Packera aurea','forb'], yellowtroutlily:['Erythronium americanum','bulb'],
    michiganlily:['Lilium michiganense','bulb'],
  };
  for (const k in expected){
    const P=PLANTS[k];
    assert(P, `${k}: recommended native landscape addition is missing`);
    assertEqual(P.latin, expected[k][0], `${k}: botanical name`);
    assertEqual(P.type, expected[k][1], `${k}: type`);
    assert(P.native, `${k}: should remain a North American native`);
    assert(Array.isArray(P.bloomMonths) && P.bloomMonths.length, `${k}: needs real bloom months`);
  }
  assertEqual(PLANTS.purpleprairieclover.group, 'prairieclover', 'both prairie clovers share a picker');
  assertEqual(PLANTS.whiteprairieclover.group, 'prairieclover', 'both prairie clovers share a picker');
  assertEqual(PLANTS.bluegrama.look.headStyle, 'eyelash', 'blue grama needs its signature seed combs');
  assert(PLANTS.northernseaoats.look.spikeletW > 3, 'northern sea oats needs broad hanging spikelets');
  assertEqual(PLANTS.michiganlily.bulbSeason, 'summer', 'Michigan lily must not use the spring-ephemeral bulb envelope');
});

test('second-wave native additions keep their distinct form and cultivar policy', () => {
  const expected = {
    largebeardtongue:['Penstemon grandiflorus','spike'],
    roughgoldenrod:['Solidago rugosa','spike'],
    mossphlox:['Phlox subulata','shrub'],
    falsesunflower:['Heliopsis helianthoides','cone'],
  };
  for (const k in expected){
    const P=PLANTS[k];
    assert(P, `${k}: second-wave plant is missing`);
    assertEqual(P.latin, expected[k][0], `${k}: botanical name`);
    assertEqual(P.form, expected[k][1], `${k}: renderer form`);
    assert(P.native, `${k}: straight species should be native`);
    assert(Array.isArray(P.bloomMonths) && P.bloomMonths.length, `${k}: needs real bloom months`);
  }
  assertEqual(PLANTS.largebeardtongue.look.spikeStyle, 'bell', 'large beardtongue needs tubular bells');
  assertEqual(PLANTS.roughgoldenrod.look.spikeStyle, 'goldenrodPanicle', 'rough goldenrod needs arching panicles');
  assertEqual(PLANTS.roughgoldenrod.cv.fireworks.native, false, 'Fireworks remains a garden cultivar');
  assertEqual(PLANTS.mossphlox.look.habit, 'mossphlox', 'moss phlox needs a low evergreen mat');
});

test('European Oudolf additions retain their design roles and distinct renderer styles', () => {
  const expected = {
    molinia:['Molinia caerulea subsp. arundinacea','cloudgrass'],
    knautia:['Knautia macedonica','pincushion'],
    astrantia:['Astrantia major','pincushion'],
    eryngiumbourgatii:['Eryngium bourgatii','globe'],
    matrona:["Hylotelephium 'Matrona'",'umbel'],
    persicaria:['Persicaria amplexicaulis','spike'],
  };
  for (const k in expected){
    const P=PLANTS[k];
    assert(P, `${k}: European/Oudolf addition is missing`);
    assertEqual(P.latin, expected[k][0], `${k}: botanical name`);
    assertEqual(P.form, expected[k][1], `${k}: renderer form`);
    assertEqual(P.native, false, `${k}: should not be marked North American native`);
    assert(Array.isArray(P.bloomMonths) && P.bloomMonths.length, `${k}: needs real bloom months`);
  }
  assertEqual(PLANTS.rattlesnake.group, 'eryngium', 'rattlesnake master anchors the Eryngium picker');
  assertEqual(PLANTS.eryngiumbourgatii.look.globeStyle, 'seaHolly', 'Pyrenean sea holly needs its bracted blue head');
  assertEqual(PLANTS.astrantia.look.pincushionStyle, 'astrantia', 'masterwort needs its star-bracted head');
  assertEqual(PLANTS.sedum.group, 'hylotelephium', 'Autumn Joy shares the stonecrop picker');
  assertEqual(PLANTS.matrona.group, 'hylotelephium', 'Matrona is a sibling, not an Autumn Joy cultivar');
  assertEqual(PLANTS.persicaria.look.spikeStyle, 'liatris', 'Firetail needs fine, upright red wands');
});
