import * as T from 'three';
import { buildPlayer, buildTown } from './town.js';
import { createHud } from './hud.js';
import { createCameraRig } from './camera-rig.js';
import { createAlbum } from './album.js';
import { createPhoto } from './photo.js';
import { createCamEffects } from './cam-effects.js';
import {
  bounds, bridge, canWalk, castle, clamp, court, groundHeight, houses, inHouse, northFir,
  paths, riverZ, spawn, squares, tree, upperTerrace, viewpoints, walkHeight
} from './layout.js';

const $ = selector => document.querySelector(selector);
const canvas=$('#view'), status=$('#status'), place=$('#place'), help=$('#help');
const coarse=matchMedia('(pointer: coarse)').matches;

async function play() {
  const renderer=new T.WebGLRenderer({canvas,antialias:!coarse,powerPreference:'high-performance'});
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.04;
  const scene=new T.Scene();
  const camera=new T.PerspectiveCamera(64,1,.12,190);
  const map=makeMap();
  const hud=createHud({coarse});
  let snowing=true;
  const viewButton=$('#viewpoint');
  let nearView=null;
  let resCap=coarse?1.3:1.75,mapTimer=0;
  const [town,{player,body}]=await Promise.all([buildTown(scene,coarse),buildPlayer(scene)]);
  player.position.set(spawn.x,walkHeight(spawn.x,spawn.z),spawn.z);
  player.rotation.y=Math.PI-.18;
  const angleWrap=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));
  const horizontal=new T.Vector2(), velocity=new T.Vector2();
  const animations=[];
  body.traverse(o=>{ if(o.isBone && /LeftUpLeg|RightUpLeg/i.test(o.name)) animations.push([o,o.rotation.x]); });
  let arm=null;
  body.traverse(o=>{ if(o.isBone && /RightArm/i.test(o.name)) arm={bone:o,base:o.rotation.clone()}; });
  let bob=0,jumpY=0,jumpV=0,wave=0;
  const WAVE={axis:'z',amt:-1.25}; // RightArm: z- lifts it outwards (checked by eye)

  // camera: the town's own blockers (ground and banks, the big tree, houses, the north wall)
  const isBlocked=(x,y,z)=>y<groundHeight(x,z)+.55||
    (Math.hypot(x-tree.x,z-tree.z)<tree.radius+.28&&y<groundHeight(tree.x,tree.z)+tree.planterHeight+tree.height-tree.sink)||
    houses.some(a=>inHouse(x,z,a,.16)&&y<groundHeight(a.x,a.z)+a.h+1.8)||
    (z>-42.1&&z<-40.1&& (Math.abs(x)>1.85 || y>8.0))||
    firBlocks(x,y,z);
  // the big fir by the north gate (a cone of branches over a short trunk): keeps the selfie camera out of it
  function firBlocks(x,y,z){
    const h=y-groundHeight(northFir.x,northFir.z),d=Math.hypot(x-northFir.x,z-northFir.z);
    return h<6&&d<(h<1?.5:2.7*(1-(h-1)/5.2))+.3;
  }
  const rig=createCameraRig({camera,canvas,player,body,isBlocked,groundHeight,walkHeight,blocked:hud.anyModal});

  function size(){
    const w=canvas.clientWidth,h=canvas.clientHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,resCap));
    renderer.setSize(w,h,false);
    camera.aspect=w/h;
    camera.fov=rig.wantedFov(w/h);
    camera.updateProjectionMatrix();
  }
  function leaveView(){
    if(!rig.eyeView)return;
    rig.leaveView();
    viewButton.textContent='景色を見る';
    viewButton.removeAttribute('aria-pressed');
    size();
  }
  viewButton.addEventListener('click',()=>{
    if(rig.eyeView){leaveView();return;}
    if(!nearView)return;
    rig.enterView(nearView);
    velocity.set(0,0);
    viewButton.textContent='散策に戻る';
    viewButton.setAttribute('aria-pressed','true');
    size();
  });
  addEventListener('resize',size);
  size();

  const album=createAlbum(hud);
  const photo=createPhoto({renderer,scene,camera,rig,hud,album,coarse,resize:size,beforeLeave:leaveView});
  const fx=createCamEffects({scene,camera,rig,player,toast:hud.toast,shoot:photo.shoot,live:()=>!hud.anyModal()});
  photo.setFx(fx);

  const mapButton=$('#map-button');
  mapButton.addEventListener('click',()=>{
    const panel=$('#map-panel');panel.hidden=!panel.hidden;
    mapButton.setAttribute('aria-expanded',String(!panel.hidden));
    map(player.position,player.rotation.y);
  });
  $('#winter').addEventListener('click',e=>{
    snowing=!snowing;
    e.currentTarget.setAttribute('aria-pressed',String(snowing));
    town.winter.visible=town.snow.field.visible=snowing;
    town.firSnow.value=snowing?1:0;
  });
  $('#home').addEventListener('click',()=>{
    leaveView();
    player.position.set(spawn.x,walkHeight(spawn.x,spawn.z),spawn.z);
    player.rotation.y=Math.PI-.18;
    rig.reset();velocity.set(0,0);jumpY=jumpV=0;
    rig.update(0,true);map(player.position,player.rotation.y);
  });

  function move(dt,t){
    const {x:across,y:forward,running}=hud.axes(dt);
    const frozen=hud.anyModal();
    horizontal.set(frozen?0:across,frozen?0:forward).clampLength(0,1);
    if(horizontal.lengthSq()>0)leaveView();
    const yaw=rig.moveYaw();
    const s=Math.sin(yaw),c=Math.cos(yaw),p=player.position,lastX=p.x,lastZ=p.z;
    // walk 5.05 m/s as before; dash = Halloween's dash/walk ratio (7.6 / 4.3)
    const stride=running?8.9:5.05, easing=1-Math.exp(-dt*(horizontal.lengthSq()>0?21:14));
    velocity.x+=(stride*(horizontal.x*c+horizontal.y*s)-velocity.x)*easing;
    velocity.y+=(stride*(horizontal.x*s-horizontal.y*c)-velocity.y)*easing;
    const x=p.x+velocity.x*dt, z=p.z+velocity.y*dt;
    if(canWalk(x,z)){p.x=x;p.z=z;}
    else {
      if(canWalk(x,p.z))p.x=x;
      if(canWalk(p.x,z))p.z=z;
    }
    const step=Math.hypot(p.x-lastX,p.z-lastZ);
    // jump: a small hop on top of the walking height (no new ground rules)
    if(hud.input.jump){hud.input.jump=false;if(jumpY===0&&!frozen&&!rig.eyeView){jumpV=5.4;jumpY=.0001;}}
    if(jumpY>0){jumpV-=19*dt;jumpY=Math.max(0,jumpY+jumpV*dt);if(jumpY===0)jumpV=0;}
    const ground=walkHeight(p.x,p.z);
    const baseY=(p.y-(player.userData.jumpY||0));
    const settled=baseY+(ground-baseY)*(1-Math.exp(-dt*23));
    p.y=settled+jumpY;player.userData.jumpY=jumpY;
    if(step>.0002) {
      const facing=Math.atan2(p.x-lastX,p.z-lastZ);
      player.rotation.y+=angleWrap(facing-player.rotation.y)*(1-Math.exp(-dt*15));
    }
    // selfie: while standing still Piyo turns to the camera and waves
    const still=step<dt*.4;
    if(rig.camMode&&rig.selfie&&still)player.rotation.y+=angleWrap(-rig.sAng-player.rotation.y)*(1-Math.exp(-dt*10));
    wave+=((rig.camMode&&rig.selfie&&still&&jumpY===0?1:0)-wave)*(1-Math.exp(-dt*8));
    if(arm){arm.bone.rotation.copy(arm.base);arm.bone.rotation[WAVE.axis]+=wave*(WAVE.amt+Math.sin(t*9)*.12);}
    bob += step*5.1;
    const motion=Math.min(1,step/(Math.max(dt,.001)*3.4));
    body.position.y=Math.sin(bob*2)*.035*motion+Math.sin(t*4.4)*.018;
    body.rotation.z=Math.sin(bob)*.065*motion;
    const air=jumpY>0?1:0;
    for(const [i,[bone,base]] of animations.entries())bone.rotation.x=base+Math.sin(bob+i*Math.PI)*.30*motion*(1-air)-air*.55;
  }

  rig.update(0,true);
  status.hidden=true;
  let start=performance.now(),previous=start,perfTime=0,perfN=0;
  function update(now){
    const elapsed=(now-previous)*.001,dt=Math.min(.045,elapsed),t=(now-start)*.001;
    previous=now;
    if(!document.hidden){
      move(dt,t);rig.update(dt);town.time.value=t;
      const wf=rig.wantedFov(camera.aspect);
      if(Math.abs(camera.fov-wf)>.05){camera.fov+=(wf-camera.fov)*Math.min(1,dt*8);camera.updateProjectionMatrix();}
      town.mill.rotation.z=t*town.wheelSpeed;
      if(snowing)town.snow.update(dt,t,player.position);
      fx.tick(dt);
      mapTimer+=dt;
      if(mapTimer>.12){
        mapTimer=0;
        const {x,z}=player.position;
        const onTerrace=Math.hypot((x-upperTerrace.x)/upperTerrace.rx,(z-upperTerrace.z)/upperTerrace.rz)<1;
        const current=z>-49?'北門':z>-54?'川辺の店並み':z>=bridge.a&&Math.abs(x-bridge.x)<2.35?'石のアーチ橋':
          z>-64?'小川のほとり':z>-76?'ツリー広場':onTerrace?'展望テラス':z>-92&&x>9.15?'商店街':
          z>court.z+5?'城へ続く小道':'城前の広場';
        nearView=rig.camMode?null:viewpoints.find(v=>Math.hypot(v.x-x,v.z-z)<=v.radius)??null;
        viewButton.hidden=!nearView&&!rig.eyeView;
        const caption=nearView?.name??current;
        if(place.textContent!==caption)place.textContent=caption;
        if(!$('#map-panel').hidden)map(player.position,player.rotation.y);
      }
      renderer.render(scene,camera);
      if(coarse&&resCap>1&&elapsed<.5) {
        perfN++;perfTime+=elapsed;
        if(perfTime>3){if(perfTime/perfN>1/34){resCap=1;size();}perfTime=perfN=0;}
      }
    }
    requestAnimationFrame(update);
  }
  if(new URLSearchParams(location.search).has('inspect')){
    // Read-only diagnostics for the isolated preview.
    window.townDiagnostics=()=>({
      player:player.position.toArray(), draws:renderer.info.render.calls, triangles:renderer.info.render.triangles,
      houses:houses.length, webgl:renderer.getContext().getParameter(renderer.getContext().VERSION),
      camera:camera.position.toArray().map(v=>+v.toFixed(2)),fov:+camera.fov.toFixed(1),
      rig:{yaw:rig.yaw,pitch:rig.pitch,dist:rig.dist,camMode:rig.camMode,selfie:rig.selfie,zoom:rig.zoom},fx:fx.inspect(),photo:photo.inspect()
    });
    window.townTest={WAVE,rig,photo,fx,hud,player,teleport:(x,z,yaw)=>{player.position.set(x,walkHeight(x,z),z);if(yaw!==undefined)rig.yaw=yaw;rig.update(0,true);}};
  }
  requestAnimationFrame(update);
}

function makeMap(){
  const canvas=$('#map'),g=canvas.getContext('2d'),base=document.createElement('canvas');
  base.width=canvas.width;base.height=canvas.height;
  const b=base.getContext('2d');
  const north=castle.z-7, span=bounds.south-north;
  const scale=Math.min((base.width-26)/(bounds.east-bounds.west),(base.height-32)/span);
  const left=(base.width-(bounds.east-bounds.west)*scale)/2;
  const out=(x,z)=>[left+(x-bounds.west)*scale,13+(z-north)*scale];
  b.fillStyle='#fbefdc';b.fillRect(0,0,base.width,base.height);
  const verge=out(0,court.z-7)[1];
  b.fillStyle='#e6e8d3';b.fillRect(0,verge,base.width,base.height-verge);
  function line(points,color,width) {
    b.strokeStyle=color;b.lineWidth=width;b.lineCap='round';b.lineJoin='round';
    b.beginPath();points.forEach(([x,z],i)=>i?b.lineTo(...out(x,z)):b.moveTo(...out(x,z)));b.stroke();
  }
  line(Array.from({length:bounds.east-bounds.west+1},(_,i)=>[bounds.west+i,riverZ(bounds.west+i)]),'#77a5b1',5.1*scale);
  for(const a of squares){
    b.beginPath();
    if(a.outline){
      a.outline.forEach(([x,z],i)=>i?b.lineTo(...out(x,z)):b.moveTo(...out(x,z)));
      b.closePath();
    }else b.ellipse(...out(a.x,a.z),a.rx*scale,a.rz*scale,0,0,Math.PI*2);
    b.fillStyle='#ddbe98';b.fill();
  }
  for(const {points,width} of paths)line(points,'#d5b58d',width*scale);
  line([[bridge.x,bridge.a],[bridge.x,bridge.b]],'#90776c',15);
  line([[bridge.x,bridge.a],[bridge.x,bridge.b]],'#f5d5ae',11);
  for(const a of houses) {
    b.save();b.translate(...out(a.x,a.z));b.rotate(-a.yaw);
    b.fillStyle=a.style==='letter'?'#5f8160':'#b57660';
    b.fillRect(-a.w*scale/2,-a.d*scale/2,a.w*scale,a.d*scale);
    b.restore();
  }
  const label=(txt,x,z)=>{
    b.font='700 15px sans-serif';b.fillStyle='#694d43';b.fillText(txt,...out(x,z));
  };
  label('お城',castle.x-3,castle.z);label('城門',court.x-11,court.z-1);
  label('展望テラス',upperTerrace.x+6,upperTerrace.z-2);
  label('商店街',24,-81);
  b.beginPath();b.arc(...out(tree.x,tree.z),tree.radius*scale,0,Math.PI*2);
  b.fillStyle='#507154';b.fill();
  label('ツリー広場',-7,-65.1);label('北門',-8,-40);
  label('N ↑',bounds.west+2,castle.z);
  for(const v of viewpoints){
    b.beginPath();
    b.arc(...out(v.x,v.z),4.5,0,2*Math.PI);
    b.fillStyle='#80566c';b.strokeStyle='#fff5db';b.lineWidth=1.7;b.fill();b.stroke();
  }
  return (p,facing)=>{
    g.drawImage(base,0,0);
    // Piyo: a dot with an arrow for where she faces (as on the Halloween minimap)
    const [x,y]=out(p.x,p.z);
    g.save();g.translate(x,y);g.rotate(Math.PI-(facing??Math.PI));
    g.beginPath();g.moveTo(0,-13);g.lineTo(9,7);g.lineTo(0,2.5);g.lineTo(-9,7);g.closePath();
    g.fillStyle='#795589';g.strokeStyle='#fff7e6';g.lineWidth=3;g.lineJoin='round';g.stroke();g.fill();
    g.restore();
  };
}

play().catch(error=>{
  console.error(error);
  status.textContent='城下町を開けませんでした。WebGLに対応したブラウザで、もう一度読み込んでください。';
});
