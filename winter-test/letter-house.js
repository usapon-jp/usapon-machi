import * as T from 'three';
import {entranceFor,mix} from './layout.js';
import {mergeGeometries} from './vendor/addons/utils/BufferGeometryUtils.js';

const tau=Math.PI*2;
const matte=(color,opt)=>new T.MeshLambertMaterial({color,...opt});
function polygon(points, shape=new T.Shape()){
  points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));
  shape.closePath();
  return shape;
}
function arch(w,h,s=new T.Shape(),base=0){
  const y=base+h*.58,top=base+h;
  s.moveTo(-w/2,base);s.lineTo(w/2,base);s.lineTo(w/2,y);
  s.bezierCurveTo(w/2,base+h*.88,w*.26,top,0,top);
  s.bezierCurveTo(-w*.26,top,-w/2,base+h*.88,-w/2,y);
  s.closePath();
  return s;
}
export function meshGrid(rows,cols,point){
  const p=[],uv=[],idx=[];
  for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
    const u=col/cols,v=row/rows, a=row*(cols+1)+col;
    p.push(...point(u,v));uv.push(u*2,v*2);
    if(row&&col){const b=a-cols-1; idx.push(b-1,b,a-1,b,a,a-1);}
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(p,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
  return g;
}

export function roofTileGeometry(rows=5,cols=6){
  return meshGrid(rows,cols,(u,v)=>[u-.5,.076*Math.cos((u-.5)*Math.PI*1.64)+.035*v*v,v-.5]);
}

export function combineStaticMeshes(group){
  const byMaterial=new Map();
  for(const object of group.children){
    if(!object.isMesh||object.isInstancedMesh)continue;
    const list=byMaterial.get(object.material)??[];
    list.push(object);
    byMaterial.set(object.material,list);
  }
  for(const [material,list] of byMaterial){
    if(list.length<2)continue;
    const pieces=list.map(object=>{
      object.updateMatrix();
      const g=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();
      return g.applyMatrix4(object.matrix);
    });
    const merged=mergeGeometries(pieces);
    if(!merged)continue;
    group.remove(...list);
    group.add(new T.Mesh(merged,material));
    pieces.forEach(geo=>geo.dispose());
  }
}

export function buildLetterHouse(h,groundHeight,scene,winter,tex,roses){
  const house=new T.Group(), snow=new T.Group();
  const entry=entranceFor(h),y=entry.base;
  const cosYaw=Math.cos(h.yaw),sinYaw=Math.sin(h.yaw);
  const localGround=(x,z)=>groundHeight(h.x+x*cosYaw+z*sinYaw,h.z-x*sinYaw+z*cosYaw)-y;
  for(const target of [house,snow]){
    target.position.set(h.x,y,h.z);target.rotation.y=h.yaw;
  }
  scene.add(house);winter.add(snow);
  const wood=matte(0x785440,{map:tex.wood}), woodEdge=matte(0x9f7958,{map:tex.wood});
  const recess=matte(0x67463b), green=matte(0x4d7160,{map:tex.wood});
  const stone=matte(0xc5b199,{map:tex.plaster});
  const plaster=matte(0xffe8c9,{map:tex.plaster,side:T.DoubleSide});
  const clay=matte(0x9f5447,{map:tex.tile,side:T.DoubleSide});
  const glass=new T.MeshBasicMaterial({map:tex.glass,color:0xffe9b8});
  const bright=new T.MeshBasicMaterial({color:0xffd287});
  const brass=matte(0xd0a155);
  const white=matte(0xf1f3f4,{side:T.DoubleSide});
  const boxG=new T.BoxGeometry(), ball=new T.IcosahedronGeometry(.5,1);
  const round=new T.SphereGeometry(.5,14,8);
  const stonePieces=Array.from({length:3},(_,i)=>new T.ExtrudeGeometry(polygon([
    [-.42,-.35],[.35,-.41],[.43,-.20],[.36,.39],[-.36,.40],[-.44,.17]
  ].map(([x,y],j)=>[x+Math.sin(i*6.2+j)*.045,y+Math.cos(i*1.3+j)*.05])),
  {depth:.80,bevelEnabled:true,bevelThickness:.095,bevelSize:.06,bevelSegments:1}).translate(0,0,-.4));
  const place=(geo,mat,x,y0,z,sx=1,sy=1,sz=1,ry=0,rz=0,target=house)=>{
    const m=new T.Mesh(geo,mat);m.position.set(x,y0,z);m.scale.set(sx,sy,sz);m.rotation.set(0,ry,rz,'YXZ');
    target.add(m);return m;
  };
  const box=(mat,x,y0,z,w,h,d,ry=0,rz=0,target=house)=>place(boxG,mat,x,y0,z,w,h,d,ry,rz,target);
  const pipe=(points,radius,mat,target=house)=>{
    const line=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
    return place(new T.TubeGeometry(line,Math.max(7,points.length*2),radius,5,false),mat,0,0,0,1,1,1,0,0,target);
  };
  function carve(wall,shape,x,y0){
    const hole=new T.Path();
    hole.setFromPoints(shape.getPoints(10).map(v=>new T.Vector2(v.x+x,v.y+y0)));
    wall.holes.push(hole);
  }
  const eave=4.02, ze=2.43, xe=2.99;
  function roof(side,u,v){
    const drift=.095*Math.sin(v*tau*.69+.13);
    return [side*(u*(xe-(side===1?.09:0)))+drift+.08,
      eave+2.08*(1-u)-.34*Math.sin(Math.PI*u)+.13*u*u*Math.cos(v*tau)+.067*Math.sin(v*tau*.65),
      (v-.5)*2*ze+(.075*Math.sin(Math.PI*u)*(v<.5?-1:1))];
  }
  function wall(width,height,angle,offset,openings,gabled=false){
    const cy=-.04;
    const top=gabled
      ? [[width*.48,height-.04],[width*.35,height+.59],[width*.22,height+1.15],[.06,height+1.98],
        [-width*.22,height+1.14],[-width*.36,height+.55],[-width*.48,height-.07]]
      : [[width*.49,height+.14],[width*.28,height+.09],[-width*.47,height+.12]];
    const s=polygon([[-width*.49,cy],[width*.49,cy],[width*.50,height-.72],...top,[-width*.5,height-.58]]);
    for(const o of openings)carve(s,o.shape,o.x,o.y);
    const g=new T.ExtrudeGeometry(s,{depth:.235,bevelEnabled:true,bevelSize:.028,bevelThickness:.025,curveSegments:10,bevelSegments:1});
    const xyz=g.getAttribute('position'),uv=g.getAttribute('uv');
    for(let i=0;i<xyz.count;i++){
      const x=xyz.getX(i), y=xyz.getY(i), z=xyz.getZ(i);
      const lift=.026*Math.sin(x*3.8+y*3.0)+.018*Math.cos(x*6.1-y*3.2);
      xyz.setZ(i,z+lift);uv.setXY(i,x*.47,y*.49);
    }
    g.computeVertexNormals();
    place(g,plaster,Math.sin(angle)*offset,0,Math.cos(angle)*offset,1,1,1,angle);
  }

  const frontZ=1.85;
  const windows=[
    {x:-1.55,y:1.02,w:.75,h:1.16,angle:0,z:frontZ},
    {x:1.62,y:1.05,w:.76,h:1.10,angle:0,z:frontZ},
    {x:-1.24,y:2.69,w:.82,h:1.02,angle:0,z:frontZ},
    {x:1.18,y:2.65,w:.96,h:1.07,angle:0,z:frontZ},
    {x:.07,y:4.21,w:.60,h:.71,angle:0,z:frontZ},
    {x:-.58,y:1.14,w:.71,h:1.04,angle:Math.PI/2,z:2.43},
    {x:.59,y:2.66,w:.83,h:1.08,angle:Math.PI/2,z:2.43},
    {x:-.40,y:1.10,w:.69,h:1.05,angle:-Math.PI/2,z:2.44},
    {x:.63,y:2.64,w:.76,h:1.00,angle:-Math.PI/2,z:2.44},
    {x:-.74,y:2.64,w:.82,h:1.01,angle:Math.PI,z:frontZ}
  ].map(w=>({...w,shape:arch(w.w,w.h)}));
  const door={x:entry.x,y:entry.threshold,w:1.02,h:1.84};
  door.shape=arch(door.w,door.h);
  wall(5.44,eave,0,frontZ,[door,...windows.filter(w=>w.angle===0)],true);
  wall(5.38,eave,Math.PI,frontZ,windows.filter(w=>w.angle===Math.PI),true);
  for(const a of [-Math.PI/2,Math.PI/2])wall(3.90,eave,a,2.43,windows.filter(w=>w.angle===a));

  const stoneTints=[0xb8a28b,0xad9781,0xd2bca3,0xb9aa95,0xcab098].map(color=>matte(color,{map:tex.plaster}));
  const rand=(()=>{let n=76043;return ()=>{n=(Math.imul(n,48271)>>>0);return n/4294967296;};})();
  const footing=Math.min(0,...[-2.65,2.65].flatMap(x=>[-2.04,2.04].map(z=>localGround(x,z))))-.13;
  const bottomRow=Math.floor((footing-.09)/.168);
  box(stone,0,footing/2,0,5.25,-footing,4.03);
  for(const [a,width,offset] of [[0,5.36,frontZ],[Math.PI,5.36,frontZ],[-Math.PI/2,4.02,2.43],[Math.PI/2,4.02,2.43]]){
    const c=Math.cos(a),s=Math.sin(a);
    for(let row=bottomRow;row<3;row++){
      let p=-width/2,k=0;
      while(p<width/2-.10){
        const w=Math.min(.37+rand()*.36,width/2-p),x=p+w/2; p+=w;
        if(a===0&&row>=1&&Math.abs(x-door.x)<door.w/2+.14+w/2)continue;
        place(stonePieces[k%3],stoneTints[(k+row-bottomRow)%stoneTints.length],x*c+(offset+.22)*s,.09+row*.168+rand()*.036,
          -x*s+(offset+.22)*c,w,.208,.34,a,(rand()-.5)*.064);
        k++;
      }
    }
  }
  for(const sign of [-1,1]){
    const x=sign*2.60;
    pipe([[x,.49,frontZ+.28],[x-sign*.073,1.8,frontZ+.31],[x-sign*.095,2.8,frontZ+.28],[x-sign*.13,4.04,frontZ+.24]],.086,wood);
  }
  pipe([[-2.61,2.41,frontZ+.27],[-1.2,2.39,frontZ+.30],[.05,2.43,frontZ+.30],[1.46,2.40,frontZ+.30],[2.55,2.37,frontZ+.26]],.068,wood);
  pipe([[-2.59,4.04,frontZ+.27],[-1.2,4.07,frontZ+.27],[.36,4.04,frontZ+.29],[2.47,3.98,frontZ+.25]],.082,wood);
  for(const side of [-1,1]){
    pipe([[side*2.63,2.40,-1.96],[side*2.68,2.41,-.72],[side*2.68,2.42,.81],[side*2.60,2.41,frontZ+.27]],.065,wood);
    for(const z of [-1.48,-.49,.50,1.53]){
      box(woodEdge,side*2.61,2.31,z,.18,.098,.109,0,side*.13);
    }
  }

  for(const {x,y:y0,w,h:wh,angle:a,z,shape} of windows){
    const c=Math.cos(a),s=Math.sin(a);
    const at=(u,v,d)=>[u*c+d*s,v,d*c-u*s];
    const cut=new T.ShapeGeometry(shape,12);
    const uv=cut.getAttribute('uv'), xyz=cut.getAttribute('position');
    for(let k=0;k<uv.count;k++)uv.setXY(k,.5+xyz.getX(k)/w,xyz.getY(k)/wh);
    place(cut,glass,...at(x,y0,z+.036),1,1,1,a);
    const outer=shape.getPoints(12).map(p=>at(x+p.x*1.07,y0+p.y,z+.255));
    pipe(outer,.060,woodEdge);
    pipe(shape.getPoints(12).map(p=>at(x+p.x,y0+p.y,z+.102)),.039,recess);
    box(wood,...at(x,y0+wh*.48,z+.14),w,.041,.088,a);
    box(woodEdge,...at(x,y0+wh*.46,z+.14),.034,wh*.90,.091,a);
    box(stone,...at(x,y0-.077,z+.279),w+.26,.143,.30,a);
    if(wh<.9)continue;
    for(const side of [-1,1]){
      const off=side*(w/2+.052),center=off+side*w*.25;
      const upper=shape.getPoints(12).filter(p=>p.y>=wh*.58-1e-5&&side*p.x>=-1e-5)
        .sort((p,q)=>side*(p.x-q.x));
      const shutter=polygon([[0,0],[side*w*.5,0],...upper.map(p=>[side*w*.5-p.x,p.y])]);
      const panel=new T.ExtrudeGeometry(shutter,{depth:.062,bevelEnabled:true,bevelSize:.012,bevelThickness:.009,bevelSegments:1});
      place(panel,green,...at(x+off,y0,z+.252),1,1,1,a);
      for(const yy of [.23,.55]){
        box(wood,...at(x+center,y0+wh*yy,z+.322),w*.451,.033,.030,a);
        place(round,brass,...at(x+off+side*w*.090,y0+wh*yy,z+.345),.021,.021,.016,a);
      }
    }
  }

  const surround=arch(door.w+.23,door.h+.153,new T.Shape(),-.048);
  surround.holes.push(arch(door.w,door.h,new T.Path()));
  const jamb=new T.ExtrudeGeometry(surround,{depth:.086,bevelEnabled:true,bevelSize:.014,bevelThickness:.016,bevelSegments:1,curveSegments:14});
  place(jamb,woodEdge,door.x,door.y,frontZ+.194);
  const doorFace=new T.ExtrudeGeometry(door.shape,{depth:.056,bevelEnabled:true,bevelSize:.012,bevelThickness:.014,bevelSegments:1});
  const hinge=new T.Group();
  hinge.position.set(door.x-door.w/2,door.y,frontZ+.119);
  const doorPart=(geometry,material,x,y,z,sx=1,sy=1,sz=1)=>
    place(geometry,material,x-hinge.position.x,y-hinge.position.y,z-hinge.position.z,sx,sy,sz,0,0,hinge);
  doorPart(doorFace,green,door.x,door.y,frontZ+.119);
  for(let q=-2;q<=2;q++){
    const x=door.x+q*.161, h=1.72-Math.abs(q)*.075;
    doorPart(boxG,q%2?green:recess,x,door.y+h*.5,frontZ+.187,.018,h,.018);
  }
  doorPart(round,brass,door.x+.322,door.y+.85,frontZ+.251,.084,.084,.126);
  const letterWhite=matte(0xead4aa);
  doorPart(boxG,wood,door.x,door.y+1.16,frontZ+.210,.44,.15,.051);
  doorPart(boxG,brass,door.x,door.y+1.16,frontZ+.240,.38,.104,.026);
  doorPart(boxG,recess,door.x,door.y+1.192,frontZ+.256,.32,.031,.012);
  doorPart(boxG,letterWhite,door.x,door.y+1.144,frontZ+.258,.24,.057,.017);
  doorPart(round,matte(0xa54b48),door.x,door.y+1.151,frontZ+.270,.055,.044,.018);
  house.add(hinge);
  const inside=new T.Group();
  const insideWall=matte(0xc79869);
  box(insideWall,door.x,door.y+1.11,frontZ-1.35,4.52,2.44,.08,0,0,inside);
  box(wood,door.x,door.y-.06,frontZ-.61,2.81,.11,1.36,0,0,inside);
  house.add(inside);
  inside.visible=false;
  for(const {near,far,top,bottom,width} of entry.steps){
    box(stone,entry.x,(top+bottom)/2-y,(near+far)/2,width,top-bottom,far-near);
  }

  const lanternTop=2.60,lanternX=-.079;
  box(recess,lanternX,lanternTop+.40,frontZ+.274,.138,.23,.07);
  pipe([[lanternX,lanternTop+.36,frontZ+.28],[lanternX,lanternTop+.47,frontZ+.47],
    [lanternX,lanternTop+.39,frontZ+.62],[lanternX,lanternTop+.20,frontZ+.62]],.025,recess);
  const star=new T.Shape(Array.from({length:10},(_,i)=>{
    const a=i*tau/10,r=i%2?.096:.213;return new T.Vector2(Math.sin(a)*r,Math.cos(a)*r);
  }));
  const starGeom=new T.ExtrudeGeometry(star,{depth:.064,bevelEnabled:true,bevelSize:.018,bevelThickness:.012,bevelSegments:1});
  place(starGeom,bright,lanternX,lanternTop,frontZ+.57);
  place(ball,brass,lanternX,lanternTop+.21,frontZ+.608,.076,.067,.073);

  const tiled=new T.InstancedMesh(roofTileGeometry(),matte(0xffffff,{side:T.DoubleSide}),2*10*15);
  const dummy=new T.Object3D(), matrix=new T.Matrix4();
  const palette=[0xb37053,0xae6049,0xc07e58,0xa95946,0xbc694f,0xc58a64];
  let index=0;
  for(const side of [-1,1]){
    place(meshGrid(16,17,(u,v)=>roof(side,u,v)),clay,0,0,0);
    for(let row=0;row<10;row++)for(let col=0;col<15;col++){
      const u=(row+.5)/10,v=Math.min(.994,Math.max(.006,(col+.51+((row%2)-.5)*.30)/15));
      const p=new T.Vector3(...roof(side,u,v));
      const down=new T.Vector3(...roof(side,u+.007,v)).sub(p).normalize();
      const temp=new T.Vector3(...roof(side,u,v+.007)).sub(p).normalize().multiplyScalar(-side);
      const normal=new T.Vector3().crossVectors(down,temp).normalize();
      const cross=new T.Vector3().crossVectors(normal,down).normalize();
      dummy.position.copy(p).addScaledVector(normal,.035);
      dummy.quaternion.setFromRotationMatrix(matrix.makeBasis(cross,normal,down));
      dummy.scale.set(.329+rand()*.012,.91+rand()*.13,.369+Math.abs(down.y)*.113);
      dummy.updateMatrix();
      tiled.setMatrixAt(index,dummy.matrix);tiled.setColorAt(index++,new T.Color(palette[(row+col*3+Math.floor(rand()*4))%6]));
    }
    for(const end of [0,1]){
      const edge=Array.from({length:10},(_,j)=>roof(side,j/9,end).map((p,i)=>p-(i===1?.053:0)));
      pipe(edge,.083,wood);
      pipe(edge.map(([x,y,z])=>[x,y+.075,z+(end-.5)*.049]),.052,woodEdge);
    }
    const fringe=Array.from({length:14},(_,j)=>roof(side,1,j/13).map((p,i)=>p-(i===1?.06:0)));
    pipe(fringe,.071,wood);
    for(let k=0;k<9;k++){
      const v=mix(.095,.905,(k+.5)/9);
      const [edgeX,edgeY,z]=roof(side,1,v);
      const [ridgeX]=roof(side,0,v);
      const innerX=side*2.55,outerX=edgeX-side*.064;
      const [,wallRoofY]=roof(side,(innerX-ridgeX)/(edgeX-ridgeX),v);
      const innerY=Math.min(eave+.04,wallRoofY-.079),outerY=edgeY-.075;
      const dx=outerX-innerX,dy=outerY-innerY;
      box(woodEdge,(outerX+innerX)*.5,(outerY+innerY)*.5,z,
        Math.hypot(dx,dy),.074,.084,0,Math.atan(dy/dx));
    }
    // Irregular snow caps leave the rows of terracotta along the eave visible.
    for(const [a,b,reach] of [[.035,.41,.53],[.45,.691,.60],[.716,.964,.48]]){
      const cap=meshGrid(9,14,(s,t)=>{
        const v=mix(a,b,t),fade=Math.sin(t*Math.PI)**.54;
        const u=.008+s*fade*(reach+.062*Math.sin(v*41)+.052*Math.cos(v*28.5));
        const [x,y,z]=roof(side,u,v);
        return [x,y+.09+.054*fade*(1-s*.91),z];
      });
      place(cap,white,0,0,0,1,1,1,0,0,snow);
    }
  }
  tiled.computeBoundingSphere();house.add(tiled);
  const ridge=new T.CylinderGeometry(.102,.122,.325,9).rotateX(Math.PI/2);
  const ridgeShade=matte(0xb46c53);
  for(let j=0;j<16;j++){
    const [x,y0,z]=roof(1,0,(j+.5)/16);
    place(ridge,j%2?clay:ridgeShade,x,y0+.096,z);
  }
  for(let j=0;j<8;j++){
    for(let q=0;q<2;q++){
      const x=-1.46+(q-.5)*.22, z=-1.34, y0=4.58+j*.211;
      place(stonePieces[(q+j)%3],stoneTints[(j+q)%5],x,y0,z,.27,.228,.54);
    }
  }
  box(stone,-1.46,6.28,-1.34,.66,.17,.65);
  box(recess,-1.46,6.371,-1.34,.38,.017,.39);
  box(white,-1.46,6.398,-1.34,.54,.056,.30,0,0,snow);

  const leafMat=[0x4b7655,0x608959,0x6b8863].map(color=>matte(color));
  const vineBerry=matte(0xac4655);
  const vine=Array.from({length:17},(_,i)=>{
    const y=.51+i*.194;
    return [2.52+.116*Math.sin(i*.72),y,frontZ+.325+.027*Math.cos(i*.48)];
  });
  pipe(vine,.020,green);
  for(const [i,[x,y,z]] of vine.entries()){
    const side=i%2===0?1:-1;
    const farX=x+side*(.12+rand()*.09);
    pipe([[x,y,z],[farX,y+.132,z+.019]],.009,green);
    place(ball,leafMat[i%3],farX,y+.162,z+.032,.14,.21,.047,0,side*-.70);
    if(i%3===0)place(ball,vineBerry,farX-.041,y+.116,z+.061,.058,.057,.052);
  }
  for(const [x0,y0] of [[-1.24,2.515],[1.18,2.475]]){
    box(wood,x0,y0,2.25,1.02,.205,.36);
    box(woodEdge,x0,y0+.071,2.44,1.08,.085,.081);
    for(let j=0;j<6;j++){
      const x=x0+(j-2.5)*.145,y1=y0+.095,z=2.24+rand()*.095,size=.30+rand()*.075;
      place(roses.plants[j%3],roses.material,x,y1,z,size,size,size,(rand()-.5)*.9);
      if(j%3===0)place(round,white,x+.05,y1+.027,z+.051,.14,.048,.085,0,0,snow);
    }
  }
  const pot=matte(0xaf7356),potGeo=new T.CylinderGeometry(.23,.162,.315,9);
  for(const side of [-1,1]){
    const x=side*2.35,z=2.13;
    const floor=localGround(x,z)+.108;
    place(potGeo,pot,x,floor+.153,z);
    for(let j=0;j<6;j++){
      const a=j*tau/6,r=j===0?.025:.13,size=.36+rand()*.14;
      place(roses.plants[j%3],roses.material,x+r*Math.sin(a),floor+.302,z+r*Math.cos(a),size,size,size,a);
    }
  }
  combineStaticMeshes(house);
  combineStaticMeshes(snow);
  return {house,entry,frontZ,
    lanternPosition:()=>house.localToWorld(new T.Vector3(lanternX,lanternTop,frontZ+.62)),
    lanternColor:color=>bright.color.set(color),
    setOpen(angle){
    hinge.rotation.y=angle;
    inside.visible=angle>.01;
  }};
}
