// Disposable read-only audit server. Application sources are served unchanged.
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dev', 'perf-audit-results.jsonl');
const profiles = [{name:'phone',w:390,h:844,dpr:3},{name:'tablet-portrait',w:820,h:1180,dpr:2},{name:'tablet-landscape',w:1180,h:820,dpr:2},{name:'desktop',w:1440,h:900,dpr:1},{name:'large-desktop',w:2560,h:1440,dpr:2}];
const outer = `<!doctype html><title>Local performance audit</title><style>body{margin:0;background:#f3f0e7;font:16px sans-serif}header{padding:8px}iframe{border:0;display:block}</style><header><button id="run">Run viewport audit</button> <span id="status">Ready; isolated test gardens only.</span></header><div id="host"></div><script>
const profiles=${JSON.stringify(profiles)};let i=0;
function next(){ if(i===profiles.length){document.getElementById('status').textContent='Audit complete: '+i+' viewport profiles.';return}const p=profiles[i++];document.getElementById('status').textContent='Testing '+p.name;document.getElementById('host').innerHTML='<iframe width="'+p.w+'" height="'+p.h+'" src="/audit-app?profile='+p.name+'&dpr='+p.dpr+'"></iframe>'}
document.getElementById('run').onclick=()=>{i=0;next()};window.addEventListener('message',e=>{if(e.origin!==location.origin)return;if(e.data==='done')next();else if(e.data&&e.data.status)document.getElementById('status').textContent=e.data.status});</script>`;
http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/results' && req.method==='POST'){
    let b='';req.on('data',d=>b+=d);req.on('end',()=>{fs.appendFileSync(output,b+'\n');res.end('ok')});return;
  }
  if(url.pathname==='/audit'){res.setHeader('Content-Type','text/html');res.end(outer);return}
  if(url.pathname==='/audit-app'){
    let s=fs.readFileSync(path.join(root,'index.html'),'utf8');
    s=s.replace('<head>','<head><script>Object.defineProperty(window,"devicePixelRatio",{value:'+Number(url.searchParams.get('dpr'))+'});localStorage.setItem("hortus:welcomed","1");window.__auditRaf=requestAnimationFrame.bind(window);</script>');
    s=s.replace("if ('serviceWorker' in navigator)","if (false)");
    s=s.replace('</body>','<script src="/dev/perf-audit-runner.js"></script></body>');
    res.setHeader('Content-Type','text/html');res.end(s);return;
  }
  const f=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!f.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
  const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
  fs.readFile(f,(err,b)=>{if(err){res.writeHead(404);res.end();return}res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(b)});
}).listen(8643,'127.0.0.1',()=>console.log('Audit server http://127.0.0.1:8643/audit'));
