/* Halloween 2026: camera effects (Instagram-like "✨" picker). Pure visuals, nothing saved except the chosen effect. */
window.createCamEffects = function(D) {
  'use strict';
  const {THREE,scene,camera,state,player,getSave,getMagic,indoor,toast,shoot}=D;
  const KEY='usapon-camfx-v1',TIP='usapon-camfx-tip-v1';
  // order = order in the row. wand: only shown after the wand is found. out: outdoor only.
  const FX=[
    {id:'none',name:'なし',icon:'<circle cx="12" cy="12" r="8"/><path d="m6.5 17.5 11-11"/>'},
    {id:'kira',name:'キラキラ',icon:'<path d="m12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z"/><path d="M19 3v3M17.5 4.5h3"/>'},
    {id:'leaf',name:'おちば',out:true,icon:'<path d="M5 19C5 10 10 5 19 5c0 9-5 14-14 14z"/><path d="M5 19 13 11"/>'},
    {id:'fire',name:'はなび',wand:true,out:true,icon:'<path d="M12 8V3m0 18v-5M8 12H3m18 0h-5M8.5 8.5 5 5m14 14-3.5-3.5M8.5 15.5 5 19M19 5l-3.5 3.5"/><circle cx="12" cy="12" r="1.6"/>'}
  ];
  let sel='none';try{sel=localStorage.getItem(KEY)||'none'}catch(e){}
  const has=id=>FX.some(f=>f.id===id&&(!f.wand||getSave().wand));
  if(!has(sel))sel='none';
  const $=id=>document.getElementById(id);
  const css=document.createElement('style');css.textContent=`
  #camFx{top:max(14px,env(safe-area-inset-top,0px));right:calc(66px + env(safe-area-inset-right,0px));width:40px;height:40px}
  #camFx svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
  #camFx.on{background:rgba(255,226,168,.42);border-color:#ffe2a8}
  #fxRow{position:absolute;left:0;right:0;bottom:calc(max(30px,calc(env(safe-area-inset-bottom,0px) + 24px)) + 92px);height:96px;display:none;pointer-events:auto}
  body.camfx-open #fxRow{display:block}
  body.camfx-open #joy{visibility:hidden}
  #fxName{position:absolute;left:50%;top:0;transform:translateX(-50%);padding:3px 12px;border-radius:12px;background:rgba(0,0,0,.34);color:#fff;font:800 13px/1.4 "Zen Maru Gothic",sans-serif;white-space:nowrap;pointer-events:none}
  #fxList{position:absolute;left:0;right:0;bottom:0;height:68px;display:flex;align-items:center;gap:14px;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scrollbar-width:none;padding:0 calc(50% - 27px);box-sizing:border-box;-webkit-overflow-scrolling:touch;touch-action:pan-x}
  #fxList::-webkit-scrollbar{display:none}
  .fxi{flex:0 0 54px;width:54px;height:54px;border-radius:50%;scroll-snap-align:center;display:grid;place-items:center;padding:0;margin:0;border:1.5px solid rgba(255,255,255,.6);background:rgba(0,0,0,.22);color:#fff;transition:transform .15s,background .15s;-webkit-tap-highlight-color:transparent}
  .fxi svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
  .fxi.sel{transform:scale(1.14);background:rgba(255,226,168,.42);border:3px solid #fff}
  .fxi.off{opacity:.4}
  #fxRing{position:absolute;left:50%;bottom:3px;width:68px;height:68px;margin-left:-34px;border-radius:50%;box-shadow:0 0 0 2px rgba(255,255,255,.35);pointer-events:none}
  #camShut.fxwait{animation:fxwait .5s ease-in-out infinite alternate}
  @keyframes fxwait{from{box-shadow:0 0 0 2px rgba(255,226,168,.5)}to{box-shadow:0 0 0 9px rgba(255,226,168,.15)}}
  @media (orientation:landscape) and (max-height:540px){
    #camFx{top:max(10px,env(safe-area-inset-top,0px));right:calc(62px + env(safe-area-inset-right,0px));width:38px;height:38px}
    #fxRow{bottom:max(8px,env(safe-area-inset-bottom,0px));height:88px}
  }`;document.head.appendChild(css);
  const ui=$('camUI');
  const btn=document.createElement('button');btn.type='button';btn.className='cbtn';btn.id='camFx';btn.setAttribute('aria-label','エフェクトをえらぶ');
  btn.innerHTML='<svg viewBox="0 0 24 24"><path d="m10 4 1.8 5.2L17 11l-5.2 1.8L10 18l-1.8-5.2L3 11l5.2-1.8z"/><path d="M18 3v4M16 5h4M18 15v3M16.5 16.5h3"/></svg>';
  ui.insertBefore(btn,$('camTour'));
  const row=document.createElement('div');row.id='fxRow';row.innerHTML='<div id="fxName"></div><div id="fxRing"></div><div id="fxList" role="listbox" aria-label="エフェクト"></div>';
  ui.insertBefore(row,$('camTour'));
  const list=$('fxList');
  function okHere(f){return !(f.out&&indoor())}
  function build(){
    list.innerHTML='';
    for(const f of FX){if(f.wand&&!getSave().wand)continue;
      const b=document.createElement('button');b.type='button';b.className='fxi';b.dataset.id=f.id;b.setAttribute('role','option');b.setAttribute('aria-label',f.name);
      b.innerHTML='<svg viewBox="0 0 24 24">'+f.icon+'</svg>';b.addEventListener('click',()=>{center(f.id,true)});list.appendChild(b)}
    mark();
  }
  function cur(){return FX.find(f=>f.id===sel)}
  function mark(){
    for(const b of list.children){const f=FX.find(q=>q.id===b.dataset.id);b.classList.toggle('sel',f.id===sel);b.classList.toggle('off',!okHere(f));b.setAttribute('aria-selected',String(f.id===sel))}
    const f=cur();$('fxName').textContent=okHere(f)?f.name:f.name+'（おそとで つかえるよ）';
    btn.classList.toggle('on',sel!=='none');
  }
  function choose(id){if(id===sel)return;sel=id;try{localStorage.setItem(KEY,id)}catch(e){}mark();restart()}
  function center(id,smooth){const b=[...list.children].find(e=>e.dataset.id===id);if(!b)return;lock=Date.now()+(smooth?700:150); // our own scroll: do not re-pick on the way
    list.scrollTo({left:b.offsetLeft-(list.clientWidth-b.offsetWidth)/2,behavior:smooth?'smooth':'auto'});choose(id)}
  let scrollT=0,lock=0;
  list.addEventListener('scroll',()=>{clearTimeout(scrollT);if(Date.now()<lock)return;scrollT=setTimeout(()=>{
    const mid=list.scrollLeft+list.clientWidth/2;let best=null,bd=1e9;
    for(const b of list.children){const d=Math.abs(b.offsetLeft+b.offsetWidth/2-mid);if(d<bd){bd=d;best=b}}
    if(best)choose(best.dataset.id)},90)},{passive:true});
  function open(on){document.body.classList.toggle('camfx-open',on);if(on){build();center(sel,false)}}
  btn.addEventListener('click',()=>{if(state.mode==='play'&&state.camMode)open(!document.body.classList.contains('camfx-open'))});

  /* ---- particles: one small pool, world-anchored, spawned around what the camera sees ---- */
  const tex=(draw)=>{const c=document.createElement('canvas');c.width=c.height=64;draw(c.getContext('2d'));const t=new THREE.CanvasTexture(c);return t};
  const starTex=tex(g=>{const k=g.createRadialGradient(32,32,0,32,32,30);k.addColorStop(0,'rgba(255,255,255,1)');k.addColorStop(.3,'rgba(255,255,255,.7)');k.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=k;g.beginPath();for(let i=0;i<8;i++){const a=i/8*Math.PI*2-Math.PI/2,r=i%2?6:31;g.lineTo(32+Math.cos(a)*r,32+Math.sin(a)*r)}g.closePath();g.fill();g.globalCompositeOperation='lighter';const h=g.createRadialGradient(32,32,0,32,32,12);h.addColorStop(0,'rgba(255,255,255,.9)');h.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=h;g.fillRect(0,0,64,64)});
  const leafTex=tex(g=>{g.translate(32,32);g.rotate(.5);g.fillStyle='#fff';g.beginPath();g.moveTo(0,-29);g.bezierCurveTo(19,-20,19,10,0,24);g.bezierCurveTo(-19,10,-19,-20,0,-29);g.fill(); // a plain pointed autumn leaf
  g.strokeStyle='rgba(120,40,10,.35)';g.lineWidth=2.2;g.beginPath();g.moveTo(0,30);g.lineTo(0,-22);for(const y of [-12,-2,8]){g.moveTo(0,y+6);g.lineTo(9,y);g.moveTo(0,y+6);g.lineTo(-9,y)}g.stroke()});
  function pool(map,N,leaf){
    const pos=new Float32Array(N*3),col=new Float32Array(N*3),al=new Float32Array(N),sz=new Float32Array(N),rot=new Float32Array(N);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('tint',new THREE.BufferAttribute(col,3));g.setAttribute('alpha',new THREE.BufferAttribute(al,1));g.setAttribute('size',new THREE.BufferAttribute(sz,1));g.setAttribute('rot',new THREE.BufferAttribute(rot,1));
    const m=new THREE.ShaderMaterial({uniforms:{map:{value:map},scale:{value:400}},transparent:true,depthWrite:false,blending:leaf?THREE.NormalBlending:THREE.AdditiveBlending,
      vertexShader:'attribute vec3 tint;attribute float alpha;attribute float size;attribute float rot;uniform float scale;varying vec3 vC;varying float vA;varying float vR;void main(){vC=tint;vA=alpha;vR=rot;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=min(90.0,size*scale/max(.1,-mv.z));gl_Position=projectionMatrix*mv;}',
      fragmentShader:'uniform sampler2D map;varying vec3 vC;varying float vA;varying float vR;void main(){vec2 p=gl_PointCoord-.5;float c=cos(vR),s=sin(vR);p=vec2(c*p.x-s*p.y,s*p.x+c*p.y)+.5;vec4 t=texture2D(map,p);'+(leaf?'if(t.a<.05)discard;gl_FragColor=vec4(vC*t.rgb,t.a*vA);':'gl_FragColor=vec4(vC*t.a*vA,1.0);')+'}'});
    g.setDrawRange(0,0);const P=new THREE.Points(g,m);P.frustumCulled=false;P.renderOrder=23;P.userData.magicFx=true;
    // point size follows whatever is being rendered (screen or the bigger photo canvas)
    const _s=new THREE.Vector2();P.onBeforeRender=(r,s,c)=>{r.getDrawingBufferSize(_s);m.uniforms.scale.value=_s.y*c.projectionMatrix.elements[5]/2};
    scene.add(P);return {P,g,pos,col,al,sz,rot,N,list:[]};
  }
  const stars=pool(starTex,240,false),leaves=pool(leafTex,70,true);
  const C=(h)=>new THREE.Color(h);
  const KIRA=[C(0xfff2c4),C(0xffd77a),C(0xffb8d8),C(0xc8b8ff),C(0xbff2e0)],LEAF=[C(0xf08a2c),C(0xe0582c),C(0xf2b13a),C(0xc9452e),C(0xe8a04a)];
  function add(p,o){if(p.list.length>=p.N)p.list.shift();p.list.push(Object.assign({x:0,y:0,z:0,vx:0,vy:0,vz:0,age:0,life:1,size:.1,tw:0,ph:Math.random()*6.28,r:0,vr:0,sway:0,col:KIRA[0]},o))}
  const _v=new THREE.Vector3(),_o=new THREE.Vector3();
  // a world point that the camera sees at screen position (nx,ny) [-1..1], d metres away
  function at(nx,ny,d,out){out=out||new THREE.Vector3();_v.set(nx,ny,.5).unproject(camera).sub(camera.position).normalize();return out.copy(camera.position).addScaledVector(_v,d)}
  function subjectDist(){return state.selfie?camera.position.distanceTo(player.pos):0}
  function kiraSpawn(n,burst){for(let i=0;i<n;i++){const d=(state.selfie?Math.max(2.5,subjectDist()*.6):2.6)+Math.random()*(burst?4:6);at(Math.random()*2.2-1.1,Math.random()*2-.85,d,_o);
    add(stars,{x:_o.x,y:_o.y,z:_o.z,vx:(Math.random()-.5)*.12,vy:-.12-Math.random()*.18,vz:(Math.random()-.5)*.12,life:1.4+Math.random()*1.4,size:.05+Math.random()*.07+(burst?.03:0),tw:6+Math.random()*6,col:KIRA[Math.floor(Math.random()*KIRA.length)]})}}
  function leafSpawn(n,top){for(let i=0;i<n;i++){const d=2.2+Math.random()*6;at(Math.random()*2.4-1.2,top?1.15:Math.random()*2-1,d,_o);
    add(leaves,{x:_o.x,y:_o.y,z:_o.z,vx:(Math.random()-.5)*.3,vy:-.45-Math.random()*.35,vz:(Math.random()-.5)*.3,life:4+Math.random()*2,size:.16+Math.random()*.1,r:Math.random()*6.28,vr:(Math.random()-.5)*3,sway:.6+Math.random()*.8,col:LEAF[Math.floor(Math.random()*LEAF.length)]})}}
  // fireworks come from the wand's own effect (magic.js); none if it is not there
  let side=1;
  function fireOne(){
    const M=getMagic(),fx=M&&M.fx;if(!fx||!fx.firework)return false;
    side=-side;const sd=subjectDist(),d=state.selfie?Math.max(9,sd+6):10;
    // upper third of the picture; in a selfie, beside Piyo's head rather than behind it
    const to=at((state.selfie?.42:.36)*side,.6,d),from=to.clone();from.y-=4.6;fx.firework(from,to);return true;
  }
  let run=0,fireT=0,emitT=0,wait=0,shooting=false;
  function restart(){fireT=.35;emitT=0;run=0;
    if(sel==='kira'&&okHere(cur()))kiraSpawn(26,false);
    if(sel==='leaf'&&okHere(cur()))leafSpawn(10,false)}
  function live(){return state.camMode&&state.mode==='play'}
  function step(p,dt,leaf){
    let j=0;for(let i=p.list.length-1;i>=0;i--){const q=p.list[i];q.age+=dt;if(q.age>=q.life){p.list.splice(i,1);continue}}
    for(const q of p.list){
      if(leaf){q.x+=(q.vx+Math.sin(q.age*2+q.ph)*q.sway)*dt;q.z+=(q.vz+Math.cos(q.age*1.7+q.ph)*q.sway*.5)*dt;q.r+=q.vr*dt}else{q.x+=q.vx*dt;q.z+=q.vz*dt}
      q.y+=q.vy*dt;
      const k=q.age/q.life,fade=Math.min(1,q.age*4)*Math.min(1,(1-k)*3),tw=q.tw?(.55+.45*Math.sin(q.age*q.tw+q.ph)):1;
      p.pos[j*3]=q.x;p.pos[j*3+1]=q.y;p.pos[j*3+2]=q.z;p.col[j*3]=q.col.r;p.col[j*3+1]=q.col.g;p.col[j*3+2]=q.col.b;p.al[j]=fade*tw;p.sz[j]=q.size;p.rot[j]=q.r;j++}
    p.g.setDrawRange(0,j);p.P.visible=j>0;
    if(j){for(const a of ['position','tint','alpha','size','rot'])p.g.attributes[a].needsUpdate=true}
  }
  function tick(dt){
    const on=live()&&okHere(cur());
    if(!state.camMode&&document.body.classList.contains('camfx-open'))open(false);
    if(on){run+=dt;
      if(sel==='kira'){emitT+=dt;while(emitT>.06){emitT-=.06;kiraSpawn(1,false)}}
      if(sel==='leaf'){emitT+=dt;while(emitT>.22){emitT-=.22;leafSpawn(1,true)}}
      if(sel==='fire'&&!wait){fireT-=dt;if(fireT<=0){fireT=2.6;fireOne()}}
    }
    if(wait>0){wait-=dt;if(wait<=0){wait=0;$('camShut').classList.remove('fxwait');if(state.camMode&&state.mode==='play'){shooting=true;try{shoot()}finally{shooting=false}}}}
    step(stars,dt,false);step(leaves,dt,true);
  }
  // Called first by takeFreePhoto. true = "not yet": the effect is set up and the picture is taken at its best moment.
  function beforePhoto(){
    if(shooting)return false;if(wait>0)return true;
    const f=cur();if(sel==='none'||!okHere(f))return false;
    if(sel==='kira'){kiraSpawn(state.selfie?48:34,true);wait=.25}
    else if(sel==='leaf'){leafSpawn(8,false);wait=.12}
    else if(sel==='fire'){if(!fireOne())return false;fireT=2.6;wait=1.2} // rocket .6 s + star mostly open
    $('camShut').classList.add('fxwait');return true;
  }
  let tipShown=false;try{tipShown=!!localStorage.getItem(TIP)}catch(e){}
  function camOn(on){
    open(false);wait=0;$('camShut').classList.remove('fxwait');
    if(on){if(!has(sel))sel='none';mark();restart();
      if(!tipShown){tipShown=true;try{localStorage.setItem(TIP,'1')}catch(e){}setTimeout(()=>{if(state.camMode&&!document.body.classList.contains('camfx-open'))toast('右上の ✨ で エフェクトが えらべるよ',2600)},2700)}}
  }
  build();
  return {tick,beforePhoto,camOn,open,select:id=>{if(has(id)){center(id,false);choose(id)}},inspect:()=>({sel,wait,stars:stars.list.length,leaves:leaves.list.length,open:document.body.classList.contains('camfx-open'),items:[...list.children].map(b=>b.dataset.id)})};
};
