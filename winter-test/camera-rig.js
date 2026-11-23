// Camera rig for the winter town. Keeps the town's own framing (distance 4.5, target a little ahead of Piyo, viewpoints)
// and adds what the Halloween 2026 camera does: a slightly lagging follow, "pull in at once, wait, then ease back out"
// near walls, Piyo's-eye camera mode with zoom, and the selfie camera that circles Piyo.
import * as T from 'three';
import { clamp } from './layout.js';

const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

export function createCameraRig({camera,canvas,player,body,isBlocked,groundHeight,walkHeight,blocked=()=>false}) {
  const rig={
    yaw:.23,pitch:.09,dist:4.5,           // follow camera (same numbers as before)
    camMode:false,selfie:false,fp:.05,zoom:1,   // camera mode: Piyo's eyes, fp = look down(+)/up(-)
    sAng:0,sd:2.1,sp:.12,                 // selfie: angle around Piyo, distance, height
    eyeView:null,eyeYaw:0,eyePitch:0,     // "景色を見る" viewpoints
    fov:64
  };
  const look=new T.Vector3(),target=new T.Vector3(),desired=new T.Vector3(),probe=new T.Vector3(),head=new T.Vector3();
  const pivot={x:0,y:0,z:0,ok:false};
  let cur=1,hold=0;

  rig.wantedFov=aspect=>{
    const tall=aspect<.84;
    if(rig.eyeView)return tall?88:68;
    if(rig.camMode&&rig.selfie)return tall?80:70;
    if(rig.camMode)return (tall?72:64)*rig.zoom;
    return tall?72:64;
  };

  // ---- pointer: drag = look, pinch / wheel = distance (or zoom in camera mode) ----
  const drags=new Map();let pinch=0;
  const grip=()=>{const [a,b]=drags.values();return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;};
  canvas.addEventListener('pointerdown',e=>{
    if(blocked()||(e.pointerType==='mouse'&&e.button!==0))return;
    canvas.setPointerCapture(e.pointerId);drags.set(e.pointerId,{x:e.clientX,y:e.clientY});pinch=grip();
  });
  canvas.addEventListener('pointermove',e=>{
    const p=drags.get(e.pointerId);if(!p)return;
    if(e.pointerType==='mouse'&&e.buttons===0){drags.delete(e.pointerId);pinch=0;return;} // the release was lost
    const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
    if(drags.size>=2){
      const d=grip();
      if(pinch){
        const g=d-pinch;
        if(rig.eyeView){}
        else if(rig.camMode&&rig.selfie)rig.sd=clamp(rig.sd-g*.008,.9,4.2);
        else if(rig.camMode)rig.zoom=clamp(rig.zoom-g*.004,.3,1.25);
        else rig.dist=clamp(rig.dist-g*.024,2.5,9);
      }
      pinch=d;return;
    }
    if(rig.eyeView){rig.eyeYaw=wrap(rig.eyeYaw-dx*.0063);rig.eyePitch=clamp(rig.eyePitch-dy*.0044,-.72,.74);}
    else if(rig.camMode&&rig.selfie){rig.sAng=wrap(rig.sAng-dx*.0068);rig.sp=clamp(rig.sp+dy*.003,-.12,.45);}
    else if(rig.camMode){const z=Math.max(.4,rig.zoom);rig.yaw=wrap(rig.yaw-dx*.0063*z);rig.fp=clamp(rig.fp+dy*.0048*z,-1.1,1.25);}
    else{rig.yaw=wrap(rig.yaw-dx*.0063);rig.pitch=clamp(rig.pitch+dy*.0044,-.36,.83);}
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,e=>{drags.delete(e.pointerId);pinch=grip();});
  const release=()=>{drags.clear();pinch=0;};
  addEventListener('blur',release);document.addEventListener('visibilitychange',release);
  canvas.addEventListener('wheel',e=>{
    e.preventDefault();if(blocked()||rig.eyeView)return;
    if(rig.camMode&&rig.selfie)rig.sd=clamp(rig.sd+e.deltaY*.003,.9,4.2);
    else if(rig.camMode)rig.zoom=clamp(rig.zoom+e.deltaY*.001,.3,1.25);
    else rig.dist=clamp(rig.dist+e.deltaY*.005,2.5,9);
  },{passive:false});

  // ---- modes ----
  rig.enterView=v=>{
    rig.eyeView=v;
    const [px,pz]=v.eye??[v.x,v.z],[x,y,z]=v.look;
    rig.eyeYaw=Math.atan2(x-px,pz-z);
    rig.eyePitch=Math.atan2(y-walkHeight(px,pz)-(v.eyeHeight??1.22),Math.hypot(x-px,z-pz));
  };
  rig.leaveView=()=>{rig.eyeView=null;};
  rig.setCamMode=on=>{
    if(!on&&rig.selfie)rig.setSelfie(false);
    rig.camMode=on;if(on){rig.fp=.05;rig.zoom=1;}
  };
  rig.setSelfie=on=>{
    if(on&&!rig.selfie){rig.sAng=-player.rotation.y;rig.sp=.12;}           // start in front of Piyo
    if(!on&&rig.selfie){rig.yaw=wrap(Math.PI-player.rotation.y);cur=1;}  // back behind her
    rig.selfie=on;
  };
  rig.moveYaw=()=>rig.camMode&&rig.selfie?rig.sAng:rig.yaw;  // stick directions follow the camera in use
  rig.reset=()=>{rig.yaw=.23;rig.pitch=.09;rig.dist=4.5;pivot.ok=false;cur=1;hold=0;};

  // ---- per frame ----
  rig.update=(dt,snap=false)=>{
    const p=player.position;
    // Piyo is hidden only when the camera is her own eyes.
    body.visible=!rig.eyeView&&!(rig.camMode&&!rig.selfie);
    if(rig.eyeView){
      const v=rig.eyeView,[x,z]=v.eye??[v.x,v.z];
      camera.position.set(x,walkHeight(x,z)+(v.eyeHeight??1.22),z);
      look.copy(camera.position).add(target.set(Math.sin(rig.eyeYaw),Math.tan(rig.eyePitch),-Math.cos(rig.eyeYaw)));
      camera.lookAt(look);return;
    }
    if(rig.camMode&&!rig.selfie){
      const ey=p.y+1.02,q=rig.fp,cq=Math.cos(q),s=Math.sin(rig.yaw),c=Math.cos(rig.yaw);
      camera.position.set(p.x,ey,p.z);
      camera.lookAt(look.set(p.x+s*cq,ey-Math.sin(q),p.z-c*cq));
      pivot.ok=false;return;
    }
    if(rig.camMode&&rig.selfie){
      const a=rig.sAng,sa=-Math.sin(a),ca=Math.cos(a),y0=p.y+.78+rig.sp*2.2;
      let sd=rig.sd;
      for(;sd>.9;sd-=.15)if(!isBlocked(p.x+sa*sd,Math.max(y0,groundHeight(p.x+sa*sd,p.z+ca*sd)+.45),p.z+ca*sd))break;
      const x=p.x+sa*sd,z=p.z+ca*sd;
      camera.position.set(x,Math.max(groundHeight(x,z)+.45,y0),z);
      camera.lookAt(p.x,p.y+.66,p.z);
      pivot.ok=false;return;
    }
    // follow: the pivot trails Piyo a little (it catches up at once after a jump of more than 4 m)
    if(!pivot.ok||Math.hypot(p.x-pivot.x,p.z-pivot.z)>4||snap){pivot.x=p.x;pivot.y=p.y;pivot.z=p.z;pivot.ok=true;snap=true;}
    const kf=Math.min(1,dt*10);
    pivot.x+=(p.x-pivot.x)*kf;pivot.z+=(p.z-pivot.z)*kf;
    pivot.y+=(p.y-pivot.y)*Math.min(1,dt*(p.y>pivot.y?7:5));
    const s=Math.sin(rig.yaw),c=Math.cos(rig.yaw),d=rig.dist;
    const h=2.12+rig.pitch*d;
    target.set(pivot.x+s*2.7,pivot.y+2.98-rig.pitch*3.35,pivot.z-c*2.7);
    desired.set(pivot.x-s*d,pivot.y+h,pivot.z+c*d);
    head.set(pivot.x,pivot.y+1.65,pivot.z);
    // How far out the camera may go before walls, buildings or banks get in the way.
    let free=1;
    for(let t=.1;t<=1.01;t+=.075){
      probe.copy(head).lerp(desired,t);
      if(isBlocked(probe.x,probe.y,probe.z)){free=Math.max(.16,t-.095);break;}
    }
    // In at once; out again only after a short wait, and slowly (no pumping past every pillar and corner).
    let jump=snap;
    if(free<cur-.01){cur=free;hold=.6;jump=true;}
    else if(hold>0)hold-=dt;
    else cur+=(free-cur)*Math.min(1,dt*1.1);
    desired.lerpVectors(head,desired,cur);
    const alpha=jump?1:1-Math.exp(-dt*22);
    camera.position.lerp(desired,alpha);
    look.lerp(target,alpha);
    camera.lookAt(look);
  };
  return rig;
}
