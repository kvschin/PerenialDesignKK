const { makeSandbox } = require('../tests/sandbox');
const vm = require('vm');
const sb = makeSandbox(true, {});
vm.createContext(sb);
const probe = src => { try { return vm.runInContext(src, sb); } catch (e) { return 'THREW: ' + e.message; } };

const rows = [
  ['getElementById identity', "document.getElementById('x')===document.getElementById('x')"],
  ['  ...so attributes persist?', "(()=>{const a=document.getElementById('x');a.setAttribute('data-k','1');return document.getElementById('x').getAttribute('data-k');})()"],
  ['unknown element prop', "typeof document.createElement('div').totallyMadeUpProperty"],
  ['  ...is it truthy?', "!!document.createElement('div').totallyMadeUpProperty"],
  ['el.hidden', "!!document.createElement('div').hidden"],
  ['getBoundingClientRect', "JSON.stringify(document.createElement('div').getBoundingClientRect())"],
  ['querySelectorAll', "JSON.stringify(document.querySelectorAll('*'))"],
  ['measureText width', "document.createElement('canvas').getContext('2d').measureText('a very long string').width"],
  ['getImageData length', "document.createElement('canvas').getContext('2d').getImageData(0,0,50,50).data.length"],
  ['setTimeout fires?', "(()=>{let hit=false;setTimeout(()=>{hit=true;},0);return hit;})()"],
  ['setTimeout handle', "JSON.stringify(setTimeout(()=>{},0))"],
  ['  ...handle truthy?', "!!setTimeout(()=>{},0)"],
  ['performance.now advances?', "(()=>{const a=performance.now();for(let i=0;i<1e6;i++);return performance.now()-a;})()"],
  ['matchMedia any query', "matchMedia('(min-width:1px)').matches"],
  ['getComputedStyle value', "JSON.stringify(getComputedStyle(document.body).getPropertyValue('--anything'))"],
  ['requestAnimationFrame fires?', "(()=>{let hit=false;requestAnimationFrame(()=>{hit=true;});return hit;})()"],
  ['localStorage enumerable', "(()=>{localStorage.setItem('a','1');localStorage.setItem('b','2');return localStorage.length+' keys, key(0)='+localStorage.key(0);})()"],
  ['crypto fills buffer', "(()=>{const b=new Uint8Array(8);crypto.getRandomValues(b);return b.some(x=>x!==0);})()"],
  ['canvas default size', "(()=>{const c=document.createElement('canvas');return c.width+'x'+c.height;})()"],
];
for (const [label, src] of rows)
  console.log('  ' + label.padEnd(30) + ' -> ' + String(probe(src)));
