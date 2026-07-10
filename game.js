'use strict';

// ================= canvas / mobile-portrait logical resolution =================
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const DPR = Math.min(window.devicePixelRatio || 1, 2);
const VW = 420, VH = 740;              // logical mobile-portrait resolution
let S = 1, OX = 0, OY = 0, screenW = 0, screenH = 0;
function resize(){
  screenW = window.innerWidth; screenH = window.innerHeight;
  cv.width = screenW * DPR; cv.height = screenH * DPR;
  cv.style.width = screenW + 'px'; cv.style.height = screenH + 'px';
  S = Math.min(screenW / VW, screenH / VH);
  OX = (screenW - VW * S) / 2; OY = (screenH - VH * S) / 2;
}
window.addEventListener('resize', resize); resize();

// ================= palette =================
const C = {
  ink:'#3a352e', paper:'#faf5e8', sand:'#cbc7bd', rock:'#c6c2b8',
  skin:'#dfa878', hair:'#1d1712', tee:'#ffffff', jeans:'#3d4a63', hat:'#a4763d',
  copShirt:'#2f3f66', copPants:'#232b3f', vest:'#1a2130', patch:'#dfe4ec', badge:'#e8c15c',
  palmG:'#57a05f', palmT:'#b3925f',
  pvGreen:'#8fae4e', pvBloom:'#e9c93c',
  mesqT:'#6b5236', mesqG:'#71904e', mesqPod:'#c8a86b',
  ironT:'#8a7f70', ironG:'#7f9273', ironBloom:'#b287c9',
  wilT:'#95795a', wilG:'#86a75a', wilBloom:'#d886a8',
  sag:'#7fa05a', sun:'#e8a13a', sunFill:'#f6c65e', alert:'#c0504a', gold:'#e9c93c'
};
const FONT = '"Chalkboard SE","Comic Sans MS",cursive';

// ================= audio: chiptune music + synthesized SFX =================
// Everything is generated live with the Web Audio API -- no files. The context
// is created lazily on the first user gesture (browser autoplay rule). Master
// bus -> destination; music runs through its own gain so it can duck under SFX.
let actx=null, masterGain=null, musicGain=null, muted=false;
// note-name -> frequency, so both music and SFX sit in the same key (C major)
const NF={};
(()=>{ const nm=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  for(let o=1;o<=6;o++) for(let i=0;i<12;i++) NF[nm[i]+o]=440*Math.pow(2,(((o+1)*12+i)-69)/12);
})();
function initAudio(){
  try{
    if(!actx){
      actx=new (window.AudioContext||window.webkitAudioContext)();
      masterGain=actx.createGain(); masterGain.gain.value=muted?0:1; masterGain.connect(actx.destination);
      musicGain=actx.createGain(); musicGain.gain.value=0.5; musicGain.connect(masterGain);
    }
    if(actx.state!=='running') actx.resume();
    // iOS unlock: playing a 1-sample silent buffer inside a user gesture is what
    // actually flips Safari's audio session on -- resume() alone is not enough
    const b=actx.createBuffer(1,1,22050), s=actx.createBufferSource();
    s.buffer=b; s.connect(actx.destination); s.start(0);
    startMusic();
  }catch(e){ actx=null; }
}
// iOS only counts some gestures (esp. touchend) as unlock-worthy, and can
// suspend the context when the app backgrounds -- re-arm on every chance
['touchend','pointerup','click','keydown'].forEach(ev=>
  document.addEventListener(ev,()=>{ if(!actx||actx.state!=='running') initAudio(); },{passive:true}));
document.addEventListener('visibilitychange',()=>{ if(!document.hidden&&actx&&actx.state!=='running') actx.resume(); });
function toggleMute(){ muted=!muted; if(masterGain) masterGain.gain.value=muted?0:1; return muted; }
// one enveloped oscillator note; freq can glide to slideTo; routed to bus (SFX->master, music->musicGain)
function tone(freq,dur,type,vol,slideTo,delay,bus){
  if(!actx) return;
  const t=actx.currentTime+(delay||0);
  const o=actx.createOscillator(), g=actx.createGain();
  o.type=type||'sine';
  o.frequency.setValueAtTime(freq,t);
  if(slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1,slideTo),t+dur);
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(vol||0.12,t+0.012);
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g); g.connect(bus||masterGain||actx.destination);
  o.start(t); o.stop(t+dur+0.03);
}
const N=(n,dur,type,vol,slideToName,delay,bus)=>tone(NF[n],dur,type,vol,slideToName?NF[slideToName]:0,delay,bus);

// ---- chiptune background loop: I-vi-IV-V in C, square lead + triangle bass ----
const MUS={ playing:false, next:0, step:0, spb:0.15 };  // spb = seconds per 8th note
const M_BASS=['C2',0,'C3',0,'G2',0,'C3',0, 'A2',0,'A3',0,'E2',0,'A3',0, 'F2',0,'F3',0,'C2',0,'F3',0, 'G2',0,'G3',0,'D2',0,'G3',0];
const M_LEAD=['E4','G4','C5',0,'G4',0,'E4',0, 'E4','A4','C5',0,'A4',0,'E4',0, 'F4','A4','C5',0,'A4',0,'F4',0, 'D4','G4','B4',0,'G4',0,'D4',0];
const M_SPARK=[0,0,0,'E5',0,'G5',0,0, 0,0,0,'A5',0,'E5',0,0, 0,0,0,'C6',0,'A5',0,0, 0,0,0,'D5',0,'B4',0,0];
function musicStep(s,t){
  const b=M_BASS[s]; if(b) tone(NF[b],0.22,'triangle',0.16,0,t-actx.currentTime,musicGain);
  const l=M_LEAD[s]; if(l) tone(NF[l],0.16,'square',0.055,0,t-actx.currentTime,musicGain);
  const k=M_SPARK[s]; if(k) tone(NF[k],0.10,'triangle',0.035,0,t-actx.currentTime,musicGain);
}
function startMusic(){ if(actx&&!MUS.playing){ MUS.playing=true; MUS.next=actx.currentTime+0.1; MUS.step=0; } }
function musicSched(){
  if(!actx||!MUS.playing) return;
  const ahead=actx.currentTime+0.25;
  while(MUS.next<ahead){ musicStep(MUS.step,MUS.next); MUS.next+=MUS.spb; MUS.step=(MUS.step+1)%M_BASS.length; }
}
setInterval(musicSched,60);

// ---- SFX (in-key with the music so they never clash) ----
const sfxJump   =()=>N('G3',0.15,'square',0.09,'D4');                 // rising hop
const sfxLand   =()=>tone(190,0.10,'sine',0.08,90);                   // soft thud
function sfxPlant(){ // super-satisfying reward: warm chord swell + bright rising sparkle + shimmer tail
  N('C4',0.5,'triangle',0.14); N('E4',0.5,'triangle',0.12); N('G4',0.5,'triangle',0.11); // major chord bloom
  ['C5','E5','G5','C6'].forEach((n,i)=>N(n,0.18,'square',0.075,0,0.06+i*0.055));           // ascending sparkle
  N('G5',0.6,'sine',0.06,'C6',0.28); N('E6',0.5,'sine',0.045,0,0.34);                      // shimmer tail
}
function sfxWater(){ N('C5',0.09,'sine',0.10,'G5'); N('E5',0.10,'sine',0.09,'C6',0.06); }  // refreshing glug
const sfxStartle=()=>{ N('E5',0.08,'square',0.09); N('E5',0.08,'square',0.09,0,0.11); };    // alert whistle
function sfxCaught(){ ['G3','E3','C3','G2'].forEach((n,i)=>N(n,0.22,'sawtooth',0.12,0,i*0.09)); } // descending game-over
function sfxLowWater(){ N('A4',0.14,'square',0.12,'F4'); N('A4',0.14,'square',0.10,'F4',0.18); }  // urgent two-tone warning
const sfxClick  =()=>N('C5',0.05,'square',0.07);
const sfxShutter=()=>{ tone(1200,0.02,'square',0.08); tone(900,0.03,'square',0.06,0,0.03); };
// death-screen beats
const sfxRevealItem=()=>N('E5',0.12,'triangle',0.10,'G5');            // a tree card pops in
const sfxItemPoof  =()=>tone(300,0.14,'sine',0.07,120);              // it poofs away
const sfxScoreTick =()=>N('C6',0.03,'square',0.045);                 // each score increment
function sfxBest(){ ['C5','E5','G5','C6','E6'].forEach((n,i)=>N(n,0.22,'triangle',0.11,0,i*0.07)); } // fanfare
function sfxConfetti(){ for(let i=0;i<7;i++) N(['C6','E6','G6','A5','G5'][i%5]||'C6',0.10,'square',0.05,0,i*0.03); }
const sfxPanel=()=>N('G4',0.12,'triangle',0.09,'C5');                // the big album button slides in

// ================= rng / sketch helpers =================
let boil = 0;
let waterShake = 0;  // brief one-shot shake of the water chip when it goes low
let tutT = 0;        // seconds left on the little controls tutorial bubble
let plantHoldId = null; // pointer currently held down on a palm (hold-to-replant)
let hoverCard = -1;  // album card index under the cursor (hover lift)
function h32(n){ n|=0; n=Math.imul(n^(n>>>15),0x2c1b3c6d); n=Math.imul(n^(n>>>12),0x297a2d39); n^=n>>>15; return (n>>>0)/4294967296; }
function sr(s){ return h32(Math.imul(s|0, 374761393)); }
function srr(s,a,b){ return a + (b-a)*sr(s); }
function br(s){ return h32(Math.imul(s|0, 374761393) + Math.imul(boil, 668265263)); }

function jseg(x1,y1,x2,y2,seed,amp){
  const dx=x2-x1, dy=y2-y1, len=Math.hypot(dx,dy)||1;
  const n=Math.max(1,Math.round(len/13)), nx=-dy/len, ny=dx/len;
  for(let i=1;i<=n;i++){
    const t=i/n, w=amp*Math.sin(Math.PI*Math.min(t,.999));
    const j=(br(seed*53+i*7919)-.5)*2*w;
    ctx.lineTo(x1+dx*t+nx*j, y1+dy*t+ny*j);
  }
}
function skPath(pts,seed,amp,close){
  amp=amp===undefined?2:amp;
  ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]);
  for(let i=1;i<pts.length;i++) jseg(pts[i-1][0],pts[i-1][1],pts[i][0],pts[i][1],seed+i*101,amp);
  if(close){ jseg(pts[pts.length-1][0],pts[pts.length-1][1],pts[0][0],pts[0][1],seed+991,amp); ctx.closePath(); }
}
function skLine(x1,y1,x2,y2,seed,amp){ skPath([[x1,y1],[x2,y2]],seed,amp===undefined?2:amp); }
function skCircle(cx,cy,r,seed,amp){
  amp=amp===undefined?1.5:amp;
  ctx.beginPath();
  const n=Math.max(9,Math.round(r*0.9)), sa=sr(seed)*6.283;
  for(let i=0;i<=n+1;i++){
    const a=sa+(i/n)*6.283*1.04;
    const rj=r+(br(seed*31+i*17)-.5)*2*amp;
    const x=cx+Math.cos(a)*rj, y=cy+Math.sin(a)*rj;
    if(i)ctx.lineTo(x,y); else ctx.moveTo(x,y);
  }
}
function skEllipse(cx,cy,rx,ry,seed){
  ctx.beginPath();
  const n=22, sa=sr(seed)*6.283;
  for(let i=0;i<=n+1;i++){
    const a=sa+(i/n)*6.283*1.03;
    const jr=1+(br(seed*31+i*17)-.5)*0.12;
    const x=cx+Math.cos(a)*rx*jr, y=cy+Math.sin(a)*ry*jr;
    if(i)ctx.lineTo(x,y); else ctx.moveTo(x,y);
  }
}
function quadPts(p0,c,p1,n){
  n=n||8; const o=[];
  for(let i=0;i<=n;i++){ const t=i/n,u=1-t;
    o.push([u*u*p0[0]+2*u*t*c[0]+t*t*p1[0], u*u*p0[1]+2*u*t*c[1]+t*t*p1[1]]); }
  return o;
}
let SCEN_FADE=false; // true while drawing purely decorative, non-interactive scenery
const FADE_A=0.4;
function ink(w,col,a){
  if(SCEN_FADE) return; // faded scenery gets no ink outline -- signals "can't interact"
  ctx.lineWidth=w||2; ctx.strokeStyle=col||C.ink; ctx.globalAlpha=a===undefined?1:a;
  ctx.lineJoin='round'; ctx.lineCap='round'; ctx.stroke(); ctx.globalAlpha=1;
}
function fillA(col,a){
  ctx.fillStyle=col; ctx.globalAlpha=(a===undefined?1:a)*(SCEN_FADE?FADE_A:1);
  ctx.fill(); ctx.globalAlpha=1;
}
function strokePts(pts,w,col,a){
  ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]);
  for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i][0],pts[i][1]);
  ctx.lineWidth=w; ctx.strokeStyle=col; ctx.globalAlpha=(a===undefined?1:a)*(SCEN_FADE?FADE_A:1);
  ctx.lineCap='round'; ctx.lineJoin='round'; ctx.stroke(); ctx.globalAlpha=1;
}
function tube(pts,w,col,seed){
  strokePts(pts,w,col);
  const l=[],r=[];
  for(let i=0;i<pts.length;i++){
    const a=pts[Math.max(0,i-1)], b=pts[Math.min(pts.length-1,i+1)];
    const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
    l.push([pts[i][0]+nx*w/2,pts[i][1]+ny*w/2]);
    r.push([pts[i][0]-nx*w/2,pts[i][1]-ny*w/2]);
  }
  skPath(l,seed,1.3); ink(1.8);
  skPath(r,seed+7,1.3); ink(1.8);
}
function mod(v,m){ return ((v%m)+m)%m; }

// ================= constants / state =================
// physics: max jump height = JUMPV^2/(2G) ~= 157px, flat jump range ~= 170px.
// generator caps: up-steps <=100, canyon depth 114 (never followed by an up-step),
// canyon width <=138, platform rise <=120, stacked rise <=112.
const G=2300, RUN=230, AIR=RUN*1.13, JUMPV=850;
const NATIVES=['paloverde','mesquite','ironwood','willow','torote','unagato','palodulce','guayacan'];
const ES={paloverde:'Palo Verde',mesquite:'Mezquite',ironwood:'Palo Fierro',willow:'Mimbre',
  torote:'Torote',unagato:'Uña de Gato',palodulce:'Palo Dulce',guayacan:'Guayacán'};
const INFO={
  paloverde:{sci:'Parkinsonia florida',desc:['Su corteza verde hace','fotosíntesis. Se llena de','flores amarillas en primavera.']},
  mesquite:{sci:'Prosopis velutina',desc:['Da sombra ancha y sus vainas','alimentan a la fauna del desierto.']},
  ironwood:{sci:'Olneya tesota',desc:['Madera durísima. Es el árbol','nodriza del desierto sonorense.']},
  willow:{sci:'Chilopsis linearis',desc:['Crece junto a los arroyos.','Flores rosas en forma','de trompeta.']},
  torote:{sci:'Bursera microphylla',desc:['Tronco grueso con corteza','de papel. Pariente del copal.']},
  unagato:{sci:'Senegalia greggii',desc:['Espinas curvas como garras.','Flores amarillo pálido','muy olorosas.']},
  palodulce:{sci:'Eysenhardtia orthocarpa',desc:['Espigas de flores blancas.','Muy visitado por las abejas.']},
  guayacan:{sci:'Guaiacum coulteri',desc:['Flores moradas intensas.','Follaje denso, verde oscuro.']}
};
let infoKind=null; // species shown in the album info card, or null

let state='menu'; // menu | play | caught | over | album
let albumReturn='menu';
let score=0, tm=0, caughtT=0;
let overT=0, overPlan=null, btnsShown=false;
let sparts=[]; // screen-space particles: death-screen poofs and confetti
let segs=[], plats=[], trees=[], cops=[], scen=[], parts=[], floats=[], weeds=[], bottles=[];
let genX=0, lastY=0, segIdx=0, worldSeed=0, lastPalmX=0, nextPalmGap=0, palmCount=0;
let weedTimer=0;
let player=null;
const cam={x:0,y:0};

// persistent collection + highscore
let best=+(localStorage.getItem('sonoranBest')||0);
let treeCounts={};
try{ treeCounts=JSON.parse(localStorage.getItem('sonoranTrees')||'{}'); }catch(e){ treeCounts={}; }
let runNew=[], runStarred=[], newBest=false;
function saveMeta(){
  try{
    localStorage.setItem('sonoranBest',String(best));
    localStorage.setItem('sonoranTrees',JSON.stringify(treeCounts));
  }catch(e){}
}
function starsOf(k){ return Math.min(5,Math.max(0,(treeCounts[k]||0)-1)); }
// progressive unlocks: rarer species only start appearing once you've mastered
// the earlier ones. Gates read off how many species have >=N stars.
const BASE_NATIVES=['paloverde','mesquite','ironwood','willow'];
// rarer (harder-to-unlock) species are worth more from the very first plant
const TREE_BASE={
  paloverde:100, mesquite:100, ironwood:100, willow:100,
  torote:150, unagato:150,
  palodulce:250,
  guayacan:400
};
// points for planting: base by rarity, +20% of base per star you already own
function treePoints(k){ return Math.round((TREE_BASE[k]||100)*(1+0.2*starsOf(k))); }
function speciesWithStars(n){ return NATIVES.filter(k=>starsOf(k)>=n).length; }
function unlockedNatives(){
  const out=[...BASE_NATIVES];
  if(speciesWithStars(3)>=2) out.push('torote','unagato');      // 2 types with >2 stars
  if(speciesWithStars(3)>=4) out.push('palodulce');             // 3 stars on half the set
  if(speciesWithStars(4)>=6) out.push('guayacan');              // 4 stars on all but 2
  return out;
}

// ================= world generation =================
function resetWorld(){
  segs=[];plats=[];trees=[];cops=[];scen=[];parts=[];floats=[];weeds=[];bottles=[];
  worldSeed=(Math.random()*1e9)|0;
  lastY=0; segIdx=0; score=0; lastPalmX=-200; nextPalmGap=480; palmCount=0; weedTimer=2;
  runNew=[]; runStarred=[]; newBest=false;
  segs.push({x0:-420,x1:460,y:0});
  genX=460;
  scen.push({kind:'rockpile',x:-350,y:0,seed:worldSeed+5,s:1.6});
  scen.push({kind:'car',x:330,y:0,seed:worldSeed+9,s:1});
  player={x:60,feet:0,vx:0,vy:0,dir:1,grounded:true,onPlat:null,coyote:0,jbuf:0,anim:0,plantTree:null,water:1};
  cam.x=player.x-VW*0.4; cam.y=-VH*0.62;
  genTo(cam.x+VW+700);
}
function genTo(xt){ let guard=0; while(genX<xt && guard++<400) addSeg(); }
function addSeg(){
  const s=worldSeed+segIdx*131; segIdx++;
  const roll=sr(s+1);
  if(roll<0.14 && genX>900){
    const cw=srr(s+2,108,138);
    segs.push({x0:genX,x1:genX+cw,y:lastY+114,canyon:true});
    genX+=cw;
    return;
  }
  const afterCanyon=segs.length&&segs[segs.length-1].canyon;
  let y=lastY;
  if(roll<0.60&&!afterCanyon) y=Math.max(-170,Math.min(150,lastY+srr(s+3,-100,108)));
  const w=srr(s+4,190,430);
  const seg={x0:genX,x1:genX+w,y};
  segs.push(seg); lastY=y; genX+=w;
  decorate(seg,s);
}
function decorate(seg,s){
  const w=seg.x1-seg.x0;
  // curbside packed bumper-to-bumper with parked cars (denser now), tiny gaps of
  // brush/rock, and the occasional wreck of one car rammed into another
  const carClear=x=>!scen.some(o=>(o.kind==='car'||o.kind==='crash')&&Math.abs(o.x-x)<(o.kind==='crash'?120:80));
  for(let x=seg.x0+48;x<seg.x1-48;x+=srr(((s+x)|0),58,76)){
    const r=sr((s|0)+((x|0)*7));
    if(r<0.09){
      if(carClear(x)&&x<seg.x1-90) scen.push({kind:'crash',x,y:seg.y,seed:(s+(x|0))|0,s:srr(((s+x+1)|0),0.9,1.05)});
    }
    else if(r<0.92){
      if(carClear(x)) scen.push({kind:'car',x,y:seg.y,seed:(s+(x|0))|0,s:srr(((s+x+1)|0),0.85,1.08)});
    }
    else if(r<0.96) scen.push({kind:'brush',x,y:seg.y,seed:(s+(x|0))|0,s:1});
    else scen.push({kind:'rock',x,y:seg.y,seed:(s+(x|0))|0,s:srr(((s+x+2)|0),0.6,1.1)});
  }
  // platforms nearly everywhere: an upper route you can ride across most of the
  // level, dropping to the ground only to reach palms
  if(w>=200 && sr(s+30)<0.9){
    const pw=srr(s+31,120,190);
    const px=seg.x0+srr(s+32,8,Math.max(9,w-pw-8));
    const py=seg.y-srr(s+33,92,120);
    const p={x:px,y:py,w:pw};
    plats.push(p);
    // palms rarely sit up here -- they're mostly a reason to go back down
    if(sr(s+38)<0.14 && pw>120) addPalm(px+pw/2,py,p,s+40);

    // chain platforms upward; each hop stays within the base jump budget so
    // ground->p->p2->p3->p4 is always climbable
    let prev=p, tier=2;
    while(tier<=4){
      const base=s+100+tier*20;
      const thresh = tier===2?0.7 : tier===3?0.5 : 0.34;
      if(sr(base)>=thresh) break;
      const riseLo = tier===2?84:80, riseHi = tier===2?112:104;
      const offR = tier===2?100:85;
      const tw=srr(base+1,92,160);
      const tx=Math.max(seg.x0-40,Math.min(seg.x1+40-tw,
        prev.x+prev.w/2-tw/2+srr(base+2,-offR,offR)));
      const ty=prev.y-srr(base+3,riseLo,riseHi);
      const np={x:tx,y:ty,w:tw};
      plats.push(np);
      // water bottles are common on the high ledges -- the reward for staying up top
      if(seg.y-ty>=195 && sr(base+6)<0.85) bottles.push({x:tx+tw*0.5,y:ty,seed:base|0});
      prev=np; tier++;
    }
  }
  if(genX-lastPalmX>nextPalmGap && w>=210){
    const px=seg.x0+w*srr(s+50,0.35,0.65);
    addPalm(px,seg.y,null,s+51);
    lastPalmX=genX; nextPalmGap=srr(s+52,520,900);
  }
}
function addPalm(x,base,plat,s){
  s|=0;
  trees.push({x,base,seed:s,kind:'palm',native:null,swapT:-1,progress:0});
  palmCount++;
  if(palmCount===1) return; // first palm: always unguarded (safe discovery)
  const t=trees[trees.length-1];
  const c={
    x:x+srr(s+1,-90,90), feet:base, dir:sr(s+2)<0.5?-1:1,
    anchor:x, plat, state:'patrol', t:0, lost:0, seed:s, palm:t, gone:false, dead:false,
    min: plat? plat.x+10 : x-130, max: plat? plat.x+plat.w-10 : x+130
  };
  if(plat){ c.x=Math.max(c.min,Math.min(c.max,c.x)); c.feet=plat.y; }
  else c.feet=groundYAt(c.x);
  cops.push(c);
  // second palm: exactly one cop; from the third on, occasionally a pair
  if(palmCount>2 && !plat && sr(s+3)<0.18){
    const c2={...c, x:x+srr(s+4,-120,120), dir:-c.dir, seed:(s+9)|0};
    c2.feet=groundYAt(c2.x);
    cops.push(c2);
  }
}
function groundYAt(x){
  for(let i=0;i<segs.length;i++){ const s=segs[i]; if(x>=s.x0&&x<s.x1) return s.y; }
  // x is outside all generated segments (e.g. generation hasn't caught up yet for
  // one frame) -- extrapolate from the nearest edge instead of an arbitrary abyss,
  // so a momentary gap can never look like a bottomless pit and strand the fall permanently
  if(!segs.length) return 0;
  return x<segs[0].x0 ? segs[0].y : segs[segs.length-1].y;
}
function prune(){
  const cut=cam.x-950;
  while(segs.length&&segs[0].x1<cut) segs.shift();
  plats=plats.filter(p=>p.x+p.w>cut);
  trees=trees.filter(t=>t.x>cut);
  scen=scen.filter(o=>o.x>cut);
  bottles=bottles.filter(b=>b.x>cut);
  cops=cops.filter(c=>c.x>cut-100&&!c.dead);
}

// ================= input: keyboard =================
const keys={};
window.addEventListener('keydown',e=>{
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyA','KeyD','KeyW','KeyS'].includes(e.code)) e.preventDefault();
  if(e.code==='KeyM'){ initAudio(); toggleMute(); return; } // mute toggle
  if(!keys[e.code]){
    keys[e.code]=true;
    if((e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW')&&player) player.jbuf=0.12;
  }
});
window.addEventListener('keyup',e=>{
  keys[e.code]=false;
  if((e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW')&&player&&player.vy<-200) player.vy*=0.45;
});

// ================= input: touch / pointer (zones relative to the character) =================
const vk={left:false,right:false};
const ptrZones=new Map();
const ptrSwipe=new Map();          // pointerId -> lowest y reached, for swipe-up jump detection
const SWIPE_JUMP=45;               // logical px of upward flick that triggers a jump
const ALB={x:14,y:20,w:46,h:42}; // aligned with the other top-bar chips
const MUTE={x:14,y:70,w:40,h:40}; // music/sfx mute toggle, tucked under the album button
function toLogical(e){
  // derive the mapping from the canvas's live rect instead of cached resize
  // values, so tap zones can never drift out of sync with what's on screen
  const r=cv.getBoundingClientRect();
  const s=Math.min(r.width/VW,r.height/VH)||1;
  const ox=(r.width-VW*s)/2, oy=(r.height-VH*s)/2;
  return [(e.clientX-r.left-ox)/s,(e.clientY-r.top-oy)/s];
}
// hard-stop pinch/double-tap zoom: a zoomed viewport crops the view and
// shifts every tap zone sideways (the "jump stops working" bug)
document.addEventListener('gesturestart',e=>e.preventDefault());
document.addEventListener('dblclick',e=>e.preventDefault());
function recomputeVk(){
  vk.left=vk.right=false;
  for(const z of ptrZones.values()){ if(z==='l')vk.left=true; if(z==='r')vk.right=true; }
}
function setPtrZone(id,z){
  if(ptrZones.get(id)===z) return;
  ptrZones.set(id,z); recomputeVk();
}
function releasePtr(id){ if(ptrZones.delete(id)) recomputeVk(); }
function inRect(lx,ly,r){ return lx>=r.x-6&&lx<=r.x+r.w+6&&ly>=r.y-6&&ly<=r.y+r.h+6; }
// album layout rects (keep in sync with drawAlbum's card grid)
const ALBSHOT={x:VW/2-23,y:VH-70,w:46,h:46};
const ALBREL={x:VW/2-93,y:VH-70,w:46,h:46};   // reload (restart run) in the album
const OVERREL={x:VW/2-100,y:565,w:46,h:46};   // reload on the death screen, left of the shot button
const BIGALB={x:VW/2-80,y:405,w:160,h:70}; // death-screen shortcut to the tree album
const INFOCARD={x:46,y:150,w:VW-92,h:400};
const INFOSHOT={x:INFOCARD.x+INFOCARD.w-58,y:INFOCARD.y+INFOCARD.h-58,w:46,h:46};
function cardAt(lx,ly){
  const cw=182,chh=128,gx=(VW-2*cw)/3;
  for(let i=0;i<NATIVES.length;i++){
    const col=i%2,row=(i/2)|0;
    const x=gx+(cw+gx)*col,y=80+(chh+11)*row;
    if(lx>=x&&lx<=x+cw&&ly>=y&&ly<=y+chh) return i;
  }
  return -1;
}
function downloadShot(){
  cv.toBlob(b=>{
    if(!b) return;
    const a=document.createElement('a');
    a.href=URL.createObjectURL(b);
    a.download='sonoran-doodle.png';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),5000);
  });
}
cv.addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch'&&e.cancelable) e.preventDefault(); // no browser gestures, ever
  initAudio();                        // unlock audio on the first touch gesture
  const [lx,ly]=toLogical(e);
  if(state!=='caught'&&inRect(lx,ly,MUTE)){ toggleMute(); sfxClick(); return; }
  if(state!=='caught'&&inRect(lx,ly,ALB)){ toggleAlbum(); return; }
  if(state==='album'){
    if(infoKind){
      if(inRect(lx,ly,INFOSHOT)) downloadShot();
      else infoKind=null;          // tap anywhere else closes the info card
      return;
    }
    if(inRect(lx,ly,ALBSHOT)){ downloadShot(); return; }
    if(inRect(lx,ly,ALBREL)){ restartRun(); return; }
    const ci=cardAt(lx,ly);
    if(ci>=0&&(treeCounts[NATIVES[ci]]||0)>0){ infoKind=NATIVES[ci]; return; }
    toggleAlbum();                 // tap outside the cards closes the album
    return;
  }
  if(state==='over'){
    if(!btnsShown&&overPlan) overT=overPlan.btnsAt+0.01;      // first tap skips the reveal
    else if(inRect(lx,ly,OVERREL)) restartRun();              // reload button
    else if(inRect(lx,ly,BIGALB)) toggleAlbum();              // big album button
    else restartRun();                                        // any other tap restarts
    return;
  }
  if(state!=='play'||!player) return;
  // press-and-HOLD directly on a nearby palm to replant it
  const wx=lx+cam.x, wy=ly+cam.y;
  const pt=player.plantTree;
  if(pt&&Math.abs(wx-pt.x)<44&&wy>pt.base-100&&wy<pt.base+16){ plantHoldId=e.pointerId; return; }
  // otherwise: hold a side to walk, swipe up anywhere to jump
  ptrSwipe.set(e.pointerId, ly);               // anchor the swipe at the touch point
  setPtrZone(e.pointerId, lx<VW/2?'l':'r');
});
cv.addEventListener('pointermove',e=>{
  const [lx,ly]=toLogical(e);
  if(state==='album'){ hoverCard=cardAt(lx,ly); return; }     // card hover lift
  // only react to PRESSED pointers (in ptrSwipe). Otherwise a hovering mouse
  // with no button held would keep steering the character around.
  if(state!=='play'||!player||e.pointerId===plantHoldId||!ptrSwipe.has(e.pointerId)) return;
  // swipe-up-anywhere -> jump: fire when the finger flicks up past the lowest point it reached
  const low=ptrSwipe.get(e.pointerId);
  if(ly>low) ptrSwipe.set(e.pointerId,ly);       // moved down: lower the anchor
  else if(low-ly>SWIPE_JUMP){ player.jbuf=0.12; ptrSwipe.set(e.pointerId,ly); } // flicked up: jump
  setPtrZone(e.pointerId, lx<VW/2?'l':'r');
});
function endPtr(id){ if(id===plantHoldId) plantHoldId=null; releasePtr(id); ptrSwipe.delete(id); }
cv.addEventListener('pointerup',e=>endPtr(e.pointerId));
cv.addEventListener('pointercancel',e=>endPtr(e.pointerId));

function kLeft(){ return keys.ArrowLeft||keys.KeyA||vk.left; }
function kRight(){ return keys.ArrowRight||keys.KeyD||vk.right; }
function kDown(){ return keys.ArrowDown||keys.KeyS; }

// ================= player =================
function updatePlayer(dt){
  const p=player;
  const move=(kRight()?1:0)-(kLeft()?1:0);
  const planting=p.plantTree&&(kDown()||plantHoldId!==null)&&p.grounded;
  const cap=p.grounded?RUN:AIR;          // faster in the air: leap clean over cops
  const target=planting?0:move*cap;
  const acc=p.grounded?2800:1700;
  if(target>p.vx) p.vx=Math.min(target,p.vx+acc*dt);
  else p.vx=Math.max(target,p.vx-acc*dt);
  if(move) p.dir=move;

  if(p.vx!==0){
    let nx=p.x+p.vx*dt;
    const gy=groundYAt(nx+Math.sign(p.vx)*8);
    if(gy<p.feet-14){ nx=p.x; p.vx=0; }
    else if(p.grounded&&!p.onPlat&&gy<p.feet) p.feet=gy;
    p.x=Math.max(-360,nx);
  }
  if(p.grounded){
    if(p.onPlat){
      const q=p.onPlat;
      if(p.x<q.x-6||p.x>q.x+q.w+6){ p.onPlat=null; p.grounded=false; }
    } else {
      const gy=groundYAt(p.x);
      if(gy-p.feet>14) p.grounded=false;
      else if(gy!==p.feet) p.feet=gy;
    }
  }
  if(p.grounded){ p.coyote=0.09; p.vy=0; }
  else {
    p.coyote-=dt;
    p.vy+=G*dt;
    let nf=p.feet+p.vy*dt;
    if(p.vy>0){
      const gy=groundYAt(p.x);
      // ground is a simple partition of x (never overlaps), so reaching it always
      // means "land" -- no extra guard needed. Crossing into a segment boundary
      // mid-air can leave p.feet already past the new segment's y; requiring
      // p.feet<=gy here used to make that landing un-catchable forever (falling
      // through the world). Platforms DO need the guard below since several can
      // overlap in x at different heights, and we must not snap up onto one
      // already passed.
      if(nf>=gy){ land(); nf=gy; }
      else for(const q of plats){
        if(p.x>=q.x-6&&p.x<=q.x+q.w+6&&p.feet<=q.y+0.01&&nf>=q.y){ land(q); nf=q.y; break; }
      }
    }
    p.feet=nf;
  }
  p.jbuf-=dt;
  if(p.jbuf>0&&(p.grounded||p.coyote>0)){
    p.jbuf=0; p.coyote=0; p.grounded=false; p.onPlat=null; p.vy=-JUMPV;
    dust(p.x,p.feet,5); sfxJump();
  }
  p.anim+=Math.abs(p.vx)*dt*0.06+dt*2;

  // desert heat: hydration drains fast; hitting zero ends the run.
  // ~27s from full (10% faster than before), so keep hunting bottles up top
  const pw=p.water;
  p.water=Math.max(0,p.water-dt/27.3);
  if(pw>=0.25&&p.water<0.25){ sfxLowWater(); waterShake=0.55; } // crossed into the danger zone: alert + shake
  if(p.water<=0&&state==='play') setCaught();
  for(let i=bottles.length-1;i>=0;i--){
    const b=bottles[i];
    if(Math.abs(b.x-p.x)<22&&Math.abs(b.y-p.feet)<44){
      p.water=Math.min(1,p.water+0.15);
      poof(b.x,b.y-14); sfxWater();
      bottles.splice(i,1);
    }
  }

  p.plantTree=null;
  for(const t of trees){
    if(t.kind==='palm'&&t.swapT<0&&Math.abs(t.x-p.x)<48&&Math.abs(t.base-p.feet)<40){ p.plantTree=t; break; }
  }
  for(const t of trees){
    if(t.kind!=='palm'||t.swapT>=0) continue;
    if(t===p.plantTree&&(kDown()||plantHoldId!==null)&&p.grounded&&Math.abs(p.vx)<8){
      t.progress+=dt/0.85;
      if(t.progress>=1) completeSwap(t);
    } else t.progress=Math.max(0,t.progress-dt*(t===p.plantTree?0.45:1.4)); // slow decay nearby: taps can stack
  }
}
function land(q){
  const p=player;
  if(p.vy>260){ dust(p.x,q?q.y:groundYAt(p.x),6); sfxLand(); }
  p.grounded=true; p.onPlat=q||null; p.vy=0;
}
// single funnel for the caught transition so the SFX fires exactly once
function setCaught(){ if(state==='play'){ state='caught'; caughtT=0; sfxCaught(); } }
function completeSwap(t){
  t.swapT=0; t.progress=0; t.kind='native';
  const pool=unlockedNatives();
  t.native=pool[(sr(t.seed+77)*pool.length)|0];
  // points computed BEFORE the count is incremented, so it reflects the stars
  // you currently hold for this species
  const pts=treePoints(t.native);
  score+=pts;
  // just the score pops up here -- the tree's name is already shown by the
  // proximity label (drawTreeLabel), so pushing it here too doubled the text
  floats.push({x:t.x,y:t.base-112,t:0,txt:'+'+pts});
  poof(t.x,t.base-55); sfxPlant();
  // the spot comes alive: an oasis of bushes, flowers and bees
  t.bushes=[];
  const nb=3+((sr(t.seed+201)*3)|0);
  for(let i=0;i<nb;i++){
    const side=i%2?1:-1;
    t.bushes.push({dx:side*(16+sr(t.seed+210+i)*52),s:0.6+sr(t.seed+220+i)*0.55,seed:(t.seed+230+i)|0});
  }
  t.flora=[];
  const nf=4+((sr(t.seed+240)*3)|0);
  for(let i=0;i<nf;i++){
    const side=i%2?1:-1;
    t.flora.push({kind:(sr(t.seed+250+i)*3)|0,dx:side*(24+sr(t.seed+260+i)*72),s:0.7+sr(t.seed+270+i)*0.5,seed:(t.seed+280+i)|0});
  }
  for(let i=0;i<8;i++) parts.push({x:t.x+(Math.random()-.5)*80,y:t.base-36+(Math.random()-.5)*40,vx:(Math.random()-.5)*26,vy:-6-Math.random()*10,t:0,life:2.5+Math.random()*1.8,kind:'bee'});
  const prev=treeCounts[t.native]||0;
  treeCounts[t.native]=prev+1;
  if(prev===0){ if(runNew.indexOf(t.native)<0) runNew.push(t.native); }
  else if(prev<=5&&runStarred.indexOf(t.native)<0) runStarred.push(t.native);
  saveMeta();
  for(const c of cops) if(c.palm===t) c.gone=true;
}

// ================= police =================
function updateCop(c,dt){
  c.t+=dt;
  const diff=Math.max(0,Math.min(1,(player.x-600)/5000));
  const VIS=210+90*diff;
  const CHASE=Math.min(RUN-40,145+45*diff);
  const PATROL=38;
  c.rest=Math.max(0,(c.rest||0)-dt);
  c.flipCd=Math.max(0,(c.flipCd||0)-dt);
  const dx=player.x-c.x, dy=player.feet-c.feet;
  const sees=state==='play'&&c.rest<=0&&Math.sign(dx)===c.dir&&Math.abs(dx)<VIS&&Math.abs(dy)<74;

  const walk=v=>{
    const nx=c.x+v*dt;
    if(c.plat){
      const cl=Math.max(c.min,Math.min(c.max,nx));
      const moved=Math.abs(cl-c.x)>0.01;
      c.x=cl; c.feet=c.plat.y; return moved;
    }
    const ny=groundYAt(nx+Math.sign(v)*7);
    if(ny-c.feet<-26) return false;
    if(ny-c.feet>72) return false;
    c.x=nx; c.feet=groundYAt(nx); return true;
  };

  if(c.state==='patrol'){
    if(c.gone){ c.state='confused'; c.t=0; c.moving=false; }
    else{
      c.moving=walk(c.dir*PATROL);
      // blocked both ways: stand calmly instead of flip-flopping every frame
      if(!c.moving&&c.flipCd<=0){ c.dir*=-1; c.flipCd=0.7; }
      if(c.x>c.max){ c.x=c.max; c.dir=-1; }
      if(c.x<c.min){ c.x=c.min; c.dir=1; }
      if(sees){ c.state='startle'; c.t=0; c.moving=false; sfxStartle(); }
    }
  } else if(c.state==='startle'){
    c.moving=false;
    if(c.t>0.35){ c.state='chase'; c.t=0; c.lost=0; }
  } else if(c.state==='chase'){
    if(Math.abs(dx)>6) c.dir=dx>0?1:-1; // no mirror-jitter when right on top of you
    c.moving=walk(c.dir*CHASE);
    // loses sight quickly when you're clearly above him (platforms are escape routes)
    if(Math.abs(dx)>VIS*1.9||dy<-74||Math.abs(dy)>150) c.lost+=dt; else c.lost=0;
    if(c.t>8){ c.state='tired'; c.t=0; c.moving=false; }           // winded after ~8s
    else if(c.lost>1.0||state!=='play'){ c.state=c.gone?'confused':'return'; c.t=0; }
  } else if(c.state==='tired'){
    c.moving=false;
    if(c.t>1.5){ c.state=c.gone?'confused':'return'; c.t=0; c.rest=2.5; }
  } else if(c.state==='return'){
    if(c.gone){ c.state='confused'; c.t=0; c.moving=false; }
    else{
      c.dir=c.anchor>c.x?1:-1;
      c.moving=walk(c.dir*PATROL);
      if(!c.moving||Math.abs(c.anchor-c.x)<6){ c.state='patrol'; c.t=0; }
      if(sees){ c.state='startle'; c.t=0; sfxStartle(); }
    }
  } else if(c.state==='confused'){
    c.moving=false;
    if(c.t>1.5){ c.state='leave'; c.t=0; c.dir=player.x>c.x?-1:1; }
  } else if(c.state==='leave'){
    c.moving=walk(c.dir*PATROL*1.4);
    if(c.t>6){ poof(c.x,c.feet-25); c.dead=true; }
  }
  if(state==='play'&&c.state!=='confused'&&c.state!=='leave'){
    if(Math.abs(c.x-player.x)<19&&Math.abs(c.feet-player.feet)<46) setCaught();
  }
}

// ================= particles / ambience =================
function dust(x,y,n){
  for(let i=0;i<n;i++) parts.push({x:x+(Math.random()-.5)*14,y:y-2,vx:(Math.random()-.5)*60,vy:-Math.random()*40,t:0,life:.5+Math.random()*.3,kind:'dust'});
}
function poof(x,y){
  for(let i=0;i<10;i++) parts.push({x:x+(Math.random()-.5)*30,y:y+(Math.random()-.5)*40,vx:(Math.random()-.5)*80,vy:-30-Math.random()*60,t:0,life:.6+Math.random()*.4,kind:'poof'});
}
function spoof(x,y){
  for(let i=0;i<9;i++) sparts.push({x:x+(Math.random()-.5)*40,y:y+(Math.random()-.5)*50,vx:(Math.random()-.5)*70,vy:-40-Math.random()*50,g:-10,rot:0,vr:0,t:0,life:.5+Math.random()*.3,kind:'poof'});
}
function confetti(){
  const cols=['#e9c93c','#c0504a','#7fa05a','#5b8db1','#b287c9'];
  for(let i=0;i<54;i++) sparts.push({x:VW/2+(Math.random()-.5)*180,y:272+(Math.random()-.5)*40,vx:(Math.random()-.5)*260,vy:-140-Math.random()*220,g:420,rot:Math.random()*6.3,vr:(Math.random()-.5)*10,t:0,life:1.6+Math.random()*.8,kind:'conf',col:cols[i%5]});
}
function drawSparts(){
  for(const q of sparts){
    const kk=1-q.t/q.life;
    if(q.kind==='poof'){ skCircle(q.x,q.y,3+(1-kk)*7,(q.x*13|0)+1); ink(1.6,C.ink,0.5*kk); }
    else{
      ctx.save(); ctx.translate(q.x,q.y); ctx.rotate(q.rot);
      ctx.globalAlpha=Math.min(1,kk*2); ctx.fillStyle=q.col; ctx.fillRect(-3,-2,6,4);
      ctx.restore(); ctx.globalAlpha=1;
    }
  }
}
function updateWeeds(dt){
  weedTimer-=dt;
  if(weedTimer<=0&&weeds.length<2){
    weedTimer=4+Math.random()*6;
    weeds.push({x:cam.x+VW+80,vx:-40-Math.random()*40,rot:0,r:9+Math.random()*6,seed:(Math.random()*1e9)|0,y:0});
  }
  for(const w of weeds){
    w.x+=w.vx*dt; w.rot+=w.vx*dt/w.r*0.55;
    const gy=groundYAt(w.x);
    w.y=gy-w.r-Math.abs(Math.sin(w.rot*2))*4;
  }
  weeds=weeds.filter(w=>w.x>cam.x-300&&groundYAt(w.x)<3000);
}

// ================= drawing: terrain =================
function drawGround(){
  const x0=cam.x-60, x1=cam.x+VW+60;
  const vis=segs.filter(s=>s.x1>x0&&s.x0<x1);
  if(!vis.length) return;
  const bot=cam.y+VH+80;
  const pts=[];
  for(const s of vis) pts.push([s.x0,s.y],[s.x1,s.y]);
  const edgeSeed=i=>(Math.round(pts[i][0])*31+Math.round(pts[i][1])*7)|0;

  ctx.beginPath();
  ctx.moveTo(pts[0][0],bot); ctx.lineTo(pts[0][0],pts[0][1]);
  for(let i=1;i<pts.length;i++) jseg(pts[i-1][0],pts[i-1][1],pts[i][0],pts[i][1],edgeSeed(i-1),2.4);
  ctx.lineTo(pts[pts.length-1][0],bot); ctx.closePath();
  fillA(C.sand);

  ctx.beginPath();
  ctx.moveTo(pts[0][0],pts[0][1]);
  for(let i=1;i<pts.length;i++) jseg(pts[i-1][0],pts[i-1][1],pts[i][0],pts[i][1],edgeSeed(i-1),2.4);
  ink(2.4);

  for(const s of vis){
    for(let x=Math.ceil(s.x0/48)*48;x<s.x1;x+=48){
      const r=sr(x*7+worldSeed);
      if(r<0.3){ skLine(x,s.y+srr(x,8,26),x+srr(x+1,5,10),s.y+srr(x+2,10,30),x|0,1); ink(1.2,C.ink,0.3); }
      else if(r<0.55){ skLine(x,s.y,x+srr(x+3,-3,3),s.y-srr(x+4,5,10),x|0,0.8); ink(1.4,'#9aa86b',0.8); }
    }
  }
}
function drawPlat(p){
  const s=(p.x*13)|0;
  skPath([[p.x,p.y],[p.x+p.w,p.y],[p.x+p.w-7,p.y+16],[p.x+7,p.y+16]],s,2,true);
  fillA(C.rock); ink(2.2);
  for(let i=0;i<3;i++){
    skLine(p.x+10+i*(p.w-20)/3,p.y+14,p.x+16+i*(p.w-20)/3,p.y+4,s+i*7,1);
    ink(1.2,C.ink,0.3);
  }
}

// ================= drawing: flora =================
function drawPalm(x,y,seed,k){
  ctx.save(); ctx.translate(x,y); ctx.scale(1+(1-k)*0.5,Math.max(0.05,k));
  const L=srr(seed,-1,1)*20;
  const tp=quadPts([0,0],[L*0.5,-40],[L,-76],8);
  tube(tp,7,C.palmT,seed);
  for(let i=2;i<tp.length-1;i+=2){
    skLine(tp[i][0]-4,tp[i][1],tp[i][0]+4,tp[i][1],seed+3+i,0.5);
    ink(1.1,C.ink,0.45);
  }
  const tx=tp[8][0], ty=tp[8][1];
  for(let i=0;i<6;i++){
    const a=-Math.PI*(0.11+0.78*i/5);
    const droop=8+Math.abs(Math.cos(a))*10;
    const ex=tx+Math.cos(a)*34, ey=ty+Math.sin(a)*20;
    const fp=quadPts([tx,ty],[tx+Math.cos(a)*18,ty+Math.sin(a)*26-8],[ex,ey+droop],7);
    strokePts(fp,3.2,C.palmG);
    skPath(fp,seed+9+i,1.2); ink(1.4,C.ink,0.6);
  }
  skCircle(tx-4,ty-1,3,seed+30); fillA('#8a6a42'); ink(1.4);
  skCircle(tx+4,ty+1,3,seed+31); fillA('#8a6a42'); ink(1.4);
  ctx.restore();
}
function drawPaloVerde(seed){
  tube(quadPts([0,0],[1,-14],[0,-28],4),7,C.pvGreen,seed);
  tube(quadPts([0,-24],[-8,-40],[-18,-56],5),4.5,C.pvGreen,seed+3);
  tube(quadPts([0,-26],[7,-42],[17,-60],5),4.5,C.pvGreen,seed+6);
  skLine(-12,-48,-22,-58,seed+9,1); ink(2,C.pvGreen);
  skLine(10,-50,20,-62,seed+10,1); ink(2,C.pvGreen);
  skLine(-4,-38,-2,-52,seed+11,1); ink(2,C.pvGreen);
  for(let i=0;i<26;i++){
    const bx=(sr(seed+20+i)-.5)*64, by=-56+(sr(seed+50+i)-.5)*26;
    ctx.beginPath(); ctx.arc(bx,by,1.9,0,7); fillA(C.pvBloom,0.95);
  }
  for(let i=0;i<8;i++){
    const bx=(sr(seed+80+i)-.5)*60, by=-56+(sr(seed+90+i)-.5)*24;
    skCircle(bx,by,3,seed+100+i,0.8); ink(1,C.ink,0.18);
  }
}
function drawMesquite(seed){
  tube(quadPts([-3,0],[-6,-18],[2,-34],5),6,C.mesqT,seed);
  tube(quadPts([2,-30],[-10,-42],[-18,-50],4),3.5,C.mesqT,seed+3);
  tube(quadPts([2,-30],[12,-44],[16,-52],4),3.5,C.mesqT,seed+6);
  for(let i=0;i<46;i++){
    const a=sr(seed+20+i)*6.283, rr2=Math.sqrt(sr(seed+80+i));
    const bx=Math.cos(a)*rr2*36, by=-52+Math.sin(a)*rr2*16;
    skLine(bx-3,by,bx+3,by-2,seed+140+i,0.8); ink(1.6,C.mesqG,0.85);
  }
  skEllipse(0,-52,38,18,seed+9); ink(1.4,C.ink,0.3);
  for(let i=0;i<3;i++){
    const px=-14+i*13;
    strokePts(quadPts([px,-44],[px+2,-38],[px+1,-32],4),2.2,C.mesqPod);
  }
}
function drawIronwood(seed){
  tube(quadPts([0,0],[-2,-16],[-1,-32],4),8,C.ironT,seed);
  tube(quadPts([-1,-28],[-9,-38],[-14,-46],4),4,C.ironT,seed+3);
  tube(quadPts([-1,-28],[8,-40],[12,-46],4),4,C.ironT,seed+6);
  skCircle(0,-52,26,seed+9,2.5); fillA(C.ironG,0.4); ink(1.6,C.ink,0.5);
  for(let i=0;i<34;i++){
    const a=sr(seed+20+i)*6.283, rr2=Math.sqrt(sr(seed+80+i))*22;
    const bx=Math.cos(a)*rr2, by=-52+Math.sin(a)*rr2*0.8;
    skLine(bx-2.5,by,bx+2.5,by-1.5,seed+140+i,0.6); ink(1.4,C.ironG);
  }
  for(let i=0;i<12;i++){
    const a=sr(seed+200+i)*6.283, rr2=Math.sqrt(sr(seed+230+i))*22;
    ctx.beginPath(); ctx.arc(Math.cos(a)*rr2,-52+Math.sin(a)*rr2*0.8,1.7,0,7); fillA(C.ironBloom);
  }
}
function drawWillow(seed){
  tube(quadPts([0,0],[2,-20],[-1,-42],5),5,C.wilT,seed);
  tube(quadPts([-1,-38],[-8,-46],[-13,-52],4),3,C.wilT,seed+3);
  tube(quadPts([-1,-38],[7,-48],[11,-54],4),3,C.wilT,seed+6);
  for(let i=0;i<14;i++){
    const sx=(sr(seed+20+i)-.5)*26, sy=-46+(sr(seed+40+i)-.5)*14;
    strokePts(quadPts([sx,sy],[sx+(sr(seed+60+i)-.5)*30,sy+6],[sx+(sr(seed+80+i)-.5)*36,sy+22],5),1.8,C.wilG,0.9);
  }
  for(let i=0;i<8;i++){
    const bx=(sr(seed+100+i)-.5)*40, by=-42+(sr(seed+120+i)-.5)*20;
    ctx.beginPath(); ctx.arc(bx,by,2,0,7); fillA(C.wilBloom);
  }
}
function drawTorote(seed){
  // elephant tree: fat squat reddish trunk, papery bark, tiny leaves
  tube(quadPts([0,0],[-2,-12],[-2,-24],4),13,'#a5654e',seed);
  tube(quadPts([-2,-20],[-12,-30],[-20,-36],4),6,'#a5654e',seed+3);
  tube(quadPts([-2,-22],[8,-34],[16,-40],4),6,'#a5654e',seed+6);
  tube(quadPts([-2,-24],[0,-34],[-2,-44],4),5,'#a5654e',seed+9);
  skLine(-5,-10,-1,-14,seed+12,0.8); ink(1.2,'#7c4a38',0.7);
  skLine(2,-16,5,-12,seed+13,0.8); ink(1.2,'#7c4a38',0.7);
  for(let i=0;i<16;i++){
    const t=[[-20,-38],[16,-42],[-2,-46]][i%3];
    ctx.beginPath(); ctx.arc(t[0]+(sr(seed+30+i)-.5)*14,t[1]+(sr(seed+50+i)-.5)*10,1.6,0,7);
    fillA('#7db35a');
  }
}
function drawUnaGato(seed){
  // catclaw acacia: scraggly stems, feathery leaves, pale yellow catkins
  tube(quadPts([-2,0],[-8,-16],[-14,-30],4),3.5,'#4f4335',seed);
  tube(quadPts([0,0],[2,-18],[0,-36],4),4,'#4f4335',seed+3);
  tube(quadPts([2,0],[10,-14],[16,-28],4),3.5,'#4f4335',seed+6);
  for(let i=0;i<26;i++){
    const bx=(sr(seed+20+i)-.5)*44, by=-34+(sr(seed+50+i)-.5)*16;
    skLine(bx-2.5,by,bx+2.5,by-1.5,seed+90+i,0.6); ink(1.4,C.mesqG,0.8);
  }
  for(let i=0;i<6;i++){
    const bx=(sr(seed+130+i)-.5)*40, by=-32+(sr(seed+150+i)-.5)*14;
    strokePts([[bx,by],[bx+1,by+6]],3.4,'#e6d77b',0.9);
  }
  skLine(1,-12,4,-10,seed+170,0.4); ink(1.2,C.ink,0.5);
  skLine(-4,-20,-1,-19,seed+171,0.4); ink(1.2,C.ink,0.5);
}
function drawPaloDulce(seed){
  // kidneywood: slender pale trunk, airy canopy, white flower spikes
  tube(quadPts([0,0],[1,-16],[-1,-34],5),4.5,'#9b968c',seed);
  tube(quadPts([-1,-30],[-7,-40],[-11,-48],4),2.8,'#9b968c',seed+3);
  tube(quadPts([-1,-30],[6,-42],[9,-50],4),2.8,'#9b968c',seed+6);
  for(let i=0;i<22;i++){
    const bx=(sr(seed+20+i)-.5)*36, by=-46+(sr(seed+50+i)-.5)*14;
    skLine(bx-2.5,by,bx+2.5,by-1,seed+90+i,0.6); ink(1.4,'#86a75a',0.85);
  }
  for(let i=0;i<5;i++){
    const bx=(sr(seed+130+i)-.5)*30, by=-50+(sr(seed+150+i)-.5)*10;
    for(let j=0;j<4;j++){ ctx.beginPath(); ctx.arc(bx,by-j*2.6,1.1,0,7); fillA('#f6f2e4'); }
  }
}
function drawGuayacan(seed){
  // guayacán: short dark trunk, dense deep-green dome, violet blooms
  tube(quadPts([0,0],[-2,-10],[-1,-22],4),6,'#5c5246',seed);
  tube(quadPts([-1,-18],[-8,-26],[-12,-32],4),3.2,'#5c5246',seed+3);
  tube(quadPts([-1,-20],[6,-28],[10,-34],4),3.2,'#5c5246',seed+6);
  skCircle(0,-40,22,seed+9,2.2); fillA('#4e7a4a',0.5); ink(1.6,C.ink,0.5);
  for(let i=0;i<30;i++){
    const a=sr(seed+20+i)*6.283, rr2=Math.sqrt(sr(seed+60+i))*19;
    skLine(Math.cos(a)*rr2-2,-40+Math.sin(a)*rr2*0.85,Math.cos(a)*rr2+2,-40+Math.sin(a)*rr2*0.85-1.5,seed+100+i,0.5);
    ink(1.4,'#4e7a4a');
  }
  for(let i=0;i<10;i++){
    const a=sr(seed+140+i)*6.283, rr2=Math.sqrt(sr(seed+160+i))*19;
    ctx.beginPath(); ctx.arc(Math.cos(a)*rr2,-40+Math.sin(a)*rr2*0.85,1.8,0,7); fillA('#7a5fb5');
  }
}
function drawNative(kind,x,y,seed,k){
  ctx.save(); ctx.translate(x,y); ctx.scale(k,k);
  if(kind==='paloverde') drawPaloVerde(seed);
  else if(kind==='mesquite') drawMesquite(seed);
  else if(kind==='ironwood') drawIronwood(seed);
  else if(kind==='willow') drawWillow(seed);
  else if(kind==='torote') drawTorote(seed);
  else if(kind==='unagato') drawUnaGato(seed);
  else if(kind==='palodulce') drawPaloDulce(seed);
  else drawGuayacan(seed);
  ctx.restore();
}
function drawBottle(b){
  const yy=b.y-12+Math.sin(tm*3+b.seed)*3;
  ctx.save(); ctx.translate(b.x,yy);
  skPath([[-5,10],[5,10],[6,0],[3,-4],[3,-8],[-3,-8],[-3,-4],[-6,0]],b.seed,0.8,true);
  fillA('#bfe3f2',0.92); ink(2,'#4a7fa5');
  skPath([[-3,-8],[3,-8],[3,-13],[-3,-13]],b.seed+1,0.5,true); fillA('#4a7fa5'); ink(1.4,'#2f5a7a');
  skLine(-2,3,2,5,b.seed+2,0.4); ink(1.2,'#ffffff',0.85);
  ctx.restore();
}
function drawOcotillo(x,y,seed,s){
  ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
  for(let i=0;i<5;i++){
    const a=-Math.PI/2+(i-2)*0.22;
    const ex=Math.cos(a)*26, ey=Math.sin(a)*26;
    strokePts(quadPts([0,0],[ex*0.5,ey*0.7],[ex,ey],5),1.8,'#7d9a5e',0.95);
    ctx.beginPath(); ctx.arc(ex,ey,1.9,0,7); fillA('#e8654f');
  }
  ctx.restore();
}
function drawAgave(x,y,seed,s){
  ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
  for(let i=0;i<7;i++){
    const a=-Math.PI/2+(i-3)*0.32;
    skLine(0,0,Math.cos(a)*15,Math.sin(a)*15,seed+i,1);
    ink(2.6,'#4f9e8a',0.95);
  }
  ctx.restore();
}
function drawPoppies(x,y,seed,s){
  ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
  for(let i=0;i<4;i++){
    const px=(sr(seed+i)-.5)*16, ph=6+sr(seed+9+i)*7;
    skLine(px,0,px,-ph,seed+i,0.5); ink(1.3,'#6f9e58');
    ctx.beginPath(); ctx.arc(px,-ph-1.5,2.4,0,7); fillA('#f2a03d');
    ctx.beginPath(); ctx.arc(px,-ph-1.5,1,0,7); fillA('#e8654f');
  }
  ctx.restore();
}
function drawGreenBush(x,y,seed,s){
  ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
  for(let i=0;i<6;i++){
    const a=-Math.PI*(0.12+0.76*i/5);
    skLine(0,0,Math.cos(a)*13,Math.sin(a)*12-2,seed+i,1.4);
    ink(1.6,'#6f9e58',0.75);
  }
  ctx.beginPath(); ctx.arc(-4,-9,1.4,0,7); fillA('#e9c93c',0.9);
  ctx.beginPath(); ctx.arc(5,-7,1.4,0,7); fillA('#d886a8',0.9);
  ctx.restore();
}
function drawTree(t){
  if(t.swapT<0) drawPalm(t.x,t.base,t.seed,1);
  else if(t.swapT<0.22) drawPalm(t.x,t.base,t.seed,1-t.swapT/0.22);
  else {
    const g=Math.min(1,(t.swapT-0.22)/0.9);
    const k=(0.3+0.7*g)*(1+0.15*Math.sin(g*Math.PI));
    // the restored spot becomes a little oasis: layered saturated greens,
    // a pond, wildflowers and desert plants (pure decoration, no labels)
    if(t.bushes){
      const gg=Math.min(1,Math.max(0,(t.swapT-0.45)/1.3));
      if(gg>0){
        ctx.beginPath(); ctx.ellipse(t.x,t.base+7,128*gg,13*gg,0,0,7); fillA('#58b368',0.32);
        ctx.beginPath(); ctx.ellipse(t.x,t.base+4,84*gg,9*gg,0,0,7); fillA('#7ecb70',0.4);
        const pdx=(t.seed%2?1:-1)*44;
        ctx.beginPath(); ctx.ellipse(t.x+pdx,t.base+3,20*gg,4.5*gg,0,0,7); fillA('#69b7dd',0.9);
        ctx.beginPath(); ctx.ellipse(t.x+pdx-4,t.base+2,8*gg,1.6*gg,0,0,7); fillA('#ffffff',0.55);
        for(let i=0;i<12;i++){
          const gxr=t.x+(sr(t.seed+300+i)-.5)*200*gg;
          skLine(gxr,t.base,gxr+srr(t.seed+310+i,-3,3),t.base-srr(t.seed+320+i,6,14),(t.seed+i)|0,0.8);
          ink(1.6,'#4caf6d',0.85*gg);
        }
        if(t.flora) for(const f of t.flora){
          const fs=f.s*Math.min(1,gg*1.25);
          if(f.kind===0) drawOcotillo(t.x+f.dx,t.base,f.seed,fs);
          else if(f.kind===1) drawAgave(t.x+f.dx,t.base,f.seed,fs);
          else drawPoppies(t.x+f.dx,t.base,f.seed,fs);
        }
        for(const b of t.bushes) drawGreenBush(t.x+b.dx,t.base,b.seed,b.s*Math.min(1,gg*1.3));
      }
    }
    drawNative(t.native,t.x,t.base,t.seed,k);
  }
}

// ================= drawing: scenery =================
function drawSaguaro(seed){
  tube([[0,0],[0,-30],[0,-56],[-1,-74]],15,C.sag,seed);
  skCircle(-1,-76,7.5,seed+1,1); fillA(C.sag); ink(1.8);
  tube([[-7,-40],[-17,-44],[-19,-56],[-18,-66]],9,C.sag,seed+2);
  skCircle(-18,-68,4.5,seed+3,0.8); fillA(C.sag); ink(1.6);
  if(sr(seed+4)<0.6){
    tube([[7,-30],[16,-35],[18,-48]],9,C.sag,seed+5);
    skCircle(18,-50,4.5,seed+6,0.8); fillA(C.sag); ink(1.6);
  }
  skLine(-3,-6,-3,-66,seed+7,1); ink(1,C.ink,0.3);
  skLine(2,-6,2,-70,seed+8,1); ink(1,C.ink,0.3);
  for(let i=0;i<8;i++){
    const yy=-10-i*8;
    skLine(-8,yy,-11,yy-2,seed+9+i,0.4); ink(1,C.ink,0.4);
  }
  if(sr(seed+30)<0.5){
    skCircle(-1,-84,3,seed+31); fillA('#fff8ec'); ink(1.4);
    ctx.beginPath(); ctx.arc(-1,-84,1.2,0,7); fillA(C.pvBloom);
  }
}
function drawRock(seed,s){
  ctx.save(); ctx.scale(s,s*0.7);
  skCircle(0,-9,11,seed,2); fillA(C.rock); ink(2);
  ctx.restore();
  skLine(-3*s,-8*s,3*s,-4*s,seed+1,0.6); ink(1,C.ink,0.3);
}
function drawSkull(seed){
  skCircle(0,-6,5.5,seed,1); fillA('#f3ead6'); ink(1.8);
  skPath(quadPts([-5,-9],[-11,-13],[-13,-7],4),seed+1,0.8); ink(1.8);
  skPath(quadPts([5,-9],[11,-13],[13,-7],4),seed+2,0.8); ink(1.8);
  ctx.beginPath(); ctx.arc(-2,-7,1.1,0,7); fillA(C.ink);
  ctx.beginPath(); ctx.arc(2,-7,1.1,0,7); fillA(C.ink);
}
function drawBrush(seed){
  for(let i=0;i<6;i++){
    const a=-Math.PI*(0.15+0.7*i/5);
    skLine(0,0,Math.cos(a)*14,Math.sin(a)*13-3,seed+i,1.5);
    ink(1.4,'#a08a5c',0.7);
  }
}
function drawCar(seed){
  const col=['#b95b4d','#5b7fb4','#d8d4c8','#7ba05b','#c9a54a'][(sr(seed)*5)|0];
  skPath([[-34,-8],[-36,-14],[-30,-17],[-14,-17],[-8,-25],[12,-25],[20,-17],[32,-16],[36,-12],[35,-8]],seed+1,1.2,true);
  fillA(col);
  skPath([[-6,-18],[-3,-23],[10,-23],[15,-18]],seed+2,0.8,true); fillA('#e8ecef',0.85);
  skCircle(-20,-6,6,seed+3,1); fillA('#3a3a3a');
  skCircle(20,-6,6,seed+4,1); fillA('#3a3a3a');
  skCircle(-20,-6,2.4,seed+5,0.5); fillA('#efece4');
  skCircle(20,-6,2.4,seed+6,0.5); fillA('#efece4');
}
function drawWreck(seed){
  // a crumpled, angular wreck -- deliberately different from the parked car
  const col=['#8a5b52','#556788','#7c7a6e','#8a7a4a'][(sr(seed)*4)|0];
  skPath([[-30,-7],[-33,-16],[-16,-16],[-9,-27],[6,-22],[9,-14],[30,-15],[32,-9],[28,-7]],seed+1,2.4,true);
  fillA(col);
  // crumpled hood creases
  skLine(9,-14,15,-20,seed+2,1.4); ink(1.6,'#2c2c2c',0.5);
  skLine(15,-20,22,-13,seed+3,1.4); ink(1.6,'#2c2c2c',0.5);
  // shattered windshield
  skPath([[-11,-16],[-6,-24],[3,-21]],seed+4,1,true); fillA('#b9c2c8',0.7);
  skLine(-8,-22,-4,-17,seed+5,0.6); ink(1,'#2c2c2c',0.5);
  // wheels (one splayed)
  skCircle(-18,-5,5.5,seed+6,1.2); fillA('#3a3a3a');
  skCircle(19,-4,5.5,seed+7,1.2); fillA('#3a3a3a');
}
function drawCrash(seed){
  drawCar(seed);                       // the parked car that got hit
  ctx.save();
  ctx.translate(38,0); ctx.rotate(-0.16); ctx.scale(0.96,0.96);
  drawWreck(seed+40);                  // the wreck rammed into its rear
  ctx.restore();
  // a faint smoke puff rising from the impact
  skCircle(24,-30,5,seed+80,1.4); fillA('#c9c4b8',0.5);
  skCircle(30,-38,4,seed+81,1.4); fillA('#c9c4b8',0.4);
}
function drawScen(o){
  ctx.save(); ctx.translate(o.x,o.y); ctx.scale(o.s,o.s);
  if(o.kind==='saguaro') drawSaguaro(o.seed);
  else if(o.kind==='rock') drawRock(o.seed,1);
  else if(o.kind==='rockpile'){ drawRock(o.seed,1.5); ctx.translate(-15,0); drawRock(o.seed+2,1); ctx.translate(29,0); drawRock(o.seed+3,0.8); }
  else if(o.kind==='skull') drawSkull(o.seed);
  else if(o.kind==='brush') drawBrush(o.seed);
  else if(o.kind==='car') drawCar(o.seed);
  else if(o.kind==='crash') drawCrash(o.seed);
  ctx.restore();
}
function drawWeed(w){
  skCircle(w.x,w.y,w.r,w.seed,3); ink(1.6,'#a08a5c',0.8);
  skCircle(w.x,w.y,w.r*0.55,w.seed+3,2.4); ink(1.2,'#a08a5c',0.5);
}

// rope-like hair sim: integrates the tip displacement (hx,hy) toward a target
// set by the character's velocity, with an underdamped spring so it overshoots
// and eases back — trailing opposite to motion, flying up while falling.
function updateHair(p,dt){
  if(!p) return;
  if(p.hx===undefined){ p.hx=0; p.hy=0; p.hvx=0; p.hvy=0; }
  dt=Math.min(1/30,dt);
  const vx=p.vx||0, vy=p.vy||0;
  const tx=Math.max(-20,Math.min(20,-vx*0.05));   // trail opposite horizontal motion
  const ty=Math.max(-22,Math.min(9,-vy*0.03));    // vy>0 (falling) -> up; jumping -> down
  const stiff=55, damp=10;                          // underdamped -> rope-like overshoot
  p.hvx+=(stiff*(tx-p.hx)-damp*p.hvx)*dt; p.hx+=p.hvx*dt;
  p.hvy+=(stiff*(ty-p.hy)-damp*p.hvy)*dt; p.hy+=p.hvy*dt;
  p.hx=Math.max(-26,Math.min(26,p.hx)); p.hy=Math.max(-28,Math.min(14,p.hy));
}

// ================= drawing: characters =================
function drawCowboy(p){
  const m=Math.abs(p.vx)>10, ph=p.anim*6;
  const planting=p.plantTree&&(kDown()||plantHoldId!==null)&&p.grounded&&state==='play';
  ctx.save(); ctx.translate(p.x,p.feet); ctx.scale(p.dir,1);
  if(planting) ctx.rotate(0.12);
  const lsw=m?Math.sin(ph)*5:0, lsw2=m?Math.sin(ph+Math.PI)*5:0;
  // the head/hair group is authored around x=2 (a forward lean). Pull it back
  // over the body's center when still, so he only leans forward while running.
  const lean=Math.min(1,Math.abs(p.vx)/RUN);
  const headBack=-2*(1-lean);
  // back hair: a tight column of strands right behind the body (drawn first),
  // bending with rope-like physics simulated in updateHair(). hx/hy are the tip
  // displacement -- lags opposite to motion, up while falling, eases home at rest.
  const hy=p.hy||0, hxd=(p.hx||0)*p.dir;         // hxd: world-space lag mapped into the mirrored local frame,
                                                 // so the hair trails behind correctly whichever way he faces
  // strands spread across the face and start at eye level, so the outer ones
  // frame the face; wide stroke + small wobble => one solid hair mass, no gaps
  const bxs=[-4,-1.6,0.8,3.2,5.6,8];
  for(let i=0;i<6;i++){
    const bx=bxs[i]+headBack;
    const tipx=bx+hxd, tipy=-19+hy;              // displaced tip -- half the shirt's length (16) below its top
    const midx=bx+hxd*0.42, midy=-28.5+hy*0.42;  // rope bends toward the tip
    skPath(quadPts([bx,-34],[midx,midy],[tipx,tipy],7),140+i,0.45); ink(3.2,C.hair);
  }
  // bare legs (skin) — showing below the jorts (centered stance)
  skLine(-2.5,-9,-2.5+lsw,0,11,0.8); ink(2.8,C.skin);
  skLine(2.5,-9,2.5+lsw2,0,12,0.8); ink(2.8,C.skin);
  // denim jorts (cut-off shorts over the hips) -- narrow body, thinner than the hair
  skPath([[-5,-9],[5,-9],[4.5,-17],[-4.5,-17]],131,1,true); fillA(C.jeans); ink(2);
  skLine(0,-16,0,-9,132,0.4); ink(1.4,C.ink); // fly seam (black)
  // white short-sleeve tee (torso kept thinner than the hair)
  skPath([[-5,-11],[5,-11],[4,-27],[-4,-27]],13,1.2,true); fillA(C.tee); ink(2.2);
  // head group -- shifted back to center when still, forward when running
  ctx.save(); ctx.translate(headBack,0);
  skCircle(2,-33,6.5,18); fillA(C.skin); ink(2);
  // middle-parted hair on top (hairline stays above the eyes)
  skPath(quadPts([2,-41],[-4.5,-41.5],[-6,-31],6).concat([[-4,-33.5],[0,-38.5]]),41,0.9,true);
  fillA(C.hair); ink(1.4);
  skPath(quadPts([2,-41],[8.5,-41.5],[10,-31],6).concat([[8,-33.5],[4,-38.5]]),42,0.9,true);
  fillA(C.hair); ink(1.4);
  // beard: just a soft curve along the jaw
  skPath(quadPts([-1.5,-29],[2.5,-23.5],[6.5,-29],7),35,0.6); ink(2,C.hair);
  // small moustache curve
  skLine(-0.5,-30.8,5.5,-30.8,36,0.4); ink(1.8,C.hair);
  // eyes
  ctx.beginPath(); ctx.arc(4.5,-34.5,1,0,7); fillA(C.ink);
  ctx.beginPath(); ctx.arc(0.5,-34.5,1,0,7); fillA(C.ink);
  ctx.restore();
  ctx.restore();
}
function drawCop(c){
  const chase=c.state==='chase', tired=c.state==='tired', ph=tm*(chase?13:6)+c.seed;
  const m=!!c.moving&&(c.state==='patrol'||chase||c.state==='return'||c.state==='leave');
  const lsw=m?Math.sin(ph)*(chase?6:3):0, lsw2=m?Math.sin(ph+Math.PI)*(chase?6:3):0;
  ctx.save(); ctx.translate(c.x,c.feet); ctx.scale(c.dir,1);
  if(chase) ctx.rotate(0.1);
  if(tired) ctx.rotate(0.16);
  // legs: dark navy tactical pants
  skLine(-2,-15,-2+lsw,0,c.seed+1,0.8); ink(2.8,C.copPants);
  skLine(3,-15,3+lsw2,0,c.seed+2,0.8); ink(2.8,C.copPants);
  // navy shirt
  skPath([[-8,-14],[8,-14],[6,-30],[-6,-30]],c.seed+3,1.2,true); fillA(C.copShirt); ink(2.2);
  // black tactical vest with pockets
  skPath([[-6.5,-15],[6.5,-15],[5.5,-28],[-5.5,-28]],c.seed+21,1,true); fillA(C.vest); ink(1.8);
  skPath([[-4.5,-18],[-1,-18],[-1,-22],[-4.5,-22]],c.seed+22,0.6,true); fillA(C.copShirt,0.8); ink(1);
  skPath([[1,-18],[4.5,-18],[4.5,-22],[1,-22]],c.seed+23,0.6,true); fillA(C.copShirt,0.8); ink(1);
  skLine(-5.5,-25,5.5,-25,c.seed+24,0.5); ink(1,'#0e1218',0.7);
  // white patch + badge
  skCircle(-3,-27,1.8,c.seed+5,0.5); fillA(C.patch); ink(1);
  ctx.beginPath(); ctx.arc(3.4,-27,1.2,0,7); fillA(C.badge);
  // head
  skCircle(2,-37,6,c.seed+9); fillA('#e0b183'); ink(2);
  // sunglasses + small moustache
  skLine(-3,-38.5,8,-38.5,c.seed+10,0.5); ink(2.6,'#181818');
  skLine(1,-34.5,6,-34.5,c.seed+11,0.4); ink(1.8,'#2a211b');
  // short dark hair
  skPath(quadPts([2,-43.5],[-3.5,-44],[-4,-37],5).concat([[2,-40]]),c.seed+30,0.8,true);
  fillA('#2a241e'); ink(1.2);
  skPath(quadPts([2,-43.5],[7.5,-44],[8,-37],5).concat([[2,-40]]),c.seed+31,0.8,true);
  fillA('#2a241e'); ink(1.2);
  ctx.restore();
  if(c.state==='startle'||(chase&&c.t<0.9)) drawBang(c.x,c.feet-64);
  if(c.state==='confused') drawQuest(c.x,c.feet-64);
  if(c.state==='tired') drawSigh(c.x,c.feet,c.dir,c.t);
}
function drawSigh(x,y,dir,t){
  const u=t%0.9;
  // a little breath puff drifting away
  skCircle(x+dir*9+u*10*dir,y-33-u*3,1.6+u*2.4,(x|0)+91,0.8);
  ink(1.6,C.ink,Math.max(0,0.55-u*0.55));
  // sweat drop sliding down
  const dy=Math.min(4,t*6);
  skCircle(x-dir*3,y-44+dy,2.1,(x|0)+92,0.5);
  fillA('#9fcdea'); ink(1.2,'#5b8db1',0.8);
}
function drawBang(x,y){
  skLine(x,y,x,y+9,(x|0)+3,0.6); ink(3.2,C.alert);
  ctx.beginPath(); ctx.arc(x,y+14,1.7,0,7); fillA(C.alert);
}
function drawQuest(x,y){
  const pts=quadPts([x-4,y+1],[x+6,y-7],[x+3,y+5],6);
  pts.push([x,y+8]);
  strokePts(pts,2.4,'#777');
  ctx.beginPath(); ctx.arc(x,y+13,1.5,0,7); fillA('#777');
}
function drawStars(x,y){
  for(let i=0;i<3;i++){
    const a=tm*5+i*2.09;
    const sx=x+Math.cos(a)*17, sy=y+Math.sin(a)*6-2;
    skLine(sx-3,sy,sx+3,sy,i+61,0.4); ink(1.8,C.alert,0.9);
    skLine(sx,sy-3,sx,sy+3,i+64,0.4); ink(1.8,C.alert,0.9);
  }
}

// ================= drawing: fx =================
function drawParts(){
  for(const q of parts){
    const kk=1-q.t/q.life;
    if(q.kind==='dust'){ ctx.beginPath(); ctx.arc(q.x,q.y,2+(1-kk)*4,0,7); fillA('#cbb98d',0.5*kk); }
    else if(q.kind==='bee'){
      const a=Math.min(1,kk*2.5);
      const bx=q.x+Math.sin(q.t*8+q.x*0.1)*10, by=q.y+Math.sin(q.t*12)*5;
      ctx.beginPath(); ctx.arc(bx,by,2,0,7); fillA('#e9c93c',a);
      skLine(bx-2,by,bx+2,by,(q.x|0)+7,0.3); ink(1.1,C.ink,a*0.9);
      ctx.beginPath(); ctx.arc(bx-1,by-2.6,1.2,0,7); fillA('#ffffff',a*0.8);
    }
    else { skCircle(q.x,q.y,3+(1-kk)*7,(q.x*13|0)+1); ink(1.6,C.ink,0.5*kk); }
  }
}
function drawFloats(){
  ctx.textAlign='center'; ctx.textBaseline='middle';
  for(const f of floats){
    const life=f.life||1.2;
    ctx.font=(f.small?'700 15px ':'700 22px ')+FONT;
    ctx.fillStyle=C.ink; ctx.globalAlpha=Math.max(0,1-f.t/life);
    ctx.fillText(f.txt,f.x,f.y-f.t*(f.small?14:30));
    ctx.globalAlpha=1;
  }
}
function drawProgress(t){
  const x=t.x, y=t.base-96;
  ctx.beginPath(); ctx.arc(x,y,10,-Math.PI/2,-Math.PI/2+t.progress*6.283);
  ink(4,'#6b9a4e',0.9);
  skCircle(x,y,10,t.seed+9); ink(1.4,C.ink,0.35);
}
function drawHint(t){
  // "press and hold here": a fingertip with touch ripples, gently bobbing
  const y=t.base-98+Math.sin(tm*5)*3, x=t.x;
  skLine(x,y-12,x,y-2,t.seed+98,0.5); ink(3,C.skin);
  skCircle(x,y+2,4.5,t.seed+99,0.7); fillA(C.skin); ink(1.8);
  ctx.beginPath(); ctx.arc(x,y+3,10,-2.5,-0.6); ink(1.8,C.ink,0.55);
  ctx.beginPath(); ctx.arc(x,y+3,15,-2.3,-0.8); ink(1.6,C.ink,0.32);
}
function drawTreeLabel(t){
  const dx=Math.abs(t.x-player.x), dy=Math.abs(t.base-player.feet);
  const R=110, RY=140;
  if(dx>R||dy>RY) return;
  const a=Math.min(1,(R-dx)/26);
  ctx.font='700 15px '+FONT;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle=C.ink; ctx.globalAlpha=Math.max(0,a);
  ctx.fillText(ES[t.native],t.x,t.base-92);
  ctx.globalAlpha=1;
}

// ================= drawing: ui widgets =================
function drawMiniTree(x,y){
  skLine(x,y+9,x,y-4,901,0.6); ink(2.6,C.pvGreen);
  skLine(x,y-1,x-6,y-9,902,0.6); ink(2,C.pvGreen);
  skLine(x,y-1,x+6,y-10,903,0.6); ink(2,C.pvGreen);
  for(let i=0;i<8;i++){
    ctx.beginPath();
    ctx.arc(x+(sr(910+i)-.5)*18,y-9+(sr(920+i)-.5)*10,1.5,0,7);
    fillA(C.pvBloom);
  }
}
function drawStarIcon(x,y,r,filled,seed){
  const pts=[];
  for(let i=0;i<10;i++){
    const a=-Math.PI/2+i*Math.PI/5;
    const rr2=i%2?r*0.45:r;
    pts.push([x+Math.cos(a)*rr2,y+Math.sin(a)*rr2]);
  }
  skPath(pts,seed||((x*7+y*13)|0),0.6,true);
  if(filled){ fillA(C.gold); ink(1.4); } else ink(1.2,C.ink,0.35);
}
function drawCrown(x,y,w){
  const h=w*0.6;
  skPath([[x-w/2,y],[x-w/2,y-h*0.7],[x-w/4,y-h*0.4],[x,y-h],[x+w/4,y-h*0.4],[x+w/2,y-h*0.7],[x+w/2,y]],(x|0)+7,0.8,true);
  fillA(C.gold); ink(1.8);
}
function drawShotBtn(r,seed){
  skPath([[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w,r.y+r.h],[r.x,r.y+r.h]],seed,1.4,true);
  fillA('#fffdf4',0.95); ink(2.2);
  const cx=r.x+r.w/2;
  skLine(cx,r.y+10,cx,r.y+24,seed+1,0.5); ink(2.6);
  skPath([[cx-5,r.y+20],[cx+5,r.y+20],[cx,r.y+28]],seed+2,0.4,true); fillA(C.ink);
  skLine(r.x+11,r.y+r.h-11,r.x+r.w-11,r.y+r.h-11,seed+3,0.5); ink(2.6);
}
function drawReloadBtn(r,seed){
  skPath([[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w,r.y+r.h],[r.x,r.y+r.h]],seed,1.4,true);
  fillA('#fffdf4',0.95); ink(2.2);
  const cx=r.x+r.w/2, cy=r.y+r.h/2;
  ctx.beginPath(); ctx.arc(cx,cy,9,-0.5,4.3); ink(2.6);
  skPath([[cx+12,cy-9],[cx+3,cy-8],[cx+9,cy-1]],seed+1,0.4,true); fillA(C.ink);
}
function drawAlbumBtn(){
  if(state==='caught') return;
  skPath([[ALB.x,ALB.y],[ALB.x+ALB.w,ALB.y],[ALB.x+ALB.w,ALB.y+ALB.h],[ALB.x,ALB.y+ALB.h]],881,1.4,true);
  fillA('#fffdf4',0.92); ink(2.2);
  if(state==='album'){
    skLine(ALB.x+14,ALB.y+14,ALB.x+ALB.w-14,ALB.y+ALB.h-14,882,0.8); ink(2.8);
    skLine(ALB.x+ALB.w-14,ALB.y+14,ALB.x+14,ALB.y+ALB.h-14,883,0.8); ink(2.8);
  } else {
    ctx.save(); ctx.translate(ALB.x+ALB.w/2,ALB.y+ALB.h-9); ctx.scale(0.44,0.44); drawPaloVerde(77); ctx.restore();
  }
}
function drawMuteBtn(){
  if(state==='caught') return;
  const b=MUTE, cx=b.x+b.w/2, cy=b.y+b.h/2;
  skPath([[b.x,b.y],[b.x+b.w,b.y],[b.x+b.w,b.y+b.h],[b.x,b.y+b.h]],884,1.2,true);
  fillA('#fffdf4',0.92); ink(2);
  // little speaker
  skPath([[cx-8,cy-3],[cx-3,cy-3],[cx+2,cy-8],[cx+2,cy+8],[cx-3,cy+3],[cx-8,cy+3]],885,0.6,true);
  fillA(C.ink,0.85); ink(1.4);
  if(muted){ skLine(cx+5,cy-6,cx+12,cy+6,886,0.6); ink(2.4,C.alert); } // slash when muted
  else { ctx.beginPath(); ctx.arc(cx+4,cy,5,-0.9,0.9); ink(1.8,C.ink,0.7);
         ctx.beginPath(); ctx.arc(cx+4,cy,9,-0.8,0.8); ink(1.6,C.ink,0.45); } // sound waves
}
function drawTitle(){
  // logo title -- the top of the visual hierarchy on the start screen, sitting
  // close above the START button so the two read as one centered focal group
  const cx=VW/2, cy=VH*0.44;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  // sketchy banner behind, tilted slightly for the doodle feel
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(-0.025);
  skPath([[-152,-58],[152,-58],[152,58],[-152,58]],7001,3,true);
  fillA('#fffdf4',0.9); ink(3.2);
  skPath([[-146,-52],[146,-52],[146,52],[-146,52]],7002,2,true); ink(1.6,C.ink,0.4);
  // small top line
  ctx.font='700 24px '+FONT; ctx.fillStyle=C.ink; ctx.globalAlpha=0.85;
  ctx.fillText('La odisea de',0,-34); ctx.globalAlpha=1;
  // the big word -- warm shadow + solid fill + ink outline = bold logo
  ctx.font='700 62px '+FONT; ctx.lineJoin='round';
  ctx.fillStyle=C.hat; ctx.fillText('ODISEO',3.5,10);      // drop shadow
  ctx.lineWidth=5; ctx.strokeStyle=C.ink; ctx.strokeText('ODISEO',0,6);
  ctx.fillStyle=C.sunFill; ctx.fillText('ODISEO',0,6);     // sun-gold fill
  ctx.restore();
  // small "good boy" creator logo above the title
  drawGoodBoyLogo(cx,VH*0.265);
}
function drawGoodBoyLogo(cx,cy){
  // "Good Boy" wordmark in a bold brush script, with the 2nd 'o' as a red dot
  const fs=30;
  ctx.font='400 '+fs+'px Pacifico, "Comic Sans MS", cursive';
  ctx.textBaseline='middle';
  ctx.fillStyle=C.ink;
  ctx.textAlign='center';
  ctx.fillText('Good Boy',cx,cy);
  // overlay a red ellipse exactly on the second 'o' of "Good"
  ctx.textAlign='left';
  const full=ctx.measureText('Good Boy').width;
  const left=cx-full/2;
  const wGo=ctx.measureText('Go').width, wGoo=ctx.measureText('Goo').width;
  const oc=left+(wGo+wGoo)/2, orx=(wGoo-wGo)/2;
  ctx.save(); ctx.translate(oc,cy-fs*0.06); ctx.rotate(-0.35);
  ctx.beginPath(); ctx.ellipse(0,0,orx*1.05,orx*1.5,0,0,7); ctx.fillStyle='#e5342f'; ctx.fill();
  ctx.restore();
  ctx.textAlign='center';
}
function drawTutorial(){
  // iconographic controls hint above the character, shown for a few seconds
  // after starting a run. Left: phone (swipe up / hold sides / hold palm).
  // Right: pc (arrow keys). Fades out over its final second.
  const a=Math.min(1,tutT);
  const px=player.x, py=player.feet-96;
  skPath([[px-100,py-28],[px+100,py-28],[px+100,py+26],[px-100,py+26]],9101,2,true);
  fillA('#fffdf4',0.94*a); ink(2.4,C.ink,a);
  skPath([[px-7,py+26],[px+7,py+26],[px,py+38]],9102,0.6,true); fillA('#fffdf4',0.94*a);
  const tri=(x,y,d,s)=>{
    const t=d==='l'?[[x+s,y-s],[x+s,y+s],[x-s,y]]:d==='r'?[[x-s,y-s],[x-s,y+s],[x+s,y]]
          :d==='u'?[[x-s,y+s],[x+s,y+s],[x,y-s]]:[[x-s,y-s],[x+s,y-s],[x,y+s]];
    skPath(t,((x*3+y*7)|0),0.3,true); fillA(C.ink,a);
  };
  // phone glyph
  skPath([[px-90,py-14],[px-74,py-14],[px-74,py+14],[px-90,py+14]],9104,0.8,true);
  fillA('#fffdf4',a); ink(1.8,C.ink,a);
  skLine(px-85,py+10,px-79,py+10,9105,0.3); ink(1.4,C.ink,0.7*a);
  // swipe up = jump
  skLine(px-60,py+10,px-60,py-8,9106,0.6); ink(2.2,C.ink,a); tri(px-60,py-13,'u',4);
  // hold sides = walk
  tri(px-40,py,'l',5); tri(px-26,py,'r',5);
  // hold the palm = replant
  ctx.save(); ctx.translate(px-4,py+16); ctx.scale(0.22,0.22); drawPalm(0,0,5,1); ctx.restore();
  skCircle(px-4,py-4,3,9107,0.5); fillA(C.skin,a); ink(1.4,C.ink,a);
  ctx.beginPath(); ctx.arc(px-4,py-4,7,-2.4,-0.7); ink(1.4,C.ink,0.5*a);
  // divider
  skLine(px+14,py-20,px+14,py+18,9108,0.8); ink(1.2,C.ink,0.3*a);
  // pc glyph (monitor)
  skPath([[px+26,py-14],[px+50,py-14],[px+50,py+2],[px+26,py+2]],9109,0.8,true);
  fillA('#fffdf4',a); ink(1.8,C.ink,a);
  skLine(px+38,py+2,px+38,py+8,9110,0.3); ink(1.8,C.ink,a);
  skLine(px+32,py+9,px+44,py+9,9111,0.3); ink(1.8,C.ink,a);
  // arrow keys
  const kc=(x,y,d)=>{
    skPath([[x-6,y-6],[x+6,y-6],[x+6,y+6],[x-6,y+6]],((x*7)|0),0.5,true);
    fillA('#fffdf4',a); ink(1.5,C.ink,a); tri(x,y,d,3);
  };
  kc(px+62,py+9,'l'); kc(px+76,py-7,'u'); kc(px+76,py+9,'d'); kc(px+90,py+9,'r');
}
function drawUI(){
  if(state==='menu') return;
  // top bar: three aligned chips -- album (left), water (middle-left), score (right)
  ctx.font='700 26px '+FONT;
  const stxt=String(score);
  const tw=ctx.measureText(stxt).width;
  const sc0=VW-14-(tw+56);
  skPath([[sc0,20],[VW-14,20],[VW-14,62],[sc0,62]],878,1.4,true);
  fillA('#fffdf4',0.92); ink(2.2);
  ctx.textAlign='right'; ctx.textBaseline='middle'; ctx.fillStyle=C.ink;
  ctx.fillText(stxt,VW-26,41);
  drawMiniTree(sc0+20,43);
  // hydration chip -- shakes once when water first goes low
  ctx.save();
  if(waterShake>0){ const sh=Math.sin(waterShake*46)*5*(waterShake/0.55); ctx.translate(sh,0); }
  const W={x:70,y:20,w:118,h:42};
  skPath([[W.x,W.y],[W.x+W.w,W.y],[W.x+W.w,W.y+W.h],[W.x,W.y+W.h]],879,1.4,true);
  fillA('#fffdf4',0.92); ink(2.2);
  const dx0=W.x+16,dy0=W.y+21;
  skPath([[dx0,dy0-8],[dx0+5.5,dy0+1],[dx0+3,dy0+7],[dx0-3,dy0+7],[dx0-5.5,dy0+1]],880,0.7,true);
  fillA('#5b9fd4'); ink(1.6,'#2f5a7a');
  const bx=W.x+32,bw=W.w-44,by=W.y+13,bh=16;
  skPath([[bx,by],[bx+bw,by],[bx+bw,by+bh],[bx,by+bh]],881,0.8,true);
  fillA('#efeadb'); ink(1.8);
  const lvl=player?player.water:1;
  if(lvl>0.02){
    const flash=lvl<0.25&&Math.sin(tm*7)>0;
    ctx.fillStyle=lvl<0.25?(flash?'#e2833f':'#d4552f'):lvl<0.5?'#e2a53f':'#5b9fd4';
    ctx.fillRect(bx+1.5,by+1.5,(bw-3)*lvl,bh-3);
  }
  ctx.restore();
}
function paperSpecks(){
  for(let i=0;i<60;i++){
    ctx.beginPath();
    ctx.arc(sr(i*3+1)*VW,sr(i*3+2)*VH,sr(i*3+3)*1.4+0.4,0,7);
    fillA('#b7a98a',0.12);
  }
}
function drawCloud(x,y,seed){
  skCircle(x,y,16,seed,1.5); fillA('#ffffff',0.7); ink(1.6,C.ink,0.35);
  skCircle(x+18,y+3,12,seed+1,1.5); fillA('#ffffff',0.7); ink(1.6,C.ink,0.3);
  skCircle(x-17,y+4,11,seed+2,1.5); fillA('#ffffff',0.7); ink(1.6,C.ink,0.3);
}
function drawMast(x,y,h,seed){
  skLine(x,y,x,y-h,seed,0.6); ink(1.6,C.ink,0.4);
  for(let i=1;i<=3;i++){
    const yy=y-h*i/3.5, w=4-(i-1);
    skLine(x-w,yy,x+w,yy,seed+i,0.4); ink(1,C.ink,0.3);
  }
  ctx.beginPath(); ctx.arc(x,y-h,1.3,0,7); fillA('#c0504a',0.5);
}
function drawCerro(sx,baseY,s,seed){
  // El Cerro de la Campana (Hermosillo): bell-shaped rocky hill,
  // terraced slopes and antenna masts on the summit
  ctx.save(); ctx.translate(sx,baseY); ctx.scale(s,s);
  skPath([[-170,0],[-150,-22],[-118,-58],[-86,-96],[-52,-124],[-18,-138],[8,-136],[38,-118],[62,-92],[88,-70],[118,-44],[142,-20],[158,0]],seed,2.5,true);
  fillA('#ddd7c8',0.5); ink(2,C.ink,0.3);
  // small rocky outcrop to its right
  skPath([[150,0],[162,-18],[178,-34],[196,-30],[208,-14],[214,0]],seed+5,2,true);
  fillA('#ddd7c8',0.45); ink(1.8,C.ink,0.25);
  // terraced slope roads
  skLine(-96,-70,-30,-84,seed+8,1.5); ink(1.2,C.ink,0.16);
  skLine(-58,-104,20,-112,seed+9,1.5); ink(1.2,C.ink,0.16);
  skLine(30,-96,86,-64,seed+10,1.5); ink(1.2,C.ink,0.16);
  // the masts
  drawMast(-26,-134,44,seed+11);
  drawMast(-2,-138,56,seed+12);
  drawMast(22,-128,38,seed+13);
  ctx.restore();
}
function drawSkyScreen(){
  // dim warm wash so the desert sky feels hot
  const grad=ctx.createLinearGradient(0,0,0,VH*0.62);
  grad.addColorStop(0,'rgba(242,166,64,0.10)');
  grad.addColorStop(1,'rgba(242,166,64,0)');
  ctx.fillStyle=grad; ctx.fillRect(0,0,VW,VH*0.62);
  for(let i=0;i<3;i++){
    drawCloud(mod(i*577+tm*7-cam.x*0.12,VW+360)-180,64+i*44,800+i*9);
  }
  for(let i=0;i<2;i++){
    const bx=mod(tm*26+i*430-cam.x*0.2,VW+240)-120, by=110+i*46+Math.sin(tm*2+i*3)*9;
    const fl=Math.sin(tm*9+i)*3;
    skLine(bx-7,by,bx,by-4-fl,880+i,0.5); ink(1.8,C.ink,0.5);
    skLine(bx,by-4-fl,bx+7,by,884+i,0.5); ink(1.8,C.ink,0.5);
  }
  // El Cerro de la Campana rising behind the city, drifting with parallax.
  // phase keeps one cerro horizontally centered at the start of a run
  const par=0.22, spacing=1400, off=(cam.x+108)*par-VW/2;
  const i0=Math.floor((off-360)/spacing), n=Math.ceil((VW+720)/spacing)+1;
  for(let i=0;i<=n;i++){
    const gi=i0+i;
    drawCerro(gi*spacing-off, VH*0.615, 0.9+sr(gi*7)*0.25, 3000+gi*13);
  }
  drawCity(); // low flat skyline in front of the cerro's base
  drawSun();  // drawn LAST so nothing in the sky ever covers it
}
function drawSun(){
  // lowered out of the UI bar, radiating heat: pulsing halo + slowly turning rays
  const sx=330, sy=205;
  const pul=Math.sin(tm*2.2)*0.5+0.5;
  const g=ctx.createRadialGradient(sx,sy,10,sx,sy,80+pul*12);
  g.addColorStop(0,'rgba(246,190,80,0.5)');
  g.addColorStop(0.55,'rgba(246,190,80,0.16)');
  g.addColorStop(1,'rgba(246,190,80,0)');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(sx,sy,94,0,7); ctx.fill();
  skCircle(sx,sy,24,42); fillA(C.sunFill,0.95); ink(2.2,C.sun);
  for(let i=0;i<12;i++){
    const a=i/12*6.283+tm*0.15;
    const L=(i%2?38:48)+pul*5;
    skLine(sx+Math.cos(a)*30,sy+Math.sin(a)*30,sx+Math.cos(a)*L,sy+Math.sin(a)*L,43+i,1);
    ink(2,C.sun,0.85);
  }
  skCircle(sx,sy,13,49); fillA('#ffdf8a',0.9);
}
function drawCity(){
  // Hermosillo skyline: low and flat, pure silhouette, no detail.
  // The fill runs all the way to the bottom of the screen so that when the
  // player climbs high (and the real ground scrolls off-screen), no hard
  // bottom edge / crop of the background is ever visible.
  const par=0.15, step=90, off=cam.x*par;
  const baseY=VH*0.625, bottom=VH+40, i0=Math.floor(off/step)-1, n=Math.ceil(VW/step)+3;
  ctx.beginPath();
  ctx.moveTo(-30,bottom);
  for(let i=0;i<=n;i++){
    const gi=i0+i, x0=gi*step-off;
    const h1=12+sr(gi*13+901)*24, h2=8+sr(gi*17+903)*16;
    const mid=x0+step*srr(gi*7+902,0.45,0.8);
    ctx.lineTo(x0,baseY-h1); ctx.lineTo(mid,baseY-h1);
    ctx.lineTo(mid,baseY-h2); ctx.lineTo(x0+step,baseY-h2);
  }
  ctx.lineTo(VW+30,bottom); ctx.closePath();
  fillA('#e0dbcd',0.85);
}

// ================= album screen =================
function drawAlbum(){
  // header: the game's goal glyph -- palm becomes native
  ctx.save(); ctx.translate(VW/2-48,62); ctx.scale(0.45,0.45); drawPalm(0,0,5,1); ctx.restore();
  skLine(VW/2-20,44,VW/2+10,44,921,0.6); ink(2.4);
  skPath([[VW/2+6,39],[VW/2+6,49],[VW/2+15,44]],922,0.4,true); fillA(C.ink);
  ctx.save(); ctx.translate(VW/2+46,62); ctx.scale(0.45,0.45); drawPaloVerde(31); ctx.restore();
  // collection progress badge
  const nUnl=NATIVES.filter(k=>(treeCounts[k]||0)>0).length;
  skCircle(VW-38,46,17,929,1); fillA(C.gold); ink(2);
  ctx.font='700 13px '+FONT; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle=C.ink;
  ctx.fillText(nUnl+'/'+NATIVES.length,VW-38,46);

  const cw=182, chh=128, gx=(VW-2*cw)/3;
  for(let i=0;i<NATIVES.length;i++){
    const k=NATIVES[i];
    const col=i%2, row=(i/2)|0;
    const count=treeCounts[k]||0, unlocked=count>0;
    const lift=(i===hoverCard&&unlocked)?-5:0;   // hover: card floats up
    const x=gx+(cw+gx)*col, y=80+(chh+11)*row+lift;
    if(lift){ skPath([[x+4,y+8],[x+cw+4,y+8],[x+cw+4,y+chh+8],[x+4,y+chh+8]],(i+1)*95,1.6,true); fillA(C.ink,0.12); }
    skPath([[x,y],[x+cw,y],[x+cw,y+chh],[x,y+chh]],(i+1)*93,1.6,true);
    fillA('#fffdf4'); ink(lift?3:2.2);
    if(lift){ skPath([[x-3,y-3],[x+cw+3,y-3],[x+cw+3,y+chh+3],[x-3,y+chh+3]],(i+1)*97,1.4,true); ink(2.2,C.gold,0.9); }
    drawNative(k,x+cw/2,y+70,7+i*11,0.82);
    if(!unlocked){
      ctx.fillStyle='rgba(250,245,232,0.85)';
      ctx.fillRect(x+3,y+3,cw-6,chh-6);
      skPath([[x,y],[x+cw,y],[x+cw,y+chh],[x,y+chh]],(i+1)*93,1.6,true); ink(2.2);
      ctx.save(); ctx.translate(x+cw/2,y+56); ctx.scale(1.7,1.7); drawQuest(0,-4); ctx.restore();
    } else {
      ctx.font='700 14px '+FONT;
      ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle=C.ink;
      ctx.fillText(ES[k],x+cw/2,y+92);
    }
    const st=starsOf(k);
    for(let j=0;j<5;j++){
      drawStarIcon(x+cw/2+(j-2)*19,y+112,6,unlocked&&j<st,(i*17+j*7)|0);
    }
  }
  drawShotBtn(ALBSHOT,552);
  drawReloadBtn(ALBREL,553);
  // info card for a tapped species
  if(infoKind){
    ctx.fillStyle='rgba(58,53,46,0.28)'; ctx.fillRect(0,0,VW,VH);
    const r=INFOCARD;
    skPath([[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w,r.y+r.h],[r.x,r.y+r.h]],771,2,true);
    fillA('#fffdf4'); ink(2.6);
    drawNative(infoKind,VW/2,r.y+168,7,1.85);
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle=C.ink;
    ctx.font='700 22px '+FONT;
    ctx.fillText(ES[infoKind],VW/2,r.y+206);
    ctx.font='700 14px '+FONT; ctx.globalAlpha=0.55;
    ctx.fillText(INFO[infoKind].sci,VW/2,r.y+230);
    ctx.globalAlpha=1;
    ctx.font='700 15px '+FONT;
    const dl=INFO[infoKind].desc;
    for(let i=0;i<dl.length;i++) ctx.fillText(dl[i],VW/2,r.y+256+i*21);
    const st=starsOf(infoKind);
    for(let j=0;j<5;j++) drawStarIcon(VW/2+(j-2)*24,r.y+346,7.5,j<st,(j*7+77)|0);
    drawShotBtn(INFOSHOT,551);
  }
}
function toggleAlbum(){
  sfxClick();
  infoKind=null; hoverCard=-1; plantHoldId=null;
  ptrZones.clear(); ptrSwipe.clear(); recomputeVk(); // never carry held walk-pointers across screens
  if(state==='album'){
    state=albumReturn;
    if(state==='over'&&btnsShown){ shotBtn.style.display='block'; }
    if(state==='menu'){ startBtn.style.display='block'; }
  } else if(state==='menu'||state==='play'||state==='over'){
    albumReturn=state; state='album';
    startBtn.style.display='none'; shotBtn.style.display='none';
  }
}

// ================= death screen (sequenced reveal) =================
const ITEM_D=1.05;
function planOver(){
  const items=[...runNew.map(k=>({k,star:false})),...runStarred.map(k=>({k,star:true}))];
  const treesEnd=items.length*ITEM_D;
  overT=0; btnsShown=false; sparts=[];
  overPlan={items,treesEnd,scoreAt:treesEnd+0.25,bestAt:treesEnd+1.35,
    btnsAt:treesEnd+1.9+(newBest?0.9:0),poofed:{},revealed:{},confettiDone:false,
    bestPlayed:false,scoreTicks:0,caughtChimed:false};
}
function drawOverScreen(){
  const cx2=VW/2, pl=overPlan;
  if(!pl) return;
  // unlocked / starred trees, one at a time, each ending in a poof
  const idx=Math.floor(overT/ITEM_D);
  if(idx<pl.items.length&&!pl.poofed[idx]){
    const u=(overT-idx*ITEM_D)/ITEM_D;
    const k=Math.min(1,u/0.22);
    const sc=0.95*k*(1+0.2*Math.sin(k*Math.PI));
    const item=pl.items[idx];
    drawNative(item.k,cx2,358,7+idx*3,sc);
    if(u>0.15){
      ctx.font='700 17px '+FONT; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle=C.ink;
      ctx.fillText(ES[item.k],cx2,380);
      if(item.star) drawStarIcon(cx2+36,308,8,true,(idx*13)|0);
      else{
        drawStarIcon(cx2+36,304,5,true,(idx*7)|0);
        skLine(cx2+28,312,cx2+32,317,681+idx,0.4); ink(1.8,C.gold);
        skLine(cx2+45,310,cx2+41,315,684+idx,0.4); ink(1.8,C.gold);
      }
    }
  }
  // run score counts up (sits just under the highscore, mid-screen)
  if(overT>pl.scoreAt){
    const u=Math.min(1,(overT-pl.scoreAt)/0.9);
    const e=1-Math.pow(1-u,3);
    const stx=String(Math.round(score*e));
    ctx.font='700 30px '+FONT; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle=C.ink;
    ctx.fillText(stx,cx2+10,338);
    const tw=ctx.measureText(stx).width;
    drawMiniTree(cx2+10-tw/2-18,340);
  }
  // highscore, bigger than the run score; pops with confetti on a new record
  if(overT>pl.bestAt){
    const u=overT-pl.bestAt;
    let k=1;
    if(newBest) k=1+0.5*Math.exp(-2.2*u)*Math.abs(Math.sin(u*9));
    ctx.save(); ctx.translate(cx2,272); ctx.scale(k,k);
    drawCrown(-52,16,30);
    ctx.font='700 48px '+FONT; ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillStyle=newBest?'#c99a1e':C.ink;
    ctx.fillText(String(best),-24,8);
    ctx.restore();
  }
  // big album button: pops in with a shake, badge shows collection progress
  if(overT>pl.btnsAt){
    const u=overT-pl.btnsAt;
    const shake=Math.sin(u*30)*4*Math.exp(-2.5*u);
    ctx.save(); ctx.translate(shake,0);
    skPath([[BIGALB.x,BIGALB.y],[BIGALB.x+BIGALB.w,BIGALB.y],[BIGALB.x+BIGALB.w,BIGALB.y+BIGALB.h],[BIGALB.x,BIGALB.y+BIGALB.h]],661,2,true);
    fillA('#fffdf4'); ink(2.6);
    ctx.save(); ctx.translate(BIGALB.x+42,BIGALB.y+BIGALB.h-12); ctx.scale(0.72,0.72); drawPalm(0,0,5,1); ctx.restore();
    skLine(BIGALB.x+70,BIGALB.y+38,BIGALB.x+90,BIGALB.y+38,662,0.5); ink(2.4);
    skPath([[BIGALB.x+86,BIGALB.y+33],[BIGALB.x+86,BIGALB.y+43],[BIGALB.x+95,BIGALB.y+38]],663,0.4,true); fillA(C.ink);
    ctx.save(); ctx.translate(BIGALB.x+120,BIGALB.y+BIGALB.h-12); ctx.scale(0.72,0.72); drawPaloVerde(31); ctx.restore();
    const nUnl=NATIVES.filter(k=>(treeCounts[k]||0)>0).length;
    skCircle(BIGALB.x+BIGALB.w-2,BIGALB.y+2,17,664,1); fillA(C.gold); ink(2);
    ctx.font='700 13px '+FONT; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle=C.ink;
    ctx.fillText(nUnl+'/'+NATIVES.length,BIGALB.x+BIGALB.w-2,BIGALB.y+2);
    ctx.restore();
    drawReloadBtn(OVERREL,668);
  }
  drawSparts();
}

// ================= render =================
const menuDude={x:0,feet:0,vx:0,vy:0,dir:1,grounded:true,onPlat:null,anim:0,plantTree:null,jbuf:0,coyote:0};
function render(){
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.fillStyle=C.paper; ctx.fillRect(0,0,screenW,screenH);
  ctx.setTransform(DPR*S,0,0,DPR*S,OX*DPR,OY*DPR);
  ctx.save();
  ctx.beginPath(); ctx.rect(0,0,VW,VH); ctx.clip();
  paperSpecks();

  if(state==='album'){
    drawAlbum();
  } else {
    drawSkyScreen();
    ctx.save(); ctx.translate(-cam.x,-cam.y);
    drawGround();
    for(const p of plats) drawPlat(p);
    SCEN_FADE=true;
    for(const o of scen) drawScen(o);
    SCEN_FADE=false;
    for(const t of trees) drawTree(t);
    for(const b of bottles) drawBottle(b);
    for(const w of weeds) drawWeed(w);
    for(const c of cops) drawCop(c);
    if(state!=='menu'){
      drawCowboy(player);
      if(state==='caught'||state==='over') drawStars(player.x,player.feet-40);
      for(const t of trees){
        if(state==='play'&&t===player.plantTree&&t.progress<=0) drawHint(t);
        if(t.progress>0) drawProgress(t);
        if(state==='play'&&t.kind==='native') drawTreeLabel(t);
      }
      drawFloats();
      if(state==='play'&&tutT>0) drawTutorial();
    }
    drawParts();
    ctx.restore();

    if(state==='menu') drawTitle();
    drawUI();

    if(state==='caught'||state==='over'){
      ctx.fillStyle='rgba(250,245,232,'+(0.72*Math.min(1,caughtT/0.8))+')';
      ctx.fillRect(0,0,VW,VH);
      if(state==='over') drawOverScreen();
    }
  }
  drawAlbumBtn();
  drawMuteBtn();
  ctx.restore();
  // sketchy frame around the playfield
  skPath([[3,3],[VW-3,3],[VW-3,VH-3],[3,VH-3]],9001,2,true); ink(3);
}

// ================= main loop =================
let last=performance.now();
function frame(now){
  const dt=Math.min(1/30,(now-last)/1000); last=now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
function update(dt){
  tm+=dt;
  boil=Math.floor(tm*7.7);
  if(waterShake>0) waterShake=Math.max(0,waterShake-dt);
  if(state==='play'&&tutT>0) tutT-=dt;
  updateHair(state==='menu'?menuDude:player,dt);   // rope-hair settles in every state
  if(state==='album') return;      // album pauses the world

  if(state==='play') updatePlayer(dt);
  if(state==='caught'){
    caughtT+=dt;
    if(caughtT>1.15){
      state='over';
      if(score>best){ best=score; newBest=true; }
      saveMeta();
      planOver();
    }
  }
  if(state==='over'&&overPlan){
    overT+=dt;
    for(let i=0;i<overPlan.items.length;i++){
      if(overT>i*ITEM_D&&!overPlan.revealed[i]){ overPlan.revealed[i]=true; sfxRevealItem(); } // card pops in
      if(overT>i*ITEM_D+0.88&&!overPlan.poofed[i]){ overPlan.poofed[i]=true; spoof(VW/2,342); sfxItemPoof(); }
    }
    // score count-up: a soft tick per number as it climbs
    if(overT>overPlan.scoreAt&&overPlan.scoreTicks<6){
      const want=Math.min(6,Math.floor((overT-overPlan.scoreAt)/0.13));
      while(overPlan.scoreTicks<want){ overPlan.scoreTicks++; sfxScoreTick(); }
    }
    // highscore reveal fanfare
    if(!overPlan.bestPlayed&&overT>overPlan.bestAt){ overPlan.bestPlayed=true; (newBest?sfxBest:sfxRevealItem)(); }
    if(newBest&&!overPlan.confettiDone&&overT>overPlan.bestAt){ overPlan.confettiDone=true; confetti(); sfxConfetti(); }
    if(!btnsShown&&overT>overPlan.btnsAt){
      btnsShown=true;
      shotBtn.style.display='block';
      sfxPanel();
    }
  }
  for(const q of sparts){ q.t+=dt; q.x+=q.vx*dt; q.y+=q.vy*dt; q.vy+=q.g*dt; q.rot+=q.vr*dt; }
  sparts=sparts.filter(q=>q.t<q.life);
  for(const c of cops) updateCop(c,dt);
  for(const t of trees) if(t.swapT>=0&&t.swapT<3) t.swapT+=dt;
  for(const q of parts){ q.t+=dt; q.x+=q.vx*dt; q.y+=q.vy*dt; q.vy+=(q.kind==='poof'?-10:q.kind==='bee'?0:60)*dt; }
  parts=parts.filter(q=>q.t<q.life);
  for(const f of floats) f.t+=dt;
  floats=floats.filter(f=>f.t<(f.life||1.2));
  updateWeeds(dt);

  if(state!=='menu'){
    cam.x+=((player.x-VW*0.4)-cam.x)*Math.min(1,dt*6);
    cam.y+=((player.feet-VH*0.62)-cam.y)*Math.min(1,dt*3.5);
    cam.x=Math.max(cam.x,-420);
  }
  genTo(cam.x+VW+700);
  prune();
}

// ================= ui wiring =================
const startBtn=document.getElementById('startBtn');
const shotBtn=document.getElementById('shotBtn');
function restartRun(){
  sfxClick();
  shotBtn.style.display='none';
  sparts=[]; overPlan=null; btnsShown=false; infoKind=null;
  ptrZones.clear(); ptrSwipe.clear(); recomputeVk();
  plantHoldId=null;
  resetWorld(); state='play'; tutT=6;
}
startBtn.onclick=()=>{ initAudio(); sfxClick(); startBtn.style.display='none'; startBtn.blur(); resetWorld(); state='play'; tutT=6; };
shotBtn.onclick=()=>{ shotBtn.blur(); sfxShutter(); downloadShot(); };

resetWorld();
requestAnimationFrame(frame);
