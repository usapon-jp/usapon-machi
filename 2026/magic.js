/* Halloween 2026 only. No network, account or shared progress writes. */
window.createHalloweenMagic = function(D) {
  'use strict';
  const {THREE,scene,camera,canvas,piyo,state,player,ED,W,STAIRS,shopsOut,groundY,collidesAt,edApply,edPos,edSt,edBase,burst,SPARK,toast,AUDIO,setCamMode,setSelfie,takeFreePhoto,askYN,getSave,getPresent,blocked}=D;
  const KEY='usapon-halloween-2026-magic-layout-v1';
  // Small free-standing props only. Barrels / pumpkin crates were checked: one round or box collider, no seat, panel, lamp cord or id.
  const kinds=new Set(['pumpkin','pot','lantern','bucket','barrel','crate']);
  const foot=e=>Math.max(.45,...e.circs.map(c=>c.r),...e.cols.map(c=>Math.hypot(c.hw,c.hd)));
  const safe=e=>!e.id&&!e.panel&&!e.spot&&!e.lamp&&!(e.seats&&e.seats.length)&&e.cols.length+e.circs.length<=1&&foot(e)<=1;
  const props=ED.list.filter(e=>kinds.has(e.kind)&&safe(e)&&!edSt(e).hide&&e.spare===undefined);
  const propSet=new Set(props);
  // Progress items and panels keep a little breathing room even when they have no collider.
  const keep=ED.list.filter(e=>['panel','present','gift','potion','tv','board','sign','chalk'].includes(e.kind));
  const HEIGHT={pumpkin:.75,pot:1.15,lantern:1.8,bucket:.9,barrel:1.25,crate:1.15};
  const ids=new Map(props.map(e=>[`${e.kind}:${e.x0.toFixed(3)}:${e.z0.toFixed(3)}`,e]));
  const defaults=new Map(props.map(e=>[e,{...edSt(e)}]));
  const REACH=8;
  let rows={},active=false,lift=0,held=null,undo=null,wand=null,hand=null,cooldown=0,photoTimer=0,clock=0,ready=false,photoMode=false,lastCam=false;
  const copy=s=>({dx:s.dx||0,dz:s.dz||0,dy:s.dy||0,r:s.r||0,hide:false});
  const idOf=e=>[...ids].find(([,v])=>v===e)[0];
  const MAXD=8;
  // Same limit the player walks within, so the edge matches where Piyo can actually stand (the south gate sits right at it).
  const EDGE=(W&&W.WORLD)||40;
  const REASON={far:'元の場所から遠いよ',road:'道から少し離してね',stair:'階段の近くは置けないよ',door:'お店の入口に近いよ',slope:'ななめの所は置けないよ',keep:'大事な物の近くだよ',prop:'ほかの物に近いよ',wall:'建物やかべに近いよ',edge:'村の外には置けないよ',behind:'かべの向こうには置けないよ'};
  const hitCols=(list,x,z,r,y)=>list.some(b=>{if(y>=b.top-.15)return false;if(b.hw!==undefined){const dx=x-b.x,dz=z-b.z,lx=dx*b.c-dz*b.s,lz=dx*b.s+dz*b.c;return Math.abs(lx)<b.hw+r&&Math.abs(lz)<b.hd+r}const dx=x-b.x,dz=z-b.z;return dx*dx+dz*dz<(b.r+r)*(b.r+r)});
  // '' = can place. Otherwise a short reason key, checked from the clearest rule to the most general one.
  function check(e,x,z){
    const base=defaults.get(e),bx=e.x0+base.dx,bz=e.z0+base.dz,r=foot(e);
    if(!Number.isFinite(x)||!Number.isFinite(z))return 'far';
    if(Math.abs(x)>EDGE-r-.1||Math.abs(z)>EDGE-r-.1)return 'edge';
    if(Math.hypot(x-bx,z-bz)>MAXD)return 'far';
    // Roads are fine too (2026-10-23, user request). Stairs and shop doors stay clear below.
    if(STAIRS.some(s=>Math.abs(x-s.x)<s.w/2+r+.5&&z>Math.min(s.a,s.b)-r-.5&&z<Math.max(s.a,s.b)+r+.5))return 'stair';
    if(shopsOut.some(s=>Math.hypot(x-s.x,z-s.z)<r+1.8||Math.hypot(x-s.sx,z-s.sz)<r+1.8))return 'door';
    const y=groundY(x,z);
    if(Math.abs(y-groundY(bx,bz))>.35||Math.abs(y-groundY(x+r,z))>.22||Math.abs(y-groundY(x-r,z))>.22||Math.abs(y-groundY(x,z+r))>.22||Math.abs(y-groundY(x,z-r))>.22)return 'slope';
    if(keep.some(k=>{const q=edPos(k);return Math.hypot(q.x-x,q.z-z)<r+.9}))return 'keep';
    if(props.some(o=>{if(o===e)return false;const q=edPos(o);return Math.hypot(q.x-x,q.z-z)<r+foot(o)*.8}))return 'prop';
    const cs=[...e.cols,...e.circs],tops=cs.map(c=>c.top);
    try{
      cs.forEach(c=>c.top=-999);
      if(!collidesAt(x,z,r+.08,y+.1))return '';
      return ED.list.some(o=>o!==e&&(o.cols.length||o.circs.length)&&hitCols([...o.cols,...o.circs],x,z,r+.08,y+.1))?'prop':'wall';
    }finally{cs.forEach((c,i)=>c.top=tops[i])}
  }
  const valid=(e,x,z)=>!check(e,x,z);
  // Piyo must be able to reach the spot in a straight line: no wall, building or cliff in between.
  function reach(e,x,z){
    const sx=player.pos.x,sz=player.pos.z,L=Math.hypot(x-sx,z-sz),n=Math.ceil(L/.25),cs=[...e.cols,...e.circs],tops=cs.map(c=>c.top);
    let py=groundY(sx,sz);
    try{
      cs.forEach(c=>c.top=-999);
      for(let i=1;i<=n;i++){
        const k=i/n,qx=sx+(x-sx)*k,qz=sz+(z-sz)*k,qy=groundY(qx,qz);
        if(Math.abs(qy-py)>.45)return false;py=qy;
        if(k*L>.3&&collidesAt(qx,qz,.1,qy+.1))return false;
      }
      return true;
    }finally{cs.forEach((c,i)=>c.top=tops[i])}
  }
  const why=(e,x,z)=>check(e,x,z)||(reach(e,x,z)?'':'behind');
  const okHere=(e,x,z)=>!why(e,x,z);
  // Nearest placeable point around (x,z): gentle snap first, wider search only for the faint guide ring.
  function nearestSpot(e,x,z,maxR,step){
    if(okHere(e,x,z))return {x,z,d:0};
    const r=foot(e);
    for(let rr=step;rr<=maxR+1e-6;rr+=step){
      let best=null;const n=Math.max(8,Math.round(rr*10));
      for(let i=0;i<n;i++){
        const a=i/n*Math.PI*2+player.face,px=x+Math.sin(a)*rr,pz=z+Math.cos(a)*rr;
        if(Math.hypot(px-player.pos.x,pz-player.pos.z)<r+.35)continue;
        if(okHere(e,px,pz)){const turn=Math.abs(Math.atan2(Math.sin(a-player.face),Math.cos(a-player.face)));if(!best||turn<best.t)best={x:px,z:pz,d:rr,t:turn}}
      }
      if(best)return best;
    }
    return null;
  }
  function persist(){
    try{localStorage.setItem(KEY,JSON.stringify({v:1,props:rows}));return true}
    catch(e){toast('配置を保存できませんでした。空き容量を確認してね',4000);return false}
  }
  // Malformed / outdated records never enter the renderer or touch game progress.
  try{
    const data=JSON.parse(localStorage.getItem(KEY)||'null');
    if(data&&data.v===1&&data.props&&typeof data.props==='object')for(const [id,s] of Object.entries(data.props).slice(0,100)){
      const e=ids.get(id);if(!e||!s||![s.dx,s.dz,s.r].every(Number.isFinite)||Math.abs(s.r)>3600)continue;
      if(valid(e,e.x0+s.dx,e.z0+s.dz)){e.st={...copy(defaults.get(e)),dx:s.dx,dz:s.dz,r:s.r};edApply(e);rows[id]=copy(e.st)}
    }
  }catch(e){toast('模様替えの保存を読めませんでした。元の配置で始めます',4000)}
  const style=document.createElement('style');style.textContent=`
  .magic-button{position:fixed;z-index:24;width:48px;height:48px;padding:0;display:grid;place-items:center;border-radius:50%;border:1.5px solid rgba(255,255,255,.75);background:rgba(255,255,255,.16);color:#fff;box-shadow:0 0 0 1px #0002;backdrop-filter:blur(2px);touch-action:none;-webkit-tap-highlight-color:transparent;user-select:none;font:24px sans-serif}
  .magic-button svg{width:25px;height:25px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
  .magic-button[aria-pressed=true]{background:rgba(255,255,255,.36);box-shadow:0 0 0 2px #ffffff70,0 0 12px #ffe2a880}
  .magic-button:active{transform:scale(.94)}.magic-button:disabled,.magic-button.off{opacity:.38}
  body.nobtn .magic-button,body.cammode .magic-button,.magic-button[hidden],#magicFrame[hidden],#magicSettings[hidden]{display:none!important}
  #magicFrame{position:fixed;pointer-events:none;left:50%;top:50%;transform:translate(-50%,-50%);width:min(100vw,56.25vh);height:min(100vh,177.7778vw);border:1px solid #fff7;box-sizing:border-box;box-shadow:0 0 0 100vmax #1e123822;z-index:19}
  body.magic-capture #hud,body.magic-capture #camUI,body.magic-capture #joy,body.magic-capture .magic-button,body.magic-capture #magicFrame{visibility:hidden!important}
  body.cammode #candyBtn,body:has(.modal.on) #candyBtn{visibility:hidden;pointer-events:none}
  #magicTag,#magicHint{position:fixed;left:0;top:0;z-index:18;pointer-events:none;padding:5px 11px;border-radius:14px;font:800 13px/1.25 "Zen Maru Gothic",sans-serif;white-space:nowrap;transform:translate(-50%,0);box-shadow:0 2px 8px #1a103344;transition:opacity .18s}
  #magicTag{background:rgba(255,255,255,.9);color:#3b2a52;border:1.5px solid #81e3ab}
  #magicTag.ng{border-color:#f08a9a;color:#7a2a3e;background:rgba(255,246,247,.92)}
  #magicTag b{display:inline-block;width:1.15em;margin-right:3px;text-align:center}
  #magicHint{background:rgba(26,16,51,.84);color:#fff1d8;border:1px solid #ffffff55;transform:translate(-50%,-100%);opacity:0}
  #magicHint.on{opacity:1}
  .magic-ripple{position:fixed;z-index:18;pointer-events:none;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:2px solid #fff8;animation:magicRipple .45s ease-out forwards}
  @keyframes magicRipple{from{transform:scale(.35);opacity:.95}to{transform:scale(1.25);opacity:0}}
  body.cammode #magicTag,body.cammode #magicHint,body.magic-capture #magicTag,body.magic-capture #magicHint,#magicTag[hidden]{display:none!important}
  #magicSettings{margin:12px 0}#magicSettings summary{cursor:pointer;font-weight:800;padding:10px 0}#magicSettings .actions{flex-wrap:wrap}
  `;document.head.appendChild(style);
  const $=id=>document.getElementById(id);
  const icons={wand:'<path d="m5 21 9-12m1-7 2 3 4 .5-3 2.5.6 4-3.6-2-3.5 2 .6-4L8 5.5 12 5z"/>',spark:'<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4zM3 3v4M1 5h4"/>',fire:'<path d="M12 7V2m0 20v-5M7 12H2m20 0h-5M8 8 4 4m16 16-4-4M8 16l-4 4M20 4l-4 4"/><circle cx="12" cy="12" r="2"/>',turn:'<path d="M5 8a8 8 0 1 1-1 7M5 3v5h5"/>',put:'<path d="m5 12 4 4L19 6M4 20h16"/>',cancel:'<path d="m6 6 12 12M18 6 6 18"/>'};
  function button(id,label,icon){const b=document.createElement('button');b.id=id;b.type='button';b.className='magic-button';b.hidden=true;b.title=label;b.setAttribute('aria-label',label);b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+icons[icon]+'</svg>';b.addEventListener('contextmenu',e=>e.preventDefault());document.body.appendChild(b);return b}
  const toggle=button('magicToggle','杖を装備する','wand');
  button('magicSpark','杖を振る・キラキラ','spark');button('magicFire','花火の魔法','fire');
  button('magicTurn','小物を回す','turn');button('magicPut','ここに置く','put');button('magicCancel','元の場所に戻す','cancel');
  const settings=document.createElement('details');settings.id='magicSettings';settings.hidden=true;settings.innerHTML='<summary>まほうのスティック</summary><p>杖を装備して、小物をタップ。歩いて運んで、緑の輪で置けるよ。杖を持ってカメラを開くと縦写真になります。</p><div class="actions"><button class="btn sub" id="magicUndo">ひとつ戻す</button><button class="btn sub" id="magicReset">元の配置に戻す</button></div>';$('helpSheet').appendChild(settings);
  const frame=document.createElement('div');frame.id='magicFrame';frame.hidden=true;document.body.appendChild(frame);
  let pending=null,arc=null,dockTime=0,swing=0,trailTime=0,lastFire=false,taking=false;
  function dock(){
    const photo=$('photoBtn').getBoundingClientRect();
    const obstacles=['photoBtn','broomBtn','actBtn','candyBtn','tbJump','tbDash','joy'].map(id=>$(id)).filter(e=>e&&e.getBoundingClientRect().width&&getComputedStyle(e).visibility!=='hidden').map(e=>e.getBoundingClientRect());
    const overlaps=(x,y,w,h)=>obstacles.some(r=>x<r.right+8&&x+w>r.left-8&&y<r.bottom+8&&y+h>r.top-8);
    const x=innerWidth-18-48;let y=Math.min(innerHeight-116,photo.top-60);
    while(y>120&&overlaps(x,y,48,48))y-=56;
    toggle.style.left=x+'px';toggle.style.top=y+'px';
    const ids=held?['magicCancel','magicTurn','magicPut']:['magicSpark','magicFire'];
    let ay=y-56;const left=x-(ids.length-1)*56;
    while(ay>70&&overlaps(left,ay,ids.length*56-8,48))ay-=56;
    ids.forEach((id,i)=>{$(id).style.left=(left+i*56)+'px';$(id).style.top=ay+'px'});
  }
  const tag=document.createElement('div');tag.id='magicTag';tag.hidden=true;document.body.appendChild(tag);
  const hint=document.createElement('div');hint.id='magicHint';hint.setAttribute('role','status');document.body.appendChild(hint);
  let hintT=0;
  function say(msg,x,y){
    hint.textContent=msg;const w=Math.min(innerWidth-24,hint.offsetWidth||160)/2;
    let top=Math.max(76,Math.min(innerHeight-170,y-18));const t=$('toast');
    if(t&&t.classList.contains('on')){const r=t.getBoundingClientRect();if(top>r.top-6)top=Math.max(76,r.top-8)} // keep clear of the game's own toast
    hint.style.left=Math.max(12+w,Math.min(innerWidth-12-w,x))+'px';hint.style.top=top+'px';
    hint.classList.add('on');clearTimeout(hintT);hintT=setTimeout(()=>hint.classList.remove('on'),1500);
  }
  function ripple(x,y){const d=document.createElement('div');d.className='magic-ripple';d.style.left=x+'px';d.style.top=y+'px';document.body.appendChild(d);setTimeout(()=>d.remove(),500)}
  // Ground rings are drawn on top so grass or the prop itself never hides the "can I put it here" answer.
  const fx=[];
  const ringMat=(c,o,top)=>new THREE.MeshBasicMaterial({color:c,side:THREE.DoubleSide,transparent:true,opacity:o,depthWrite:false,depthTest:!top,fog:false});
  const mkRing=(a,b,mat,ro)=>{const m=new THREE.Mesh(new THREE.RingGeometry(a,b,40),mat);m.rotation.x=-Math.PI/2;m.visible=false;m.renderOrder=ro||0;m.userData.magicFx=true;scene.add(m);fx.push(m);return m};
  const ring=mkRing(.8,.9,ringMat(0x81e3ab,.95,true),20);
  const fill=new THREE.Mesh(new THREE.CircleGeometry(.8,40),ringMat(0x81e3ab,.18,true));fill.renderOrder=19;fill.position.z=-.001;fill.userData.magicFx=true;ring.add(fill);
  const guide=mkRing(.42,.5,ringMat(0x81e3ab,.55,true),18);
  // Faint "movable" marks: thin warm ring on the ground + a tiny star above the prop. Few, only near Piyo.
  const starTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),k=g.createRadialGradient(32,32,0,32,32,30);k.addColorStop(0,'rgba(255,250,225,1)');k.addColorStop(.25,'rgba(255,236,170,.75)');k.addColorStop(1,'rgba(255,220,140,0)');g.fillStyle=k;g.beginPath();for(let i=0;i<8;i++){const a=i/8*Math.PI*2-Math.PI/2,r=i%2?7:30;g.lineTo(32+Math.cos(a)*r,32+Math.sin(a)*r)}g.closePath();g.fill();const t=new THREE.CanvasTexture(c);return t})();
  const marks=[];
  for(let i=0;i<8;i++){
    const m=mkRing(.92,1,ringMat(0xfff0c0,.4,false),3);
    const st=new THREE.Sprite(new THREE.SpriteMaterial({map:starTex,transparent:true,depthWrite:false,opacity:.75}));st.scale.set(.32,.32,1);st.visible=false;st.userData.magicFx=true;scene.add(st);fx.push(st);
    marks.push({m,st,e:null});
  }
  let markList=[],markTime=1,spotTime=0;
  const _v=new THREE.Vector3();
  function nearProps(){
    const out=[];
    for(const e of props){
      if(held&&held.e===e)continue;
      const q=edPos(e),d=Math.hypot(q.x-player.pos.x,q.z-player.pos.z);if(d>11)continue;
      _v.set(q.x,q.y+(HEIGHT[e.kind]||1)*.5,q.z).project(camera);if(_v.z>1||Math.abs(_v.x)>1.05||Math.abs(_v.y)>1.05)continue;
      out.push({e,d,q});
    }
    return out.sort((a,b)=>a.d-b.d).slice(0,marks.length);
  }
  function usable(){return !!getSave().wand&&state.mode==='play'&&!state.editOn&&!blocked()&&!player.fly&&!player.sit}
  function ui(){
    const show=usable()&&!state.camMode;
    toggle.hidden=!show;toggle.setAttribute('aria-pressed',String(active));toggle.setAttribute('aria-label',active?'杖をしまう':'杖を装備する');
    for(const id of ['magicTurn','magicPut','magicCancel'])$(id).hidden=!(show&&active&&held);
    for(const id of ['magicSpark','magicFire'])$(id).hidden=!(show&&active&&!held);
    settings.hidden=!getSave().wand;$('magicUndo').disabled=!undo;$('magicReset').disabled=!Object.keys(rows).length;
    dock();
  }
  function hideFx(){ring.visible=guide.visible=false;tag.hidden=true;marks.forEach(k=>{k.m.visible=k.st.visible=false;k.e=null});markList=[]}
  function cancel(){if(held){held.e.st=held.orig;edApply(held.e);held=null}hideFx();markTime=1;ui()}
  function close(){cancel();active=false;photoTimer=0;ui()}
  function select(e){
    if(!usable()||!active||state.camMode||!propSet.has(e))return false;
    cancel();const q=edPos(e);if(Math.hypot(q.x-player.pos.x,q.z-player.pos.z)>REACH)return false;
    wave(.45);lift=0;held={e,orig:e.st,before:copy(edSt(e)),r:edSt(e).r||0,x:q.x,z:q.z,vx:q.x,vz:q.z,ok:false,why:'',guide:null,collisions:[...e.cols,...e.circs].map(c=>({c,s:{...c}}))};
    spotTime=1;ui();AUDIO.sfx('wand');return true;
  }
  function place(){
    if(!held||!held.ok||!usable())return false;
    const h=held,e=h.e,id=idOf(e),oldRows={...rows},oldUndo=undo;
    e.st={...h.before,dx:h.x-e.x0,dz:h.z-e.z0,dy:defaults.get(e).dy||0,r:h.r};edApply(e);
    rows[id]=copy(e.st);undo={e,before:h.before};
    if(!persist()){rows=oldRows;undo=oldUndo;e.st=h.orig;edApply(e);held=null;hideFx();ui();return false}
    held=null;hideFx();markTime=1;burst(h.x,groundY(h.x,h.z)+.8,h.z,24,SPARK,2,1);AUDIO.sfx('found');ui();return true;
  }
  function undoLast(){
    if(!undo||!getSave().wand)return;cancel();const {e,before}=undo,now=copy(edSt(e)),id=idOf(e),oldRows={...rows};
    e.st=before;edApply(e);rows[id]=copy(before);
    if(!persist()){rows=oldRows;e.st=now;edApply(e);return}undo=null;ui();
  }
  function resetLayout(){
    cancel();const oldRows=rows;
    rows={};if(!persist()){rows=oldRows;return}
    for(const e of props){e.st=copy(defaults.get(e));edApply(e)}undo=null;ui();toast('模様替えだけ 元にもどしました',2600);
  }
  function cast(fire){
    if(!usable()||!active||cooldown>0)return false;cooldown=1.4;wave(.65);lastFire=fire;
    const f=player.face,pos=new THREE.Vector3(player.pos.x+Math.sin(f)*3,player.pos.y+(fire?6:1.6),player.pos.z+Math.cos(f)*3);
    if(state.camMode){camera.getWorldDirection(pos);pos.multiplyScalar(8).add(camera.position);pos.y+=fire?2:.4}
    // The spell itself fires at the end of the flick (see tick): a "pop" ring, or a rocket that opens into a star.
    // A gold ribbon arc is drawn over Piyo's head from her wand side to the other side; the spell goes off where it ends.
    const F=new THREE.Vector3(Math.sin(f),0,Math.cos(f)),S=new THREE.Vector3(-Math.cos(f),0,Math.sin(f)),C=(_sh.lengthSq()?_sh.clone():player.pos.clone().setY(player.pos.y+.6)).addScaledVector(F,.2).add(new THREE.Vector3(0,.55,0));
    arc={t0:clock+.08,dur:.32,C,F,S,R:.95,a0:.45,a1:3.6};
    pending={fire,pos};AUDIO.sfx('wand');return true;
  }
  const localPreview=['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&new URLSearchParams(location.search).get('magic-preview')==='1';
  if(localPreview){getSave().wand=true;}
  toggle.onclick=()=>{if(!usable()||state.camMode)return;if(active){close();return}active=true;wave(.45);ui();try{if(!localStorage.getItem('usapon-magic-guide-v1')){toast('光る小物をタップして ふわり！\n歩いてはこんで、緑の輪で ✓ を押そう',3400);localStorage.setItem('usapon-magic-guide-v1','1')}}catch(e){}};
  $('magicCancel').onclick=cancel;
  $('magicReset').onclick=()=>askYN('模様替え','模様替えをぜんぶ元にもどす？\n集めたアイテムと写真はそのままだよ',resetLayout);
  $('magicTurn').onclick=()=>{if(held){held.r=(held.r+30)%360;wave(.3)}};$('magicPut').onclick=()=>{if(!place()&&held){const r=$('magicPut').getBoundingClientRect();say(REASON[held.why]||'ここには置けないよ',r.left+r.width/2,r.top)}};$('magicUndo').onclick=undoLast;
  $('magicSpark').onclick=()=>cast(false);$('magicFire').onclick=()=>cast(true);
  let down=null;const rc=new THREE.Raycaster(),pt=new THREE.Vector2();
  const pointers=new Set();
  const owner=(obj,id)=>ED.list.find(e=>e.objs.some(o=>{let p=obj;while(p){if(p===o)return true;p=p.parent}return false})||e.inst.some(([ib,i])=>ib.im===obj&&i===id));
  function firstHit(cx,cy){
    const r=canvas.getBoundingClientRect();pt.set((cx-r.left)/r.width*2-1,1-(cy-r.top)/r.height*2);rc.setFromCamera(pt,camera);
    for(const h of rc.intersectObjects(scene.children,true)){
      let visible=true;for(let o=h.object;o;o=o.parent)if(!o.visible)visible=false;
      // Thin garland cords / outlines (lines, hit within 1 m by default) and particles never block a tap.
      if(!visible||h.object.userData.magicFx||h.object.isSprite||h.object.isPoints||h.object.isLine)continue;
      const m=h.object.material;if(m&&m.transparent&&m.depthWrite===false)continue; // glow pools, shadows, dirt decals
      if(wand){let p=h.object,w=false;while(p){if(p===wand)w=true;p=p.parent}if(w)continue}
      if(piyo.group){let p=h.object,w=false;while(p){if(p===piyo.group)w=true;p=p.parent}if(w)continue}
      return h;
    }
    return null;
  }
  // A tap always answers: pick, "come closer", "this one does not move", or where to tap instead.
  function tapAt(cx,cy){
    ripple(cx,cy);
    if(held){say('置くときは ✓ ボタンだよ',cx,cy);return}
    const h=firstHit(cx,cy),o=h&&owner(h.object,h.instanceId);
    let pick=o&&propSet.has(o)?o:null;
    if(!pick){
      // Small props are hard to hit with a finger: accept a near miss, but only if that prop is itself the first thing seen there (no picking through walls).
      const r=canvas.getBoundingClientRect();let best=null;
      for(const {e,q} of nearProps()){
        _v.set(q.x,q.y+(HEIGHT[e.kind]||1)*.45,q.z).project(camera);
        const sx=r.left+(_v.x+1)/2*r.width,sy=r.top+(1-_v.y)/2*r.height,d=Math.hypot(sx-cx,sy-cy);
        if(d>38||(best&&d>=best.d))continue;
        const hh=firstHit(sx,sy);if(hh&&owner(hh.object,hh.instanceId)===e)best={e,d};
      }
      if(best)pick=best.e;
    }
    if(pick){
      const q=edPos(pick);
      if(Math.hypot(q.x-player.pos.x,q.z-player.pos.z)>REACH){say('もう少し近づいてね',cx,cy);return}
      if(!select(pick))say('いまは動かせないよ',cx,cy);
      return;
    }
    if(o||(h&&h.point.y>groundY(h.point.x,h.point.z)+.6)){say('これは動かせないよ',cx,cy);return}
    say(markList.some(k=>k.d<=REACH)?'光っている小物をタップしてね':'近くに動かせる小物がないよ',cx,cy);
  }
  canvas.addEventListener('pointerdown',ev=>{pointers.add(ev.pointerId);if(pointers.size>1){down=null;return}if(active&&!state.camMode)down={id:ev.pointerId,x:ev.clientX,y:ev.clientY,t:performance.now()}});
  canvas.addEventListener('pointermove',ev=>{if(down&&Math.hypot(ev.clientX-down.x,ev.clientY-down.y)>9)down=null});
  window.addEventListener('pointerup',ev=>pointers.delete(ev.pointerId));
  canvas.addEventListener('pointercancel',ev=>{down=null;pointers.delete(ev.pointerId)});
  canvas.addEventListener('pointerup',ev=>{
    const d=down;down=null;pointers.delete(ev.pointerId);if(!d||d.id!==ev.pointerId||!active||!usable()||state.camMode||Math.hypot(ev.clientX-d.x,ev.clientY-d.y)>9||performance.now()-d.t>450)return;
    tapAt(ev.clientX,ev.clientY);
  });
  window.addEventListener('keydown',ev=>{if(ev.code==='Escape'&&active)close()});
  window.addEventListener('blur',()=>{if(held)cancel();photoTimer=0});
  /* Wand in Piyo's hand. The rig has no hand bone, so the stick sits at the tip of the short right arm.
     The arm pose is layered on top of the walk pose each frame (never stored), so walk / sit / fly / selfie poses stay untouched. */
  const _q1=new THREE.Quaternion(),_q2=new THREE.Quaternion(),_q3=new THREE.Quaternion(),_e=new THREE.Euler(0,0,0,'XYZ'),_d=new THREE.Vector3(),_h=new THREE.Vector3(),_sh=new THREE.Vector3(),_tip=new THREE.Vector3(),_Y=new THREE.Vector3(0,1,0),_w=new THREE.Quaternion();
  const ARM={len:.2,rest:new THREE.Vector3(-.85,-.45,.2).normalize(),grip:.3};
  let armW=0,swingMax=.65,glint=0;
  const wave=len=>{swing=len;swingMax=len};
  // 0..1 swing curve: lift (0-.35), flick forward (.35-.6), settle.
  function swingPose(){
    if(swing<=0)return {up:0,fwd:0};
    const u=1-swing/swingMax,ease=t=>t*t*(3-2*t);
    if(u<.35){const k=ease(u/.35);return {up:k,fwd:-.25*k}}
    if(u<.6){const k=ease((u-.35)/.25);return {up:1-1.25*k,fwd:-.25+1.25*k}}
    const k=ease((u-.6)/.4);return {up:-.25*(1-k),fwd:(1-k)}
  }
  function holdWand(dt){
    const o=piyo.bones&&piyo.bones.RightArm;
    armW+=((wand.visible?1:0)-armW)*Math.min(1,dt*8);
    if(!o){piyo.group.updateWorldMatrix(true,false);wand.position.set(-.45,.75,.2).applyMatrix4(piyo.group.matrixWorld);wand.quaternion.copy(piyo.group.quaternion);return}
    const sp=swingPose(),carry=held?lift:0,walk=Math.min(1,Math.hypot(player.vx||0,player.vz||0)/4);
    // Model axes: x = sideways (pitch the arm forward), z = forward (raise the arm out).
    const raise=.55+.45*sp.up+.1*carry,pitch=-(.55+.85*sp.up+.35*carry-.4*sp.fwd)-Math.sin(clock*7)*.05*walk+Math.sin(clock*1.6)*.03;
    _e.set(pitch,0,-raise);_q1.setFromEuler(_e);
    // Current walk pose rotation A_anim (holder space) recovered from the bone, then blended toward the wand pose.
    _q2.copy(o.pq).multiply(o.b.quaternion).multiply(_q3.copy(o.q).invert()).multiply(o.pqi);
    _q2.slerp(_q1,armW);
    o.b.quaternion.copy(o.pqi).multiply(_q2).multiply(o.pq).multiply(o.q);
    piyo.group.updateMatrixWorld(true);
    o.b.getWorldPosition(_sh);
    piyo.body.getWorldQuaternion(_w);
    _h.copy(ARM.rest).applyQuaternion(_q2).applyQuaternion(_w).multiplyScalar(ARM.len).add(_sh);
    // Stick direction in Piyo space: up and a little forward, tipping forward on the flick, pointing at the held prop while carrying.
    _d.set(-.32-.15*sp.up,1-.35*sp.fwd,.35+1.2*sp.fwd-.55*sp.up).normalize().applyQuaternion(_w);
    if(held){const q=edPos(held.e);_tip.set(held.vx,q.y+.6+lift*.35,held.vz).sub(_h).normalize();_d.lerp(_tip,.55*carry).normalize()}
    if(arcOn){_tip.subVectors(arcHead,_h).normalize();_d.lerp(_tip,.85).normalize()}
    wand.quaternion.setFromUnitVectors(_Y,_d);
    wand.position.copy(_h).addScaledVector(_d,ARM.grip);
  }
  /* ---- spell effects: own small pools, never touching the game's shared spark pool ---- */
  const GOLD=new THREE.Color(0xffd77a),CREAM=new THREE.Color(0xfff4d2),PINK=new THREE.Color(0xffa8c8),MINT=new THREE.Color(0xa8f0d8),LILAC=new THREE.Color(0xd2b8ff);
  // Star particles (THREE.Points, world-size, per-particle colour / alpha / twinkle)
  const PN=260,pPos=new Float32Array(PN*3),pCol=new Float32Array(PN*3),pA=new Float32Array(PN),pS=new Float32Array(PN),parts=[];
  const pGeo=new THREE.BufferGeometry();pGeo.setAttribute('position',new THREE.BufferAttribute(pPos,3));pGeo.setAttribute('tint',new THREE.BufferAttribute(pCol,3));pGeo.setAttribute('alpha',new THREE.BufferAttribute(pA,1));pGeo.setAttribute('size',new THREE.BufferAttribute(pS,1));
  const pMat=new THREE.ShaderMaterial({uniforms:{map:{value:starTex},scale:{value:400}},transparent:true,depthWrite:false,
    vertexShader:'attribute vec3 tint;attribute float alpha;attribute float size;uniform float scale;varying vec3 vC;varying float vA;void main(){vC=tint;vA=alpha;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=size*scale/max(.1,-mv.z);gl_Position=projectionMatrix*mv;}',
    fragmentShader:'uniform sampler2D map;varying vec3 vC;varying float vA;void main(){vec4 t=texture2D(map,gl_PointCoord);gl_FragColor=vec4(mix(vC,vec3(1.0),t.a*t.a*.55),min(1.0,t.a*1.3)*vA);}'});
  pGeo.setDrawRange(0,0);const pts=new THREE.Points(pGeo,pMat);pts.frustumCulled=false;pts.renderOrder=22;
  // Sized at draw time from the real buffer, so 1080x1920 photos get the same sparkle size as the screen.
  const _buf=new THREE.Vector2();pts.onBeforeRender=(r,sc,cam)=>{r.getDrawingBufferSize(_buf);pMat.uniforms.scale.value=_buf.y*cam.projectionMatrix.elements[5]/2};
  pts.userData.magicFx=true;scene.add(pts);
  function spark(o){if(parts.length>=PN)parts.shift();parts.push(Object.assign({x:0,y:0,z:0,vx:0,vy:0,vz:0,age:0,life:.6,size:.14,drag:0,g:0,tw:0,delay:0,col:GOLD,grow:0},o))}
  const _R=new THREE.Vector3(),_U=new THREE.Vector3(),_C=new THREE.Vector3();
  function camAxes(){camera.updateMatrixWorld();_R.setFromMatrixColumn(camera.matrixWorld,0).normalize();_U.setFromMatrixColumn(camera.matrixWorld,1).normalize()}
  function twinkle(x,y,z,n,r,col){for(let i=0;i<n;i++){const a=Math.random()*6.283,b=Math.random()*2-1,k=r*(.4+Math.random()*.6);spark({x,y,z,vx:Math.cos(a)*k*2,vy:b*k*2+.3,vz:Math.sin(a)*k*2,drag:4,life:.45+Math.random()*.35,size:.13+Math.random()*.13,tw:14,col:col||(i%3?GOLD:CREAM)})}}
  // Pop ring: a camera-facing ring that springs open and fades ("ポンッ")
  const pops=[];
  function pop(p,r){
    for(const [k,delay,w] of [[1,0,.16],[.6,.07,.12]]){
      const m=new THREE.Mesh(new THREE.RingGeometry(1-w,1,48),new THREE.MeshBasicMaterial({color:0xffd75e,transparent:true,depthWrite:false,side:THREE.DoubleSide,fog:false}));
      m.position.copy(p);m.renderOrder=21;m.visible=false;m.userData.magicFx=true;scene.add(m);fx.push(m);pops.push({m,age:-delay,r:r*k});
    }
    camAxes();for(let i=0;i<10;i++){const a=i/10*6.283;spark({x:p.x,y:p.y,z:p.z,vx:(_R.x*Math.cos(a)+_U.x*Math.sin(a))*r*4.2,vy:(_R.y*Math.cos(a)+_U.y*Math.sin(a))*r*4.2,vz:(_R.z*Math.cos(a)+_U.z*Math.sin(a))*r*4.2,drag:5,life:.6,size:.17,tw:10,col:i%2?GOLD:PINK})}
    spark({x:p.x,y:p.y,z:p.z,life:.22,size:.55,col:CREAM});
  }
  // Firework: a little light rises, then opens into a five-point star; glitter drifts down slowly.
  const rockets=[];
  function firework(from,to){rockets.push({p:from.clone(),to:to.clone(),age:0,dur:.6,trail:0})}
  function starBurst(c){
    camAxes();const cols=[GOLD,PINK,MINT,LILAC],main=cols[Math.floor(Math.random()*cols.length)];
    const V=[];for(let k=0;k<10;k++){const a=k/10*6.283+Math.PI/2,r=k%2?.42:1;V.push([Math.cos(a)*r,Math.sin(a)*r])}
    for(let k=0;k<10;k++){const A=V[k],B=V[(k+1)%10];for(let j=0;j<8;j++){const t=j/8,sx=A[0]+(B[0]-A[0])*t,sy=A[1]+(B[1]-A[1])*t,sp=4.4;
      spark({x:c.x,y:c.y,z:c.z,vx:(_R.x*sx+_U.x*sy)*sp,vy:(_R.y*sx+_U.y*sy)*sp,vz:(_R.z*sx+_U.z*sy)*sp,drag:3.2,g:-.55,life:1.8+Math.random()*.5,size:k%2?.24:.3,tw:5,col:k%2?main:GOLD})}}
    spark({x:c.x,y:c.y,z:c.z,life:.28,size:1.3,col:CREAM});
    for(let i=0;i<34;i++){const a=Math.random()*6.283,r=Math.random()*1.15;spark({x:c.x+(_R.x*Math.cos(a)+_U.x*Math.sin(a))*r,y:c.y+(_R.y*Math.cos(a)+_U.y*Math.sin(a))*r,z:c.z+(_R.z*Math.cos(a)+_U.z*Math.sin(a))*r,vy:-.25-Math.random()*.25,vx:(Math.random()-.5)*.15,vz:(Math.random()-.5)*.15,delay:.35+Math.random()*.5,life:2.2+Math.random()*.8,size:.12+Math.random()*.1,tw:9,col:i%3?GOLD:(i%2?CREAM:main)})}
  }
  // Ribbon: a thin gold band following the wand tip, each point fading after ~0.3 s.
  const RN=40,RL=.3,rib=[],rPos=new Float32Array(RN*2*3),rA=new Float32Array(RN*2),rIdx=[];
  for(let i=0;i<RN-1;i++){const a=i*2;rIdx.push(a,a+1,a+2,a+1,a+3,a+2)}
  const rGeo=new THREE.BufferGeometry();rGeo.setAttribute('position',new THREE.BufferAttribute(rPos,3));rGeo.setAttribute('alpha',new THREE.BufferAttribute(rA,1));{const sd=new Float32Array(RN*2);for(let i=0;i<RN;i++){sd[i*2]=1;sd[i*2+1]=-1}rGeo.setAttribute('side',new THREE.BufferAttribute(sd,1))}rGeo.setIndex(rIdx);
  const rMat=new THREE.ShaderMaterial({uniforms:{c:{value:new THREE.Color(0xffc93c)}},transparent:true,depthWrite:false,depthTest:false,side:THREE.DoubleSide,
    vertexShader:'attribute float alpha;attribute float side;varying float vA;varying float vS;void main(){vA=alpha;vS=side;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'uniform vec3 c;varying float vA;varying float vS;void main(){float core=1.0-abs(vS);gl_FragColor=vec4(mix(c,vec3(1.0,.99,.92),core*core*core),vA*(.15+.85*core));}'});
  const ribbon=new THREE.Mesh(rGeo,rMat);ribbon.frustumCulled=false;ribbon.renderOrder=22;ribbon.userData.magicFx=true;scene.add(ribbon);fx.push(ribbon);
  const _a=new THREE.Vector3(),_b=new THREE.Vector3(),_cd=new THREE.Vector3();
  let arcOn=false;const arcHead=new THREE.Vector3();
  function arcPoint(k,out){const a=arc.a0+(arc.a1-arc.a0)*k;return out.copy(arc.C).addScaledVector(arc.S,Math.cos(a)*arc.R).addScaledVector(arc.F,Math.sin(Math.PI*k)*.35).add(_b2.set(0,Math.sin(a)*arc.R,0))}
  const _b2=new THREE.Vector3();
  function fxTick(dt){
    // ribbon: the head runs along the arc, every point fades out ~0.3 s after it was drawn
    if(arc&&clock>=arc.t0){
      const k=Math.min(1,(clock-arc.t0)/arc.dur),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2,steps=3;
      const from=arc.last===undefined?0:arc.last;
      for(let j=1;j<=steps;j++){const kk=from+(e-from)*j/steps;arcPoint(kk,_b);rib.push({p:_b.clone(),t:clock});if(rib.length>RN)rib.shift()}
      arc.last=e;arcPoint(e,arcHead);arcOn=true;
      if(Math.random()<.6)spark({x:arcHead.x,y:arcHead.y,z:arcHead.z,vy:-.35,vx:(Math.random()-.5)*.3,vz:(Math.random()-.5)*.3,life:.5,size:.1+Math.random()*.08,tw:12,col:Math.random()<.5?CREAM:GOLD});
      if(k>=1){
        const end=arcHead.clone();twinkle(end.x,end.y,end.z,10,.25);pop(end,.7);
        const P=pending;pending=null;arc=null;arcOn=false;
        if(P){if(P.fire)firework(end,P.pos);else{pop(P.pos,1);burst(P.pos.x,P.pos.y,P.pos.z,18,SPARK,1.4,1.2);twinkle(P.pos.x,P.pos.y,P.pos.z,12,.45)}}
      }
    }
    while(rib.length&&clock-rib[0].t>RL)rib.shift();
    const n=rib.length;ribbon.visible=n>1;
    if(n>1){
      camera.getWorldDirection(_cd);
      for(let i=0;i<n;i++){
        const A=rib[Math.max(0,i-1)].p,B=rib[Math.min(n-1,i+1)].p,age=(clock-rib[i].t)/RL,head=i/(n-1);
        _a.subVectors(B,A).cross(_cd).normalize().multiplyScalar(.15*(.25+.75*head)*(1-age*.45));
        _b.copy(rib[i].p);rPos.set([_b.x+_a.x,_b.y+_a.y,_b.z+_a.z,_b.x-_a.x,_b.y-_a.y,_b.z-_a.z],i*6);
        const al=Math.pow(Math.max(0,1-age),1.4)*(.2+.8*head);rA[i*2]=rA[i*2+1]=al;
      }
      rGeo.setDrawRange(0,(n-1)*6);rGeo.attributes.position.needsUpdate=rGeo.attributes.alpha.needsUpdate=true;
    }
    if(!arc&&pending&&swing<=0){const P=pending;pending=null;if(P.fire)firework(P.pos.clone().setY(P.pos.y-4.6),P.pos);else pop(P.pos,.6)} // wand hidden mid-swing
    // pops
    for(let i=pops.length-1;i>=0;i--){const q=pops[i];q.age+=dt;const k=q.age/.42;q.m.visible=q.age>0;
      if(k>=1){scene.remove(q.m);q.m.geometry.dispose();q.m.material.dispose();fx.splice(fx.indexOf(q.m),1);pops.splice(i,1);continue}
      if(q.age>0){const e=1-Math.pow(1-k,3);q.m.scale.setScalar(q.r*(.2+.8*e));q.m.quaternion.copy(camera.quaternion);q.m.material.opacity=(1-k)*(1-k)}}
    // rockets
    for(let i=rockets.length-1;i>=0;i--){const r=rockets[i];r.age+=dt;const k=Math.min(1,r.age/r.dur),e=1-(1-k)*(1-k);
      _C.lerpVectors(r.p,r.to,e);_C.x+=Math.sin(r.age*18)*.04*(1-k);
      r.trail+=dt;if(r.trail>.03){r.trail=0;spark({x:_C.x,y:_C.y,z:_C.z,vy:-.4,life:.4,size:.16,col:i%2?CREAM:GOLD,tw:20})}
      spark({x:_C.x,y:_C.y,z:_C.z,life:dt*1.5,size:.45,col:CREAM});
      if(k>=1){starBurst(r.to);rockets.splice(i,1)}}
    // particles
    if(parts.length||pts.visible){
      let j=0;
      for(let i=parts.length-1;i>=0;i--){const q=parts[i];
        if(q.delay>0){q.delay-=dt;continue}
        q.age+=dt;if(q.age>=q.life){parts.splice(i,1);continue}
        const dr=Math.exp(-q.drag*dt);q.vx*=dr;q.vy=q.vy*dr+q.g*dt;q.vz*=dr;q.x+=q.vx*dt;q.y+=q.vy*dt;q.z+=q.vz*dt;
        const k=q.age/q.life,fade=k<.12?k/.12:1-Math.pow((k-.12)/.88,2),tw=q.tw?.65+.35*Math.sin(q.age*q.tw*6.283+i):1;
        pPos[j*3]=q.x;pPos[j*3+1]=q.y;pPos[j*3+2]=q.z;pCol[j*3]=q.col.r;pCol[j*3+1]=q.col.g;pCol[j*3+2]=q.col.b;pA[j]=fade*tw;pS[j]=q.size*(1+q.grow*k);j++;
      }
      pGeo.setDrawRange(0,j);pts.visible=j>0;
      for(const a of ['position','tint','alpha','size'])pGeo.attributes[a].needsUpdate=true;
    }
  }
  function tick(dt){
    clock+=dt;cooldown=Math.max(0,cooldown-dt);
    if(lastCam&&!state.camMode){photoMode=false;photoTimer=0}
    if(lastCam!==!!state.camMode){if(state.camMode){cancel();photoMode=false} /* 写真は ステッキなしと同じ: 画面の向きのまま(縦→縦、横→横)、わくも つけられる (フミオさん 10/24) */lastCam=!!state.camMode;ui()}
    frame.hidden=!(photoMode&&state.camMode&&state.mode==='play');
    if(!ready){ready=true;ui()}
    if(!wand&&getPresent()){
      wand=getPresent().wand.clone(true);wand.scale.setScalar(.65);wand.visible=false;scene.add(wand);
      // Own, softer glow: the present's sprite material is shared and must stay as it is.
      wand.traverse(o=>{if(o.isSprite){o.material=o.material.clone();o.material.opacity=.42;o.scale.multiplyScalar(.55)}});
    }
    if(wand){
      wand.visible=active&&!!getSave().wand&&piyo.group.visible&&!player.fly;
      swing=Math.max(0,swing-dt);
      holdWand(dt);
      trailTime+=dt;glint+=dt;
      if(wand.visible&&(held&&trailTime>.22||glint>1.8)){
        trailTime=0;wand.updateMatrixWorld(true);_tip.set(0,.18,0).applyMatrix4(wand.matrixWorld);
        if(glint>1.8&&!swing&&!held){glint=0;burst(_tip.x,_tip.y,_tip.z,1,SPARK,.12,.05)}
        else if(held){const q=edPos(held.e),k=.35+Math.random()*.4;burst(_tip.x+(held.vx-_tip.x)*k,_tip.y+(q.y+.6+lift*.35-_tip.y)*k,_tip.z+(held.vz-_tip.z)*k,1,SPARK,.15,.08)}
      }
    }
    fxTick(dt);
    if(!getSave().wand||player.fly||blocked()){if(active)close()}
    if(!usable()){photoTimer=0;if(held)cancel();ui();return}
    dockTime+=dt;if(dockTime>.15){dockTime=0;ui()}
    if(active&&!held&&!state.camMode){
      markTime+=dt;if(markTime>.25){markTime=0;markList=nearProps();marks.forEach((k,i)=>{k.e=markList[i]?markList[i].e:null})}
      marks.forEach((k,i)=>{
        const o=markList[i];k.m.visible=k.st.visible=!!(o&&k.e);if(!k.m.visible)return;
        const q=edPos(o.e),near=o.d<=REACH,s=foot(o.e)+.25,pulse=.5+.5*Math.sin(clock*2.6+i*1.3);
        k.m.position.set(q.x,q.y+.05,q.z);k.m.scale.setScalar(s*(1+pulse*.06));k.m.material.opacity=(near?.3:.14)+pulse*(near?.22:.08);
        k.st.position.set(q.x,q.y+(HEIGHT[o.e.kind]||1)+.22+Math.sin(clock*2+i)*.05,q.z);k.st.material.opacity=(near?.55:.25)+pulse*.3;
      });
    }
    if(held){
      // Carried a little to Piyo's right (the wand hand) so the follow camera behind her still sees it.
      const h=held,e=h.e,f=player.face-.4,r=foot(e),dist=r+.9,lim=EDGE-r-.15,ax=Math.max(-lim,Math.min(lim,player.pos.x+Math.sin(f)*dist)),az=Math.max(-lim,Math.min(lim,player.pos.z+Math.cos(f)*dist));
      spotTime+=dt;
      if(spotTime>.08||Math.hypot(ax-h.ax,az-h.az)>.35||h.ax===undefined){
        spotTime=0;h.ax=ax;h.az=az;
        // Gentle snap: a free spot within ~0.9 m counts as "here". Otherwise explain why and show the nearest free spot faintly.
        const snap=nearestSpot(e,ax,az,.9,.3);
        if(snap){h.ok=true;h.x=snap.x;h.z=snap.z;h.why='';h.guide=null}
        else{h.ok=false;h.x=ax;h.z=az;h.why=why(e,ax,az)||'wall';h.guideT=(h.guideT||0)+1;if(h.guideT%3===1)h.guide=nearestSpot(e,ax,az,3.5,.5)}
      }
      lift=Math.min(1,lift+dt*3);
      h.vx+=(h.x-h.vx)*Math.min(1,dt*12);h.vz+=(h.z-h.vz)*Math.min(1,dt*12);
      // Only the visual pose floats. Collision stays at the last committed position.
      e.st={...h.before,dx:h.vx-e.x0,dz:h.vz-e.z0,dy:(defaults.get(e).dy||0)+(.35+Math.sin(clock*3)*.06)*lift,r:h.r};edApply(e);
      h.collisions.forEach(({c,s})=>Object.assign(c,s));
      const gy=groundY(h.x,h.z)+.06,rs=(r+.2)/.85;
      ring.visible=true;ring.position.set(h.x,gy,h.z);ring.scale.setScalar(rs*(h.ok?1+Math.sin(clock*5)*.03:1));ring.material.color.setHex(h.ok?0x81e3ab:0xf08a9a);fill.material.color.setHex(h.ok?0x81e3ab:0xf08a9a);
      guide.visible=!h.ok&&!!h.guide;if(guide.visible){guide.position.set(h.guide.x,groundY(h.guide.x,h.guide.z)+.06,h.guide.z);guide.material.opacity=.35+.25*Math.sin(clock*4)}
      {const b=$('magicPut');b.classList.toggle('off',!h.ok);b.setAttribute('aria-disabled',String(!h.ok))}
      _v.set(h.x,gy,h.z).project(camera);
      if(_v.z<1){
        const html=h.ok?'<b>◯</b>ここに置けるよ':'<b>✕</b>'+REASON[h.why]+(h.guide?'<br><b>→</b>光る小さな輪なら置けるよ':'');
        if(tag.dataset.k!==html){tag.innerHTML=html;tag.dataset.k=html}
        tag.classList.toggle('ng',!h.ok);tag.hidden=false;
        // Under the ring, unless that would slide under the round buttons: then above it.
        const w=(tag.offsetWidth||150)/2,th=tag.offsetHeight||28,x=(_v.x+1)/2*innerWidth,ry=(1-_v.y)/2*innerHeight;
        const left=Math.max(10+w,Math.min(innerWidth-10-w,x));let y=ry+22;
        const hit=yy=>[...document.querySelectorAll('.magic-button:not([hidden]),#joy,#photoBtn')].some(b=>{const r=b.getBoundingClientRect();return r.width&&left-w<r.right+6&&left+w>r.left-6&&yy<r.bottom+6&&yy+th>r.top-6});
        if(hit(y))y=ry-th-34;
        tag.style.left=left+'px';tag.style.top=Math.max(70,Math.min(innerHeight-th-10,y))+'px';
      }else tag.hidden=true;
    }
    if(photoTimer>0){photoTimer-=dt;if(photoTimer<=0&&state.camMode){photoTimer=0;taking=true;try{takeFreePhoto(true)}finally{taking=false}}}
  }
  return {tick,cancel,close,select,place,valid,check,why,reach,spot:nearestSpot,fx:{firework,pop,twinkle},story:()=>photoMode&&!!state.camMode,beforePhoto:story=>{if(!story||!active||taking)return false;if(!photoTimer){cast(lastFire);photoTimer=lastFire?1.25:.55}return true},capture:()=>{document.body.classList.add('magic-capture');setTimeout(()=>document.body.classList.remove('magic-capture'),180)},props:()=>props,storageKey:KEY,inspect:()=>({active,marks:markList.map(o=>({kind:o.e.kind,d:+o.d.toFixed(2)})),held:held?{id:idOf(held.e),ok:held.ok,why:held.why,x:held.x,z:held.z}:null,count:Object.keys(rows).length,wandVisible:!!(wand&&wand.visible),fx:{ribbon:rib.length,sparks:parts.length,pops:pops.length,rockets:rockets.length}})};
};
