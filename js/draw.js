'use strict';
/* ---------- tiny seeded RNG so each plant clump is unique but stable ---------- */
function mulberry(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0;
  let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

/* ---------- procedural plant renderer ----------
   Draws a species at screen (x,y) given growth 0..1, season, and a stable seed. */
function drawPlant(ctx, x, y, key, growth, season, seed, sway, variant, bloomLvl, detail){
  const P = plantDef(key, variant), S = P.sea[season], rnd = mulberry(seed);
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
  const shadowW = woodyVisualCw(P) || (P.type==='grass' ? (P.spread||P.space||16)*HERB_SCALE : 0);
  const shR = (shadowW ? shadowW*0.42 : 14)*growth + 6;
  drawSoftShadow(ctx,0,3,shR,shR*0.36+1.8,P.cw?0.19:0.15);
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.beginPath(); ctx.ellipse(0, 3, shR*0.58, shR*0.16+1.2, 0, 0, 7); ctx.fill();
  ctx.scale(plantVisualWidthScale(P,key),1);

  const stemFor = (n)=> Math.max(3, Math.round(n * (0.4+0.6*growth)));

  if (P.form === 'bunchgrass'){
    const L=P.look||{}, n = stemFor(L.leaves||13);
    ctx.lineCap='round';
    const drawSedgeSeed=(style,sx,sy,a)=>{
      ctx.fillStyle=S.seed;
      if (style==='mace'){
        ctx.strokeStyle=shade(S.seed,-12); ctx.lineWidth=0.9;
        for (let p=0;p<5;p++){
          const ang=p*Math.PI*0.4+a*0.25;
          ctx.beginPath(); ctx.moveTo(sx,sy);
          ctx.lineTo(sx+Math.cos(ang)*4.6,sy+Math.sin(ang)*4.6); ctx.stroke();
        }
        ctx.beginPath(); ctx.ellipse(sx,sy,3.25,3.25,0,0,7); ctx.fill();
      } else if (style==='brush'){
        ctx.strokeStyle=shade(S.seed,-10); ctx.lineWidth=0.7;
        for (let p=0;p<5;p++){
          const ox=(p-2)*1.25;
          ctx.beginPath(); ctx.moveTo(sx+ox,sy+2.4); ctx.lineTo(sx+ox*1.5,sy-3.6); ctx.stroke();
        }
        ctx.beginPath(); ctx.ellipse(sx,sy,2.15,4.2,a*0.25,0,7); ctx.fill();
      } else if (style==='pendant'){
        const drop=5.4;
        ctx.strokeStyle=shade(S.fol,-12); ctx.lineWidth=0.75;
        ctx.beginPath(); ctx.moveTo(sx,sy-1); ctx.quadraticCurveTo(sx+3.8,sy+1.5,sx+3.2,sy+drop); ctx.stroke();
        ctx.fillStyle=S.seed; ctx.beginPath(); ctx.ellipse(sx+3.2,sy+drop+1.8,1.75,3.6,0.45,0,7); ctx.fill();
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
            ctx.strokeStyle=shade(S.fol,(rnd()-0.5)*(L.colorJitter||18)); ctx.lineWidth=L.leafW||1.75;
            ctx.beginPath(); ctx.moveTo(baseX,y);
            ctx.quadraticCurveTo(baseX+dir*leafLen*0.34,y-leafLen*0.08,tipX,tipY); ctx.stroke();
          }
        }
        if (S.seed && mature && i%2===0) drawSedgeSeed(L.seedStyle,baseX+side*2,-stemH-2,side);
      }
    } else if (L.mound){
      const fan=L.fan||2.15, spread=L.spread||0.68, lift=L.dome||0.68, edgeDrop=L.edgeDrop||0.42;
      const seedEvery=L.seedStems ? Math.max(2,Math.floor(n/L.seedStems)) : 0;
      for (let i=0;i<n;i++){
        const u=n>1?i/(n-1):0.5, side=u-0.5;
        const a=side*fan+(rnd()-0.5)*(L.jitter||0.26);
        const len=H*(L.leafLen||0.86)*(0.78+rnd()*0.26);
        const arc=Math.max(0,1-Math.abs(side)*2);
        const bx=Math.sin(a)*len*spread+sway*len*0.025;
        const by=-len*(lift-edgeDrop*Math.abs(side)*1.35+arc*0.12+(rnd()-0.5)*0.07);
        const baseX=(rnd()-0.5)*(L.baseW||5);
        ctx.strokeStyle = shade(S.fol, (rnd()-0.5)*(L.colorJitter||22));
        ctx.lineWidth = L.leafW||1.2; ctx.beginPath(); ctx.moveTo(baseX,0);
        ctx.quadraticCurveTo(baseX+bx*0.22, -len*0.46, bx, by); ctx.stroke();
        if (S.seed && mature && seedEvery && i%seedEvery===0){
          const sx=baseX+(rnd()-0.5)*4, sy=-H*(0.82+rnd()*0.22);
          ctx.strokeStyle=shade(S.fol,-12); ctx.lineWidth=0.75;
          ctx.beginPath(); ctx.moveTo(baseX,0); ctx.quadraticCurveTo(sx*0.45,-H*0.42,sx,sy); ctx.stroke();
          drawSedgeSeed(L.seedStyle,sx,sy,a);
        }
      }
    } else {
      const fan=L.fan||1.5, spread=L.spread||0.55;
      for (let i=0;i<n;i++){
        const a = (i/(n-1)-0.5)*fan + (rnd()-0.5)*0.3;
        const len = H*(L.leafLen||1)*(0.6+rnd()*0.45);
        const bx = Math.sin(a)*len*spread + sway*len*0.06;
        const by = -Math.cos(a*0.5)*len;
        ctx.strokeStyle = shade(S.fol, (rnd()-0.5)*24);
        ctx.lineWidth = L.leafW||1.4; ctx.beginPath(); ctx.moveTo((rnd()-0.5)*6,0);
        ctx.quadraticCurveTo(bx*0.4, by*0.62, bx, by); ctx.stroke();
        if (S.seed && mature && i%(L.seedEvery||2)===0){ ctx.fillStyle=S.seed;
          ctx.beginPath(); ctx.ellipse(bx,by,2.1,3.4,a,0,7); ctx.fill(); }
      }
    }
  }
  else if (P.form === 'vertgrass'){
    // upright vase (miscanthus/indiangrass/Karl Foerster): blades rise from a
    // tight base and SPLAY outward at the tips, so the clump reads as a real
    // fountain of width, not the pencil it used to be (H2). look.fan tunes the
    // splay (arching miscanthus wide, stiff feather reed narrow).
    const L=P.look||{}, n = stemFor(L.leaves||9), fan=L.fan!==undefined?L.fan:1.25;
    for (let i=0;i<n;i++){
      const a=(i/(n-1)-0.5)*fan+(rnd()-0.5)*0.18, len=H*(0.8+rnd()*0.25);
      const baseX=(rnd()-0.5)*6, tip=baseX+Math.sin(a)*len*0.42+sway*len*0.05;
      ctx.strokeStyle = shade(S.fol,(rnd()-0.5)*20); ctx.lineWidth=1.6;
      ctx.beginPath(); ctx.moveTo(baseX,0); ctx.quadraticCurveTo((baseX+tip)*0.5,-len*0.62,tip,-len); ctx.stroke();
      if (S.seed && mature){ ctx.fillStyle=S.seed;
        ctx.beginPath(); ctx.ellipse(tip,-len-4,2.6,9,a*0.5+sway*0.05,0,7); ctx.fill(); }
    }
  }
  else if (P.form === 'turkeyfoot'){ // big bluestem: very tall, 3-pronged tips
    const bn = stemFor(7); // low basal blades
    for (let i=0;i<bn;i++){ const a=(i/(bn-1)-0.5)*1.5, l=H*0.3;
      ctx.strokeStyle=shade(S.fol,(rnd()-0.5)*24); ctx.lineWidth=1.4;
      ctx.beginPath(); ctx.moveTo(0,0);
      ctx.quadraticCurveTo(Math.sin(a)*l*0.7,-l*0.5,Math.sin(a)*l,-l*0.55); ctx.stroke(); }
    const n = stemFor(8);
    for (let i=0;i<n;i++){
      const ox=(rnd()-0.5)*14, len=H*(0.78+rnd()*0.25), tip=ox+sway*len*0.07;
      ctx.strokeStyle=shade(S.fol,(rnd()-0.5)*22); ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(ox,0); ctx.quadraticCurveTo(ox,-len*0.6,tip,-len); ctx.stroke();
      if (S.seed && mature && i%2===0){ // the turkey foot
        ctx.strokeStyle=S.seed; ctx.lineWidth=1.6;
        for (let p3=-1;p3<=1;p3++){ ctx.beginPath(); ctx.moveTo(tip,-len);
          ctx.lineTo(tip+p3*3.6, -len-6-(p3===0?2.5:0)); ctx.stroke(); }
      }
    }
  }
  else if (P.form === 'cloudgrass'){ // switchgrass/muhly/lovegrass: foliage clump under an airy seed cloud
    const L=P.look||{}, n = stemFor(L.leaves||11);
    const leafFan=L.leafFan||1.3, leafSpread=L.bladeSpread!==undefined?L.bladeSpread:0.6;
    const leafArch=L.leafArch||0.7, leafLean=L.leafLean!==undefined?L.leafLean:0.05;
    ctx.lineCap='round';
    for (let i=0;i<n;i++){ // arching or upright blades
      const u=n>1?i/(n-1):0.5;
      const a=(u-0.5)*leafFan+(rnd()-0.5)*(L.leafJitter||0.2), len=H*(L.leafLen||0.55)*(0.7+rnd()*0.4);
      const bx=Math.sin(a)*len*leafSpread+sway*len*leafLean;
      const by=-len*(L.leafUpright||1);
      ctx.strokeStyle=shade(S.fol,(rnd()-0.5)*24); ctx.lineWidth=L.leafW||1.4;
      ctx.beginPath(); ctx.moveTo((rnd()-0.5)*5,0);
      ctx.quadraticCurveTo(bx*0.4,-len*leafArch,bx,by); ctx.stroke();
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
    const L=P.look||{}, n=stemFor(L.leaves||14);
    for (let i=0;i<n;i++){
      const a=(i/(n-1)-0.5)*(L.fan||1.05)+(rnd()-0.5)*0.16;
      const len=H*(L.leafLen||0.58)*(0.82+rnd()*0.26);
      const bx=Math.sin(a)*len*0.5+sway*len*0.025;
      const by=-len*(0.72+rnd()*0.14);
      ctx.strokeStyle=shade(S.fol,(rnd()-0.5)*18); ctx.lineWidth=1.45; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo((rnd()-0.5)*5,0);
      ctx.quadraticCurveTo(bx*0.28,-len*0.42,bx,by); ctx.stroke();
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
          const py=-len+b*2.0, px=tip+(rnd()-0.5)*2.0;
          ctx.beginPath(); ctx.ellipse(px,py,1.2,1.7,(rnd()-0.5)*0.6,0,7); ctx.fill();
        }
      }
    }
  }
  else if (P.form === 'oatgrass'){ // gramas and sea oats: species-specific one-sided heads
    const L=P.look||{}, n=stemFor(L.leaves||9), leafFan=L.leafFan===undefined?1.4:L.leafFan;
    for (let i=0;i<n;i++){ const a=(i/(n-1)-0.5)*leafFan+(rnd()-0.5)*0.2, len=H*(L.leafLen||0.5)*(0.6+rnd()*0.5);
      const bx=Math.sin(a)*len*(L.leafSpread||0.55)+sway*len*0.05;
      ctx.strokeStyle=shade(S.fol,(rnd()-0.5)*24); ctx.lineWidth=L.leafW||1.3;
      ctx.beginPath(); ctx.moveTo((rnd()-0.5)*5,0);
      ctx.quadraticCurveTo(bx*0.4,-len*0.6,bx,-len); ctx.stroke(); }
    const sn=stemFor(L.stems||5), oat=S.seed||(blooming?S.bloom:null);
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
        for (let s2=0;s2<spikelets;s2++){ const f=0.45+s2*step;
          const px=ox*0.5+(tip-ox*0.5)*f+(L.spikeletSide===undefined?-2.4:L.spikeletSide), py=-len*f;
          ctx.beginPath(); ctx.ellipse(px,py,L.spikeletW||1.9,L.spikeletH||1.1,0.5,0,7); ctx.fill(); }
      }
    }
  }
  else if (P.form === 'fountaingrass'){ // pennisetum: arching blades with bottlebrush plumes
    const L=P.look||{}, n=stemFor(L.leaves||13);
    for (let i=0;i<n;i++){
      const a=(i/(n-1)-0.5)*(L.fan||1.9)+(rnd()-0.5)*0.18, len=H*(L.leafLen||0.54)*(0.7+rnd()*0.45);
      const bx=Math.sin(a)*len*0.78+sway*len*0.06, by=-len*(0.46+rnd()*0.18);
      ctx.strokeStyle=shade(S.fol,(rnd()-0.5)*22); ctx.lineWidth=L.leafW||1.35;
      ctx.beginPath(); ctx.moveTo((rnd()-0.5)*5,0);
      ctx.quadraticCurveTo(bx*0.28,-len*0.72,bx,by); ctx.stroke();
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
          ctx.beginPath();
          ctx.ellipse(tip+(rnd()-0.5)*2,topY-b*2.1,br*0.38,br*0.22,a*0.5,0,7); ctx.fill();
        }
      }
    }
  }
  else if (P.form === 'forestgrass'){ // Hakonechloa: low cascading ribbons for shade
    const L=P.look||{}, n=stemFor(L.leaves||16);
    for (let i=0;i<n;i++){
      const a=(i/(n-1)-0.5)*(L.fan||2.2)+(rnd()-0.5)*0.12, len=H*(L.leafLen||0.7)*(0.72+rnd()*0.34);
      const bx=Math.sin(a)*len*(L.sweep||0.78)+sway*len*0.04;
      const by=-len*((L.tipLift||0.28)+rnd()*0.12);
      const col=shade(S.fol,(rnd()-0.5)*18);
      ctx.strokeStyle=col; ctx.lineWidth=L.leafW||2.2; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo((rnd()-0.5)*5,0);
      ctx.quadraticCurveTo(bx*0.18,-len*(L.arch||0.72),bx,by); ctx.stroke();
      if (L.stripe){
        ctx.strokeStyle=shade(L.stripe,(rnd()-0.5)*12); ctx.lineWidth=Math.max(0.7,(L.leafW||2.2)*0.32);
        ctx.beginPath(); ctx.moveTo((rnd()-0.5)*3,-1);
        ctx.quadraticCurveTo(bx*0.18,-len*(L.arch||0.72),bx,by); ctx.stroke();
      }
    }
    if (S.seed && mature){
      ctx.strokeStyle=shade(S.fol||S.seed,-18); ctx.lineWidth=0.85;
      for (let i=0;i<3;i++){ const ox=(rnd()-0.5)*10, len=H*(0.62+rnd()*0.16), tip=ox+sway*2;
        ctx.beginPath(); ctx.moveTo(ox*0.4,0); ctx.quadraticCurveTo(ox,-len*0.5,tip,-len); ctx.stroke();
        ctx.fillStyle=S.seed; ctx.beginPath(); ctx.ellipse(tip,-len,1.2,3.8,0.2,0,7); ctx.fill(); }
    }
  }
  else if (P.form === 'cone' || P.form === 'globe' || P.form === 'spike' || P.form === 'umbel'){
    const L = P.look||{}; // per-species carriage: leafiness, wispiness, droop
    // basal foliage (skipped in seasons with no foliage color)
    if (S.fol){
      const fn = stemFor(L.leaves||8);
      ctx.strokeStyle = S.fol; ctx.lineWidth = L.leafW||1.8;
      ctx.lineCap = L.leafCap || 'round';
      if (L.leafStyle === 'willow'){
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
    for (let i=0;i<sn;i++){
      const ox=(rnd()-0.5)*(L.stemSpread||14);
      const len=H*((L.lenBase||0.75)+rnd()*(L.lenJitter||0.3));
      const tx=ox+sway*len*0.05+(P.form==='spike'?(rnd()-0.5)*(L.wildLean||0):0);
      ctx.strokeStyle = P.stem || shade(S.fol,-18);
      ctx.lineWidth=1.3; ctx.beginPath(); ctx.moveTo(ox*0.4,0);
      ctx.quadraticCurveTo(ox,-len*0.55,tx,-len); ctx.stroke();
      if (S.fol && L.stemLeaves){
        const leafPairs = Math.max(1, Math.round(L.stemLeaves));
        ctx.strokeStyle = S.fol; ctx.lineWidth = L.stemLeafW || 1;
        ctx.lineCap = 'round';
        for (let lp=0; lp<leafPairs; lp++){
          const f=(lp+1)/(leafPairs+1), px=ox*0.35+(tx-ox*0.35)*f*0.75, py=-len*(0.18+f*0.54);
          const side=((lp+i)%2===0?-1:1), ll=(L.stemLeafLen||7)*(0.8+rnd()*0.35);
          ctx.beginPath(); ctx.moveTo(px,py);
          ctx.quadraticCurveTo(px+side*ll*0.45,py-ll*0.08,px+side*ll,py-ll*0.28);
          ctx.stroke();
        }
        ctx.lineCap = 'butt';
      }
      if (!mature) continue;
      const hx=tx, hy=-len;
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
          ctx.fillStyle=S.seed;
          ctx.beginPath(); ctx.ellipse(cx,cy,(L.seedW||3)*sc,(L.seedH||3.8)*sc,0,0,7); ctx.fill();
        };
        if (headOn){
          for(let h=0; h<headCount; h++){ const o=headOffset(h,headCount); drawConeHead(hx+o.x,hy+o.y,o.s); }
        } else if (S.seed){
          const seedCount = Math.max(1, Math.round(L.seedHeads || Math.min(headCount,3)));
          for(let h=0; h<seedCount; h++){ const o=headOffset(h,seedCount); drawSeedHead(hx+o.x,hy+o.y,o.s); }
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
          ctx.beginPath(); ctx.arc(ghx,ghy,hr,0,7); ctx.fill();
          ctx.strokeStyle=shade(col,-30); ctx.lineWidth=0.7;
          const spokes=L.spokes||6;
          for(let p=0;p<spokes;p++){ const pa=p/spokes*Math.PI*2;
            ctx.beginPath(); ctx.moveTo(ghx,ghy);
            ctx.lineTo(ghx+Math.cos(pa)*hr*1.3,ghy+Math.sin(pa)*hr*1.3); ctx.stroke(); }
          if (L.topknot){
            ctx.fillStyle=L.topknot;
            ctx.beginPath(); ctx.ellipse(ghx, ghy-hr*1.15, hr*0.42, hr*0.28, 0, 0, 7); ctx.fill();
          } }
      }
      else if (P.form==='umbel'){ // flat-to-domed corymb of tiny florets
        const col=(headOn?S.bloom:null)||S.seed;
        if (col){ ctx.fillStyle=col;
          const rad=L.head||6, dome=(L.dome===undefined?0.4:L.dome), dots=Math.round(rad*2);
          for(let d2=0;d2<dots;d2++){ const a2=rnd()*Math.PI*2, rr=Math.sqrt(rnd())*rad;
            ctx.beginPath();
            ctx.ellipse(hx+Math.cos(a2)*rr, hy-rad*dome*0.5-Math.sin(a2)*rr*dome, 1.5,1.3,0,0,7);
            ctx.fill(); } }
      }
      else { // spike
        const col=(headOn?S.bloom:null)||S.seed;
        if (col){
          if (L.spikeStyle==='bell'){
            const bells=Math.max(2,Math.round(L.bellCount||5)), bellW=L.bellW||2.8, bellH=L.bellH||4.2;
            for(let b=0;b<bells;b++){
              const side=b%2?-1:1, rootY=hy+b*bellH*0.8, bx=hx+side*(L.bellLean||2.6), by=rootY+bellH*0.36;
              ctx.strokeStyle=shade(S.fol||col,-24); ctx.lineWidth=0.85;
              ctx.beginPath(); ctx.moveTo(hx,rootY-1); ctx.quadraticCurveTo(hx+side*1.4,rootY,bx,by-bellH*0.36); ctx.stroke();
              ctx.fillStyle=shade(col,(rnd()-0.5)*16);
              ctx.beginPath(); ctx.ellipse(bx,by,bellW,bellH,side*0.18,0,7); ctx.fill();
              ctx.fillStyle=shade(col,22);
              ctx.beginPath(); ctx.ellipse(bx+side*bellW*0.22,by+bellH*0.26,bellW*0.62,bellH*0.28,side*0.16,0,7); ctx.fill();
            }
          } else if (L.spikeStyle==='goldenrodPanicle'){
            const panicles=Math.max(3,Math.round(L.panicles||6)), dots=Math.max(3,Math.round(L.panicleDots||6));
            for(let p=0;p<panicles;p++){
              const u=panicles===1?0.5:p/(panicles-1), side=p%2?-1:1;
              const baseY=hy+u*H*0.30, reach=(L.panicleSpread||13)*(0.58+rnd()*0.42);
              const endX=hx+side*reach, endY=baseY+(L.panicleDrop||6)*(0.55+rnd()*0.45);
              ctx.strokeStyle=shade(S.fol||col,-22); ctx.lineWidth=0.8;
              ctx.beginPath(); ctx.moveTo(hx,baseY); ctx.quadraticCurveTo(hx+side*reach*0.52,baseY-1,endX,endY); ctx.stroke();
              ctx.fillStyle=shade(col,(rnd()-0.5)*16);
              for(let d=0;d<dots;d++){
                const f=0.38+d/(dots-1)*0.62, px=hx+(endX-hx)*f+(rnd()-0.5)*2.2, py=baseY+(endY-baseY)*f+(rnd()-0.5)*2.2;
                ctx.beginPath(); ctx.arc(px,py,1.15+(rnd()*0.35),0,7); ctx.fill();
              }
            }
          } else if (L.spikeStyle==='liatris'){
            const spikeLen=L.spikeLen||18, florets=Math.max(3,Math.round(L.florets||8));
            const dense=L.dense||1, capW=L.capW||2.3, capH=L.capH||2.8;
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
          } else {
            ctx.fillStyle=col;
            for(let s=0;s<5;s++){ ctx.beginPath();
              ctx.ellipse(hx+(rnd()-0.5)*1.5, hy+s*3.2, 1.8,2.2,0,0,7); ctx.fill(); }
          }
        }
      }
    }
  }
  else if (P.form === 'bractstack'){ // spotted bee balm: stacked bracts with small spotted tubes
    const L=P.look||{};
    if (S.fol){
      const n=stemFor(L.leaves||8);
      ctx.strokeStyle=S.fol; ctx.lineWidth=L.leafW||1.4;
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
          ctx.fillStyle=shade(br,(rnd()-0.5)*16);
          for(let b=-2;b<=2;b++){
            ctx.beginPath(); ctx.ellipse(tip+b*w*0.28,y+(Math.abs(b)%2)*1.5,w*0.22,2.1,b*0.2,0,7); ctx.fill();
          }
        }
        const col=(blooming?S.bloom:null)||S.seed;
        if (col){
          ctx.fillStyle=col;
          for(let f=0;f<5;f++){
            ctx.beginPath(); ctx.ellipse(tip+(rnd()-0.5)*w,y-2-rnd()*3,1.2,1.8,0,0,7); ctx.fill();
          }
          if (blooming && S.eye){
            ctx.fillStyle=S.eye;
            for(let d=0;d<3;d++){ ctx.beginPath(); ctx.arc(tip+(rnd()-0.5)*w,y-2-rnd()*3,0.45,0,7); ctx.fill(); }
          }
        }
      }
    }
  }
  else if (P.form === 'pincushion'){ // scabiosa: wiry stems and pincushion disks
    const L=P.look||{};
    if (S.fol){
      const n=stemFor(L.leaves||7);
      ctx.strokeStyle=S.fol; ctx.lineWidth=L.leafW||1.1;
      for(let i=0;i<n;i++){
        const a=(i/(n-1)-0.5)*1.7+(rnd()-0.5)*0.2, l=H*(L.leafLen||0.3);
        ctx.beginPath(); ctx.moveTo(0,0);
        ctx.quadraticCurveTo(Math.sin(a)*l*0.5,-l*0.5,Math.sin(a)*l,-l*0.52); ctx.stroke();
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
        ctx.fillStyle=col;
        ctx.beginPath(); ctx.ellipse(tip,-len,r,r*0.78,0,0,7); ctx.fill();
        ctx.strokeStyle=shade(col,-25); ctx.lineWidth=0.7;
        for(let p=0;p<8;p++){ const pa=p/8*Math.PI*2;
          ctx.beginPath(); ctx.moveTo(tip,-len);
          ctx.lineTo(tip+Math.cos(pa)*r*1.1,-len+Math.sin(pa)*r*0.82); ctx.stroke(); }
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
    const L = P.look||{};
    if (S.fol){ const fn=stemFor(7); // low pinnate basal foliage
      ctx.strokeStyle=S.fol; ctx.lineWidth=1.3;
      for(let i=0;i<fn;i++){ const a=(i/(fn-1)-0.5)*1.8, l=H*0.26;
        ctx.beginPath(); ctx.moveTo(0,0);
        ctx.quadraticCurveTo(Math.sin(a)*l*0.7,-l*0.5,Math.sin(a)*l,-l*0.55); ctx.stroke(); } }
    const sn=stemFor(L.stems||7);
    for(let i=0;i<sn;i++){
      const ox=(rnd()-0.5)*17, len=H*(0.65+rnd()*0.4), tip=ox+sway*len*0.09;
      ctx.strokeStyle=shade(S.fol||'#6b6248',-14); ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(ox*0.3,0); ctx.quadraticCurveTo(ox,-len*0.6,tip,-len); ctx.stroke();
      if (!mature) continue;
      const headOn = blooming ? (i < Math.max(1,Math.ceil(sn*blv))) : false;
      const col=(headOn?S.bloom:null)||S.seed;
      if (col){ ctx.fillStyle=col;
        const bw=L.button||1.8, bl=L.buttonLen||3.2;
        ctx.beginPath(); ctx.ellipse(tip,-len-bl*0.4,bw,bl,sway*0.12,0,7); ctx.fill(); }
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
            ctx.fillStyle=shade(S.fol,(rnd()-0.5)*22);
            ctx.beginPath();
            ctx.ellipse(ox+Math.cos(a)*r, wy+Math.sin(a)*r*0.35, 4.5, 1.5, a*0.4, 0, 7); ctx.fill();
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
        if (blooming && S.bloom){
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
      ctx.strokeStyle=shade(fol,-10+dep*20+(rnd()-0.5)*8); ctx.lineWidth=w;   // leaf body
      ctx.beginPath(); ctx.moveTo(0,cy); ctx.quadraticCurveTo(midX,midY,tipX,tipY); ctx.stroke();
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
    const leafDot=(px,py,w,h,a,col)=>{
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
          leafDot(px+side*(3+rnd()*2),py,4.2,2.6,side*0.35,fol);
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
      const m0=stemFor(habit==='mossphlox'?(L.flowers||18):(L.flowerStems||7)), m=S.bloom&&!S.seed ? Math.max(1,Math.ceil(m0*blv)) : m0;
      for (let i=0;i<m;i++){
        const ox=(rnd()-0.5)*(L.flowerW||20), len=H*((L.flowerLen||0.85)+rnd()*(L.flowerJitter||0.2));
        ctx.strokeStyle=shade(fol,-25); ctx.lineWidth=habit==='baptisia'?1.5:1.1;
        ctx.beginPath(); ctx.moveTo(ox*0.5,0); ctx.lineTo(ox+sway*2,-len); ctx.stroke();
        ctx.fillStyle=col;
        if (habit==='baptisia'&&season==='Spring'){
          const pods=S.seed&&!blooming, count=pods?3:(L.raceme||6);
          for(let s=0;s<count;s++){
            ctx.beginPath();
            ctx.ellipse(ox+sway*2+(s%2?-1.8:1.8),-len+s*3.3,pods?2.1:2.0,pods?3.1:2.4,0,0,7); ctx.fill();
          }
        }
        else if ((habit==='threadleaf'||habit==='broadamsonia')&&season==='Spring'){
          for(let p=0;p<5;p++){ const pa=p/5*Math.PI*2;
            ctx.beginPath(); ctx.ellipse(ox+sway*2+Math.cos(pa)*3,-len+Math.sin(pa)*3,1.3,1.3,0,0,7); ctx.fill(); }
        }
        else if (habit==='mossphlox'){
          const petals=L.petals||5, petal=L.petal||2.2, cx=ox+sway*2+(rnd()-0.5)*(L.flowerSpread||24), cy=-H*(0.08+rnd()*(L.foliageH||0.18));
          for(let p=0;p<petals;p++){ const a=p/petals*Math.PI*2;
            ctx.beginPath(); ctx.ellipse(cx+Math.cos(a)*petal*0.72,cy+Math.sin(a)*petal*0.58,petal,petal*0.56,a,0,7); ctx.fill(); }
          if (S.eye){ ctx.fillStyle=S.eye; ctx.beginPath(); ctx.arc(cx,cy,petal*0.34,0,7); ctx.fill(); ctx.fillStyle=col; }
        }
        else if (habit==='asterdome'||habit==='asterupright'||habit==='asterclean'){
          const heads=habit==='asterdome'?3:(habit==='asterclean'?2:1), rad=habit==='asterupright'?3.0:2.4;
          for(let h=0;h<heads;h++){
            const hx=ox+sway*2+(h-(heads-1)/2)*4, hy=-len+rnd()*3;
            ctx.beginPath(); ctx.arc(hx,hy,rad,0,7); ctx.fill();
            if (S.eye){ ctx.fillStyle=S.eye; ctx.beginPath(); ctx.arc(hx,hy,rad*0.35,0,7); ctx.fill(); ctx.fillStyle=col; }
          }
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
        ctx.beginPath(); ctx.moveTo(0,0);
        ctx.quadraticCurveTo(Math.sin(a)*l*0.5,-l*0.6,Math.sin(a)*l*0.8,-l); ctx.stroke(); }
    }
    if (blooming){
      const sn=Math.max(1,Math.ceil((L2.stems||3)*blv)), cup=L2.cup||3;
      for (let i=0;i<sn;i++){
        const ox=(rnd()-0.5)*8, len=H*(0.7+rnd()*0.3);
        ctx.strokeStyle=shade(S.fol,-12); ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(ox*0.5,0); ctx.lineTo(ox+sway,-len); ctx.stroke();
        ctx.strokeStyle=S.bloom; ctx.lineWidth=1.8;
        for (let p2=-1;p2<=1;p2++){ ctx.beginPath();
          ctx.moveTo(ox+sway,-len);
          ctx.lineTo(ox+sway+p2*cup*0.8,-len-cup*1.6); ctx.stroke(); }
        if (S.eye){ ctx.fillStyle=S.eye;
          ctx.beginPath(); ctx.arc(ox+sway,-len-cup*0.5,cup*0.45,0,7); ctx.fill(); }
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
        ctx.fillStyle=shade(fol,(rnd()-0.5)*20);
        ctx.beginPath(); ctx.ellipse(px,py,padW*(0.65+rnd()*0.25),padH*(0.65+rnd()*0.25),rnd()*0.4,0,7); ctx.fill();
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
    if (S.fol){
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
  else if (P.form === 'leafmound'){ // hosta: broad overlapping leaves, scapes above
    if (S.fol){
      const n=stemFor(11);
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
      const m=Math.max(1,Math.ceil(3*blv));
      for (let i=0;i<m;i++){ const ox=(rnd()-0.5)*10, len=H*(1.0+rnd()*0.2);
        ctx.beginPath(); ctx.moveTo(ox*0.4,0); ctx.lineTo(ox+sway*2,-len); ctx.stroke();
        ctx.fillStyle=S.bloom;
        for (let s2=0;s2<4;s2++){ ctx.beginPath();
          ctx.ellipse(ox+sway*2+(rnd()-0.5)*2,-len+s2*2.8,1.5,2,0,0,7); ctx.fill(); } }
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
      ctx.save();
      ctx.globalAlpha=0.24;
      ctx.fillStyle=shade(S.fol,-26);
      ctx.beginPath();
      ctx.ellipse(sway*2, cy+H*0.06, cw*(L.canopyW||0.48)*0.92, H*(L.canopyH||0.26)*0.88, 0, 0, 7);
      ctx.fill();
      ctx.restore();
      // T10: leaf blobs are cw-relative, so a rescaled giant would read as a
      // few huge lobes — trade blob size for blob count (coverage constant)
      const leafMul=Math.min(3,Math.max(1,vs*0.75)), leafDim=1/Math.sqrt(leafMul);
      const n=stemFor(Math.round((L.leafN||26)*leafMul));
      for (let i=0;i<n;i++){
        const a=rnd()*Math.PI*2, r=Math.sqrt(rnd());
        ctx.fillStyle=shade(S.fol,(rnd()-0.5)*30);
        ctx.beginPath();
        ctx.ellipse(Math.cos(a)*cw*(L.canopyW||0.48)*r+sway*3, cy-Math.sin(a)*H*(L.canopyH||0.26)*r,
          cw*(L.leafW||0.15)*leafDim, cw*(L.leafH||0.10)*leafDim, a, 0, 7);
        ctx.fill();
      }
      if (L.weep){
        ctx.strokeStyle=shade(S.fol,-10); ctx.lineWidth=Math.max(1,vs*0.7);
        for (let w=0;w<8;w++){
          const wx=(rnd()-0.5)*cw*0.7+sway*3, wy=cy+rnd()*H*0.12;
          ctx.beginPath(); ctx.moveTo(wx,wy);
          ctx.quadraticCurveTo(wx+(rnd()-0.5)*5,wy+H*0.16,wx+(rnd()-0.5)*7,wy+H*(0.24+rnd()*0.1)); ctx.stroke();
        }
      }
      ctx.save(); ctx.globalAlpha=0.18; ctx.fillStyle=shade(S.fol,22);
      for (let i=0;i<Math.max(4,Math.round(n*0.18));i++){
        const a=-Math.PI*0.65+rnd()*Math.PI*0.42, r=Math.sqrt(rnd());
        ctx.beginPath();
        ctx.ellipse(Math.cos(a)*cw*(L.canopyW||0.48)*r+sway*3, cy-Math.sin(a)*H*(L.canopyH||0.26)*r,
          cw*(L.leafW||0.15)*leafDim*0.65, cw*(L.leafH||0.10)*leafDim*0.62, a, 0, 7);
        ctx.fill();
      }
      ctx.restore();
    }
    if (blooming){ // flowers: on the canopy, or straight on bare branches (redbud)
      const spots=Math.max(2,Math.ceil((L.flowerN||(S.fol?10:14))*blv));
      if (L.smoke){
        ctx.save(); ctx.globalAlpha=0.48;
        for (let i=0;i<spots;i++){
          const [tx2,ty2]=tips[i%tips.length];
          const f=0.5+rnd()*0.45, hx=sway*1.4+(tx2-sway*1.4)*f, hy=-trunkH*0.92+(ty2+trunkH*0.92)*f;
          ctx.fillStyle=shade(S.bloom,(rnd()-0.5)*26);
          for (let p=0;p<4;p++){ ctx.beginPath();
            ctx.ellipse(hx+(rnd()-0.5)*12*vs,hy+(rnd()-0.5)*10*vs,3.2*vs,2.1*vs,(rnd()-0.5)*1.2,0,7); ctx.fill(); }
        }
        ctx.restore();
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
      ctx.fillStyle=S.seed;
      const seeds=L.seedN||8, seedR=(L.seedR||1.4)*vs;
      for (let i=0;i<seeds;i++){ ctx.beginPath();
        ctx.arc((rnd()-0.5)*cw*0.8+sway*3, cy-(rnd()-0.5)*H*0.4, seedR, 0, 7); ctx.fill(); }
    }
  }
  else if (P.form === 'conifer'){ // stacked evergreen, dense at any season
    const vs=(woodyVisualCw(P)||60)/(P.cw||60);
    const cw=(woodyVisualCw(P)||60)*(0.12+0.88*growth);
    ctx.strokeStyle='#5e4a38'; ctx.lineWidth=Math.max(2,4*vs*growth);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-H*0.18); ctx.stroke();
    for (let t=0;t<3;t++){
      const w=cw*(0.95-t*0.27), yb=-H*(0.16+t*0.26), yt=-H*(0.46+t*0.27);
      ctx.fillStyle=shade(S.fol,(t-1)*10);
      ctx.beginPath(); ctx.moveTo(-w/2+sway*(t+1)*0.6,yb);
      ctx.lineTo(w/2+sway*(t+1)*0.6,yb); ctx.lineTo(sway*(t+1.6),yt);
      ctx.closePath(); ctx.fill();
    }
    if (S.seed && mature){ ctx.fillStyle=S.seed;
      for (let i=0;i<6;i++){ ctx.beginPath();
        ctx.arc((rnd()-0.5)*cw*0.6, -H*(0.25+rnd()*0.5), 1.2, 0, 7); ctx.fill(); } }
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
      for (let n=1;n<5;n++){ const yy=-ht*n/5, xx=ox+lean*(n/5);
        ctx.beginPath(); ctx.moveTo(xx-2.4*vs,yy); ctx.lineTo(xx+2.4*vs,yy); ctx.stroke(); }
      if (S.fol){
        const leaves=Math.max(2,Math.round((L.leafN||36)/canes));
        for (let j=0;j<leaves;j++){
          const f=0.45+rnd()*0.48, lx=ox+lean*f, ly=-ht*f;
          const side=rnd()<0.5?-1:1;
          ctx.fillStyle=shade(fol,(rnd()-0.5)*26);
          ctx.beginPath(); ctx.ellipse(lx+side*(5+rnd()*7)*vs,ly+(rnd()-0.5)*5,8*vs,2.1*vs,side*0.35,0,7); ctx.fill();
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
      if (L.needles){
        // yew (Taxus): dense LAYERED SPRAYS, never smooth topiary — even a
        // clipped yew keeps a soft, feathery surface. Column = an upright
        // irregular pillar (Hicksii); mound/round = wide layered masses.
        // Mature plants carry scattered red arils in fall/winter (S.seed).
        const col=shape==='column';
        const bw=bodyW*(col?0.56:1.0), bh=Math.max(bodyH,12);
        const span=col?0.92:(shape==='mound'?0.62:0.76);   // spray reach up the body
        ctx.fillStyle=shade(fol,-30);                       // dark underbody grounds the mass
        ctx.beginPath();
        if (col) ctx.ellipse(0,baseY-bh*0.50,bw*0.44,bh*0.48,0,0,7);
        else ctx.ellipse(0,baseY-bh*0.26,bw*0.50,bh*0.30,0,0,7);
        ctx.fill();
        const n=Math.max(16,Math.min(60,Math.round(bw*bh/210)));
        const sprayW=Math.max(7,bw*(col?0.20:0.13)), sprayH=sprayW*0.40;
        const arils=[];
        for (let i=0;i<n;i++){
          const t=rnd();                                    // 0 base .. 1 top
          const wf=col ? (0.92-t*0.28) : Math.sqrt(Math.max(0.06,1-t*t));
          const px2=(rnd()*2-1)*bw*0.5*wf, py2=baseY-bh*(0.08+t*span);
          const ang=(px2/Math.max(1,bw))*0.9+(rnd()-0.5)*0.5; // sprays sweep outward
          ctx.fillStyle=shade(fol,-16+t*26+(rnd()-0.5)*14);   // lighter toward the light
          ctx.beginPath();
          ctx.ellipse(px2,py2,sprayW*(0.7+rnd()*0.5),sprayH*(0.7+rnd()*0.5),ang,0,7);
          ctx.fill();
          if (rnd()<0.22) arils.push([px2+(rnd()-0.5)*sprayW,py2+(rnd()-0.5)*sprayH]);
        }
        // feathery upswept shoot tips break the outline along the top
        ctx.strokeStyle=shade(fol,30); ctx.lineWidth=1.1; ctx.lineCap='round';
        for (let i=0;i<Math.max(6,Math.round(n*0.4));i++){
          const t=0.55+rnd()*0.45;
          const wf=col ? (0.92-t*0.28) : Math.sqrt(Math.max(0.06,1-t*t));
          const px2=(rnd()*2-1)*bw*0.5*wf, py2=baseY-bh*(0.08+t*span);
          const dx=(px2>=0?1:-1)*(1.5+rnd()*2.5);
          ctx.beginPath(); ctx.moveTo(px2,py2);
          ctx.quadraticCurveTo(px2+dx*0.6,py2-2.5,px2+dx,py2-(3.5+rnd()*3)); ctx.stroke();
        }
        if (S.seed && mature && arils.length){              // red arils, female plants in fruit
          ctx.fillStyle=S.seed;
          arils.slice(0,7).forEach(([ax,ay])=>{ ctx.beginPath(); ctx.arc(ax,ay,1.5,0,7); ctx.fill(); });
        }
      } else if (shape==='sphere'){
        ctx.fillStyle=shade(fol,-20);
        ctx.beginPath(); ctx.ellipse(0,baseY-bodyH*0.47,bodyW*0.50,bodyH*0.52,0,0,7); ctx.fill();
        ctx.fillStyle=shade(fol,-6);
        ctx.beginPath(); ctx.ellipse(0,baseY-bodyH*0.36,bodyW*0.46,bodyH*0.34,0,0,7); ctx.fill();
        ctx.fillStyle=shade(fol,14);
        ctx.beginPath(); ctx.ellipse(-bodyW*0.12,baseY-bodyH*0.66,bodyW*0.30,bodyH*0.19,-0.1,0,7); ctx.fill();
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
            for (let i=0;i<9;i++){ const a=left+rnd()*len, b=back+rnd()*thick, p1=pt(a-2,b,1), p2=pt(a+2,b+(rnd()-0.5)*2,1);
              ctx.beginPath(); ctx.moveTo(p1[0],p1[1]); ctx.lineTo(p2[0],p2[1]); ctx.stroke(); }
            ctx.restore();
          }
          ctx.restore();
          return;
        }
        const top=baseY-bodyH*0.92, frontTop=top+bodyH*(connectedSquare?0.18:0.14), bottom=baseY;
        const left=-bodyW/2, right=bodyW/2, inset=connectedSquare?0:bodyW*0.12;
        ctx.fillStyle=shade(fol,-18); ctx.fillRect(left,frontTop,bodyW,bottom-frontTop);
        ctx.fillStyle=shade(fol,10);
        ctx.beginPath();
        ctx.moveTo(left,frontTop); ctx.lineTo(left+inset,top);
        ctx.lineTo(right-inset,top); ctx.lineTo(right,frontTop);
        ctx.closePath(); ctx.fill();
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
          ctx.fillStyle=shade(fol,(q-1)*10);
          ctx.beginPath(); ctx.moveTo(-w/2,y);
          ctx.lineTo(w/2,y); ctx.lineTo(sway*1.2,baseY-bodyH*(0.95+q*0.06)); ctx.closePath(); ctx.fill();
        }
      } else if (shape==='column'){
        const w=bodyW*0.62;
        ctx.fillStyle=shade(fol,-13); ctx.fillRect(-w/2,baseY-bodyH,w,bodyH*0.94);
        ctx.fillStyle=shade(fol,8);
          ctx.beginPath(); ctx.ellipse(0,baseY-bodyH,w/2,bodyH*0.16,0,0,7); ctx.fill();
          ctx.beginPath(); ctx.ellipse(0,baseY-bodyH*0.08,w/2,bodyH*0.12,0,0,7); ctx.fill();
      } else {
        const isMound=shape==='mound';
        ctx.fillStyle=shade(fol,-20);
        ctx.beginPath(); ctx.ellipse(0,baseY-bodyH*(isMound?0.30:0.38),bodyW*(isMound?0.58:0.54),bodyH*(isMound?0.30:0.38),0,0,7); ctx.fill();
        ctx.fillStyle=shade(fol,8);
        ctx.beginPath(); ctx.ellipse(-bodyW*0.05,baseY-bodyH*(isMound?0.46:0.57),bodyW*(isMound?0.48:0.44),bodyH*(isMound?0.22:0.30),0,0,7); ctx.fill();
      }
      if (L.fleck){   // boxwood leaf flecks; yews texture themselves via sprays
        ctx.strokeStyle=shade(fol,-12); ctx.lineWidth=0.8; ctx.lineCap='round';
        for (let i=0;i<9;i++){ const fx=(rnd()-0.5)*bodyW*0.8, fy=baseY-bodyH*(0.18+rnd()*0.64);
          ctx.beginPath(); ctx.moveTo(fx-2,fy); ctx.lineTo(fx+2,fy+(rnd()-0.5)*2); ctx.stroke(); }
      }
    } else {
      const tn=stemFor(7), tips=[];
      ctx.strokeStyle='#6e5a48'; ctx.lineWidth=1.6; ctx.lineCap='round';
      for (let i=0;i<tn;i++){
        const a=(i/(tn-1)-0.5)*1.5+(rnd()-0.5)*0.2;
        const tx2=Math.sin(a)*cw*0.5+sway*2, ty2=-H*(0.55+rnd()*0.45);
        ctx.beginPath(); ctx.moveTo((rnd()-0.5)*4,0);
        ctx.quadraticCurveTo(tx2*0.4,ty2*0.55,tx2,ty2); ctx.stroke();
        tips.push([tx2,ty2]);
      }
    if (S.fol){
        ctx.save(); ctx.globalAlpha=0.20; ctx.fillStyle=shade(S.fol,-24);
        ctx.beginPath(); ctx.ellipse(sway, -H*0.42, cw*0.45, H*0.28, 0, 0, 7); ctx.fill();
        ctx.restore();
        const n=stemFor(20);
        for (let i=0;i<n;i++){
          const a=rnd()*Math.PI*2, r=rnd();
          ctx.fillStyle=shade(S.fol,(rnd()-0.5)*28);
          ctx.beginPath();
          ctx.ellipse(Math.cos(a)*cw*0.5*r+sway*2, -H*(0.35+rnd()*0.55),
            3.6, 2.6, a, 0, 7);
          ctx.fill();
        }
      }
      if (blooming && mature){
        const heads=tips.slice(0,Math.max(1,Math.ceil(tips.length*blv)));
        if (L.smoke){
          ctx.save(); ctx.globalAlpha=0.52;
          heads.forEach(([tx2,ty2])=>{ for (let p=0;p<6;p++){ ctx.fillStyle=shade(S.bloom,(rnd()-0.5)*24);
            ctx.beginPath(); ctx.ellipse(tx2+(rnd()-0.5)*16,ty2-3+(rnd()-0.5)*12,3.4,2.2,(rnd()-0.5)*1.2,0,7); ctx.fill(); } });
          ctx.restore();
        } else { ctx.fillStyle=S.bloom;
          heads.forEach(([tx2,ty2])=>{
            ctx.beginPath(); ctx.ellipse(tx2,ty2-2,2.2,3.2,0,0,7); ctx.fill(); }); }
      }
      if (S.seed && mature){ ctx.fillStyle=S.seed; // berries/pods along upper twigs
        tips.forEach(([tx2,ty2])=>{ for (let b=0;b<3;b++){ const f=0.6+b*0.15;
          ctx.beginPath(); ctx.arc(tx2*f,ty2*f,1.6,0,7); ctx.fill(); } }); }
    }
  }
  else if (P.form === 'hydrangea'){ // big mophead or panicle flowering shrub
    const L = P.look||{}, panicle = L.bloomShape==='panicle', lacecap = L.bloomShape==='lacecap';
    const cw=(woodyVisualCw(P)||70)*(0.4+0.6*growth), tn=stemFor(6), tips=[];
    ctx.strokeStyle='#6e5a48'; ctx.lineWidth=2; ctx.lineCap='round';
    for (let i=0;i<tn;i++){
      const a=(i/(tn-1)-0.5)*1.3+(rnd()-0.5)*0.2;
      const tx2=Math.sin(a)*cw*0.42+sway*2, ty2=-H*(0.6+rnd()*0.38);
      ctx.beginPath(); ctx.moveTo((rnd()-0.5)*5,0);
      ctx.quadraticCurveTo(tx2*0.4,ty2*0.55,tx2,ty2); ctx.stroke();
      tips.push([tx2,ty2]);
    }
    if (S.fol){ // broad leafy mound
      ctx.save(); ctx.globalAlpha=0.23; ctx.fillStyle=shade(S.fol,-24);
      ctx.beginPath(); ctx.ellipse(sway, -H*0.40, cw*0.44, H*0.26, 0, 0, 7); ctx.fill();
      ctx.restore();
      const n=stemFor(22);
      for (let i=0;i<n;i++){ const a=rnd()*Math.PI*2, r=rnd();
        ctx.fillStyle=shade(S.fol,(rnd()-0.5)*26);
        ctx.beginPath(); ctx.ellipse(Math.cos(a)*cw*0.46*r+sway*2, -H*(0.30+rnd()*0.5),
          4.4,3.2,a,0,7); ctx.fill(); }
    }
    const headR=L.headR||7;
    const drawHead=(hx,hy,col,scale)=>{
      const r=headR*(scale||1);
      if (panicle){ for (let k=0;k<16;k++){ const f=k/16; // taper to a point
        const wr=r*(1-f)*0.9;
        ctx.fillStyle=shade(col,(rnd()-0.5)*16);
        ctx.beginPath(); ctx.ellipse(hx+(rnd()-0.5)*2*wr, hy-r*0.3-f*r*1.7, 1.9,1.9,0,0,7); ctx.fill(); } }
      else if (lacecap){ // flat disc: tiny fertile center ringed by showy florets
        const cy=hy-r*0.4;
        ctx.fillStyle=shade(col,-46);
        for (let k=0;k<12;k++){ const a=rnd()*Math.PI*2, rr=Math.sqrt(rnd())*r*0.6;
          ctx.beginPath(); ctx.ellipse(hx+Math.cos(a)*rr, cy+Math.sin(a)*rr*0.42, 1.1,1.1,0,0,7); ctx.fill(); }
        const ring=Math.round(7+r*0.5);
        for (let k=0;k<ring;k++){ const a=k/ring*Math.PI*2;
          ctx.fillStyle=shade(col,(rnd()-0.5)*14);
          ctx.beginPath(); ctx.ellipse(hx+Math.cos(a)*r, cy+Math.sin(a)*r*0.45, 2.4,2.2,a,0,7); ctx.fill(); } }
      else { for (let k=0;k<20;k++){ const a=rnd()*Math.PI*2, rr=Math.sqrt(rnd())*r;
        ctx.fillStyle=shade(col,(rnd()-0.5)*16);
        ctx.beginPath(); ctx.ellipse(hx+Math.cos(a)*rr, hy-r*0.55+Math.sin(a)*rr*0.82, 2,2,0,0,7); ctx.fill(); } }
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
    const capW=P.cw?Math.max(18,(woodyVisualCw(P)||18)*0.5):18;
    const capS=P.cw?Math.max(1,(woodyVisualCw(P)||60)/60):1;
    const rs=mulberry(seed+9), caps=isTreeDef(P)?7:4;
    for(let i=0;i<caps;i++){ ctx.beginPath();
      ctx.ellipse((rs()-0.5)*capW,-H*(0.5+rs()*0.45),3.5*capS,1.6*capS,0,0,7); ctx.fill(); }
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

/* ---------- character renderer: round-bodied cats & dogs ---------- */
function drawCritter(ctx, x, y, ch, t, walking, scale){
  const s = scale||1, coat = ch.coat, dark = ch.coatD;
  const bob = walking ? Math.sin(t*0.02)*1.6*s : Math.sin(t*0.004)*0.7*s;
  ctx.save(); ctx.translate(x, y+bob);
  ctx.scale(s,s);
  // shadow
  ctx.fillStyle='rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(0,3,13,5,0,0,7); ctx.fill();
  // tail
  ctx.strokeStyle=dark; ctx.lineWidth=4; ctx.lineCap='round';
  ctx.beginPath();
  if (ch.species==='cat'){ ctx.moveTo(8,-6);
    ctx.quadraticCurveTo(17,-10,15,-22+Math.sin(t*0.005)*2); }
  else { ctx.moveTo(9,-7); ctx.quadraticCurveTo(16,-12+Math.sin(t*0.012)*3,13,-16); }
  ctx.stroke();
  // body
  ctx.fillStyle=coat;
  ctx.beginPath(); ctx.ellipse(0,-9,11,10,0,0,7); ctx.fill();
  if (ch.mark==='tuxedo'){ ctx.fillStyle='#f3ecdd';
    ctx.beginPath(); ctx.ellipse(0,-7,5.5,7,0,0,7); ctx.fill(); }
  // legs hint
  ctx.fillStyle=dark;
  const lp = walking? Math.sin(t*0.02)*2 : 0;
  ctx.fillRect(-7,-2+lp*0.4,3.4,4); ctx.fillRect(3.6,-2-lp*0.4,3.4,4);
  // head
  ctx.fillStyle=coat;
  ctx.beginPath(); ctx.arc(0,-22,8.6,0,7); ctx.fill();
  if (ch.mark==='patch'){ ctx.fillStyle=dark;
    ctx.beginPath(); ctx.arc(-3.4,-24,3.6,0,7); ctx.fill(); }
  // ears
  ctx.fillStyle=coat;
  if (ch.species==='cat'){
    ctx.beginPath(); ctx.moveTo(-7,-26); ctx.lineTo(-5,-34); ctx.lineTo(-1.5,-28); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(7,-26); ctx.lineTo(5,-34); ctx.lineTo(1.5,-28); ctx.closePath(); ctx.fill();
    ctx.fillStyle=dark;
    ctx.beginPath(); ctx.moveTo(-6,-27.5); ctx.lineTo(-5,-31.5); ctx.lineTo(-3,-28.5); ctx.closePath(); ctx.fill();
  } else { // floppy dog ears
    ctx.fillStyle=dark;
    ctx.beginPath(); ctx.ellipse(-8,-22,3.2,6,0.4,0,7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(8,-22,3.2,6,-0.4,0,7); ctx.fill();
  }
  // face
  ctx.fillStyle='#19120f';
  ctx.beginPath(); ctx.arc(-3,-23,1.2,0,7); ctx.fill();
  ctx.beginPath(); ctx.arc(3,-23,1.2,0,7); ctx.fill();
  if (ch.species==='dog'){ ctx.beginPath(); ctx.ellipse(0,-19.5,2.2,1.7,0,0,7); ctx.fill(); }
  else { ctx.beginPath(); ctx.moveTo(-1.4,-20); ctx.lineTo(1.4,-20); ctx.lineTo(0,-18.6); ctx.closePath(); ctx.fill(); }
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

