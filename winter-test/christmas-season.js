import * as T from 'three';
import {GLTFLoader} from './vendor/addons/loaders/GLTFLoader.js';

const seasons=window.VillageSeasons;
export function createChristmasSeason({scene,camera,player,walkHeight,hud,outfit,canInteract,letterDoor}){
  const fromGate=new URLSearchParams(location.search).get('from')==='gate';
  if(!fromGate&&!seasons.owns('halloween-visited'))seasons.grant('started-christmas');
  const inventory=seasons.inventory();
  let delivered=seasons.owns('letter-found');
  let complete=inventory.winterBroom;
  let leaving=false,flying=false,flightHeight=0,liftTime=0;
  const guideButton=document.querySelector('#north-guide');
  const lanternButton=document.querySelector('#letter-lantern');
  const broomButton=document.querySelector('#winter-broom');
  const pickBroom=document.querySelector('#winter-broom-style');
  const fade=document.querySelector('#season-fade');
  const guide=new T.Group();
  const guideMotion=window.SantaGuide.create(T,guide,walkHeight,
    [[-1.3,-47],[2.35,-47],[4.65,-50.4],[4.8,-54],[4.8,-66],[5.35,-68]]);
  scene.add(guide);
  const meeting=window.SantaGuide.encounter(T,camera,guide,'いちごサンタ',[
    fromGate?'来てくれたんだね！\nお手紙を取りに行きたいの。':'こんにちは！\nいちごサンタだよ。',
    'お願いがあるの。\n橋の先の ツリー広場まで来てくれる？'
  ]);
  let retired=false;
  let dressed=seasons.owns('santa-outfit');
  outfit.show(dressed);
  let guiding=false,guideCalled=false;
  const guideDone=delivered;
  guide.visible=!guideDone;
  if(!guideDone){
    new GLTFLoader().loadAsync(new URL('./assets/strawberry-santa.glb',import.meta.url).href).then(({scene:model,animations})=>{
      const box=new T.Box3().setFromObject(model);
      const scale=1/(box.max.y-box.min.y);
      model.scale.setScalar(scale);model.position.y=-box.min.y*scale;guide.add(model);
      const clip=T.AnimationClip.findByName(animations,'Poyon_Hop');
      if(clip){
        const mixer=new T.AnimationMixer(model);
        mixer.clipAction(clip).play();
        guideMotion.usePose(phase=>mixer.setTime(phase*clip.duration));
      }
    }).catch(error=>console.warn('北門のいちごサンタ',error));
  }

  const lantern=letterDoor.lanternPosition();
  const wandColor=inventory.halloweenWand?0xf0b1ff:0xffdf8c;
  letterDoor.lanternColor(complete?wandColor:0x817161);
  const light=new T.PointLight(wandColor,complete?3:0,4);
  light.position.copy(lantern);scene.add(light);
  let whiteBroom,oldBroom;
  async function addOriginalBroom(){
    try{
      const response=await fetch(new URL('./assets/halloween-broom.json',import.meta.url));
      if(!response.ok)throw new Error('Halloween broom model unavailable');
      const data=await response.json();
      const decode=(key,Type)=>new Type(Uint8Array.from(atob(data[key]),ch=>ch.charCodeAt(0)).buffer);
      const quantized=decode('p',Uint16Array);
      const position=Float32Array.from(quantized,(n,i)=>{
        const axis=i%3;
        return data.mn[axis]+n/65535*(data.mx[axis]-data.mn[axis]);
      });
      const geometry=new T.BufferGeometry();
      geometry.setAttribute('position',new T.BufferAttribute(position,3));
      geometry.setAttribute('uv',new T.BufferAttribute(decode('u',Float32Array),2));
      geometry.setIndex(new T.BufferAttribute(decode('i',Uint16Array),1));
      geometry.computeVertexNormals();
      geometry.translate(0,-data.mn[1],-.85);
      const scale=2.6/(data.mx[2]-data.mn[2]);
      geometry.scale(scale,scale,scale);
      const map=new T.TextureLoader().load('data:image/jpeg;base64,'+data.t);
      map.flipY=false;map.colorSpace=T.SRGBColorSpace;
      oldBroom=new T.Mesh(geometry,new T.MeshStandardMaterial({map,side:T.DoubleSide}));
      oldBroom.position.y=.11;oldBroom.visible=false;player.add(oldBroom);
      pickBroom.options[1].disabled=false;
    }catch(error){console.warn('ハロウィンのほうき',error);}
  }
  if(inventory.halloweenBroom){pickBroom.options[1].disabled=true;void addOriginalBroom();}
  const wand=new T.Group();
  const wandMaterial=new T.MeshStandardMaterial({color:0xfff1da});
  const stick=new T.Mesh(new T.CylinderGeometry(.021,.028,.57,8),wandMaterial);
  wand.add(stick);
  const shape=new T.Shape();
  for(let i=0;i<10;i++){
    const angle=Math.PI/2+i*Math.PI/5,r=i%2===0?.14:.061;
    if(i===0)shape.moveTo(Math.cos(angle)*r,Math.sin(angle)*r);
    else shape.lineTo(Math.cos(angle)*r,Math.sin(angle)*r);
  }
  shape.closePath();
  const tip=new T.Mesh(new T.ShapeGeometry(shape),
    new T.MeshBasicMaterial({color:wandColor,side:T.DoubleSide}));
  tip.position.y=.34;wand.add(tip);
  wand.position.set(.49,.85,.22);wand.visible=false;player.add(wand);
  if(delivered&&!complete&&!inventory.halloweenWand&&!inventory.winterWand)seasons.grant('winter-wand');

  function deliver(farewell=''){
    if(delivered)return;
    delivered=true;
    const saved=seasons.grant('letter-found');
    const gotWand=inventory.halloweenWand||seasons.grant('winter-wand');
    const reward=inventory.halloweenWand
      ?'「時計塔のスティックだね！\nランタンに魔法をかけてみて」'
      :gotWand?'「このスティックで\nランタンをともしてね」'
        :'「ランタンをともしてね」';
    hud.toast(farewell?`${farewell}\n${reward}`:reward,4600);
    if(!saved||!gotWand)setTimeout(()=>hud.toast('このブラウザでは道具を保存できませんでした'),4700);
  }
  guideButton.onclick=()=>{
    guiding=true;guideMotion.greetClose();
    meeting.begin(player.position,()=>guideMotion.start());
  };
  lanternButton.onclick=()=>{
    if(!delivered||complete)return;
    complete=true;letterDoor.lanternColor(wandColor);light.intensity=3;liftTime=performance.now();
    const saved=seasons.grant('winter-broom');
    hud.toast(saved?'赤いリボンの白いほうきを もらった！':'白いほうきを もらった！ このブラウザでは道具を保存できませんでした',5000);
  };
  const flightArea=p=>p.z>=-76&&p.z<=-52&&Math.abs(p.x-4.8)<12;
  broomButton.onclick=()=>{
    if(flying){flying=false;return;}
    if(!complete||!canInteract())return;
    if(!flightArea(player.position)){hud.toast('橋やツリー広場の近くで乗れるよ');return;}
    if(!whiteBroom){
      whiteBroom=seasons.whiteBroom(T);
      whiteBroom.position.y=.11;whiteBroom.visible=false;player.add(whiteBroom);
    }
    flying=true;
  };
  addEventListener('pageshow',event=>{if(event.persisted)location.reload()});

  function update(dt,t){
    const p=player.position;
    const nearGuide=Math.hypot(p.x-guide.position.x,p.z-guide.position.z)<3.3;
    const interactive=canInteract()&&!leaving;
    if(!retired&&p.z<-66.9&&Math.hypot(p.x-4.4,p.z+69.98)<4){
      retired=true;
      if(!dressed){
        dressed=true;outfit.show(true);
        seasons.grant('santa-outfit');
        hud.toast('いちごサンタから\nサンタ帽とケープを もらったよ！',4200);
      }
    }
    guideButton.hidden=!interactive||!nearGuide||guiding||guideDone||retired;
    if(interactive&&nearGuide&&!guideCalled&&!guideDone){
      guideCalled=true;guideMotion.greet();
    }
    guideMotion.update(dt,p,(interactive||meeting.active())&&!guideDone&&!retired);
    if(delivered||retired)guide.visible=false;
    lanternButton.hidden=!interactive||!delivered||complete||Math.hypot(p.x-lantern.x,p.z-lantern.z)>4.5;
    broomButton.hidden=!interactive||!complete;
    broomButton.setAttribute('aria-label',flying?'ほうきからおりる':'ほうきにのる');
    broomButton.querySelector('span').textContent=flying?'おりる':'ほうき';
    pickBroom.hidden=!interactive||!complete||!oldBroom;
    if(flying&&!flightArea(p))flying=false;
    flightHeight+=(Number(flying)*1.35-flightHeight)*Math.min(1,dt*4);
    if(whiteBroom){
      whiteBroom.visible=flightHeight>.07&&pickBroom.value!=='halloween';
      if(oldBroom)oldBroom.visible=flightHeight>.07&&pickBroom.value==='halloween';
    }
    const pulse=liftTime?Math.max(0,1-(performance.now()-liftTime)/1300):0;
    wand.visible=pulse>0;
    if(pulse>0)wand.rotation.z=-.5-Math.sin(pulse*Math.PI)*1.1;
    if(complete)light.intensity=3+pulse*12;
    if(interactive&&!meeting.active()&&!flying&&flightHeight<.05&&p.z>-39.3&&Math.abs(p.x)<1.45){
      leaving=true;seasons.grant('crossed-north-gate');
      fade.classList.add('active');
      setTimeout(()=>location.assign('./2026/?season=winter&from=gate'),220);
    }
  }
  return {update,deliver,meeting,canMeet:()=>retired,delivered:()=>delivered,height:()=>flightHeight,land:()=>{flying=false;flightHeight=0;}};
}
