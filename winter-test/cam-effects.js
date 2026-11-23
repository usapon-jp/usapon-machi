// Camera effects (the "✨" picker in camera mode), ported from the Halloween 2026 game (2026/cam-effects.js).
// Winter set: なし / キラキラ / ゆき (big soft flakes in front of the lens). Pure visuals; only the choice is remembered.
import * as T from 'three';
const $ = id => document.getElementById(id);
const KEY='usapon-winter-camfx-v1', TIP='usapon-winter-camfx-tip-v1';
const FX=[
  {id:'none',name:'なし',icon:'<circle cx="12" cy="12" r="8"/><path d="m6.5 17.5 11-11"/>'},
  {id:'kira',name:'キラキラ',icon:'<path d="m12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z"/><path d="M19 3v3M17.5 4.5h3"/>'},
  {id:'yuki',name:'ゆき',icon:'<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="m9.5 4.5 2.5 2 2.5-2M9.5 19.5l2.5-2 2.5 2"/>'}
];

export function createCamEffects({scene,camera,rig,player,toast,shoot,live}) {
  let sel='none';try{sel=localStorage.getItem(KEY)||'none';}catch(e){}
  if(!FX.some(f=>f.id===sel))sel='none';
  const css=document.createElement('style');css.textContent=`
  #camFx{top:max(14px,env(safe-area-inset-top));right:calc(66px + env(safe-area-inset-right));width:40px;height:40px}
  #camFx svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
  #camFx.on{background:rgba(255,226,168,.42);border-color:#ffe2a8}
  #fxRow{position:absolute;left:0;right:0;bottom:calc(max(30px,calc(env(safe-area-inset-bottom) + 24px)) + 92px);height:96px;display:none;pointer-events:auto}
  body.camfx-open #fxRow{display:block}
  body.camfx-open #joystick{visibility:hidden}
  #fxName{position:absolute;left:50%;top:0;transform:translateX(-50%);padding:3px 12px;border-radius:12px;background:rgba(0,0,0,.34);color:#fff;font-weight:800;font-size:13px;line-height:1.4;white-space:nowrap;pointer-events:none}
  #fxList{position:absolute;left:0;right:0;bottom:0;height:68px;display:flex;align-items:center;gap:14px;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scrollbar-width:none;padding:0 calc(50% - 27px);box-sizing:border-box}
  #fxList::-webkit-scrollbar{display:none}
  .fxi{flex:0 0 54px;width:54px;height:54px;min-width:0;min-height:0;border-radius:50%;scroll-snap-align:center;display:grid;place-items:center;padding:0;margin:0;border:1.5px solid rgba(255,255,255,.6);background:rgba(0,0,0,.22);color:#fff;transition:transform .15s,background .15s}
  .fxi svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
  .fxi.sel{transform:scale(1.14);background:rgba(255,226,168,.42);border:3px solid #fff}
  #fxRing{position:absolute;left:50%;bottom:3px;width:68px;height:68px;margin-left:-34px;border-radius:50%;box-shadow:0 0 0 2px rgba(255,255,255,.35);pointer-events:none}
  #camShut.fxwait{animation:fxwait .5s ease-in-out infinite alternate}
  @keyframes fxwait{from{box-shadow:0 0 0 2px rgba(255,226,168,.5)}to{box-shadow:0 0 0 9px rgba(255,226,168,.15)}}
  @media (orientation:landscape) and (max-height:540px){
    #camFx{top:max(10px,env(safe-area-inset-top));right:calc(62px + env(safe-area-inset-right));width:38px;height:38px}
    #fxRow{bottom:max(8px,env(safe-area-inset-bottom));height:88px}
  }`;document.head.appendChild(css);
  const ui=$('camUI');
  const btn=document.createElement('button');btn.type='button';btn.className='cbtn';btn.id='camFx';btn.setAttribute('aria-label','エフェクトをえらぶ');
  btn.innerHTML='<svg viewBox="0 0 24 24"><path d="m10 4 1.8 5.2L17 11l-5.2 1.8L10 18l-1.8-5.2L3 11l5.2-1.8z"/><path d="M18 3v4M16 5h4M18 15v3M16.5 16.5h3"/></svg>';
  ui.insertBefore(btn,$('camTour'));
  const row=document.createElement('div');row.id='fxRow';
  row.innerHTML='<div id="fxName"></div><div id="fxRing"></div><div id="fxList" role="listbox" aria-label="エフェクト"></div>';
  ui.insertBefore(row,$('camTour'));
  const list=$('fxList');
  for(const f of FX){
    const b=document.createElement('button');b.type='button';b.className='fxi';b.dataset.id=f.id;b.setAttribute('role','option');b.setAttribute('aria-label',f.name);
    b.innerHTML='<svg viewBox="0 0 24 24">'+f.icon+'</svg>';b.addEventListener('click',()=>center(f.id,true));list.appendChild(b);
  }
  const cur=()=>FX.find(f=>f.id===sel);
  function mark(){
    for(const b of list.children){b.classList.toggle('sel',b.dataset.id===sel);b.setAttribute('aria-selected',String(b.dataset.id===sel));}
    $('fxName').textContent=cur().name;btn.classList.toggle('on',sel!=='none');
  }
  function choose(id){if(id===sel)return;sel=id;try{localStorage.setItem(KEY,id);}catch(e){}mark();restart();}
  let scrollT=0,lock=0;
  function center(id,smooth){
    const b=[...list.children].find(e=>e.dataset.id===id);if(!b)return;lock=Date.now()+(smooth?700:150);
    list.scrollTo({left:b.offsetLeft-(list.clientWidth-b.offsetWidth)/2,behavior:smooth?'smooth':'auto'});choose(id);
  }
  list.addEventListener('scroll',()=>{clearTimeout(scrollT);if(Date.now()<lock)return;scrollT=setTimeout(()=>{
    const mid=list.scrollLeft+list.clientWidth/2;let best=null,bd=1e9;
    for(const b of list.children){const d=Math.abs(b.offsetLeft+b.offsetWidth/2-mid);if(d<bd){bd=d;best=b;}}
    if(best)choose(best.dataset.id);},90);},{passive:true});
  function open(on){document.body.classList.toggle('camfx-open',on);if(on){mark();center(sel,false);}}
  btn.addEventListener('click',()=>{if(rig.camMode)open(!document.body.classList.contains('camfx-open'));});

  // ---- particles: one small pool per look, placed in the world around what the camera sees ----
  const tex=draw=>{const c=document.createElement('canvas');c.width=c.height=64;draw(c.getContext('2d'));return new T.CanvasTexture(c);};
  const starTex=tex(g=>{const k=g.createRadialGradient(32,32,0,32,32,30);k.addColorStop(0,'rgba(255,255,255,1)');k.addColorStop(.3,'rgba(255,255,255,.7)');k.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=k;g.beginPath();for(let i=0;i<8;i++){const a=i/8*Math.PI*2-Math.PI/2,r=i%2?6:31;g.lineTo(32+Math.cos(a)*r,32+Math.sin(a)*r);}g.closePath();g.fill();
    g.globalCompositeOperation='lighter';const h=g.createRadialGradient(32,32,0,32,32,12);h.addColorStop(0,'rgba(255,255,255,.9)');h.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=h;g.fillRect(0,0,64,64);});
  const flakeTex=tex(g=>{const k=g.createRadialGradient(32,32,0,32,32,30);k.addColorStop(0,'rgba(255,255,255,1)');k.addColorStop(.45,'rgba(255,255,255,.85)');k.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=k;g.fillRect(0,0,64,64);});
  // raw sRGB values (the shader writes them straight to the screen, like the Halloween version)
  const C=h=>new T.Color().setHex(h,T.LinearSRGBColorSpace);
  const KIRA=[C(0xfff2c4),C(0xffd77a),C(0xffb8d8),C(0xc8b8ff),C(0xbff2e0)],SNOW=[C(0xffffff),C(0xf4f6ff),C(0xfff6ee)];
  function pool(map,N,soft){
    const pos=new Float32Array(N*3),col=new Float32Array(N*3),al=new Float32Array(N),sz=new Float32Array(N),rot=new Float32Array(N);
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.BufferAttribute(pos,3));g.setAttribute('tint',new T.BufferAttribute(col,3));g.setAttribute('alpha',new T.BufferAttribute(al,1));
    g.setAttribute('size',new T.BufferAttribute(sz,1));g.setAttribute('rot',new T.BufferAttribute(rot,1));
    const m=new T.ShaderMaterial({uniforms:{map:{value:map},scale:{value:400}},transparent:true,depthWrite:false,blending:soft?T.NormalBlending:T.AdditiveBlending,
      vertexShader:'attribute vec3 tint;attribute float alpha;attribute float size;attribute float rot;uniform float scale;varying vec3 vC;varying float vA;varying float vR;void main(){vC=tint;vA=alpha;vR=rot;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=min(90.0,size*scale/max(.1,-mv.z));gl_Position=projectionMatrix*mv;}',
      fragmentShader:'uniform sampler2D map;varying vec3 vC;varying float vA;varying float vR;void main(){vec2 p=gl_PointCoord-.5;float c=cos(vR),s=sin(vR);p=vec2(c*p.x-s*p.y,s*p.x+c*p.y)+.5;vec4 t=texture2D(map,p);'+
        (soft?'if(t.a<.03)discard;gl_FragColor=vec4(vC,t.a*vA);':'gl_FragColor=vec4(vC*t.a*vA,1.0);')+'}'});
    g.setDrawRange(0,0);const P=new T.Points(g,m);P.frustumCulled=false;P.renderOrder=23;
    const s2=new T.Vector2();P.onBeforeRender=(r,s,c)=>{r.getDrawingBufferSize(s2);m.uniforms.scale.value=s2.y*c.projectionMatrix.elements[5]/2;}; // also right for the bigger photo canvas
    scene.add(P);return {P,g,pos,col,al,sz,rot,N,list:[]};
  }
  const stars=pool(starTex,240,false),flakes=pool(flakeTex,120,true);
  function add(p,o){if(p.list.length>=p.N)p.list.shift();p.list.push(Object.assign({x:0,y:0,z:0,vx:0,vy:0,vz:0,age:0,life:1,size:.1,tw:0,ph:Math.random()*6.28,r:0,vr:0,sway:0,col:KIRA[0]},o));}
  const v=new T.Vector3(),o=new T.Vector3();
  function at(nx,ny,d,out){v.set(nx,ny,.5).unproject(camera).sub(camera.position).normalize();return out.copy(camera.position).addScaledVector(v,d);}
  const subject=()=>rig.selfie?camera.position.distanceTo(player.position):0;
  // winter scale: Piyo is smaller here than in the Halloween town, so everything sits a little closer
  function kiraSpawn(n,burst){for(let i=0;i<n;i++){const d=(rig.selfie?Math.max(1.6,subject()*.6):1.7)+Math.random()*(burst?2.6:4);at(Math.random()*2.2-1.1,Math.random()*2-.85,d,o);
    add(stars,{x:o.x,y:o.y,z:o.z,vx:(Math.random()-.5)*.08,vy:-.08-Math.random()*.12,vz:(Math.random()-.5)*.08,life:1.4+Math.random()*1.4,size:.035+Math.random()*.045+(burst?.02:0),tw:6+Math.random()*6,col:KIRA[Math.random()*KIRA.length|0]});}}
  function snowSpawn(n,top){for(let i=0;i<n;i++){const d=1.6+Math.random()*4.5;at(Math.random()*2.4-1.2,top?1.15:Math.random()*2-1,d,o);
    add(flakes,{x:o.x,y:o.y,z:o.z,vx:(Math.random()-.5)*.12,vy:-.28-Math.random()*.22,vz:(Math.random()-.5)*.12,life:4+Math.random()*2.5,size:.07+Math.random()*.08,sway:.18+Math.random()*.25,col:SNOW[Math.random()*SNOW.length|0]});}}
  let emitT=0,wait=0,shooting=false;
  function restart(){emitT=0;if(sel==='kira')kiraSpawn(26,false);if(sel==='yuki')snowSpawn(46,false);}
  function step(p,dt,soft){
    for(let i=p.list.length-1;i>=0;i--){const q=p.list[i];q.age+=dt;if(q.age>=q.life)p.list.splice(i,1);}
    let j=0;
    for(const q of p.list){
      if(soft){q.x+=(q.vx+Math.sin(q.age*1.6+q.ph)*q.sway)*dt;q.z+=(q.vz+Math.cos(q.age*1.3+q.ph)*q.sway*.5)*dt;}else{q.x+=q.vx*dt;q.z+=q.vz*dt;}
      q.y+=q.vy*dt;
      const k=q.age/q.life,fade=Math.min(1,q.age*4)*Math.min(1,(1-k)*3),tw=q.tw?(.55+.45*Math.sin(q.age*q.tw+q.ph)):.9;
      p.pos[j*3]=q.x;p.pos[j*3+1]=q.y;p.pos[j*3+2]=q.z;p.col[j*3]=q.col.r;p.col[j*3+1]=q.col.g;p.col[j*3+2]=q.col.b;p.al[j]=fade*tw;p.sz[j]=q.size;p.rot[j]=q.r;j++;
    }
    p.g.setDrawRange(0,j);p.P.visible=j>0;
    if(j)for(const a of ['position','tint','alpha','size','rot'])p.g.attributes[a].needsUpdate=true;
  }
  function tick(dt){
    if(!rig.camMode&&document.body.classList.contains('camfx-open'))open(false);
    if(rig.camMode&&live()){
      if(sel==='kira'){emitT+=dt;while(emitT>.06){emitT-=.06;kiraSpawn(1,false);}}
      if(sel==='yuki'){emitT+=dt;while(emitT>.07){emitT-=.07;snowSpawn(1,true);}}
    }
    if(wait>0){wait-=dt;if(wait<=0){wait=0;$('camShut').classList.remove('fxwait');if(rig.camMode&&live()){shooting=true;try{shoot();}finally{shooting=false;}}}}
    step(stars,dt,false);step(flakes,dt,true);
  }
  // true = "not yet": the effect gets a burst and the picture is taken a moment later
  function beforePhoto(){
    if(shooting)return false;if(wait>0)return true;
    if(sel==='none')return false;
    if(sel==='kira'){kiraSpawn(rig.selfie?48:34,true);wait=.25;}
    else if(sel==='yuki'){snowSpawn(14,false);wait=.12;}
    $('camShut').classList.add('fxwait');return true;
  }
  let tipShown=false;try{tipShown=!!localStorage.getItem(TIP);}catch(e){}
  function camOn(on){
    open(false);wait=0;$('camShut').classList.remove('fxwait');
    if(on){mark();restart();
      if(!tipShown){tipShown=true;try{localStorage.setItem(TIP,'1');}catch(e){}
        setTimeout(()=>{if(rig.camMode&&!document.body.classList.contains('camfx-open'))toast('右上の ✨ で エフェクトが えらべるよ',2600);},2700);}}
  }
  mark();
  return {tick,beforePhoto,camOn,open,select:id=>{if(FX.some(f=>f.id===id)){center(id,false);choose(id);}},
    inspect:()=>({sel,wait,stars:stars.list.length,flakes:flakes.list.length,open:document.body.classList.contains('camfx-open')})};
}
