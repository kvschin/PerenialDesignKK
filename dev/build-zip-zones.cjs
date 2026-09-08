'use strict';
/* Build the offline lookup from the four unmodified OSU/PRISM CSV downloads.
   No network access. Usage: node dev/build-zip-zones.cjs <csv-dir> YYYY-MM-DD
   Source/terms and update instructions: docs/zone-lookup.md. */
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const input=process.argv[2], retrieved=process.argv[3];
if (!input || !/^\d{4}-\d{2}-\d{2}$/.test(retrieved||'')){
  console.error('Usage: node dev/build-zip-zones.cjs <csv-directory> YYYY-MM-DD');
  process.exit(1);
}
const source='https://prism.oregonstate.edu/phzm/';
const groups={}, seen=new Set(), sources=[];
for (const region of ['us','ak','hi','pr']){
  const filename=`phzm_${region}_zipcode_2023.csv`, raw=fs.readFileSync(path.join(input,filename));
  const lines=raw.toString('utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/);
  if (lines.shift()!=='zipcode,zone,trange,zonetitle') throw Error(filename+': unexpected CSV header');
  for (const line of lines){
    const fields=line.split(','), [zip,zone,trange,title]=fields;
    if (fields.length!==4 || !/^\d{5}$/.test(zip) || !/^(?:[1-9]|1[0-3])[ab]$/.test(zone)) throw Error(filename+': invalid row '+line);
    const low=parseInt(zone,10)*10-70+(zone.endsWith('b')?5:0), expected=low+' to '+(low+5);
    if (trange!==expected || title!==zone+': '+expected) throw Error(filename+': inconsistent temperature for '+zip);
    if (seen.has(zip)) throw Error('Duplicate ZIP '+zip);
    seen.add(zip); (groups[zone]||(groups[zone]=[])).push(zip);
  }
  sources.push({url:source+'data/2023/'+filename,rows:lines.length,
    sha256:crypto.createHash('sha256').update(raw).digest('hex')});
}
const zones={};
for(let z=1;z<=13;z++) for(const half of ['a','b']){
  const key=z+half; if(groups[key]) zones[key]=groups[key].sort().join('');
}
const data={format:1,edition:2023,retrieved,source,owner:'Oregon State University',
  count:seen.size,sources,zones};
const out=path.resolve(__dirname,'../data/zip-zones-2023.json');
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(data,null,2)+'\n');
console.log(`${data.count} ZIP codes; ${fs.statSync(out).size} bytes; ${out}`);
