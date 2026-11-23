import * as T from 'three';
import { buildPlayer, buildTown } from './town.js';
import {
  bounds, bridge, canWalk, castle, clamp, court, groundHeight, houses, inHouse,
  paths, riverZ, spawn, squares, tree, upperTerrace, viewpoints, walkHeight
} from './layout.js';

const $ = selector => document.querySelector(selector);
const canvas=$('#view'), status=$('#status'), place=$('#place'), help=$('#help');
const coarse=matchMedia('(pointer: coarse)').matches;
if(coarse)help.textContent='左で歩く　画面をドラッグで視点';

async function play() {
  const renderer=new T.WebGLRenderer({canvas,antialias:!coarse,powerPreference:'high-performance'});
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.04;
  const scene=new T.Scene();
  const camera=new T.PerspectiveCamera(64,1,.12,190);
  const map=makeMap();
  const keys=new Set(), joy={x:0,y:0};
  let snowing=true,yaw=.23,pitch=.09,orbitDistance=4.5;
  const viewButton=$('#viewpoint');
  let nearView=null,eyeView=null,eyeYaw=0,eyePitch=0;
  let resCap=coarse?1.3:1.75,mapTimer=0;
  const [town,{player,body}]=await Promise.all([buildTown(scene,coarse),buildPlayer(scene)]);
  player.position.set(spawn.x,walkHeight(spawn.x,spawn.z),spawn.z);
  player.rotation.y=Math.PI-.18;
  const look=new T.Vector3(), angleWrap=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));
  const target=new T.Vector3(), desired=new T.Vector3(), probe=new T.Vector3();
  const horizontal=new T.Vector2(), velocity=new T.Vector2();
  const animations=[];
  body.traverse(o=>{ if(o.isBone && /LeftUpLeg|RightUpLeg/i.test(o.name)) animations.push([o,o.rotation.x]); });
  let bob=0;
  function size(){
    const w=canvas.clientWidth,h=canvas.clientHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,resCap));
    renderer.setSize(w,h,false);
    camera.aspect=w/h;
    camera.fov=eyeView?(w/h<.84?88:68):(w/h<.84?72:64);
    camera.updateProjectionMatrix();
  }
  function leaveView(){
    if(!eyeView)return;
    eyeView=null;
    body.visible=true;
    viewButton.textContent='景色を見る';
    viewButton.removeAttribute('aria-pressed');
    size();
  }
  viewButton.addEventListener('click',()=>{
    if(eyeView){leaveView();return;}
    if(!nearView)return;
    eyeView=nearView;
    const [px,pz]=eyeView.eye??[eyeView.x,eyeView.z];
    const [x,y,z]=eyeView.look;
    eyeYaw=Math.atan2(x-px,pz-z);
    eyePitch=Math.atan2(y-walkHeight(px,pz)-(eyeView.eyeHeight??1.22),Math.hypot(x-px,z-pz));
    body.visible=false;
    velocity.set(0,0);
    viewButton.textContent='散策に戻る';
    viewButton.setAttribute('aria-pressed','true');
    size();
  });
  addEventListener('resize',size);
  size();

  const movement=new Set(['KeyW','KeyS','KeyA','KeyD','ArrowLeft','ArrowRight','ArrowUp','ArrowDown']);
  addEventListener('keydown',e=>{
    if(!movement.has(e.code)|| (e.target instanceof HTMLButtonElement&&e.code.startsWith('Arrow')))return;
    e.preventDefault();
    keys.add(e.code);
  });
  addEventListener('keyup',e=>keys.delete(e.code));
  addEventListener('blur',()=>{keys.clear();drags.clear();resetJoy();});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){keys.clear();drags.clear();resetJoy();}
  });

  const drags=new Map();
  let pinch=0;
  const grip=()=> {
    const [a,b]=drags.values();
    return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;
  };
  canvas.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
    canvas.setPointerCapture(e.pointerId);drags.set(e.pointerId,{x:e.clientX,y:e.clientY});
    pinch=grip();
  });
  canvas.addEventListener('pointermove',e=>{
    const p=drags.get(e.pointerId);
    if(!p)return;
    const dx=e.clientX-p.x,dy=e.clientY-p.y;
    p.x=e.clientX;p.y=e.clientY;
    if(eyeView){
      if(drags.size===1){
        eyeYaw=angleWrap(eyeYaw-dx*.0063);
        eyePitch=clamp(eyePitch-dy*.0044,-.72,.74);
      }
    }else if(drags.size===2){
      const distance=grip();
      if(pinch)orbitDistance=clamp(orbitDistance+(pinch-distance)*.024,2.5,9);
      pinch=distance;
    } else if(drags.size===1){
      yaw=angleWrap(yaw-dx*.0063);
      pitch=clamp(pitch+dy*.0044,-.36,.83);
    }
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture']){
    canvas.addEventListener(event,e=>{drags.delete(e.pointerId);pinch=grip();});
  }
  canvas.addEventListener('wheel',e=>{
    e.preventDefault(); orbitDistance=clamp(orbitDistance+e.deltaY*.005,2.5,9);
  },{passive:false});

  const joystick=$('#joystick'),knob=$('#knob');
  let stick=null;
  function resetJoy(){stick=null;joy.x=joy.y=0;knob.style.transform='';}
  function joystickAt(e){
    const rect=joystick.getBoundingClientRect();
    const x=(e.clientX-(rect.left+rect.right)/2)/30,y=(e.clientY-(rect.top+rect.bottom)/2)/30;
    const mag=Math.max(1,Math.hypot(x,y));
    joy.x=x/mag;joy.y=-y/mag;
    knob.style.transform=`translate(${joy.x*25}px,${joy.y*-25}px)`;
  }
  joystick.addEventListener('pointerdown',e=>{
    if(stick!==null)return;
    stick=e.pointerId;joystick.setPointerCapture(stick);joystickAt(e);
  });
  joystick.addEventListener('pointermove',e=>{if(e.pointerId===stick)joystickAt(e);});
  for(const name of ['pointerup','pointercancel','lostpointercapture']){
    joystick.addEventListener(name,e=>{if(e.pointerId===stick)resetJoy();});
  }

  const mapButton=$('#map-button');
  mapButton.addEventListener('click',()=>{
    const panel=$('#map-panel');panel.hidden=!panel.hidden;
    mapButton.setAttribute('aria-expanded',String(!panel.hidden));
    map(player.position);
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
    yaw=.23;pitch=.09;orbitDistance=4.5;velocity.set(0,0);
    cameraView(1);map(player.position);
  });

  function move(dt,t){
    const press=(...codes)=>codes.some(c=>keys.has(c))?1:0;
    const across=press('KeyD','ArrowRight')-press('KeyA','ArrowLeft')+joy.x;
    const forward=press('KeyW','ArrowUp')-press('KeyS','ArrowDown')+joy.y;
    horizontal.set(across,forward).clampLength(0,1);
    if(horizontal.lengthSq()>0)leaveView();
    const s=Math.sin(yaw),c=Math.cos(yaw),p=player.position,lastX=p.x,lastZ=p.z;
    const stride=5.05, easing=1-Math.exp(-dt*21);
    velocity.x+=(stride*(horizontal.x*c+horizontal.y*s)-velocity.x)*easing;
    velocity.y+=(stride*(horizontal.x*s-horizontal.y*c)-velocity.y)*easing;
    const x=p.x+velocity.x*dt, z=p.z+velocity.y*dt;
    if(canWalk(x,z)){p.x=x;p.z=z;}
    else {
      if(canWalk(x,p.z))p.x=x;
      if(canWalk(p.x,z))p.z=z;
    }
    const step=Math.hypot(p.x-lastX,p.z-lastZ);
    p.y+=(walkHeight(p.x,p.z)-p.y)*(1-Math.exp(-dt*23));
    if(step>.0002) {
      const facing=Math.atan2(p.x-lastX,p.z-lastZ);
      player.rotation.y+=angleWrap(facing-player.rotation.y)*(1-Math.exp(-dt*15));
    }
    bob += step*5.1;
    const motion=Math.min(1,step/(Math.max(dt,.001)*3.4));
    body.position.y=Math.sin(bob*2)*.035*motion+Math.sin(t*4.4)*.018;
    body.rotation.z=Math.sin(bob)*.065*motion;
    for(const [i,[bone,base]] of animations.entries())bone.rotation.x=base+Math.sin(bob+i*Math.PI)*.30*motion;
  }

  function cameraView(alpha){
    const p=player.position,s=Math.sin(yaw),c=Math.cos(yaw);
    if(eyeView){
      const [x,z]=eyeView.eye??[eyeView.x,eyeView.z];
      camera.position.set(x,walkHeight(x,z)+(eyeView.eyeHeight??1.22),z);
      look.copy(camera.position).add(target.set(Math.sin(eyeYaw),Math.tan(eyePitch),-Math.cos(eyeYaw)));
      camera.lookAt(look);
      return;
    }
    const h=2.12+pitch*orbitDistance;
    target.set(p.x+s*2.7,p.y+2.98-pitch*3.35,p.z-c*2.7);
    desired.set(p.x-s*orbitDistance,p.y+h,p.z+c*orbitDistance);
    const isBlocked=(x,y,z)=>y<groundHeight(x,z)+.55||
      (Math.hypot(x-tree.x,z-tree.z)<tree.radius+.28&&y<groundHeight(tree.x,tree.z)+tree.planterHeight+tree.height-tree.sink)||
      houses.some(a=>inHouse(x,z,a,.16)&&y<groundHeight(a.x,a.z)+a.h+1.8)||
      (z>-42.1&&z<-40.1&& (Math.abs(x)>1.85 || y>8.0));
    // Pull the camera in before it passes through walls, buildings or banks.
    for(let t=.1;t<=1.01;t+=.075){
      probe.set(p.x,p.y+1.65,p.z).lerp(desired,t);
      if(isBlocked(probe.x,probe.y,probe.z)){
        desired.set(p.x,p.y+1.65,p.z).lerp(desired,Math.max(.16,t-.095));
        alpha=1;
        break;
      }
    }
    camera.position.lerp(desired,alpha);
    look.lerp(target,alpha);
    camera.lookAt(look);
  }
  cameraView(1);
  status.hidden=true;
  let start=performance.now(),previous=start,perfTime=0,perfN=0;
  function update(now){
    const elapsed=(now-previous)*.001,dt=Math.min(.045,elapsed),t=(now-start)*.001;
    previous=now;
    if(!document.hidden){
      move(dt,t);cameraView(1-Math.exp(-dt*22));town.time.value=t;
      town.mill.rotation.z=t*town.wheelSpeed;
      if(snowing)town.snow.update(dt,t,player.position);
      mapTimer+=dt;
      if(mapTimer>.12){
        mapTimer=0;
        const {x,z}=player.position;
        const onTerrace=Math.hypot((x-upperTerrace.x)/upperTerrace.rx,(z-upperTerrace.z)/upperTerrace.rz)<1;
        const current=z>-49?'北門':z>-54?'川辺の店並み':z>=bridge.a&&Math.abs(x-bridge.x)<2.35?'石のアーチ橋':
          z>-64?'小川のほとり':z>-76?'ツリー広場':onTerrace?'展望テラス':z>-92&&x>9.15?'商店街':
          z>court.z+5?'城へ続く小道':'城前の広場';
        nearView=viewpoints.find(v=>Math.hypot(v.x-x,v.z-z)<=v.radius)??null;
        viewButton.hidden=!nearView;
        const caption=nearView?.name??current;
        if(place.textContent!==caption)place.textContent=caption;
        if(!$('#map-panel').hidden)map(player.position);
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
      houses:houses.length, webgl:renderer.getContext().getParameter(renderer.getContext().VERSION)
    });
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
  return p=>{
    g.drawImage(base,0,0);
    g.beginPath();g.arc(...out(p.x,p.z),6.7,0,Math.PI*2);
    g.fillStyle='#795589';g.strokeStyle='#fff7e6';g.lineWidth=3;g.fill();g.stroke();
  };
}

play().catch(error=>{
  console.error(error);
  status.textContent='城下町を開けませんでした。WebGLに対応したブラウザで、もう一度読み込んでください。';
});
