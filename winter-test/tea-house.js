import * as T from 'three';
import { entranceFor, groundHeight, mix } from './layout.js';
import { combineStaticMeshes, meshGrid, roofTileGeometry } from './letter-house.js';

const tau=Math.PI*2;
const matte=(color,options)=>new T.MeshLambertMaterial({color,...options});

function handPaintedTexture(width,height,paint){
  const canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=height;paint(canvas.getContext('2d'),width,height);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  return texture;
}

function outline(points,shape=new T.Shape()){
  for(const [i,[x,y]] of points.entries()){
    if(i===0)shape.moveTo(x,y);
    else shape.lineTo(x,y);
  }
  shape.closePath();
  return shape;
}

function curvedOpening(w,h,shoulder=.76){
  const s=new T.Shape();
  const r=w/2;
  s.moveTo(-r,0);s.lineTo(r,0);s.lineTo(r,h*shoulder);
  s.bezierCurveTo(r,h*.98,.20*w,h,0,h);
  s.bezierCurveTo(-.20*w,h,-r,h*.98,-r,h*shoulder);
  s.closePath();
  return s;
}

function openingSurround(opening,width,height,margin,depth){
  const profile=opening.getPoints(14);
  const middle=height*.48;
  const ring=outline(profile.map(({x,y})=>[x*(1+2*margin/width),middle+(y-middle)*(1+2*margin/height)]));
  const hole=new T.Path(profile);
  hole.closePath();ring.holes.push(hole);
  return new T.ExtrudeGeometry(ring,{depth,bevelEnabled:true,bevelSize:.009,bevelThickness:.009,bevelSegments:1});
}

export function buildTeaHouse(h,scene,winter,tex,roses){
  const house=new T.Group(),snow=new T.Group(),y=groundHeight(h.x,h.z);
  house.name='Tree square tea house';
  for(const parent of [house,snow]){
    parent.position.set(h.x,y,h.z);parent.rotation.y=h.yaw;
  }
  scene.add(house);winter.add(snow);

  const oak=matte(0x6d4835,{map:tex.wood}), edgeWood=matte(0x9b7450,{map:tex.wood});
  const green=matte(0x476c52,{map:tex.wood}), mortar=matte(0x8f7662,{map:tex.plaster});
  const plaster=matte(0xf2d8b9,{map:tex.plaster,side:T.DoubleSide});
  const clay=matte(0x934936,{map:tex.tile,side:T.DoubleSide});
  const bronze=matte(0xb29058), kettle=matte(0x517d70), ivory=matte(0xf4d9b0);
  const iron=matte(0x594034);
  const light=new T.MeshBasicMaterial({color:0xffca7a});
  const glass=new T.MeshBasicMaterial({color:0xffdc9c,map:tex.glass});
  const shopBack=new T.MeshBasicMaterial({map:handPaintedTexture(128,128,(g,w,h)=>{
    const gradient=g.createRadialGradient(w*.53,h*.46,0,w*.53,h*.46,w*.66);
    gradient.addColorStop(0,'#efb466');gradient.addColorStop(.64,'#be743c');gradient.addColorStop(1,'#825036');
    g.fillStyle=gradient;g.fillRect(0,0,w,h);
    g.fillStyle='#78412c35';for(let row=8;row<h;row+=13)g.fillRect(0,row,w,1);
  })});
  const white=matte(0xf1f0e9,{side:T.DoubleSide});
  const stone=[0xb7a28e,0xc6b39b,0xaa9587,0xd8c4a8].map(c=>matte(c,{map:tex.plaster}));
  const terracotta=matte(0xa86d53);
  const leaves=[0x375648,0x567251].map(c=>matte(c));
  const wreathRed=matte(0xb96262);
  const cube=new T.BoxGeometry(),sphere=new T.SphereGeometry(.5,12,8);
  const zFront=h.d/2,eave=h.h-.13,half=h.w/2,roofWidth=h.w+.58;
  let seed=6179;
  const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const place=(geo,material,x,y,z,w=1,h=1,d=1,yaw=0,roll=0,target=house)=>{
    const m=new T.Mesh(geo,material);m.position.set(x,y,z);m.rotation.set(0,yaw,roll,'YXZ');
    m.scale.set(w,h,d);target.add(m);return m;
  };
  const box=(mat,x,y,z,w,h,d,yaw=0,roll=0)=>place(cube,mat,x,y,z,w,h,d,yaw,roll);
  const pipe=(points,radius,mat,target=house)=>{
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
    place(new T.TubeGeometry(curve,Math.max(7,points.length*2),radius,6,false),mat,0,0,0,1,1,1,0,0,target);
  };
  function masonryArch(shape,x,y,angle,depth,width,height){
    const curve=shape.getPoints(20).filter(p=>p.y>=height*.755).sort((a,b)=>a.x-b.x);
    for(let i=1;i<curve.length;i++){
      const a=curve[i-1],b=curve[i];
      if(b.x-a.x<width*.044)continue;
      const inner=p=>[p.x*1.06,p.y+.012],outer=p=>[p.x*1.26,p.y+.093];
      const brick=new T.ExtrudeGeometry(outline([inner(a),inner(b),outer(b),outer(a)]),
        {depth:.056,bevelEnabled:true,bevelSize:.012,bevelThickness:.010,bevelSegments:1});
      place(brick,stone[i%stone.length],x*Math.cos(angle)+depth*Math.sin(angle),y,
        depth*Math.cos(angle)-x*Math.sin(angle),1,1,1,angle);
    }
  }
  const stoneShape=outline([[-.43,-.35],[.32,-.40],[.43,-.23],[.38,.37],[-.30,.39],[-.44,.18]]);
  const stoneBlock=new T.ExtrudeGeometry(stoneShape,{depth:.77,bevelSize:.06,bevelThickness:.08,bevelSegments:1}).translate(0,0,-.385);

  function wall(width,angle,offset,openings,gable=false){
    const top=gable?[[width*.48,eave],[width*.24,eave+.76],[.05,eave+1.60],[-width*.24,eave+.77],[-width*.48,eave]]:
      [[width*.48,eave+.04],[.64,eave-.02],[-width*.49,eave+.07]];
    const wallShape=outline([[-width*.5,-.36],[width*.5,-.36],[width*.5,eave-.81],...top,[-width*.5,eave-.81]]);
    for(const {x,y,shape} of openings){
      const cut=new T.Path(shape.getPoints(11).map(p=>new T.Vector2(x+p.x,y+p.y)));
      cut.closePath();wallShape.holes.push(cut);
    }
    const geo=new T.ExtrudeGeometry(wallShape,{depth:.23,bevelEnabled:true,bevelSize:.026,bevelThickness:.018,bevelSegments:1,curveSegments:9});
    const p=geo.getAttribute('position'),uv=geo.getAttribute('uv');
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i);
      p.setZ(i,p.getZ(i)+.018*Math.sin(x*5.4+y*2.1)+.021*Math.cos(y*3.9-x*1.5));
      uv.setXY(i,x*.49,y*.48);
    }
    geo.computeVertexNormals();place(geo,plaster,offset*Math.sin(angle),0,offset*Math.cos(angle),1,1,1,angle);
  }

  const approach=entranceFor(h);
  const entry={x:approach.x,y:approach.threshold,w:1.025,h:1.93};
  entry.shape=curvedOpening(entry.w,entry.h,.79);
  const bay={x:1.55,y:.91,shape:curvedOpening(1.45,1.42,.90)};
  const sashes=[
    {x:-1.63,y:1.10,w:.77,h:1.06,a:0,d:zFront-.225},
    {x:-1.29,y:2.90,w:.98,h:.92,a:0,d:zFront-.225},
    {x:bay.x,y:2.94,w:.96,h:.87,a:0,d:zFront-.225},
    {x:-.29,y:1.20,w:.80,h:1.04,a:Math.PI/2,d:half-.225},
    {x:.36,y:2.78,w:.84,h:1.00,a:Math.PI/2,d:half-.225},
    {x:-.03,y:4.36,w:.52,h:.65,a:Math.PI/2,d:half-.225},
    {x:-.21,y:2.67,w:.88,h:1.08,a:-Math.PI/2,d:half-.225},
    {x:.95,y:2.62,w:.81,h:.91,a:Math.PI,d:zFront-.225}
  ].map(b=>({...b,shape:curvedOpening(b.w,b.h)}));
  wall(h.w,0,zFront-.225,[entry,bay,...sashes.filter(s=>s.a===0)]);
  wall(h.w,Math.PI,zFront-.225,sashes.filter(s=>s.a===Math.PI));
  for(const a of [-Math.PI/2,Math.PI/2])wall(h.d,a,half-.225,sashes.filter(s=>s.a===a),true);

  for(const {x,y,w,h,a,d,shape} of sashes){
    const c=Math.cos(a),s=Math.sin(a);
    const point=(u,v,depth)=>[u*c+depth*s,v,depth*c-u*s];
    const pane=new T.ShapeGeometry(shape,10),uv=pane.getAttribute('uv'),p=pane.getAttribute('position');
    for(let i=0;i<uv.count;i++)uv.setXY(i,.5+p.getX(i)/w,p.getY(i)/h);
    place(pane,glass,...point(x,y,d+.053),1,1,1,a);
    masonryArch(shape,x,y,a,d+.214,w,h);
    // The front of the trim clears the small irregularities in the plaster.
    place(openingSurround(shape,w,h,.042,.068),edgeWood,...point(x,y,d+.254),1,1,1,a);
    box(oak,...point(x,y+h*.54,d+.124),w,.029,.081,a);
    box(oak,...point(x,y+h*.494,d+.126),.024,h*.988,.084,a);
    box(stone[1],...point(x,y-.117,d+.24),w+.19,.142,.29,a);
    if(y<2.5)continue;
    for(const side of [-1,1]){
      const hingeX=side*w/2;
      const top=shape.getPoints(12).filter(p=>p.y>=h*.75&&side*p.x>=-1e-5)
        .sort((p,q)=>side*(p.x-q.x));
      const shutter=outline([[0,0],[-hingeX,0],...top.map(p=>[p.x-hingeX,p.y])]);
      const panel=new T.ExtrudeGeometry(shutter,{depth:.047,bevelEnabled:true,bevelSize:.012,bevelThickness:.009,bevelSegments:1});
      panel.translate(0,0,-.024);
      const angle=a+Math.PI-side*.13;
      const [hx,hy,hz]=point(x+side*(w*.5+.050),y,d+.286);
      const onShutter=(u,v,n)=>[hx+u*Math.cos(angle)+n*Math.sin(angle),hy+v,hz-u*Math.sin(angle)+n*Math.cos(angle)];
      place(panel,green,hx,hy,hz,1,1,1,angle);
      for(const t of [.18,.67]){
        box(edgeWood,...onShutter(-hingeX*.5,h*t,-.036),w*.44,.038,.029,angle);
        place(sphere,bronze,...onShutter(-hingeX*.14,h*t,-.056),.028,.028,.016,angle);
        place(sphere,bronze,...onShutter(-hingeX*.84,h*t,-.056),.024,.024,.016,angle);
      }
      for(const t of [1/3,2/3]){
        const xx=-hingeX*t,height=h*(.725+.167*t);
        box(iron,...onShutter(xx,height*.5,-.028),.009,height,.011,angle);
      }
    }
  }

  // Timber is visibly separate from the plaster, with a thin shadow at the joints.
  for(const side of [-1,1]){
    const x=side*(half-.12);
    pipe([[x,.48,zFront+.032],[x-side*.064,1.75,zFront+.079],[x-side*.07,eave-.04,zFront+.057]],.076,oak);
  }
  const leftCorner=[-half-.039,2.51,zFront+.057];
  const rightCorner=[half+.042,2.50,zFront+.051];
  pipe([leftCorner,[-1.08,2.53,zFront+.075],[.64,2.48,zFront+.073],rightCorner],.077,oak);
  pipe([leftCorner,[-half-.058,2.428,zFront*.67],[-half-.065,2.411,-.06],
    [-half-.055,2.416,-zFront*.65],[-half-.042,2.429,-zFront+.012]],.067,oak);
  pipe([rightCorner,[half+.056,2.49,zFront*.61],[half+.063,2.476,-.035],
    [half+.053,2.48,-zFront*.62],[half+.041,2.494,-zFront+.012]],.067,oak);
  const wallFootingDepth=Math.min(y-.48,groundHeight(h.x+.9,h.z-1.2)-.34)-y;
  const jambClearance=entry.w/2+.167;
  for(const [a,length,d] of [[0,h.w,zFront],[Math.PI,h.w,zFront],[-Math.PI/2,h.d,half],[Math.PI/2,h.d,half]]){
    const c=Math.cos(a),s=Math.sin(a),n=Math.ceil(length/.62);
    if(a===0){
      for(const [lo,hi] of [[-length/2,entry.x-jambClearance],[entry.x+jambClearance,length/2]]){
        box(mortar,(lo+hi)*.5,(wallFootingDepth+.38)*.5,d,hi-lo,.42-wallFootingDepth,.135);
      }
      box(mortar,entry.x,(wallFootingDepth+.28)*.5,d-.025,jambClearance*2,.28-wallFootingDepth,.14);
    }else{
      box(mortar,d*s,(wallFootingDepth+.38)*.5,d*c,length+.04,.42-wallFootingDepth,.135,a);
    }
    for(let row=-2;row<3;row++)for(let k=0;k<=n;k++){
      const shift=Math.abs(row%2)*.48;
      const u=Math.max(0,(k-shift)/n),v=Math.min(1,(k+1-shift)/n);
      let lo=(u-.5)*length,hi=(v-.5)*length;
      if(a===0&&row>=0&&hi>entry.x-jambClearance&&lo<entry.x+jambClearance){
        if((lo+hi)*.5<entry.x)hi=entry.x-jambClearance;
        else lo=entry.x+jambClearance;
      }
      if(hi-lo<.075)continue;
      const xx=(lo+hi)*.5,depth=d+.058;
      place(stoneBlock,stone[(k+row+4)%4],xx*c+depth*s,.04+row*.174+(random()-.5)*.03,
        -xx*s+depth*c,hi-lo,.207,.237,a,(random()-.5)*.061);
    }
  }

  const door=new T.ExtrudeGeometry(entry.shape,{depth:.074,bevelEnabled:true,bevelSize:.014,bevelThickness:.014,bevelSegments:1});
  place(door,green,entry.x,entry.y,zFront-.08);
  place(openingSurround(entry.shape,entry.w,entry.h,.092,.097),oak,entry.x,entry.y,zFront+.024);
  const fanlight=curvedOpening(.69,.29,.26);
  const fan=new T.ShapeGeometry(fanlight,12),fanUV=fan.getAttribute('uv'),fanPoints=fan.getAttribute('position');
  for(let i=0;i<fanUV.count;i++)fanUV.setXY(i,.5+fanPoints.getX(i)/.69,fanPoints.getY(i)/.29);
  place(fan,glass,entry.x,1.898,zFront+.024);
  place(openingSurround(fanlight,.69,.29,.022,.024),green,entry.x,1.898,zFront+.027);
  box(oak,entry.x,2.042,zFront+.047,.018,.283,.025);
  box(oak,entry.x,2.009,zFront+.047,.592,.017,.025);
  for(let i=-2;i<=2;i++){
    const yy=1.532;
    box(edgeWood,entry.x+i*.167,entry.y+yy*.50,zFront+.009,.017,yy,.021);
  }
  place(sphere,bronze,entry.x+.355,1.24,zFront+.056,.091,.086,.092);
  box(bronze,entry.x+.355,1.17,zFront+.010,.086,.249,.032);
  for(const [i,{near,far,top,bottom,width}] of approach.steps.entries()){
    box(stone[i===0?2:1],entry.x,(top+bottom)/2-y,(near+far)/2,width,top-bottom,far-near);
  }

  function roof(side,u,v){
    const x=(v-.5)*roofWidth;
    return [x+.032*Math.sin(u*Math.PI)*Math.sin(v*5),
      eave+1.69*(1-u)-.134*Math.sin(u*Math.PI)+.042*Math.sin(v*tau+.4)*(.72+u*.25),
      side*(zFront+.43)*u-.043*(1-u)+.033*Math.cos(v*tau*.68)];
  }
  const rc=8,cc=20,tiles=new T.InstancedMesh(roofTileGeometry(3,4),matte(0xffffff,{side:T.DoubleSide}),2*rc*cc);
  const tints=[0xa55846,0xb36951,0xac614c,0xb97154,0xb86a50].map(c=>new T.Color(c));
  const model=new T.Object3D(),basis=new T.Matrix4();
  let index=0;
  for(const side of [-1,1]){
    place(meshGrid(16,14,(u,v)=>roof(side,u,v)),clay,0,0,0);
    for(let row=0;row<rc;row++)for(let col=0;col<cc;col++){
      const u=(row+.51)/rc,v=(col+.50+(row%2?.16:-.07))/cc;
      const p=new T.Vector3(...roof(side,u,v)),down=new T.Vector3(...roof(side,u+.01,v)).sub(p).normalize();
      const along=new T.Vector3(...roof(side,u,v+.01)).sub(p).normalize();
      const up=new T.Vector3().crossVectors(down,along).normalize();
      if(up.y<0)up.negate();
      along.crossVectors(up,down).normalize();
      model.position.copy(p).addScaledVector(up,.026);
      model.quaternion.setFromRotationMatrix(basis.makeBasis(along,up,down));
      model.scale.set(roofWidth/cc*1.06,.81,Math.hypot(zFront+.43,1.69)/rc*1.10);
      model.updateMatrix();tiles.setMatrixAt(index,model.matrix);tiles.setColorAt(index++,tints[Math.floor(random()*tints.length)]);
    }
    const rail=Array.from({length:15},(_,i)=>{const [x,y,z]=roof(side,1,i/14);return [x,y-.075,z];});
    pipe(rail,.076,oak);pipe(rail.map(([x,y,z])=>[x,y+.073,z]),.043,edgeWood);
    for(const end of [0,1]){
      const sideRail=Array.from({length:10},(_,i)=>{const [x,y,z]=roof(side,i/9,end);return [x,y-.055,z];});
      pipe(sideRail,.079,oak);pipe(sideRail.map(([x,y,z])=>[x,y+.071,z]),.039,edgeWood);
    }
    for(let i=1;i<11;i++){
      const [x,y,z]=roof(side,.96,i/11);box(edgeWood,x,y-.160,z,.104,.094,.31,0,.032*Math.cos(i));
    }
    const snowEdge=v=>{
      const taper=Math.min(1,v*9,(1-v)*8);
      return .61*taper+.055*Math.sin(v*31)*taper+.025*Math.cos(v*74)*taper;
    };
    const snowPoint=(u,v)=>{
      const t=mix(.032,.967,v),[x,y,z]=roof(side,u*snowEdge(v),t);
      const drift=.011*Math.sin(t*47+u*13)+.009*Math.cos(t*79-u*7);
      return [x,y+.197+.042*(1-u)*Math.sin(v*Math.PI)+drift,z];
    };
    place(meshGrid(35,13,snowPoint),white,0,0,0,1,1,1,0,0,snow);
    const driftLip=meshGrid(37,3,(u,v)=>{
      const [x,y,z]=snowPoint(1,v);
      return [x,y-u*.139,z-side*.019*Math.sin(u*Math.PI)];
    });
    place(driftLip,white,0,0,0,1,1,1,0,0,snow);
  }
  tiles.computeBoundingSphere();house.add(tiles);
  const ridge=new T.CylinderGeometry(.094,.105,.33,9).rotateZ(Math.PI/2);
  for(let i=0;i<19;i++){
    const [x,y,z]=roof(1,0,(i+.5)/19);
    place(ridge,clay,x,y+.068,z,1.08,1,1);
  }
  const chimX=-1.61,chimZ=-.47;
  box(stone[2],chimX,5.65,chimZ,.56,1.63,.61);
  for(let i=0;i<6;i++)for(const side of [-1,1]){
    place(stoneBlock,stone[(i+(side+1))%4],chimX+side*.135+(i%2?.034:-.026),5.45+i*.166,chimZ+.314,.287,.174,.09);
  }
  box(oak,chimX,6.52,chimZ,.69,.14,.74);
  place(cube,white,chimX,6.612,chimZ,.67,.065,.70,0,.026,snow);

  // Glazing is backed by a lit display with real shelves and crockery in the bay.
  const bayLeft=.69,bayRight=2.43,bayCenter=1.56;
  const cheeks=[[bayLeft,zFront-.042],[.91,zFront+.48],[2.19,zFront+.47],[bayRight,zFront-.032]];
  const baySill=outline([...[...cheeks].reverse(),[bayLeft-.035,zFront-.15],[bayRight+.035,zFront-.15]]);
  const sill=new T.ExtrudeGeometry(baySill,{depth:.10,bevelEnabled:true,bevelThickness:.023,bevelSize:.027,bevelSegments:1}).rotateX(Math.PI/2);
  const baseProfile=outline([...[...cheeks].reverse().map(([x,z])=>[bayCenter+(x-bayCenter)*1.082,z+.071]),
    [bayLeft-.072,zFront-.157],[bayRight+.071,zFront-.157]]);
  const platform=new T.ExtrudeGeometry(baseProfile,{depth:.168,bevelEnabled:true,bevelThickness:.025,bevelSize:.039,bevelSegments:1}).rotateX(Math.PI/2);
  const displayBottom=.996,displayTop=2.315;
  const displayCenter=(displayBottom+displayTop)*.5,displayHeight=displayTop-displayBottom;
  place(platform,stone[1],0,displayBottom-.026,0);
  place(sill,oak,0,displayTop+.018,0,1,.65,1);
  for(const x of [1.03,2.08]){
    pipe([[x,.690,zFront+.035],[x,.755,zFront+.175],[x,.827,zFront+.40]],.046,oak);
  }
  box(shopBack,bayCenter,1.68,zFront-.14,1.72,1.57,.03);
  box(edgeWood,bayCenter,1.17,zFront+.105,1.32,.067,.44);
  box(edgeWood,bayCenter,1.55,zFront+.087,1.27,.056,.32);
  const faintGlass=new T.MeshBasicMaterial({color:0xffce86,transparent:true,opacity:.075,depthWrite:false,side:T.DoubleSide});
  for(let i=1;i<cheeks.length;i++){
    const [x0,z0]=cheeks[i-1],[x1,z1]=cheeks[i],dx=x1-x0,dz=z1-z0;
    const yaw=Math.atan2(-dz,dx),width=Math.hypot(dx,dz),x=(x0+x1)*.5,z=(z0+z1)*.5;
    const skin=place(new T.PlaneGeometry(width,displayHeight),faintGlass,x,displayCenter,z,1,1,1,yaw);
    skin.renderOrder=1;
    if(i===2)box(oak,x,1.61,z,width,.036,.052,yaw);
    box(edgeWood,x0,displayCenter,z0,.078,displayHeight+.020,.087,yaw);
  }
  box(edgeWood,bayRight,displayCenter,cheeks.at(-1)[1],.078,displayHeight+.020,.087);
  box(edgeWood,bayCenter,displayCenter,zFront+.49,.033,displayHeight+.030,.066);
  const potBody=new T.SphereGeometry(.5,12,8);
  const cupBody=new T.LatheGeometry([[0,0],[.38,0],[.50,.80],[.48,1],[.41,1],[.38,.19],[0,.16]].map(p=>new T.Vector2(...p)),12);
  const loop=new T.TorusGeometry(.5,.087,5,14);
  function teaPot(x,y,z,scale,material){
    place(potBody,material,x,y,z,.38*scale,.286*scale,.36*scale);
    place(potBody,material,x,y+.148*scale,z,.26*scale,.070*scale,.25*scale);
    place(potBody,bronze,x,y+.198*scale,z,.077*scale,.057*scale,.075*scale);
    place(loop,material,x-.20*scale,y+.03*scale,z,.235*scale,.232*scale,.26*scale);
    pipe([[x+.12*scale,y-.02,z],[x+.253*scale,y+.047*scale,z],[x+.283*scale,y+.148*scale,z]],.042*scale,material);
  }
  teaPot(1.53,1.348,zFront+.20,1,kettle);
  teaPot(1.24,1.681,zFront+.12,.70,ivory);
  teaPot(1.77,1.674,zFront+.13,.65,ivory);
  for(const [i,[x,y,z]] of [[1.06,1.204,.23],[1.99,1.204,.21],[1.48,1.579,.14],[1.99,1.579,.15]].entries()){
    const w=.142+.012*(i%2),mat=i===2?kettle:ivory;
    place(cupBody,mat,x,y,zFront+z,w,.115,w);
    place(loop,mat,x+w*.53,y+.060,zFront+z,.068,.068,.081);
    place(potBody,ivory,x,y-.002,zFront+z,w*1.30,.026,w*1.30);
  }

  const lace=handPaintedTexture(192,48,(g,w,h)=>{
    const repeat=24;
    g.fillStyle='#f9dfad';
    for(let x=0;x<w;x+=repeat){
      const center=x+repeat/2;
      g.fillRect(x,0,repeat,h*.59);
      g.beginPath();g.ellipse(center,h*.57,repeat*.5,h*.38,0,0,tau);g.fill();
    }
    g.globalCompositeOperation='destination-out';
    for(let x=0;x<w;x+=repeat)for(let row=0;row<4;row++)for(let col=0;col<4;col++){
      const px=x+4+col*5,py=10+row*7+(col%2)*2;
      if(row===3&&(col===0||col===3))continue;
      g.beginPath();g.ellipse(px,py,1.22+(row%2)*.53,1.85,0,0,tau);g.fill();
    }
  });
  const curtain=meshGrid(5,30,(u,v)=>[mix(.94,2.16,u),displayTop-.278*v,zFront+.406+.022*Math.sin(u*tau*10)]);
  const curveUV=curtain.getAttribute('uv');
  for(let i=0;i<curveUV.count;i++)curveUV.setXY(i,curveUV.getX(i)*.5,1-curveUV.getY(i)*.5);
  place(curtain,new T.MeshBasicMaterial({map:lace,alphaTest:.45,side:T.DoubleSide}),0,0,0);

  // Stitched green canvas bends over the timber support and ends in a scalloped hem.
  const canvas=handPaintedTexture(216,192,(g,w,h)=>{
    g.fillStyle='#476f5e';g.fillRect(0,0,w,h);
    for(let i=0;i<8;i++){
      g.fillStyle=i%2?'#5a7c68':'#4b735f';g.fillRect(i*w/8,0,w/8,h);
      g.fillStyle='#c1a279';g.fillRect(i*w/8+2,0,3,h);
      g.fillStyle='#ead4ac80';g.fillRect(i*w/8+3,0,1,h);
    }
    g.fillStyle='#e4c8a310';
    for(let y=1;y<h;y+=3)g.fillRect(0,y,w,1);
  });
  const cloth=matte(0xffffff,{map:canvas,side:T.DoubleSide});
  const hood=(u,v)=>[mix(.51,2.57,u),2.70-.30*v-.044*Math.sin(v*Math.PI)+.018*Math.sin(u*Math.PI)+.005*Math.cos(u*tau*8),zFront+.017+.765*v];
  const hem=(u,v)=>{const [x,y,z]=hood(u,1);return [x,y-v*(.079+.033*Math.abs(Math.sin(u*Math.PI*8))),z+.010*v];};
  for(const mesh of [meshGrid(9,56,hood),meshGrid(5,72,hem)]){
    const uv=mesh.getAttribute('uv');
    for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*.5,uv.getY(i)*.5);
    place(mesh,cloth,0,0,0);
  }
  for(const x of [.63,2.44])pipe([[x,2.12,zFront+.044],[x,2.20,zFront+.219],[x,2.30,zFront+.47]],.025,oak);

  // The teapot sign and door lantern are visible from the bridge.
  const board=new T.CylinderGeometry(.418,.40,.083,24).rotateX(Math.PI/2);
  const sign=new T.Group();
  const signMountX=-2.32;
  const bracketPoint=(y,outward)=>[signMountX-outward*.235,y,zFront+outward];
  const hang=.758;
  sign.position.set(...bracketPoint(2.62,hang));sign.rotation.y=.68;house.add(sign);
  function ironCurl(y,outward,r,start,turns){
    return Array.from({length:25},(_,i)=>{
      const t=i/24,a=start+t*tau*turns,k=r*(1-.83*t);
      return bracketPoint(y+Math.sin(a)*k,outward+Math.cos(a)*k);
    });
  }
  const outerCurl=ironCurl(3.401,.763,.153,-Math.PI*.82,-1.10);
  const wallCurl=ironCurl(3.405,.167,.086,-Math.PI*.39,.97);
  const lowerCurl=ironCurl(3.079,.326,.082,Math.PI*.55,-.94);
  pipe([bracketPoint(3.323,.047),bracketPoint(3.244,.235),bracketPoint(3.230,.412),
    bracketPoint(3.286,.531),...outerCurl],.021,iron);
  pipe([bracketPoint(3.159,.048),bracketPoint(3.159,.291),bracketPoint(3.156,.590),
    bracketPoint(3.151,.874),bracketPoint(3.177,.913)],.022,iron);
  pipe([bracketPoint(3.253,.105),...wallCurl],.016,iron);
  pipe([bracketPoint(3.157,.183),...lowerCurl],.015,iron);
  box(iron,signMountX,3.260,zFront+.061,.083,.470,.083);
  for(const yy of [3.068,3.450])place(sphere,bronze,signMountX,yy,zFront+.112,.045,.042,.027);
  pipe([bracketPoint(3.153,hang),bracketPoint(3.123,hang),bracketPoint(3.101,hang)],.015,iron);
  const link=new T.TorusGeometry(.043,.009,5,14);
  place(link,bronze,...bracketPoint(3.067,hang),1,1,1,.68);
  place(board,oak,0,0,0,1,1,1,0,0,sign);
  const border=new T.TorusGeometry(.369,.017,6,30);
  for(const side of [-1,1]){
    const face=new T.Group();
    face.position.z=side*.046;face.rotation.y=side===1?0:Math.PI;sign.add(face);
    place(border,bronze,0,0,.004,1,1,1,0,0,face);
    place(potBody,ivory,-.008,-.015,.035,.307,.235,.098,0,0,face);
    place(potBody,ivory,-.010,.104,.043,.231,.060,.080,0,0,face);
    place(potBody,ivory,-.011,.149,.046,.048,.041,.043,0,0,face);
    place(loop,ivory,.157,-.002,.048,.159,.166,.42,0,0,face);
    pipe([[-.107,-.050,.043],[-.168,-.021,.062],[-.205,.021,.066],[-.250,.067,.065]],.026,ivory,face);
    place(potBody,ivory,-.248,.067,.067,.062,.044,.043,0,.17,face);
    combineStaticMeshes(face);
  }
  combineStaticMeshes(sign);

  const lanternCap=new T.LatheGeometry([[0,0],[.151,0],[.151,.022],[.122,.037],[.102,.081],
    [.057,.107],[.031,.119],[0,.119]].map(p=>new T.Vector2(...p)),12);
  const lanternLamp=new T.CylinderGeometry(.121,.086,.229,4).rotateY(Math.PI/4);
  const lanternFoot=new T.LatheGeometry([[0,-.060],[.030,-.059],[.043,-.034],[.113,-.007],
    [.123,.013],[.108,.034],[0,.034]].map(p=>new T.Vector2(...p)),12);
  const lanternEye=new T.TorusGeometry(.031,.008,5,12);
  const glassCore=new T.MeshBasicMaterial({color:0xffe1a2});
  {
    const x=-.91,y=2.231;
    const z=zFront+.371;
    box(iron,x,y+.263,zFront+.065,.095,.280,.081);
    pipe([[x,y+.385,zFront+.071],[x,y+.431,zFront+.172],[x,y+.409,zFront+.326],[x,y+.312,z]],.018,iron);
    place(lanternEye,iron,x,y+.284,z);
    place(lanternCap,bronze,x,y+.131,z);
    place(lanternFoot,bronze,x,y-.126,z);
    place(lanternLamp,light,x,y,z);
    place(sphere,glassCore,x,y+.003,z+.071,.078,.116,.043);
    place(sphere,bronze,x,y+.250,z,.048,.045,.044);
    for(const [u,v] of [[-1,-1],[1,-1],[-1,1],[1,1]]){
      pipe([[x+u*.063,y-.114,z+v*.063],
        [x+u*.074,y+.026,z+v*.074],
        [x+u*.089,y+.132,z+v*.089]],.0105,iron);
    }
  }
  const wreath=new T.TorusGeometry(.224,.039,6,22);
  const wreathY=1.61,wreathZ=zFront+.038;
  place(wreath,leaves[0],entry.x,wreathY,wreathZ,1,1,.84,0,0,snow);
  for(let i=0;i<19;i++){
    const a=i*tau/19,r=.22;
    place(sphere,leaves[i%2],entry.x+Math.cos(a)*r,wreathY+Math.sin(a)*r,wreathZ+.021,
      .12,.088,.08,0,a,snow);
    if(i%4===0)place(sphere,wreathRed,entry.x+Math.cos(a)*r,wreathY+Math.sin(a)*r,wreathZ+.068,.055,.053,.049,0,0,snow);
  }
  for(const side of [-1,1]){
    place(sphere,wreathRed,entry.x+side*.058,wreathY-.21,wreathZ+.044,.131,.082,.053,0,side*.32,snow);
    place(cube,wreathRed,entry.x+side*.061,wreathY-.322,wreathZ+.058,.049,.233,.026,0,side*.16,snow);
  }

  const ivyColors=[0x476650,0x60804d,0x718853,0x889759].map(c=>matte(c,{side:T.DoubleSide}));
  const ivyLeaf=new T.ShapeGeometry(outline([[0,0],[-.21,.19],[-.38,.38],[-.27,.53],[-.49,.69],
    [-.22,.78],[0,1],[.17,.78],[.45,.72],[.25,.51],[.37,.39],[.22,.20]]));
  const twig=matte(0x715d45);
  function ivy(points,side=false){
    pipe(points,.019,twig);
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
    const count=Math.round(curve.getLength()*11);
    for(let i=1;i<count;i++){
      const t=i/count,p=curve.getPoint(t),a=(i%2?1:-1),len=.116+random()*.15;
      const angle=side?Math.PI/2:0;
      const leafX=p.x+(side?.019:a*len*.42),leafZ=p.z+(side?a*len*.42:.041);
      place(ivyLeaf,ivyColors[i%4],leafX,p.y,leafZ,len,len,.07,angle,a*(.57+random()*.61));
      if(i%5===0)place(ivyLeaf,ivyColors[(i+1)%4],p.x,p.y+.02,p.z,len*.82,len*.82,.05,angle,a*-.87);
    }
  }
  const cornerIvy=points=>ivy(points.map(([x,y,z])=>[half+x-2.80,y,z]));
  cornerIvy([[2.60,.61,zFront+.106],[2.54,1.15,zFront+.118],[2.73,2.08,zFront+.101],
    [2.73,2.59,zFront+.088],[2.66,3.22,zFront+.112],[2.47,3.93,zFront+.112]]);
  cornerIvy([[2.64,2.91,zFront+.15],[2.50,3.18,zFront+.142],[2.42,3.34,zFront+.116],[2.38,3.55,zFront+.077]]);
  cornerIvy([[2.61,1.77,zFront+.13],[2.73,2.18,zFront+.171],[2.76,2.64,zFront+.133],[2.60,3.03,zFront+.127]]);
  ivy([[half+.055,.87,1.48],[half+.041,1.52,1.37],[half+.054,2.15,1.46],
    [half+.051,3.01,1.30],[half+.056,3.60,1.45],[half+.054,3.98,.91]],true);
  ivy([[half+.058,1.64,1.40],[half+.073,1.96,1.03],[half+.071,2.26,.84],[half+.050,2.58,1.02]],true);
  ivy([[half+.055,3.21,1.48],[half+.060,3.61,1.63],[half+.051,3.92,1.48]],true);

  function blossoms(x,y,z,w,d,count,facing=0){
    for(let k=0;k<count;k++){
      const a=k*2.39996,r=Math.sqrt((k+.5)/count),px=x+Math.cos(a)*w*.49*r,pz=z+Math.sin(a)*d*.47*r;
      const size=.245+random()*.16;
      place(roses.plants[(k+Math.floor(k/3))%3],roses.material,px,y,pz,size,size,size,facing+(random()-.5)*.86,.15*Math.sin(a));
      if(k%3===1)place(sphere,white,px-.032,y+.022,pz+.045,.13,.049,.091,0,0,snow);
    }
  }
  for(const [x,yy,d,a,w] of [[-1.29,2.798,zFront+.225,0,1.18],[bay.x,2.824,zFront+.225,0,1.10],
    [.36,2.666,half+.30,Math.PI/2,1.06]]){
    const px=x*Math.cos(a)+d*Math.sin(a),pz=d*Math.cos(a)-x*Math.sin(a);
    box(oak,px,yy,pz,w,.196,.34,a);
    box(edgeWood,px+Math.sin(a)*.021,yy+.092,pz+Math.cos(a)*.021,w+.06,.059,.37,a);
    blossoms(px+Math.sin(a)*.035,yy+.120,pz+Math.cos(a)*.035,a===0?w:.24,a===0?.24:w,7,a);
  }
  for(const [j,x] of [-half+.27,half-.25].entries()){
    const z=zFront+.52,base=groundHeight(h.x+Math.cos(h.yaw)*x+Math.sin(h.yaw)*z,h.z-Math.sin(h.yaw)*x+Math.cos(h.yaw)*z)-y;
    const body=j===0?[[0,0],[.169,0],[.252,.40],[.26,.445],[.262,.481],[.224,.481],[.217,.43],[0,.417]]:
      [[0,0],[.205,0],[.256,.120],[.280,.30],[.264,.465],[.257,.506],[.224,.506],[.221,.447],[0,.443]];
    const planter=new T.LatheGeometry(body.map(p=>new T.Vector2(...p)),18);
    place(planter,j===0?terracotta:edgeWood,x,base+.118,z);
    if(j===1){
      for(const [yy,r] of [[.10,.254],[.40,.281]]){
        place(new T.CylinderGeometry(r,r,.069,18,1,true),iron,x,base+.118+yy,z);
      }
      for(let k=0;k<14;k++){
        const a=k*tau/14;
        pipe([[x+Math.sin(a)*.218,base+.15,z+Math.cos(a)*.218],[x+Math.sin(a)*.278,base+.407,z+Math.cos(a)*.278],
          [x+Math.sin(a)*.262,base+.591,z+Math.cos(a)*.262]],.006,oak);
      }
    }
    blossoms(x,base+.585,z,.36,.34,7);
  }

  const chalkMap=handPaintedTexture(112,148,(g,w,h)=>{
    g.fillStyle='#4a3a35';g.fillRect(0,0,w,h);
    g.strokeStyle='#e8c9a8';g.lineWidth=3;g.lineCap='round';
    g.beginPath();g.ellipse(53,54,26,19,0,0,tau);g.stroke();
    g.beginPath();g.ellipse(47,37,13,4,0,0,tau);g.stroke();
    g.beginPath();g.arc(52,30,3,0,tau);g.stroke();
    g.beginPath();g.moveTo(78,49);g.quadraticCurveTo(92,47,93,39);g.stroke();
    g.beginPath();g.arc(25,53,9,Math.PI*.45,Math.PI*1.62);g.stroke();
    g.font='italic 30px serif';g.textAlign='center';g.fillStyle='#f0d7b3';g.fillText('Tea',w/2,h*.79);
    g.beginPath();g.moveTo(30,125);g.quadraticCurveTo(53,132,80,124);g.stroke();
  });
  const boardFront=new T.PlaneGeometry(.47,.65);
  const signboard=place(boardFront,new T.MeshBasicMaterial({map:chalkMap}),-1.91,.562,zFront+.744);
  signboard.rotation.x=-.164;
  for(const x of [-2.175,-1.648]){
    pipe([[x,.167,zFront+.82],[x,.902,zFront+.695],[x,.165,zFront+.43]],.029,edgeWood);
  }
  box(edgeWood,-1.91,.887,zFront+.700,.551,.061,.079);
  box(edgeWood,-1.91,.240,zFront+.798,.551,.067,.089);

  combineStaticMeshes(house);combineStaticMeshes(snow);
}
