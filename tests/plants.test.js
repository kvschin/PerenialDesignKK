/* Tier 1 — the PLANTS data contract.  Runs concatenated after plants.js, so
   PLANTS is in scope.  Uses injected test()/assert(). */

const TYPES  = ['grass', 'sedge', 'forb', 'bulb', 'water', 'shrub', 'tree'];
const SUNS   = ['full', 'part'];
const MOISTS = ['dry', 'medium', 'moist'];
const PHENS  = ['cool', 'mid', 'warm'];
const SEASON_KEYS = ['Spring', 'Summer', 'Fall', 'Winter'];
const COLOR_KEYS  = ['fol', 'folTip', 'bloom', 'seed', 'panicle', 'eye', 'bract', 'edge', 'twig'];
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

test('native range and provenance replace the legacy boolean on every exact plant', () => {
  const ranges=new Set(['north-america','europe','asia','africa','central-america','south-america','australasia']);
  for (const k of keys){
    const P = PLANTS[k];
    assertEqual(P.native, undefined, `${k}: legacy native boolean must be removed`);
    assert(Array.isArray(P.nativeTo), `${k}: nativeTo must be an array`);
    P.nativeTo.forEach(r=>assert(ranges.has(r), `${k}: unknown native range ${r}`));
    assert(['species','selection','hybrid'].includes(P.provenance), `${k}: invalid provenance ${P.provenance}`);
    for (const v in (P.cv||{})){
      const C=P.cv[v];
      assert(Array.isArray(C.nativeTo), `${k}.${v}: nativeTo must resolve explicitly`);
      assert(['species','selection','hybrid'].includes(C.provenance), `${k}.${v}: invalid provenance`);
      assertEqual(C.native, undefined, `${k}.${v}: legacy native boolean must be removed`);
    }
  }
});

test('native migration pins corrected ranges and cultivar provenance sentinels', () => {
  assert(PLANTS.oakleafhydrangea.nativeTo.includes('north-america'), 'oakleaf hydrangea is southeastern North American');
  assert(PLANTS.babyjoe.nativeTo.includes('north-america'), 'Eutrochium dubium is eastern North American');
  assertEqual(PLANTS.babyjoe.provenance,'selection','Baby Joe is the named selection, not the straight species');
  assert(PLANTS.molinia.nativeTo.includes('europe')&&!PLANTS.molinia.nativeTo.includes('north-america'), 'Molinia is European here');
  assert(PLANTS.miscanthus.nativeTo.includes('asia'), 'Miscanthus records its Asian origin');
  assert(PLANTS.freemanmaple.nativeTo.includes('north-america'), 'the naturally occurring Freeman maple hybrid keeps its range');
  assertEqual(PLANTS.freemanmaple.provenance,'hybrid','Freeman maple still records hybrid provenance');
  assertEqual(PLANTS.bluestem.cv.standingovation.provenance,'selection','ordinary named cultivars resolve as selections');
  assertEqual(PLANTS.agastache.cv.bluefortune.provenance,'hybrid','Blue Fortune is not treated as a native selection');
  assertEqual(PLANTS.agastache.cv.bluefortune.nativeTo.length,0,'a garden hybrid has no wild native range');
  assertEqual(PLANTS.serviceberry.cv.autumnbrilliance.provenance,'hybrid','Autumn Brilliance records its hybrid parentage');
  assert(PLANTS.serviceberry.cv.autumnbrilliance.nativeTo.includes('north-america'),'the naturally occurring serviceberry hybrid keeps its North American range');
  assertEqual(PLANTS.crabapple.cv.sargent.provenance,'species','Sargent crabapple is an exact species entry');
  assert(PLANTS.crabapple.cv.sargent.nativeTo.includes('asia'),'Sargent crabapple records its East Asian origin');
  ['mountainsedge','greatburnet','smokebush'].forEach(k=>
    assert(PLANTS[k].nativeTo.includes('asia'),`${k} records its Asian range`));
  assertEqual(PLANTS.claudeshride.provenance,'hybrid','Claude Shride is a Martagon hybrid, not the straight species');
  assertEqual(PLANTS.claudeshride.nativeTo.length,0,'Claude Shride has no wild range');
  assert(PLANTS.eryngiumbourgatii.nativeTo.includes('africa'),'Eryngium bourgatii records its North African range');
  assert(!PLANTS.serbianspruce.nativeTo.includes('asia'),'Serbian spruce is European, not Asian');
  assertEqual(PLANTS.smokebush.cv.grace.nativeTo.length,0,'Grace smokebush is a garden hybrid');
  assertEqual(PLANTS.smoketree.cv,undefined,'American smoketree does not repeat Cotinus coggygria cultivars');
});

test('catalog cleanup leaves only intentional base-taxon aliases', () => {
  assertEqual(PLANT_KEYS.length,505,'canonical base-record count');
  assertEqual(PLANT_KEYS.filter(k=>PLANTS[k].hidden).length,0,'no hidden duplicate records remain');
  assertEqual(PLANT_KEYS.reduce((n,k)=>n+Object.keys(PLANTS[k].cv||{}).length,0),377,
    'canonical nested-choice count');
  for (const retired of ['creamindigo','salvia','salviaspecies'])
    assertEqual(PLANTS[retired],undefined,`${retired}: retired duplicate key`);

  const expectedAliases={
    'creamindigo|':'baptisia|creamwild',
    'salvia|':'meadowsage|caradonna',
    'salviaspecies|':'meadowsage|',
    'smoketree|grace':'smokebush|grace',
  };
  for (const [from,to] of Object.entries(expectedAliases)){
    assertEqual(PLANT_REF_ALIASES[from],to,`${from}: durable migration`);
    assertEqual(PLANT_REF_ALIASES[to],undefined,`${to}: canonical refs never alias again`);
  }

  const allowed=new Map([
    ['Iris versicolor','northernblueflag,waterblueflag'],
    ['Hydrangea macrophylla','bigleaflace,hydrangea'],
    ['Hydrangea arborescens','smoothhydrangea,smoothlace'],
    ['Betula nigra','riverbirch,riverbirchmulti'],
    ['Buxus sempervirens / hybrids','boxwoodcolumn,boxwoodcone,boxwoodlow,boxwoodround,boxwoodsquare'],
    ['Taxus x media','yewlow,yewmedium,yewtall'],
  ]);
  const byLatin=new Map();
  for (const key of PLANT_KEYS){
    const list=byLatin.get(PLANTS[key].latin)||[]; list.push(key); byLatin.set(PLANTS[key].latin,list);
  }
  const duplicates=[...byLatin].filter(([,list])=>list.length>1);
  assertEqual(duplicates.length,allowed.size,'only renderer/layer aliases duplicate a base Latin');
  for (const [latin,list] of duplicates)
    assertEqual(list.sort().join(','),allowed.get(latin),`${latin}: intentional architectural alias`);
});

test('West Coast batches preserve reviewed taxa, woody identities, and regional caveats', () => {
  const rows=['phase1a-sources.json','phase1b-sources.json'].flatMap(file=>
    JSON.parse(readRepoFile('docs/plant-data/'+file)).plants);
  assertEqual(rows.length,22,'the two approved batches contain 22 base taxa');
  for(const row of rows){
    const P=PLANTS[row.suggestedKey], reviewed=row.proposed;
    assert(P,`${row.id}: missing species`);
    assertEqual(P.latin,row.latin||reviewed.latin,`${row.id}: exact reviewed taxon`);
    assertEqual(P.type,reviewed.type,`${row.id}: biological placement category`);
    assertEqual(P.nativeTo.join(','),'north-america',`${row.id}: retains existing continental range contract`);
    assertEqual(P.provenance,'species',`${row.id}: straight species`);
    assert(P.heightIn>0,`${row.id}: real height is explicit, not inferred from art`);
  }
  const base=PLANTS.vinehillmanzanita, cv=base.cv.howardmcminn;
  assert(cv.heightIn>base.heightIn&&cv.spread>base.spread,'Howard McMinn must not donate its larger dimensions to the low species');
  assertEqual(cv.provenance,'selection','Howard McMinn is a named selection');
  assert(!PLANTS.westernswordfern.bloomMonths,'a fern has no flowering calendar');
  assert(!Object.values(PLANTS.westernswordfern.sea).some(s=>s.bloom||s.seed),'fern spores are not flowers or decorative seed spikes');
  assert(!PLANTS.oregoniris.sea.Winter.fol,'winter-deciduous Oregon iris is not evergreen bearded iris');
  assert(/North Carolina/.test(PLANTS.redfloweringcurrant.blurb),'Ribes restriction remains visible without a regional legal filter');
});

test('Florida batch preserves reviewed dimensions, taxa, and safety caveats', () => {
  const rows=JSON.parse(readRepoFile('docs/plant-data/phase2-sources.json')).plants;
  assertEqual(rows.length,10,'Phase 2 contains exactly the ten approved Florida taxa');
  for(const row of rows){
    const P=PLANTS[row.suggestedKey], reviewed=row.proposed;
    assert(P,`${row.id}: missing species`);
    assertEqual(P.latin,reviewed.latin,`${row.id}: exact reviewed taxon`);
    assertEqual(P.type,reviewed.type,`${row.id}: biological placement category`);
    for(const field of ['heightIn','spread','space','sun','moist','phen'])
      assertEqual(P[field],reviewed[field],`${row.id}: reviewed ${field}`);
    assertEqual(P.zones.join(','),reviewed.zones.join(','),`${row.id}: reviewed zone range`);
    if(reviewed.grow) assertEqual(P.grow,reviewed.grow,`${row.id}: planning years to represented woody size`);
    assertEqual(P.nativeTo.join(','),'north-america',`${row.id}: retains existing continental range contract`);
    assertEqual(P.provenance,'species',`${row.id}: straight species`);
  }
  assertEqual(PLANTS.coontie.form,'cycad','coontie has a cycad crown, not the fern grammar');
  assertEqual(PLANTS.sawpalmetto.form,'fanpalm','saw palmetto has a segmented fan-palm grammar');
  assert(!PLANTS.coontie.bloomMonths,'coontie has cones, not a flowering calendar');
  assert(/toxic/i.test(PLANTS.coontie.blurb)&&/nursery/i.test(PLANTS.coontie.blurb),'coontie safety and sourcing remain visible');
  assert(/jamaicensis/.test(PLANTS.nativeblueporterweed.blurb)&&/cayennensis/.test(PLANTS.nativeblueporterweed.blurb),'porterweed exact-species warning remains visible');
  assert(/subsp\. debilis/.test(PLANTS.beachsunflower.blurb)&&/do not mix ecotypes/i.test(PLANTS.beachsunflower.blurb),'beach-sunflower provenance remains visible');
  assert(/state-listed/i.test(PLANTS.dwarffakahatcheegrass.blurb),'threatened Fakahatchee sourcing remains visible');
  assert(/saw-toothed/i.test(PLANTS.sawpalmetto.blurb),'saw-palmetto petiole hazard remains visible');
  for(const key of ['sunshinemimosa','dwarffakahatcheegrass','firebush'])
    assert(!PLANTS[key].roles.includes('coastal'),`${key}: salt-intolerant species is not recommended for exposed coastal use`);
});

test('cleaned exact selections keep accepted names and provenance', () => {
  const latin={
    karl:"Calamagrostis × acutiflora 'Karl Foerster'",
    molinia:"Molinia caerulea subsp. arundinacea 'Transparent'",
    phlox:"Phlox paniculata 'Jeana'",
    joepye:"Eutrochium maculatum 'Gateway'",
    persicaria:"Bistorta amplexicaulis 'Firetail'",
    stachys:"Betonica officinalis 'Hummelo'",
    lilacsquirrel:"Sanguisorba hakusanensis 'Lilac Squirrel'",
    claudeshride:"Lilium 'Claude Shride'",
  };
  for (const [key,name] of Object.entries(latin)) assertEqual(PLANTS[key].latin,name,`${key}: exact Latin`);
  assert(['europe','asia','africa'].every(r=>PLANTS.stachys.nativeTo.includes(r)),'Hummelo keeps the Betonica species range');
  assert(!PLANTS.greatburnet.nativeTo.includes('north-america'),'introduced great burnet is not a North American native');
  assertEqual(PLANTS.rudbeckia.cv.americangoldrush.provenance,'hybrid','American Gold Rush does not inherit the wrong species');
  assertEqual(PLANTS.rudbeckia.cv.americangoldrush.nativeTo.length,0,'American Gold Rush has no asserted wild range');
  assertEqual(PLANTS.meadowsage.cv.maynight.nativeTo.join(','),'europe','May Night keeps the Salvia x sylvestris range');
  assertEqual(PLANTS.meadowsage.cv.bluehill.nativeTo.join(','),'europe','Blue Hill keeps the Salvia x sylvestris range');
  assertEqual(PLANTS.autumnfire.provenance,'hybrid','Autumn Fire follows its hybrid lineage');
  assertEqual(PLANTS.purpleemperor.provenance,'selection','Purple Emperor remains a species selection');
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

test('resized orchard-tree cultivars declare exact real dimensions', () => {
  for (const k of keys){
    const P=PLANTS[k]; if (P.type!=='tree'||!(P.roles||[]).includes('orchard')) continue;
    for (const [v,C] of Object.entries(P.cv||{})){
      const resized=['h','cw','space','spread'].some(f=>Object.hasOwn(C,f));
      if (!resized) continue;
      assert(typeof C.heightIn==='number'&&typeof C.spread==='number',
        `${k}.${v}: a resized tree cultivar needs exact heightIn and spread`);
    }
  }
});

test('home-orchard expansion covers common temperate and zone-9 fruit and nut groups', () => {
  const fruit=['apple','europeanpear','asianpear','sweetcherry','sourcherry','americanplum','europeanplum','japaneseplum',
    'hybridplum','peach','apricot','americanpersimmon','asianpersimmon','pawpaw','quince','fig',
    'redmulberry','jujube','pomegranate','olive','loquat','sweetorange','mandarin','lemon','persianlime',
    'keylime','grapefruit','avocado'];
  const nuts=['almond','pecan','blackwalnut','englishwalnut','butternut','americanchestnut',
    'chinesechestnut','americanhazel','europeanhazel','shagbarkhickory','pistachio','macadamia'];
  for (const k of fruit){
    assert(PLANTS[k],`${k}: missing common fruit tree`);
    assert((PLANTS[k].roles||[]).includes('orchard')&&(PLANTS[k].roles||[]).includes('fruit'),
      `${k}: missing orchard/fruit discovery roles`);
  }
  for (const k of nuts){
    assert(PLANTS[k],`${k}: missing common nut tree`);
    assert((PLANTS[k].roles||[]).includes('orchard')&&(PLANTS[k].roles||[]).includes('nut'),
      `${k}: missing orchard/nut discovery roles`);
  }
  assertEqual(PLANTS.apple.provenance,'hybrid','domesticated apple does not claim a wild species range');
  assertEqual(PLANTS.hybridplum.provenance,'hybrid','cold-climate hybrid plum records its lineage');
  assert(PLANTS.pawpaw.nativeTo.includes('north-america'),'pawpaw records its North American range');
  assert(PLANTS.europeanpear.nativeTo.includes('europe'),'European pear records its European range');
  assert(PLANTS.asianpear.nativeTo.includes('asia'),'Asian pear records its Asian range');
  assertEqual(PLANTS.sweetorange.provenance,'hybrid','sweet orange records its cultivated hybrid origin');
  assert(PLANTS.avocado.nativeTo.includes('central-america'),'avocado records its Mesoamerican range');
  assert(PLANTS.macadamia.nativeTo.includes('australasia'),'macadamia records its Australian range');
  assertEqual(PLANTS.redmulberry.cv.illinoiseverbearing.provenance,'hybrid',
    'Illinois Everbearing does not inherit red mulberry species provenance');
  assertEqual(PLANTS.redmulberry.cv.illinoiseverbearing.nativeTo.length,0,
    'the interspecific mulberry hybrid claims no wild range');
});

test('tree-fruit rendering metadata stays bounded and seasonal', () => {
  const shapes=new Set(['round','pear','fig','oval','pod','nut','husk','bur','pomegranate']);
  const orchardTrees=keys.filter(k=>PLANTS[k].type==='tree'&&(PLANTS[k].roles||[]).includes('orchard'));
  assert(orchardTrees.length>=25,'expected a substantial home-orchard tree palette');
  for (const k of orchardTrees){
    const P=PLANTS[k];
    assert(shapes.has(P.look.fruitShape),`${k}: invalid or missing tree fruit shape`);
    assert(Number.isInteger(P.look.seedN)&&P.look.seedN>=0&&P.look.seedN<=16,
      `${k}: seedN must remain a bounded total fruit budget`);
    if (P.look.fruitCluster!==undefined)
      assert(P.look.fruitCluster>=1&&P.look.fruitCluster<=4,`${k}: fruitCluster outside 1-4`);
  }
  assertEqual(PLANTS.pistachio.cv.peters.look.seedN,0,'male pistachio deliberately suppresses nuts');
  assertEqual(PLANTS.olive.cv.littleollie.look.seedN,0,'fruitless olive deliberately suppresses fruit');
  for (const k of ['apple','europeanpear','asianpear','sweetcherry','sourcherry','europeanplum',
    'japaneseplum','hybridplum','peach','pawpaw','quince','fig','redmulberry','jujube','pomegranate'])
    assertEqual(PLANTS[k].sea.Winter.seed,undefined,`${k}: harvested fruit must not turn into winter bark dots`);
});

test('shrubs declare explicit real dimensions and exact resized cultivars do too', () => {
  for (const k of keys){
    const P=PLANTS[k];
    if (P.type!=='shrub') continue;
    assert(typeof P.heightIn==='number'&&P.heightIn>=12&&P.heightIn<=360,
      `${k}: shrub heightIn ${P.heightIn} outside 1-30 ft`);
    assert(typeof P.spread==='number'&&P.spread>=12&&P.spread<=360,
      `${k}: shrub spread ${P.spread} outside 1-30 ft`);
    for (const [v,C] of Object.entries(P.cv||{})){
      const resized=['h','cw','space','spread'].some(f=>Object.hasOwn(C,f));
      if (!resized) continue;
      assert(typeof C.heightIn==='number'&&typeof C.spread==='number',
        `${k}.${v}: a resized shrub cultivar needs exact heightIn and spread`);
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

test('the bulb audit keeps a complete morphology and catalog contract', () => {
  const additions={
    alliumsphaerocephalon:['Allium sphaerocephalon','globe',[6,7]],
    crocuschrysanthus:['Crocus chrysanthus','bulbcup',[2,3]],
    liliummartagon:['Lilium martagon','martagon',[6,7]],
    liliumsuperbum:['Lilium superbum','martagon',[7,8]],
    englishbluebell:['Hyacinthoides non-scripta','spike',[4,5]],
    cyclamenhederifolium:['Cyclamen hederifolium','cone',[9,10]],
  };
  for(const [k,[latin,form,months]] of Object.entries(additions)){
    const P=PLANTS[k];
    assert(P,`${k}: audited bulb addition is missing`);
    assertEqual(P.latin,latin,`${k}: botanical name`);
    assertEqual(P.form,form,`${k}: renderer form`);
    assertEqual(P.type,'bulb',`${k}: stays in the bulb layer`);
    assertEqual(JSON.stringify(P.bloomMonths),JSON.stringify(months),`${k}: bloom calendar`);
  }
  assertEqual(PLANT_KEYS.filter(k=>PLANTS[k].type==='bulb').length,39,'audited base bulb count');
  assertEqual(PLANT_KEYS.filter(k=>PLANTS[k].type==='bulb')
    .reduce((n,k)=>n+1+Object.keys(PLANTS[k].cv||{}).length,0),82,'audited exact bulb count');

  assertEqual(PLANTS.alliumChristophii.latin,'Allium cristophii','Star of Persia uses the accepted spelling');
  assertEqual(PLANTS.alliumcarinatum.latin,'Allium cirrhosum','Pretty garlic uses the accepted taxon');
  assertEqual(PLANTS.puschkinia.latin,'Puschkinia scilloides','striped squill uses the accepted species');
  assertEqual(PLANTS.lycoris.provenance,'species','surprise lily no longer masquerades as a hybrid');
  assert(PLANTS.scillaperuviana.nativeTo.includes('africa'),'Portuguese squill records its North African range');
  assertEqual(PLANTS.scillaperuviana.bulbSeason,'summer','Portuguese squill survives into its early-summer bloom');
  assert(PLANTS.colchicum.springFoliage,'colchicum exposes its separate spring leaf season');
  assert(PLANTS.cyclamenhederifolium.springFoliage,'ivy-leaved cyclamen exposes its winter-spring leaf season');
  assert(PLANTS.cyclamenhederifolium.winterFoliage,'ivy-leaved cyclamen keeps its winter leaf carpet');
  assert(!PLANTS.colchicum.winterFoliage,'colchicum remains underground in winter');

  const styles={
    crocus:['bulbcup','bulbStyle','crocus'], daffodil:['bulbcup','bulbStyle','daffodil'],
    tulip:['bulbcup','bulbStyle','tulip'], snowdrop:['bulbcup','bulbStyle','snowdrop'],
    winteraconite:['bulbcup','bulbStyle','aconite'], leucojum:['bulbcup','bulbStyle','snowflake'],
    muscari:['spike','spikeStyle','bulbRaceme'], camassia:['spike','spikeStyle','bulbRaceme'],
    yellowtroutlily:['martagon','lilyStyle','trout'], fritillaria:['martagon','lilyStyle','fritillary'],
    lycoris:['martagon','lilyStyle','lycoris'], alliumAtropurpureum:['globe','globeStyle','allium'],
  };
  for(const [k,[form,field,value]] of Object.entries(styles)){
    assertEqual(PLANTS[k].form,form,`${k}: base form`);
    assertEqual(PLANTS[k].look[field],value,`${k}: audited morphology style`);
  }
  assertEqual(PLANTS.gardentulip.cv.angelique.look.flowerStyle,'double','Angelique is visibly double');
  assertEqual(PLANTS.dahlia.cv.bishopOfLlandaff.look.flowerStyle,'peonySemiDouble','Bishop retains a visible disc');
  assertEqual(PLANTS.dahlia.cv.cornelBronze.look.flowerStyle,'ball','Cornel Brons retains its ball class');
  assertEqual(PLANTS.daffodil.cv.icefollies.look.corona,'largeCup','Ice Follies keeps its broad large cup');
  assertEqual(PLANTS.muscari.cv.blueSpike.look.doubleFlorets,true,'Blue Spike carries doubled florets');
  assertEqual(PLANTS.alliumsphaerocephalon.look.headAccent,'lower','Drumstick Allium keeps its green lower florets');
  assertEqual(PLANTS.cyclamenhederifolium.look.bloomStemsOnly,true,'Cyclamen scapes are confined to bloom');
  const rgb=c=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];
  for(const k of PLANT_KEYS.filter(k=>PLANTS[k].group==='alliumbulb')){
    for(const season of ['Fall','Winter']){
      const seed=PLANTS[k].sea[season]&&PLANTS[k].sea[season].seed;
      if(!seed) continue;
      const [r,g,b]=rgb(seed);
      assert(r>=g&&g>=b&&(r-g)<=g-b+4,
        `${k} ${season} seedhead must dry to straw/tan instead of retaining bloom color (${seed})`);
    }
  }
  assertEqual(PLANTS.camassialeichtlinii.cv.blueMelody.look.leafStripe,'#e6dfc9','Blue Melody carries real leaf variegation');
  for(const v of ['kingalfred','dutchmaster','icefollies','carlton','tetatete','thalia','mountHood']){
    assertEqual(PLANTS.daffodil.cv[v].provenance,'hybrid',`${v}: garden daffodil provenance`);
    assertEqual(PLANTS.daffodil.cv[v].nativeTo.length,0,`${v}: garden daffodil claims no wild range`);
  }
  assertEqual(PLANTS.daffodil.cv.actaea.provenance,'selection','Actaea remains a selection');
  assert(PLANTS.daffodil.cv.actaea.nativeTo.includes('europe'),'Actaea retains its European species range');
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

test('anything that blooms has an authored flower colour somewhere', () => {
  // Deliberately NOT "declare bloom in every season your months touch". The
  // 4-season render model and the 12-month calendar do not line up, and they
  // should not be forced to: New England aster's flower is authored as a Fall
  // event because that is when it reads in the garden, while its real bloom
  // starts in August. Requiring a Summer bloom colour to match the calendar
  // would make it flower in the game's summer — a render bug traded for a
  // calendar tidiness nobody asked for. 39 species are in that position and
  // all of them are right.
  //
  // What IS worth pinning: planColor's last resort is a grey '#8a8a70', and a
  // plant reaching it has simply never been given a flower colour at all. The
  // calendar and the plan sheet would both draw it as mud.
  for (const k of keys){
    const P = PLANTS[k];
    if (!Array.isArray(P.bloomMonths) || !P.bloomMonths.length) continue;
    const s = P.sea.Summer || {}, f = P.sea.Fall || {}, sp = P.sea.Spring || {};
    const resolved = s.bloom || sp.bloom || f.bloom || f.seed || s.fol || sp.fol;
    assert(resolved, `${k}: has bloom months but no colour for planColor to find`);
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
    assert(P.nativeTo.includes('north-america'), `${k}: should be a North American native`);
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
  const rgb = c => ({r:parseInt(c.slice(1,3),16),g:parseInt(c.slice(3,5),16),b:parseInt(c.slice(5,7),16)});
  const northwind = effective('switchgrass', 'northwind');
  const heavyMetal = effective('switchgrass', 'heavymetal');
  const shenandoah = effective('switchgrass', 'shenandoah');
  assert(northwind.h > heavyMetal.h && heavyMetal.h > shenandoah.h,
    'Northwind should be taller than Heavy Metal, which should be taller than Shenandoah');
  assert(shenandoah.spread > northwind.spread && northwind.spread > heavyMetal.spread,
    'Shenandoah should be broader than Northwind, which should be broader than Heavy Metal');
  const hm=rgb(PLANTS.switchgrass.cv.heavymetal.sea.Summer.fol);
  assert(hm.g > hm.b && hm.b-hm.r >= 15,
    `Heavy Metal should read as cool steel blue-green, not slate blue (${PLANTS.switchgrass.cv.heavymetal.sea.Summer.fol})`);
  const hmFall=rgb(PLANTS.switchgrass.cv.heavymetal.sea.Fall.seed);
  const hmFallFol=rgb(PLANTS.switchgrass.cv.heavymetal.sea.Fall.fol);
  assert(hmFall.r+hmFall.g+hmFall.b < hmFallFol.r+hmFallFol.g+hmFallFol.b,
    'Heavy Metal burgundy fruit stays darker than its amber fall foliage');
  assert(effective('switchgrass','cloudnine').h > northwind.h,
    'Cloud Nine should be the tallest curated switchgrass');
  for (const v of ['northwind','heavymetal','prairiesky','dallasblues','cloudnine','purpletears']){
    const c=rgb(PLANTS.switchgrass.cv[v].sea.Summer.fol);
    assert(c.g > c.b && c.g > c.r && c.b-c.r <= 24,
      `${v} foliage should read green first with no more than a slight blue cast (${PLANTS.switchgrass.cv[v].sea.Summer.fol})`);
  }
  const prairieSky=rgb(PLANTS.switchgrass.cv.prairiesky.sea.Summer.fol);
  assert(prairieSky.g-prairieSky.b >= 12,
    'Prairie Sky must stay visibly green at sprite scale instead of reading cyan');
  const shenandoahBloom=rgb(PLANTS.switchgrass.cv.shenandoah.sea.Summer.bloom);
  assert(shenandoahBloom.r > shenandoahBloom.g*1.7 && shenandoahBloom.r > shenandoahBloom.b*1.35,
    'Shenandoah panicles should read as wine red rather than pink');
  const shenandoahFall=rgb(PLANTS.switchgrass.cv.shenandoah.sea.Fall.fol);
  assert(shenandoahFall.r > shenandoahFall.b && shenandoahFall.b > shenandoahFall.g &&
    shenandoahFall.r-shenandoahFall.g >= 65,
    'Shenandoah fall foliage must stay cool burgundy, unlike golden switchgrass cultivars');
  const shenandoahWinter=rgb(PLANTS.switchgrass.cv.shenandoah.sea.Winter.fol);
  assert(shenandoahWinter.r > shenandoahWinter.g && shenandoahWinter.g-shenandoahWinter.b < 20,
    'Shenandoah should dry to muted red-brown rather than the other switchgrasses\' ochre');
  const purpleTearsFall=PLANTS.switchgrass.cv.purpletears.sea.Fall;
  assert(purpleTearsFall.panicle && purpleTearsFall.panicle !== purpleTearsFall.seed,
    'Purple Tears needs a pale panicle scaffold distinct from its dark purple seed beads');
  assert(PLANTS.switchgrass.cv.dallasblues.look.cloudDots > PLANTS.switchgrass.look.cloudDots,
    'Dallas Blues needs its unusually full panicle cloud');
  for (const v of ['carousel','jazz','prairiemunchkin'])
    assert(PLANTS.bluestem.cv[v], `little bluestem needs ${v}`);
  assert(PLANTS.bigbluestem.cv.dancingwind, 'big bluestem needs Dancing Wind');
  assert(PLANTS.indiangrass.cv.indiansteel && PLANTS.indiangrass.cv.stlouis,
    'Indiangrass needs Indian Steel and St. Louis');
  assert(PLANTS.dropseed.cv.tara && PLANTS.dropseed.cv.tara.name==="'Tara'",
    "prairie dropseed needs the correctly spelled 'Tara' cultivar");
  assertEqual(PLANTS.dropseed.form,'cloudgrass',
    'prairie dropseed needs separate low foliage and airy panicle layers');
  assert(PLANTS.dropseed.look.panicle && PLANTS.dropseed.sea.Winter.seed,
    'prairie dropseed keeps airy panicles as winter structure');
  assert(PLANTS.dropseed.sea.Fall.panicle && PLANTS.dropseed.sea.Fall.panicle !== PLANTS.dropseed.sea.Fall.seed,
    'prairie dropseed needs golden-brown panicle branches distinct from its darker seeds');
  assert(PLANTS.bluestem.cv.hahatonka.sea.Summer.folTip && PLANTS.bluestem.cv.hahatonka.sea.Fall.folTip,
    'Ha Ha Tonka needs red-gray summer segments and burgundy fall accents');
  assertEqual(PLANTS.bluestem.look.seedStyle,'fluffyRaceme',
    'little bluestem species and cultivars share their characteristic fluffy racemes');
  assert(PLANTS.bluestem.look.seedTufts>=4 && PLANTS.bluestem.look.seedSpan>=0.25,
    'little bluestem racemes need several tufts spread down the upper stem');
  assert(PLANTS.bigbluestem.cv.redoctober.sea.Spring.folTip,
    'Red October needs red spring accents before its full fall display');
  for (const ref of [
    PLANTS.bluestem.cv.standingovation,
    PLANTS.bigbluestem.cv.blackhawks,
    PLANTS.bigbluestem.cv.redoctober,
    PLANTS.switchgrass.cv.shenandoah,
  ]) assert(ref.sea.Summer.folTip, `${ref.name}: needs an authentic contrasting blade tip`);
  for (const k of ['bluestem','bigbluestem','dropseed','indiangrass'])
    assert(Array.isArray(PLANTS[k].bloomMonths) && PLANTS[k].bloomMonths.length,
      `${k}: needs its real flowering window`);
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

test('evergreen tree expansion keeps resolved taxa, scale data, and distinct architecture', () => {
  const expected = {
    bluespruce:['Picea pungens','spruce'],
    blueatlascedar:['Cedrus atlantica (Glauca Group)','cedar'],
    himalayancedar:['Cedrus deodara','cedar'],
    blueweepingalaskacedar:["Callitropsis nootkatensis 'Glauca Pendula'",'weeping'],
    greengiantarborvitae:["Thuja standishii x plicata 'Green Giant'",'scale'],
    arborvitae:['Thuja occidentalis','scale'],
    spartanjuniper:["Juniperus chinensis 'Spartan'",'scale'],
    taylorjuniper:["Juniperus virginiana 'Taylor'",'scale'],
    arizonacypress:['Hesperocyparis arizonica','scale'],
    sawaracypress:['Chamaecyparis pisifera','scale'],
    hinokicypress:['Chamaecyparis obtusa','scale'],
    leylandcypress:['x Hesperotropsis leylandii','scale'],
    vanderwolfpine:["Pinus flexilis 'Vanderwolf's Pyramid'",'pine'],
    whitepine:['Pinus strobus','pine'],
    swissstonepine:['Pinus cembra','pine'],
    weepingwhitepine:["Pinus strobus 'Pendula'",'weeping'],
    dwarfalbertaspruce:["Picea glauca 'Conica'",'spruce'],
    norwayspruce:['Picea abies','spruce'],
    wellspirespruce:["Picea mariana 'Wellspire'",'spruce'],
    bigbertaspruce:["Picea glauca 'Big Berta'",'spruce'],
    serbianspruce:['Picea omorika','spruce'],
    blackhillsspruce:['Picea glauca var. densata','spruce'],
    whitefir:['Abies concolor','spruce'],
    easternhemlock:['Tsuga canadensis','spruce'],
  };
  for (const k in expected){
    const P=PLANTS[k];
    assert(P, `${k}: evergreen tree is missing`);
    assertEqual(P.latin, expected[k][0], `${k}: botanical name`);
    assertEqual(P.look.coniferHabit, expected[k][1], `${k}: conifer architecture`);
    assertEqual(P.form, 'conifer', `${k}: renderer form`);
    assertEqual(P.type, 'tree', `${k}: catalog type`);
    assert(P.heightIn>P.h && P.spread>=P.space, `${k}: real size stays separate from px-art hints`);
    for (const s of SEASON_KEYS) assert(P.sea[s] && P.sea[s].fol, `${k}: evergreen foliage missing in ${s}`);
  }
  assert(PLANTS.taylorjuniper.spread < PLANTS.spartanjuniper.spread, 'Taylor stays narrower than Spartan');
  assert(PLANTS.dwarfalbertaspruce.heightIn < PLANTS.norwayspruce.heightIn, 'Dwarf Alberta stays much shorter than Norway spruce');
  assert(PLANTS.blueatlascedar.spread > PLANTS.serbianspruce.spread, 'Atlas cedar keeps a broad shelf crown');
  assertEqual(PLANTS.swissstonepine.group, 'pine', 'Swiss stone is correctly resolved as a pine, not a spruce');
  assertEqual(PLANTS.baldcypress.sea.Winter.fol, undefined, 'deciduous bald cypress drops its winter foliage');
  for (const k of ['bluespruce','arizonacypress','whitefir'])
    assert(PLANTS[k].nativeTo.includes('north-america'),`${k}: western species belongs in the continental North American range`);
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
    assert(P.nativeTo.includes('north-america'), `${k}: should remain a North American native`);
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
    assert(P.nativeTo.includes('north-america'), `${k}: straight species should be native`);
    assert(Array.isArray(P.bloomMonths) && P.bloomMonths.length, `${k}: needs real bloom months`);
  }
  assertEqual(PLANTS.largebeardtongue.look.spikeStyle, 'bell', 'large beardtongue needs tubular bells');
  assertEqual(PLANTS.roughgoldenrod.look.spikeStyle, 'goldenrodPanicle', 'rough goldenrod needs arching panicles');
  assertEqual(PLANTS.roughgoldenrod.cv.fireworks.provenance, 'selection', 'Fireworks remains a named selection');
  assert(PLANTS.roughgoldenrod.cv.fireworks.nativeTo.includes('north-america'), 'a selection keeps its species range');
  assertEqual(PLANTS.mossphlox.look.habit, 'mossphlox', 'moss phlox needs a low evergreen mat');
});

test('European Oudolf additions retain their design roles and distinct renderer styles', () => {
  const expected = {
    molinia:["Molinia caerulea subsp. arundinacea 'Transparent'",'cloudgrass'],
    knautia:['Knautia macedonica','pincushion'],
    astrantia:['Astrantia major','pincushion'],
    eryngiumbourgatii:['Eryngium bourgatii','globe'],
    matrona:["Hylotelephium 'Matrona'",'umbel'],
    persicaria:["Bistorta amplexicaulis 'Firetail'",'spike'],
  };
  for (const k in expected){
    const P=PLANTS[k];
    assert(P, `${k}: European/Oudolf addition is missing`);
    assertEqual(P.latin, expected[k][0], `${k}: botanical name`);
    assertEqual(P.form, expected[k][1], `${k}: renderer form`);
    assert(!P.nativeTo.includes('north-america'), `${k}: should not be marked North American native`);
    assert(Array.isArray(P.bloomMonths) && P.bloomMonths.length, `${k}: needs real bloom months`);
  }
  assertEqual(PLANTS.rattlesnake.group, 'eryngium', 'rattlesnake master anchors the Eryngium picker');
  assertEqual(PLANTS.eryngiumbourgatii.look.globeStyle, 'seaHolly', 'Pyrenean sea holly needs its bracted blue head');
  assertEqual(PLANTS.astrantia.look.pincushionStyle, 'astrantia', 'masterwort needs its star-bracted head');
  assertEqual(PLANTS.sedum.group, 'hylotelephium', 'Autumn Joy shares the stonecrop picker');
  assertEqual(PLANTS.matrona.group, 'hylotelephium', 'Matrona is a sibling, not an Autumn Joy cultivar');
  assertEqual(PLANTS.persicaria.look.spikeStyle, 'liatris', 'Firetail needs fine, upright red wands');
});

test('requested sun and shade catalog expansion retains distinct taxa and cultivars', () => {
  const expected = {
    alliumcarinatum:['Allium cirrhosum','bulb'],
    alliumcaeruleum:['Allium caeruleum','bulb'],
    graysedge:['Carex grisea','sedge'],
    mountainsedge:['Carex montana','sedge'],
    marginalwoodfern:['Dryopteris marginalis','forb'],
    willowamsonia:['Amsonia tabernaemontana var. salicifolia','forb'],
    babyjoe:["Eutrochium dubium 'Baby Joe'",'forb'],
    sanguineumgeranium:['Geranium sanguineum','forb'],
    bigrootgeranium:['Geranium macrorrhizum','forb'],
    autumnGoldenrod:['Solidago sphacelata','forb'],
    silvermound:["Artemisia schmidtiana 'Silver Mound'",'forb'],
    broadleafwormwood:['Artemisia ludoviciana var. latiloba','forb'],
    menziesburnet:['Sanguisorba menziesii','forb'],
    baldwinsironweed:['Vernonia baldwinii','forb'],
    moorhexe:["Molinia caerulea subsp. caerulea 'Moorhexe'",'grass'],
    sandlovegrass:['Eragrostis trichodes','grass'],
  };
  const foliageOnly = new Set(['marginalwoodfern','silvermound','broadleafwormwood']);
  for (const k in expected){
    const P=PLANTS[k];
    assert(P, `${k}: requested catalog entry is missing`);
    assertEqual(P.latin, expected[k][0], `${k}: botanical name`);
    assertEqual(P.type, expected[k][1], `${k}: type`);
    if (!foliageOnly.has(k)) assert(Array.isArray(P.bloomMonths) && P.bloomMonths.length, `${k}: needs real bloom months`);
  }
  assert(PLANTS.bigbluestem.cv.redoctober, 'Big bluestem needs the Red October cultivar');
  assertEqual(PLANTS.bigbluestem.cv.redoctober.name, "'Red October'", 'Red October cultivar name');
  assertEqual(PLANTS.sedum.name, "Stonecrop 'Autumn Joy'", 'Autumn Joy remains the stonecrop anchor');
  for (const k of ['autumnfire','purpleemperor','autumncharm']){
    assertEqual(PLANTS[k].group, 'hylotelephium', `${k}: stonecrop group`);
  }
  assertEqual(PLANTS.willowamsonia.look.habit, 'broadamsonia', 'willow amsonia needs its broad habit');
  assert(PLANTS.willowamsonia.look.leafL >= 5 && PLANTS.willowamsonia.look.leafH < 1.5, 'willow amsonia needs long, narrow leaves');
  assertEqual(PLANTS.autumnGoldenrod.look.spikeStyle, 'goldenrodPanicle', 'autumn goldenrod needs an arching panicle');
  assertEqual(PLANTS.moorhexe.form, 'moorgrass', 'Moorhexe uses the compact moorgrass silhouette');
  assertEqual(PLANTS.sandlovegrass.form, 'cloudgrass', 'sand lovegrass uses the airy cloud silhouette');
});

test('high-priority perennial gaps keep exact taxa, origins, and starter cultivars', () => {
  const expected = {
    lentenrose:['Helleborus × hybridus','forb'],
    rozanne:["Geranium 'Gerwat' ROZANNE",'forb'],
    peony:['Paeonia lactiflora','forb'],
    daylily:['Hemerocallis hybrids','forb'],
    japaneseanemone:['Anemone × hybrida','forb'],
    brunnera:['Brunnera macrophylla','forb'],
    russiansage:['Salvia yangii','forb'],
    shastadaisy:['Leucanthemum × superbum','forb'],
    creepingphlox:['Phlox stolonifera','forb'],
    obedientplant:['Physostegia virginiana','forb'],
    foamflower:['Tiarella cordifolia','forb'],
    grayheadedconeflower:['Ratibida pinnata','forb'],
    blackcohosh:['Actaea racemosa','forb'],
    ladysmantle:['Alchemilla mollis','forb'],
    barrenwort:['Epimedium × versicolor','forb'],
    jerusalemsage:['Phlomis russeliana','forb'],
  };
  for (const k in expected){
    const P=PLANTS[k];
    assert(P, `${k}: high-priority perennial is missing`);
    assertEqual(P.latin, expected[k][0], `${k}: botanical name`);
    assertEqual(P.type, expected[k][1], `${k}: catalog type`);
    assert(Array.isArray(P.bloomMonths)&&P.bloomMonths.length, `${k}: needs real bloom months`);
  }

  for (const k of ['creepingphlox','obedientplant','foamflower','grayheadedconeflower','blackcohosh'])
    assert(PLANTS[k].nativeTo.includes('north-america'), `${k}: North American range`);
  for (const k of ['lentenrose','rozanne','daylily','japaneseanemone','shastadaisy','barrenwort']){
    assertEqual(PLANTS[k].provenance,'hybrid',`${k}: garden hybrid provenance`);
    assertEqual(PLANTS[k].nativeTo.length,0,`${k}: garden hybrid has no wild native range`);
  }
  for (const k of ['peony','brunnera','russiansage','jerusalemsage'])
    assert(PLANTS[k].nativeTo.includes('asia'), `${k}: Asian range`);
  assert(PLANTS.ladysmantle.nativeTo.includes('europe')&&PLANTS.ladysmantle.nativeTo.includes('asia'),
    "lady's mantle records its southeastern European and western Asian range");

  for (const v of ['sarahbernhardt','karlrosenfield','duchessedenemours'])
    assert(PLANTS.peony.cv[v], `peony.${v}: starter cultivar`);
  for (const v of ['stelladeoro','happyreturns','catherinewoodbery'])
    assert(PLANTS.daylily.cv[v], `daylily.${v}: starter cultivar`);
  for (const ref of [
    ['japaneseanemone','honorinejobert'], ['brunnera','jackfrost'],
    ['russiansage','bluespire'], ['russiansage','littlespire'],
    ['shastadaisy','becky'], ['creepingphlox','sherwoodpurple'],
    ['obedientplant','missmanners'], ['obedientplant','pinkmanners'], ['barrenwort','sulphureum'],
  ]) assert(PLANTS[ref[0]].cv[ref[1]], `${ref[0]}.${ref[1]}: starter cultivar`);
  assertEqual(PLANTS.russiansage.cv.bluespire.provenance,'hybrid','Blue Spire keeps its hybrid ancestry');
  assertEqual(PLANTS.russiansage.cv.bluespire.nativeTo.length,0,'Blue Spire has no wild native range');
  assertEqual(PLANTS.russiansage.cv.littlespire.provenance,'selection','Little Spire remains a Salvia yangii selection');
  assertEqual(PLANTS.grayheadedconeflower.group,'ratibida','gray-headed coneflower shares the Ratibida picker');
  assertEqual(PLANTS.mexicanhat.group,'ratibida','Mexican hat shares the Ratibida picker');
  assertEqual(PLANTS.peony.look.flowerStyle,'double','peony keeps its large double-flower silhouette');
  assertEqual(PLANTS.daylily.look.flowerStyle,'daylily','daylily keeps open six-tepal flowers instead of yucca bells');
  assert(PLANTS.lentenrose.look.floretR>2.5,'hellebore flowers stay visible above the evergreen leaf mound');
  assert(PLANTS.creepingphlox.roles.includes('groundcover')&&PLANTS.creepingphlox.roles.includes('matrix'),
    'creeping phlox stays discoverable as a woodland groundcover matrix');
  assert(PLANTS.foamflower.roles.includes('groundcover')&&PLANTS.foamflower.roles.includes('matrix'),
    'foamflower stays discoverable as a woodland groundcover matrix');
  assertEqual(PLANTS.creepingphlox.zones[0],5,'straight creeping phlox keeps its conservative species hardiness');
  assertEqual(PLANTS.creepingphlox.cv.sherwoodpurple.zones[0],2,'Sherwood Purple keeps its exact colder cultivar range');
  assertEqual(PLANTS.foamflower.zones[0],4,'foamflower keeps its verified species hardiness');
  assert(PLANTS.brunnera.nativeTo.includes('europe')&&PLANTS.brunnera.nativeTo.includes('asia'),
    'brunnera records its trans-Caucasian European and Asian range');
});

test('second-wave perennial staples keep exact lineages, origins, and morphology', () => {
  const expected = {
    bleedingheart:['Lamprocapnos spectabilis','forb'],
    lambsear:['Stachys byzantina','forb'],
    redhotpoker:['Kniphofia hybrids','forb'],
    orientalpoppy:['Papaver orientale','forb'],
    delphinium:['Delphinium hybrids','forb'],
    spikespeedwell:['Veronica spicata','forb'],
    peachbellflower:['Campanula persicifolia','forb'],
    blanketflower:['Gaillardia aristata','forb'],
    arizonasun:["Gaillardia 'Arizona Sun'",'forb'],
    goatsbeard:['Aruncus dioicus','forb'],
    dianaclarelungwort:["Pulmonaria 'Diana Clare'",'forb'],
    blueensignlungwort:["Pulmonaria 'Blue Ensign'",'forb'],
    sissinghurstlungwort:["Pulmonaria 'Sissinghurst White'",'forb'],
  };
  for (const k in expected){
    const P=PLANTS[k];
    assert(P, `${k}: second-wave perennial is missing`);
    assertEqual(P.latin,expected[k][0],`${k}: botanical name`);
    assertEqual(P.type,expected[k][1],`${k}: catalog type`);
    assert(Array.isArray(P.bloomMonths)&&P.bloomMonths.length,`${k}: needs real bloom months`);
  }

  for (const k of ['bleedingheart','lambsear','orientalpoppy','spikespeedwell','peachbellflower','goatsbeard'])
    assert(PLANTS[k].nativeTo.includes('asia'),`${k}: Asian range`);
  for (const k of ['spikespeedwell','peachbellflower','goatsbeard'])
    assert(PLANTS[k].nativeTo.includes('europe'),`${k}: European range`);
  for (const k of ['blanketflower','goatsbeard'])
    assert(PLANTS[k].nativeTo.includes('north-america'),`${k}: North American range`);
  for (const k of ['redhotpoker','delphinium','arizonasun','blueensignlungwort','sissinghurstlungwort']){
    assertEqual(PLANTS[k].provenance,'hybrid',`${k}: hybrid provenance`);
    assertEqual(PLANTS[k].nativeTo.length,0,`${k}: garden hybrid has no wild range`);
  }
  assertEqual(PLANTS.dianaclarelungwort.provenance,'hybrid','Diana Clare keeps its unresolved garden lineage');
  assertEqual(PLANTS.dianaclarelungwort.nativeTo.length,0,'Diana Clare does not inherit a disputed species range');

  const cultivars = {
    bleedingheart:['alba','goldheart'],
    lambsear:['bigears','silvercarpet'],
    redhotpoker:['royalstandard','beessunset'],
    orientalpoppy:['beautyoflivermere','pattysplum'],
    delphinium:['blackknight','bluebird'],
    spikespeedwell:['glory','icicle','rotfuchs'],
    peachbellflower:['telhambeauty','alba'],
    goatsbeard:['kneiffii'],
  };
  for (const k in cultivars) for (const v of cultivars[k])
    assert(PLANTS[k].cv[v],`${k}.${v}: starter cultivar`);

  assertEqual(PLANTS.bleedingheart.look.archStyle,'bleedingHeart','bleeding heart keeps heart-shaped flowers');
  assertEqual(PLANTS.redhotpoker.look.spikeStyle,'poker','Kniphofia keeps a bicolor torch');
  assertEqual(PLANTS.delphinium.look.spikeStyle,'delphinium','delphinium keeps an open-floret raceme');
  assertEqual(PLANTS.delphinium.cv.blackknight.latin,'Delphinium Black Knight Group',
    'Black Knight keeps its accepted Pacific-hybrid group identity');
  assertEqual(PLANTS.delphinium.cv.bluebird.latin,"Delphinium 'Blue Bird'",
    'Blue Bird does not inherit the wrong Elatum Group identity');
  assertEqual(PLANTS.peachbellflower.look.spikeStyle,'bell','Campanula keeps pendant open bells');
  assertEqual(PLANTS.orientalpoppy.look.rays,4,'Oriental poppy keeps four broad petals');
  assertEqual(PLANTS.orientalpoppy.look.rayShape,'poppy','Oriental poppy keeps basal blotches instead of daisy rays');
  assertEqual(PLANTS.lambsear.cv.silvercarpet.look.scapes,0,'Silver Carpet stays effectively non-flowering');
  assert(PLANTS.dianaclarelungwort.look.spots>0&&PLANTS.sissinghurstlungwort.look.spots>0,
    'spotted lungwort foliage stays visually distinct');
  assertEqual(PLANTS.blanketflower.group,'gaillardia','straight and hybrid blanket flowers share a picker');
  assertEqual(PLANTS.arizonasun.group,'gaillardia','Arizona Sun stays a separate exact hybrid in the picker');
  for (const k of ['dianaclarelungwort','blueensignlungwort','sissinghurstlungwort'])
    assertEqual(PLANTS[k].group,'lungwort',`${k}: exact lungwort records share a picker`);
});

test('landscape shrub expansion keeps botanical identity and grouping', () => {
  const expected = {
    ninebark:      ['Physocarpus opulifolius', true],
    redtwig:       ['Cornus sericea', true],
    arrowwood:     ['Viburnum dentatum', true],
    cranberrybush: ['Viburnum opulus var. americanum', true],
    koreanspice:   ['Viburnum carlesii', false],
    doublefile:    ['Viburnum plicatum f. tomentosum', false],
    blackhaw:      ['Viburnum prunifolium', true],
    lilac:         ['Syringa vulgaris', false],
    misskimlilac:  ["Syringa pubescens subsp. patula 'Miss Kim'", false],
    bloomeranglilac:['Syringa \'Penda\'', false],
    japanesespirea:['Spiraea japonica', false],
    bridalwreath:  ['Spiraea x vanhouttei', false],
    winterberry:   ['Ilex verticillata', true],
    chokeberry:    ['Aronia melanocarpa', true],
    inkberry:      ['Ilex glabra', true],
  };
  for (const k in expected){
    const P = PLANTS[k];
    assert(P, `${k}: landscape shrub is missing`);
    assertEqual(P.latin, expected[k][0], `${k}: botanical name`);
    assertEqual(P.type, 'shrub', `${k}: must remain a shrub`);
    assertEqual(P.nativeTo.includes('north-america'), expected[k][1],
      `${k}: native status — the garden exotics must not be sold as North American natives`);
  }
  for (const k of ['arrowwood','cranberrybush','koreanspice','doublefile','blackhaw'])
    assertEqual(PLANTS[k].group, 'viburnum', `${k}: the viburnums share one tray button`);
  for (const k of ['lilac','misskimlilac','bloomeranglilac'])
    assertEqual(PLANTS[k].group, 'lilac', `${k}: the lilacs share one tray button`);
  for (const k of ['japanesespirea','bridalwreath'])
    assertEqual(PLANTS[k].group, 'spirea', `${k}: the spireas share one tray button`);
});

test('high-priority transatlantic shrub gaps are complete and morphology-led', () => {
  const expected=[
    'catawbarhododendron','swampazalea','bonicarose','forsythia','weigela','mockorange','cinquefoil',
    'americanelder','europeanelder','commonwitchhazel','arnoldwitchhazel','summersweet',
    'virginiasweetspire','buttonbush','fothergilla','beautyberry','choisya','japanesecamellia',
    'williamscamellia','skimmia','pieris','blueholly','mountainlaurel','photinia','laurustinus',
    'cherrylaurel','portugueselaurel','hebe','sweetbox',
  ];
  for (const k of expected){
    const P=PLANTS[k];
    assert(P,`${k}: high-priority shrub is missing`);
    assertEqual(P.type,'shrub',`${k}: catalog type`);
    assertEqual(P.form,'bush',`${k}: shared woody shrub renderer`);
    assert(P.look&&P.look.art2,`${k}: authored morphology is required`);
    assert(P.heightIn>0&&P.spread>0&&P.grow>0,`${k}: real woody size data`);
  }
  const styles=new Set(expected.map(k=>PLANTS[k].look.bloomStyle).filter(Boolean));
  for (const style of ['bareStem','truss','rose','stemAxil','looseCluster','scattered','flatCorymb',
    'raceme','droopingRaceme','bottlebrush','globe','pendantRaceme','shortSpike'])
    assert(styles.has(style),`shared shrub morphology includes ${style}`);
  assertEqual(PLANTS.beautyberry.look.seedAlong,true,'beautyberry fruits in collars along its stems');
  assertEqual(PLANTS.photinia.look.newGrowth,'#c33d36','Red Robin carries a red shoot-tip cue');
  assertEqual(PLANTS.pieris.look.habit,'layered','pieris retains layered evergreen architecture');
  assertEqual(PLANTS.americanelder.look.compound,'pinnate','elderberry does not render as simple-leaved viburnum');
});

test('new shrubs have a restrained set of size- or appearance-distinct cultivars', () => {
  const expected={
    forsythia:'courtasol', weigela:'alexandra', mockorange:'snowbelle', cinquefoil:'abbotswood',
    europeanelder:'eva', commonwitchhazel:'littlesuzie', summersweet:'hummingbird',
    virginiasweetspire:'sprich', buttonbush:'smcoss', fothergilla:'bluemist', choisya:'londaz',
    japanesecamellia:'nucciosgem', skimmia:'temptation', pieris:'cavatine',
    mountainlaurel:'minuet', laurustinus:'eveprice', cherrylaurel:'ottoluyken',
    hebe:'andersoniivariegata',
  };
  for (const [k,v] of Object.entries(expected)){
    const C=PLANTS[k]&&PLANTS[k].cv&&PLANTS[k].cv[v];
    assert(C,`${k}.${v}: curated cultivar is missing`);
    assert(C.heightIn>0&&C.spread>0,`${k}.${v}: exact mature size`);
  }
  assert(PLANTS.littleredrobinphotinia,'Little Red Robin stays a standalone exact cultivar record');
  assertEqual(PLANTS.littleredrobinphotinia.group,'photinia','both exact photinia cultivars share one tray family');
  assertEqual(PLANTS.mockorange.cv.snowbelle.provenance,'hybrid','Snowbelle does not inherit a species range');
  assertEqual(PLANTS.mockorange.cv.snowbelle.nativeTo.length,0,'Snowbelle has no wild native range');
  assertEqual(PLANTS.choisya.cv.londaz.provenance,'hybrid','White Dazzler records its hybrid parentage');
  assertEqual(PLANTS.choisya.cv.londaz.nativeTo.length,0,'White Dazzler has no wild native range');
});

test('audited shrub sizes pin the former inheritance errors', () => {
  const size=(k,v)=>{ const P=v?PLANTS[k].cv[v]:PLANTS[k]; return [P.heightIn,P.spread]; };
  assertEqual(size('ninebark','summerwine').join(','),'60,60','Summer Wine mature size');
  assertEqual(size('smokebush').join(','),'144,144','straight smokebush mature size');
  assertEqual(size('smokebush','younglady').join(','),'60,60','Young Lady mature size');
  assertEqual(size('panniclehydrangea').join(','),'120,96','panicle hydrangea species size');
  assertEqual(size('panniclehydrangea','bobo').join(','),'34,42','Bobo mature size');
  assertEqual(size('oakleafhydrangea').join(','),'84,84','oakleaf hydrangea species size');
  assertEqual(size('oakleafhydrangea','peewee').join(','),'42,36','Pee Wee mature size');
});

test('new shrub ranges and horticultural provenance remain relational', () => {
  for (const k of ['catawbarhododendron','swampazalea','americanelder','commonwitchhazel',
    'summersweet','virginiasweetspire','buttonbush','fothergilla','beautyberry','mountainlaurel'])
    assert(PLANTS[k].nativeTo.includes('north-america'),`${k}: North American range`);
  for (const k of ['bonicarose','forsythia','arnoldwitchhazel','williamscamellia','blueholly','photinia','hebe']){
    assertEqual(PLANTS[k].provenance,'hybrid',`${k}: garden hybrid provenance`);
    assertEqual(PLANTS[k].nativeTo.length,0,`${k}: garden hybrid has no wild native range`);
  }
  assert(['north-america','europe','asia'].every(r=>PLANTS.cinquefoil.nativeTo.includes(r)),'cinquefoil records its circumboreal range');
  assert(['europe','asia'].every(r=>PLANTS.cherrylaurel.nativeTo.includes(r)),'cherry laurel records Europe and Asia');
  assert(['europe','africa'].every(r=>PLANTS.laurustinus.nativeTo.includes(r)),'laurustinus records Europe and North Africa');
  assert(PLANTS.choisya.nativeTo.includes('north-america')&&PLANTS.choisya.nativeTo.includes('central-america'),'Choisya records Mexico within both broad origin views');
});

/* Months -> the season slot the renderer would have to paint for that bloom to
   show up in the garden.  Bloom Calendar columns are real calendar months. */
const BLOOM_MONTH_SEASON = {
  3:'Spring',  4:'Spring',  5:'Spring',
  6:'Summer',  7:'Summer',  8:'Summer',
  9:'Fall',   10:'Fall',   11:'Fall',
  12:'Winter', 1:'Winter',  2:'Winter',
};
/* Every species with bloom months must paint a bloom colour in a matching
   season, or the Bloom Calendar promises a flower the garden never renders.
   (The four grasses/sedges that once painted only a `seed` seedhead —
   bluegrama, northernseaoats, graysedge, mountainsedge — have since been
   fixed, so this contract now covers the whole catalog with no exceptions.) */

test('requested perennial gaps keep exact taxa, lineage and grouping', () => {
  const expected = {
    easternbluestar:['Amsonia tabernaemontana','amsonia'],
    fringedbluestar:['Amsonia ciliata','amsonia'],
    scarletbeebalm:['Monarda didyma','monarda'],
    easternbeebalm:['Monarda bradburiana','monarda'],
    lemonbeebalm:['Monarda citriodora','monarda'],
    giantironweed:['Vernonia gigantea subsp. gigantea','ironweed'],
    narrowleafironweed:['Vernonia lettermannii','ironweed'],
    swansongironweed:["Vernonia 'Summer's Swan Song'",'ironweed'],
    bigflowertickseed:['Coreopsis grandiflora','coreopsis'],
  };
  for (const [key,[latin,group]] of Object.entries(expected)){
    const P = PLANTS[key];
    assert(P, `${key}: requested species missing`);
    assertEqual(P.latin,latin,`${key}: exact Latin`);
    assertEqual(P.group,group,`${key}: joins the existing family card`);
    assert(Array.isArray(P.bloomMonths) && P.bloomMonths.length,`${key}: needs calendar months`);
  }
  // Amsonia illustris IS A. tabernaemontana var. illustris. It was already in
  // the catalog under its accepted name, so the request for the variety is a
  // synonym to index, never a second base record for one taxon.
  assert((PLANTS.ozarkamsonia.synonyms||[]).includes('Amsonia tabernaemontana var. illustris'),
    'Ozark bluestar indexes the tabernaemontana varietal synonym');
  assertEqual(PLANTS.ozarkamsonia.latin,'Amsonia illustris','accepted name stays canonical');

  // Bradbury's is the early bee balm and the whole reason to grow it; if it
  // ever shares fistulosa's window the group has lost its sequence.
  assert(Math.min(...PLANTS.easternbeebalm.bloomMonths) < Math.min(...PLANTS.monarda.bloomMonths),
    'eastern bee balm opens before wild bergamot');
  // Lettermann's ironweed is the fine-textured one: it must not inherit the
  // prairie species' coarse leaf or there is no reason for it to exist.
  assert(PLANTS.narrowleafironweed.look.leaves > PLANTS.prairieironweed.look.leaves * 2 &&
         PLANTS.narrowleafironweed.look.leafW < PLANTS.prairieironweed.look.leafW * 0.5,
    'narrowleaf ironweed keeps its threadleaf foliage');
  assert(PLANTS.giantironweed.h > PLANTS.narrowleafironweed.h * 2,
    'giant ironweed towers over the narrowleaf one');
});

test('named hybrids among the new perennials never claim a wild range', () => {
  const hybrids = [['swansongironweed',null],['echinacea','tikitorch'],
                   ['echinacea','cheyennespirit'],['scarletbeebalm','marshallsdelight'],
                   ['japanesepaintedfern','ghost']];
  for (const [s,v] of hybrids){
    const D = v ? PLANTS[s].cv[v] : PLANTS[s];
    assert(D, `${s}|${v}: missing`);
    assertEqual(D.provenance,'hybrid',`${s}|${v}: hybrid lineage`);
    assertEqual(D.nativeTo.length,0,`${s}|${v}: no asserted wild range`);
  }
  // The straight species around them must NOT get swept up in that.
  assertEqual(PLANTS.narrowleafironweed.provenance,'species','Lettermann is a straight species');
  assert(PLANTS.narrowleafironweed.nativeTo.includes('north-america'),'and a North American native');
  // Orange coneflowers are garden hybrids, so they must carry their own Latin
  // rather than inheriting E. purpurea from the base record.
  for (const v of ['tikitorch','cheyennespirit'])
    assert(PLANTS.echinacea.cv[v].latin && PLANTS.echinacea.cv[v].latin !== PLANTS.echinacea.latin,
      `${v}: hybrid coneflower states its own name`);
});

test('the fern cabinet is data-driven, not one plant in many colours', () => {
  const ferns = keys.filter(k => PLANTS[k].form === 'fern');
  assert(ferns.length >= 18, `only ${ferns.length} ferns`);
  for (const k of ferns){
    const P = PLANTS[k];
    assertEqual(P.type,'forb',`${k}: ferns are forbs`);
    assertEqual(P.sun,'part',`${k}: ferns belong to the shade category`);
    assert(P.look && P.look.art2,`${k}: fern needs the ART2 look`);
    assert(!P.bloomMonths,`${k}: ferns do not flower`);
  }
  // The renderer knobs only earn their place if the species actually differ.
  // Two fronds-and-cut signatures colliding means a species was authored by
  // copying another and changing the colour, which is the thing this replaced.
  const sig = new Map();
  for (const k of ferns){
    const L = P => [P.frondStyle||'pinnate',P.fronds||9,P.spread||1.9,P.arch||0.55,
                    P.reach||0.8,P.pinnaN||6,P.pinnaLen||4.2,P.pinnaW||1.1].join('/');
    const s = L(PLANTS[k].look);
    assert(!sig.has(s),`${k}: identical frond geometry to ${sig.get(s)}`);
    sig.set(s,k);
  }
  // Architecture the knobs exist to express, pinned by the species that need it.
  assertEqual(PLANTS.hartstonguefern.look.frondStyle,'strap',"hart's tongue is undivided");
  assertEqual(PLANTS.newyorkfern.look.taper,'both','New York fern tapers at both ends');
  assert(PLANTS.maidenhairfern.look.arch > 1 && PLANTS.maidenhairfern.look.stipe,
    'maidenhair is a flat fan on a dark wiry stipe');
  assertEqual(PLANTS.cinnamonfern.look.fertileStyle,'spike','cinnamon fern has its cinnamon clubs');
  assertEqual(PLANTS.sensitivefern.look.fertileStyle,'bead','sensitive fern keeps its bead sticks');
  // A fertile treatment draws from sea.seed, so authoring one without a seed
  // colour is a knob that silently does nothing.
  for (const k of ferns){
    const L = PLANTS[k].look;
    if (!L.fertileStyle) continue;
    const S = PLANTS[k].sea;
    assert(SEASON_KEYS.some(s => S[s] && S[s].seed),
      `${k}: declares fertileStyle but no season gives it a seed colour`);
  }
});

test('evergreen ferns hold winter foliage and deciduous ones hold structure', () => {
  // Winter must show something. For a fern that means either evergreen fronds
  // or the persistent fertile stalk — a fern with neither is a bare tile.
  const evergreen = ['christmasfern','marginalwoodfern','autumnfern','malefern',
                     'softshieldfern','hartstonguefern','hollyfern'];
  for (const k of evergreen)
    assert(PLANTS[k].sea.Winter && PLANTS[k].sea.Winter.fol,`${k}: evergreen fern needs winter foliage`);
  const structural = ['ostrichfern','cinnamonfern','royalfern','interruptedfern','sensitivefern'];
  for (const k of structural){
    assert(PLANTS[k].sea.Winter && PLANTS[k].sea.Winter.seed,`${k}: needs its winter fertile structure`);
    assert(PLANTS[k].look.fertileStyle,`${k}: and a treatment to draw it with`);
  }
});
test('every species blooming in the calendar also blooms in a season slot', () => {
  for (const k of keys){
    const P = PLANTS[k];
    if (!Array.isArray(P.bloomMonths) || !P.bloomMonths.length) continue;
    const want = [...new Set(P.bloomMonths.map(m => BLOOM_MONTH_SEASON[m]))];
    const painted = want.filter(s => P.sea && P.sea[s] && P.sea[s].bloom);
    assert(painted.length,
      `${k}: blooms in months [${P.bloomMonths}] but no bloom colour in sea.${want.join('/')} — ` +
      `the calendar promises a flower the garden never shows`);
  }
});

test('winter-stem shrubs declare a twig colour', () => {
  const hex = c => ({ r:parseInt(c.slice(1,3),16), g:parseInt(c.slice(3,5),16), b:parseInt(c.slice(5,7),16) });
  const speciesTwig = PLANTS.redtwig.sea.Winter.twig;
  assert(typeof speciesTwig === 'string' && speciesTwig[0] === '#',
    'red-twig dogwood needs a winter twig colour — bare red stems are the whole reason to plant it');
  const yellowTwig = PLANTS.redtwig.cv.flaviramea.sea.Winter.twig;
  assert(typeof yellowTwig === 'string' && yellowTwig[0] === '#',
    "'Flaviramea' needs its own winter twig colour");
  assert(yellowTwig !== speciesTwig, "'Flaviramea' must not inherit the species red");
  const sp = hex(speciesTwig), fl = hex(yellowTwig);
  assert(fl.g - fl.b > 60, `'Flaviramea' should read yellow, not red (${yellowTwig})`);
  assert(sp.g - sp.b < 40, `the straight species should read red, not yellow (${speciesTwig})`);
  assert(fl.g > sp.g + 60, 'the yellow-twig should be visibly lighter-stemmed than the red-twig');
  const ninebarkTwig = Object.values(PLANTS.ninebark.sea).map(s => s.twig).filter(Boolean);
  assert(ninebarkTwig.length, 'ninebark needs a twig colour for its peeling winter bark');
});

test('clipped evergreen shrubs do not claim a bloom in the calendar', () => {
  const clipped = keys.filter(k => PLANTS[k].look && PLANTS[k].look.clip);
  assert(clipped.length >= 9, `expected the clipped evergreens, got ${clipped.length}`);
  for (const k of ['inkberry','boxwoodround','yewlow'])
    assert(clipped.includes(k), `${k}: should be a clipped evergreen`);
  for (const k of clipped)
    assert(!PLANTS[k].bloomMonths,
      `${k}: clipped evergreens have no bloom pass in the renderer, so they must not list bloom months`);
});

/* ---------- Wikipedia references ---------- */

test('every species carries a Wikipedia article, and every one is well formed', () => {
  /* Resolved and verified against the API by dev/wikipedia-links.js, never
     built from `latin` — roughly one species in ten has no article under its
     own binomial. Cultivars and Groups have none at all, reclassified taxa are
     filed under a newer genus (Calylophus berlandieri -> Oenothera
     berlandieri), and a genus that doubles as a given name resolves to a
     disambiguation page (Rosa -> Rose, Veronica -> Veronica (plant)). This
     pins the SHAPE; only the tool can re-check that the articles still exist. */
  const missing = [], malformed = [];
  for (const k of keys){
    const links = PLANTS[k].externalLinks;
    const url = links && links.wikipedia;
    if (!url){ missing.push(k); continue; }
    const m = /^https:\/\/en\.wikipedia\.org\/wiki\/(\S+)$/.exec(url);
    if (!m){ malformed.push(`${k}: ${url}`); continue; }
    const title = m[1];
    if (title.length < 3) malformed.push(`${k}: article title too short (${title})`);
    // A raw space would break the link; the table stores titles and the loop
    // that copies it over PLANTS is the only place that encodes them.
    if (/\s/.test(title)) malformed.push(`${k}: unencoded space in ${title}`);
  }
  assert(!malformed.length, 'malformed Wikipedia links:\n  ' + malformed.join('\n  '));
  assert(!missing.length,
    `${missing.length} species have no Wikipedia article: ${missing.slice(0, 8).join(', ')}` +
    ' - run `node dev/wikipedia-links.js --write`');
});

test('the article table has no entry for a species that no longer exists', () => {
  /* Same failure BLOOM_MONTHS can have: a key that was renamed or removed
     leaves a row behind that silently does nothing, and the next reader
     assumes the plant is covered. */
  const table = typeof WIKIPEDIA_ARTICLES !== 'undefined' ? WIKIPEDIA_ARTICLES : null;
  assert(table, 'plants.js defines WIKIPEDIA_ARTICLES');
  const orphans = Object.keys(table).filter(k => !PLANTS[k]);
  assert(!orphans.length, `WIKIPEDIA_ARTICLES has rows for unknown species: ${orphans.join(', ')}`);
  for (const [k, title] of Object.entries(table)){
    assert(typeof title === 'string' && title.trim().length >= 3,
      `${k}: article title is not a usable string`);
    assert(!/^https?:/.test(title),
      `${k}: store the article TITLE, not a URL - the loop builds the URL`);
  }
});
