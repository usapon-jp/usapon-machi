import * as T from 'three';
import {GLTFLoader} from './vendor/addons/loaders/GLTFLoader.js';
import {canWalk} from './layout.js';

const calmGap=1.14;
const arrivalDuration=9.05;
const searchOffsets=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
function detour(start,target){
  const step=.45;
  const coords=(x,z)=>new T.Vector2(start.x+x*step,start.y+z*step);
  const clear=p=>canWalk(p.x,p.y,.18);
  const canReach=p=>{
    const distance=p.distanceTo(target);
    if(distance>.67)return false;
    return clear(p.clone().lerp(target,.5))&&clear(target);
  };
  const nodes=[{x:0,z:0,parent:-1}],seen=new Set(['0,0']);
  for(let i=0;i<nodes.length;i++){
    const {x,z}=nodes[i],point=coords(x,z);
    if(canReach(point)){
      const path=[];
      for(let at=i;nodes[at].parent>=0;at=nodes[at].parent)path.push(coords(nodes[at].x,nodes[at].z));
      return path.reverse();
    }
    for(const [dx,dz] of searchOffsets){
      const nx=x+dx,nz=z+dz,key=`${nx},${nz}`;
      if(Math.abs(nx)>22||Math.abs(nz)>22||seen.has(key))continue;
      if(!clear(coords(nx,nz))||!clear(coords(x+dx/2,z+dz/2)))continue;
      seen.add(key);
      nodes.push({x:nx,z:nz,parent:i});
    }
  }
  return null;
}
const clamp=value=>Math.max(0,Math.min(1,value));
const blend=(a,b,t)=>a+(b-a)*t;
const ease=t=>{t=clamp(t);return t*t*(3-2*t);};
const phase=(t,a,b)=>ease((t-a)/(b-a));
const facing=(x,z)=>Math.atan2(x,z);
const wrap=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));
const $=id=>document.getElementById(id);
const farewell='「お手紙、ちゃんととどけるね。\nありがとう！」';

function paintedTexture(width,height,paint) {
  const canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=height;
  paint(canvas.getContext('2d'));
  const texture=new T.CanvasTexture(canvas);
  texture.colorSpace=T.SRGBColorSpace;
  return texture;
}

function makeEnvelope(scale) {
  const map=paintedTexture(160,112,g=>{
    g.fillStyle='#fff0cd';g.fillRect(0,0,160,112);
    g.strokeStyle='#bc907b';g.lineWidth=5;g.strokeRect(2.5,2.5,155,107);
    g.beginPath();g.moveTo(4,6);g.lineTo(80,65);g.lineTo(156,6);
    g.moveTo(5,104);g.lineTo(59,56);g.moveTo(155,104);g.lineTo(101,56);g.stroke();
    g.fillStyle='#cb4961';g.beginPath();g.arc(80,63,11,0,Math.PI*2);g.fill();
  });
  const envelope=new T.Mesh(new T.PlaneGeometry(.485/scale,.34/scale),
    new T.MeshBasicMaterial({map,side:T.DoubleSide}));
  envelope.position.set(.10,.80,1.03);
  envelope.rotation.z=-.11;
  envelope.visible=false;
  return envelope;
}

// The "?" bubble over Santa before the player talks to her, so the event does not start out of nowhere.
function makeQuestion() {
  const map=paintedTexture(96,96,g=>{
    g.fillStyle='#fff7ea';g.strokeStyle='#c9737f';g.lineWidth=5;
    g.beginPath();g.arc(48,44,34,0,Math.PI*2);g.fill();g.stroke();
    g.beginPath();g.moveTo(40,74);g.lineTo(48,90);g.lineTo(56,74);g.closePath();g.fill();
    g.fillStyle='#c9425f';g.font='bold 46px sans-serif';g.textAlign='center';g.textBaseline='middle';
    g.fillText('?',48,46);
  });
  const sprite=new T.Sprite(new T.SpriteMaterial({map,transparent:true,depthWrite:false,fog:false}));
  sprite.scale.setScalar(.55);sprite.visible=false;
  return sprite;
}

function makeParticles(scene,heart,count) {
  const map=paintedTexture(64,64,g=>{
    g.fillStyle=heart?'#ef7595':'#ffef9c';
    g.strokeStyle='#fff7e8';g.lineWidth=3;
    g.beginPath();
    if(heart){
      g.moveTo(32,56);g.bezierCurveTo(2,36,2,19,11,12);
      g.bezierCurveTo(21,5,29,11,32,18);g.bezierCurveTo(37,9,47,5,55,13);
      g.bezierCurveTo(67,25,54,41,32,56);
    }else{
      g.moveTo(32,2);g.quadraticCurveTo(36,27,62,32);g.quadraticCurveTo(36,36,32,62);
      g.quadraticCurveTo(26,36,2,32);g.quadraticCurveTo(27,27,32,2);
    }
    g.closePath();g.fill();g.stroke();
  });
  return Array.from({length:count},()=>{
    const sprite=new T.Sprite(new T.SpriteMaterial({map,transparent:true,depthWrite:false,fog:false}));
    sprite.visible=false;scene.add(sprite);return sprite;
  });
}

function createStrawberryEvent({scene,camera,player,walkHeight,letterDoor,hud,canInteract,refreshCamera,completed,onDelivered,canMeet,definition,onJoin}) {
  const talk=$('santa-talk'),speech=$('santa-speech');
  const next=$('santa-next'),skip=$('santa-skip'),speaker=$('santa-speaker'),line=$('santa-line');
  const modal=$('mSanta');
  const meeting=new T.Vector2(...definition.meeting);
  const destination=definition.name;
  const requestLines=[
    definition.id==='letter'?'ツリー広場まで 来てくれて\nありがとう！':'こんにちは！\nいちごサンタだよ。',
    `わたしは、${destination}に\nお手紙をとりに行くかかりなの。`,
    'そこまで 連れていってくれる？'
  ];
  const {house,entry}=letterDoor;
  const actor=new T.Group();scene.add(actor);
  actor.position.set(meeting.x,walkHeight(meeting.x,meeting.y),meeting.y);
  let state=completed?'done':'waiting',mixer,envelope,hearts,stars,doorStars,loading=false,failed=false;
  let lineIndex=0,saidFarewell=false,bubbleTime=0;
  const sparkleSpot=new T.Vector3();
  const question=makeQuestion();actor.add(question);actor.visible=!completed;
  let phaseTime=0,hopTime=0,playerYaw=0,detourCooldown=0;
  let trail=[],savedPlayer=null,arrivalStart=null;
  const point=new T.Vector3(),look=new T.Vector3(),playerSpot=new T.Vector2();
  const trailPosition=new T.Vector2();

  const front=entry.end+.29;
  const arrivalX=entry.x+.025;
  const active=()=>state==='request'||state==='reply'||state==='arrival';
  const gap=()=>Math.hypot(player.position.x-actor.position.x,player.position.z-actor.position.z);
  const local=(x,y,z,out=new T.Vector3())=>house.localToWorld(out.set(x,y,z));
  const yawOfHouse=house.rotation.y;
  const canStart=()=>canInteract()&&!hud.anyModal();

  async function mount() {
    loading=true;failed=false;
    try{
      const {scene:model,animations}=await new GLTFLoader().loadAsync(new URL(definition.model??'./assets/strawberry-santa.glb',import.meta.url).href);
      const clip=T.AnimationClip.findByName(animations,definition.animation??'Poyon_Hop');
      if(!clip)throw new Error('Poyon_Hop is missing');
      const size=new T.Box3().setFromObject(model).getSize(new T.Vector3());
      const scale=1/size.y;
      model.scale.setScalar(scale);
      envelope=makeEnvelope(scale);
      const animatedRoot=model.getObjectByName(T.PropertyBinding.parseTrackName(clip.tracks[0].name).nodeName);
      if(!animatedRoot)throw new Error('Santa animation root is missing');
      animatedRoot.add(envelope);
      actor.add(model);
      mixer=new T.AnimationMixer(model);
      mixer.clipAction(clip).play();
      hearts=makeParticles(scene,true,5);
      stars=makeParticles(scene,false,7);
      doorStars=makeParticles(scene,false,5);
      for(const sprite of doorStars)sprite.material.color.set(0xffb347);
    }catch(error){
      console.warn('Santa could not be loaded',error);
      failed=true;
    }finally{
      loading=false;
    }
  }
  function pose(time=0) {
    mixer.setTime(time);
  }
  function face(direction,dt) {
    actor.rotation.y+=wrap(direction-actor.rotation.y)*(1-Math.exp(-12*dt));
  }
  function showLine(name,text,button) {
    modal.removeAttribute('aria-label');
    modal.setAttribute('aria-labelledby','santa-speaker');
    speech.hidden=false;skip.hidden=true;
    speaker.textContent=name;line.textContent=text;next.textContent=button;
    next.focus();
  }
  function begin() {
    if(state!=='waiting'||gap()>2.22||!canMeet()||!canStart())return;
    if(failed){void mount();return;}
    if(!mixer)return;
    playerYaw=player.rotation.y;
    hud.input.keys.clear();
    state='request';lineIndex=0;talk.hidden=true;question.visible=false;
    hud.openModal('mSanta');
    showLine('いちごサンタ',requestLines[0],'つぎへ');
  }
  function closeScene() {
    hud.closeModal('mSanta');
    refreshCamera();
  }
  function advance(){
    if(state==='request'&&lineIndex<requestLines.length-1){
      lineIndex++;showLine('いちごサンタ',requestLines[lineIndex],'つぎへ');
    }else if(state==='request'){
      state='reply';showLine('ピヨちゃん','いいよ','しゅっぱつ');
    }else if(state==='reply'){
      state='escort';player.rotation.y=playerYaw;
      trailPosition.set(actor.position.x,actor.position.z);
      trail=[];hopTime=0;detourCooldown=0;
      onJoin();closeScene();
    }
  }
  function cancel(){
    if(state==='arrival')finish();
    else if(active()){player.rotation.y=playerYaw;state='waiting';closeScene();}
  }

  function escort(dt,slot) {
    detourCooldown=Math.max(0,detourCooldown-dt);
    const p=house.worldToLocal(point.copy(player.position));
    const atDoor=canStart()&&Math.abs(p.x-entry.x)<1.12&&p.z>=entry.start-.04&&p.z<entry.end+.98
      &&player.position.y<walkHeight(player.position.x,player.position.z)+.13;
    const targetPosition=atDoor?player.position:slot;
    playerSpot.set(targetPosition.x,targetPosition.z);
    if(trail.length&&trail.at(-1).distanceTo(playerSpot)>1.1)trail=[];
    if(!trail.length)trail.push(playerSpot.clone());
    else trail.at(-1).copy(playerSpot);
    let remaining=dt*(trailPosition.distanceTo(playerSpot)>3?8.4:5.7);
    while(remaining>.0001&&trail.length){
      const target=trail[0];
      const x=target.x-trailPosition.x,z=target.y-trailPosition.y;
      const distance=Math.hypot(x,z);
      if(distance<.017){trail.shift();continue;}
      const step=Math.min(remaining,distance);
      const nx=trailPosition.x+x*step/distance,nz=trailPosition.y+z*step/distance;
      if(!canWalk(nx,nz,.15)){
        if(detourCooldown===0){
          detourCooldown=.65;
          const path=detour(trailPosition,playerSpot);
          if(path?.length){trail=[...path,playerSpot.clone()];continue;}
        }
        break;
      }
      trailPosition.set(nx,nz);
      remaining-=step;
    }
    const nx=trailPosition.x,nz=trailPosition.y;
    const dx=nx-actor.position.x,dz=nz-actor.position.z;
    const shift=Math.hypot(dx,dz);
    actor.position.set(nx,walkHeight(nx,nz),nz);
    if(shift>.004){face(facing(dx,dz),dt);hopTime+=dt*1.8;}
    else if(hopTime%1>.002)hopTime=Math.min(Math.floor(hopTime)+1,hopTime+dt*2.6);
    pose(hopTime);
    if(atDoor&&gap()<1.4)startArrival();
  }

  function startArrival() {
    state='arrival';phaseTime=0;saidFarewell=false;
    for(const sprite of doorStars)sprite.visible=false;
    savedPlayer={position:player.position.clone(),yaw:player.rotation.y};
    arrivalStart=actor.position.clone();
    const side=local(entry.x-1.20,0,front);
    if(canWalk(side.x,side.z)){
      player.position.set(side.x,walkHeight(side.x,side.z),side.z);
    }
    player.rotation.y=yawOfHouse+.30;
    hud.input.keys.clear();
    hud.openModal('mSanta');
    modal.setAttribute('aria-label',destination);
    modal.removeAttribute('aria-labelledby');
    speech.hidden=true;skip.hidden=false;
    skip.focus();
  }
  function sitAt(x,z) {
    local(x,0,z,point);
    const y=z<entry.start?entry.base+entry.threshold:walkHeight(point.x,point.z);
    actor.position.set(point.x,y,point.z);
  }
  function particles(list,age,heart,x,y,z) {
    list.forEach((sprite,i)=>{
      const t=clamp((age-i*.06)/(heart?1.06:.69));
      sprite.visible=t>0&&t<1;
      if(!sprite.visible)return;
      const theta=i*2.399;
      const distance=(heart?.55:.95)*t;
      sprite.position.set(x+Math.cos(theta)*distance,
        y+(heart?.92*t:Math.sin(theta)*distance),z+Math.sin(theta)*distance*.36);
      const growth=Math.sin(t*Math.PI)**.62;
      sprite.scale.setScalar((heart?.27:.29)*growth*(i===0?1.35:1));
      sprite.material.opacity=growth;
    });
  }
  function arrival(dt) {
    phaseTime+=dt;
    const t=phaseTime;
    if(t>=arrivalDuration){finish();return;}
    const approach=phase(t,0,.48);
    const into=phase(t,1.78,3.87);
    const emerge=phase(t,4.70,6.06);
    const inside=letterDoor.frontZ-.64;
    const z=t<4.70?blend(front,inside,into):blend(inside,front,emerge);
    sitAt(arrivalX,z);
    if(t<.48)actor.position.lerp(arrivalStart,1-approach);
    actor.rotation.y=yawOfHouse+(t<1.52?-.40:t<1.98?blend(-.40,-Math.PI,phase(t,1.52,1.98)):t<4.50?-Math.PI:-.26);
    actor.visible=t<3.88||t>=4.61;
    if(t>=6.05&&!saidFarewell){saidFarewell=true;hud.toast(farewell,2900);}
    const vanish=phase(t,8.02,8.34);
    actor.scale.setScalar(1-vanish);
    if(vanish===1)actor.visible=false;
    envelope.visible=t>=4.61;
    const jumping=t>=.38&&t<1.38?t-.38:t>=6.00&&t<8.00?t-6:0;
    const walking=t>1.80&&t<3.88?(t-1.80)*1.70:t>4.71&&t<6.00?(t-4.71)*1.85:0;
    pose(jumping||walking);
    const doorPhase=(a,b,c,d)=>phase(t,a,b)*(1-phase(t,c,d));
    letterDoor.setOpen(1.49*(doorPhase(1.34,1.94,3.63,4.12)+doorPhase(4.40,4.94,5.87,6.36)));
    const {x,y,z:depth}=actor.position;
    particles(hearts,t-.68,true,x,y+.72,depth);
    particles(stars,t-8.01,false,x,y+.42,depth);
  }
  function finish() {
    if(state!=='arrival')return;
    actor.visible=false;envelope.visible=false;
    for(const sprite of [...hearts,...stars])sprite.visible=false;
    letterDoor.setOpen(0);
    const side=local(entry.x-1.20,0,front+.9);
    if(canWalk(side.x,side.z)){
      player.position.set(side.x,walkHeight(side.x,side.z),side.z);
      player.rotation.y=yawOfHouse+Math.PI;
    }else{
      player.position.copy(savedPlayer.position);player.rotation.y=savedPlayer.yaw;
    }
    state='done';trail=[];
    hud.closeModal('mSanta');
    refreshCamera(yawOfHouse);
    onDelivered(saidFarewell?undefined:farewell);
  }

  function update(dt,leader=player.position) {
    const distance=gap();
    if(state==='waiting'&&!mixer&&!loading&&!failed&&distance<23)void mount();
    if(state==='waiting')actor.visible=canMeet();
    question.visible=state==='waiting'&&actor.visible&&!!mixer&&distance>2.22;
    if(question.visible){bubbleTime+=dt;question.position.set(0,1.22+Math.sin(bubbleTime*4)*.05,0);}
    doorSparkle(dt);
    if(state==='waiting'&&mixer)face(facing(player.position.x-actor.position.x,player.position.z-actor.position.z),dt);
    if(state==='escort'&&!hud.anyModal())escort(dt,leader);
    if(state==='arrival')arrival(dt);
  }
  // While escorting, a few twinkles over the green door show where to go.
  let sparkleTime=0;
  function doorSparkle(dt) {
    if(!doorStars)return;
    const on=state==='escort';
    if(!on){for(const sprite of doorStars)sprite.visible=false;return;}
    sparkleTime+=dt;
    local(entry.x,entry.threshold+1.98,letterDoor.frontZ+.42,sparkleSpot);
    doorStars.forEach((sprite,i)=>{
      const t=(sparkleTime*.55+i/doorStars.length)%1;
      const glow=Math.sin(t*Math.PI)**1.4;
      const angle=i*1.9+sparkleTime*.4;
      sprite.visible=glow>.02;
      sprite.position.set(sparkleSpot.x+Math.cos(angle)*.62,sparkleSpot.y+Math.sin(angle*1.3)*.22+t*.2,sparkleSpot.z);
      sprite.scale.setScalar(.46*glow*(i===0?1.25:1));
      sprite.material.opacity=glow;
    });
  }
  function frameCamera() {
    const narrow=camera.aspect<.8;
    if(state==='arrival'){
      const close=phase(phaseTime,1.26,2.42);
      const end=phase(phaseTime,5.70,6.55);
      const x=blend(-2.64,-2.37,close)-(narrow?0:.35);
      const y=blend(2.60,1.63,close);
      const z=blend(7.10,6.57,close)-(narrow?0:.27);
      local(entry.x+x,y,z,point);
      local(entry.x+(narrow?blend(-.20,-.52,close):-.54),blend(1.24,blend(.56,.46,end),close),blend(2.05,3.42,close),look);
      camera.fov=narrow?82:blend(67,55,close);
    }else{
      const dx=player.position.x-actor.position.x,dz=player.position.z-actor.position.z;
      const distance=Math.hypot(dx,dz)||1;
      const x=(actor.position.x+player.position.x)*.5,z=(actor.position.z+player.position.z)*.5;
      const y=(actor.position.y+player.position.y)*.5;
      point.set(x+dx/distance*1.34-dz/distance*3.86,y+1.70,z+dz/distance*1.34+dx/distance*3.86);
      look.set(x,y+.77,z);
      const towardPlayer=facing(dx,dz);
      const santaToCamera=facing(point.x-actor.position.x,point.z-actor.position.z);
      const piyoToCamera=facing(point.x-player.position.x,point.z-player.position.z);
      actor.rotation.y=towardPlayer+wrap(santaToCamera-towardPlayer)*.74;
      const towardSanta=towardPlayer+Math.PI;
      player.rotation.y=towardSanta+wrap(piyoToCamera-towardSanta)*.54;
      camera.fov=narrow?72:37;
    }
    camera.position.copy(point);camera.lookAt(look);camera.updateProjectionMatrix();
  }
  function reset() {
    if(state==='done')return;
    state='waiting';actor.visible=true;
    actor.scale.setScalar(1);
    actor.position.set(meeting.x,walkHeight(meeting.x,meeting.y),meeting.y);
    trail=[];
    if(mixer)pose();
    if(envelope)envelope.visible=false;
    if(hearts)for(const sprite of [...hearts,...stars,...doorStars])sprite.visible=false;
    lineIndex=0;
    letterDoor.setOpen(0);
    hud.closeModal('mSanta');
  }
  return {update,active,frameCamera,reset,begin,advance,cancel,finish,destination,
    hint:definition.hint,gap,ready:()=>state==='waiting'&&actor.visible&&gap()<=2.22&&canStart()&&(mixer||failed),
    companion:()=>state==='escort'?actor.position:null,
    arrivalActive:()=>state==='arrival',
    showEscort(show){
      if(state==='escort'){
        actor.visible=show;
        if(!show)for(const sprite of doorStars)sprite.visible=false;
      }
    },
    locationLabel:()=>state==='arrival'?destination:null,
    inspect:()=>({state,loaded:!!mixer,actor:actor.position.toArray(),visible:actor.visible,phaseTime})};
}

export function createSantaParty({definitions,doors,completed,canMeet,onDelivered,...options}){
  const party=[];
  const footprint=[];
  let previous=new T.Vector2();
  const targetSlots=[];
  function track(){
    const {position,rotation}=options.player;
    const point=new T.Vector2(position.x,position.z);
    if(footprint.length&&point.distanceTo(previous)>2.5)footprint.length=0;
    previous.copy(point);
    if(!footprint.length){
      const s=Math.sin(rotation.y),c=Math.cos(rotation.y);
      for(let d=.22;d<Math.max(8,events.length*calmGap);d+=.22){
        const next=new T.Vector2(point.x-d*s,point.y-d*c);
        if(!canWalk(next.x,next.y,.18))break;
        footprint.push(next);
      }
      footprint.reverse();footprint.push(point);
    }else if(footprint.at(-1).distanceTo(point)>.13)footprint.push(point);
    while(footprint.length>Math.max(150,events.length*14))footprint.shift();
    return point;
  }
  function slotFor(index,point){
    const slot=targetSlots[index]??(targetSlots[index]=new T.Vector3());
    let remaining=(index+1)*calmGap,from=point;
    for(let i=footprint.length-1;i>=0;i--){
      const to=footprint[i],length=from.distanceTo(to);
      if(length>=remaining){
        const t=remaining/length;
        return slot.set(blend(from.x,to.x,t),0,blend(from.y,to.y,t));
      }
      remaining-=length;from=to;
    }
    return slot.set(from.x,0,from.y);
  }
  const events=definitions.map(definition=>{
    const santa=createStrawberryEvent({...options,definition,letterDoor:doors.get(definition.houseId??definition.id),
      completed:completed(definition.id),canMeet:()=>canMeet(definition.id),
      onJoin:()=>party.push(santa),
      onDelivered:farewell=>{
        party.splice(party.indexOf(santa),1);
        onDelivered(definition.id,farewell);
      }});
    return santa;
  });
  const talk=$('santa-talk'),hint=$('santa-route');
  const active=()=>events.find(event=>event.active());
  let candidate;
  talk.addEventListener('click',()=>candidate?.begin());
  $('santa-next').addEventListener('click',()=>active()?.advance());
  $('santa-skip').addEventListener('click',()=>active()?.finish());
  addEventListener('keydown',event=>{
    if(event.code==='Escape'&&active()){
      event.preventDefault();event.stopImmediatePropagation();active().cancel();
    }else if(event.code==='KeyE'&&!event.repeat)candidate?.begin();
  },true);
  return {
    update(dt){
      for(const event of events)if(!party.includes(event))event.update(dt);
      const point=track();
      [...party].forEach((event,index)=>event.update(dt,slotFor(index,point)));
      const showingArrival=party.some(event=>event.arrivalActive());
      for(const event of party)event.showEscort(!showingArrival);
      candidate=events.filter(event=>event.ready()).sort((a,b)=>a.gap()-b.gap())[0];
      talk.hidden=!candidate;
      const canShowRoute=party.length>0&&options.canInteract()&&!options.hud.anyModal();
      hint.hidden=!canShowRoute;
      if(canShowRoute)hint.textContent=party.length===1?party[0].hint:
        `いちごサンタ ${party.length}人  ·  ${party.map(event=>event.destination).join('、')}`;
    },
    active:()=>!!active(),busy:()=>!!active()||party.length>0,
    frameCamera:()=>active()?.frameCamera(),locationLabel:()=>active()?.locationLabel(),
    reset(){for(const event of events)event.reset();party.length=0;footprint.length=0;},
    companion:()=>party[0]?.companion()??null,
    inspect:()=>({...events[0]?.inspect(),party:party.map(event=>event.destination),santas:events.map(event=>event.inspect())})
  };
}
