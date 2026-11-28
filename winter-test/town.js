import {santaDestinations} from './santa-destinations.js';
import * as T from 'three';
import { createWalkHeight } from './walk-surface.js';
import { buildLetterHouse, meshGrid, roofTileGeometry } from './letter-house.js';
import { buildTeaHouse } from './tea-house.js';
import { winterFlowers } from './winter-flowers.js';
import { buildHouseMarker } from './house-markers.js';
import { buildTeaStall } from './market-stall.js';
import { createRiverWater } from './river-water.js';
import { GLTFLoader } from './vendor/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from './vendor/addons/utils/BufferGeometryUtils.js';
import {
  benches, bridge, bridgeHeight, castle, clamp, court, entrancesFor, forecourts, front, gardens, giftWindowX, groundHeight, hillGate, houses, inHouse, letterHouse, mix,
  nearestPoint, northFir, pavedAt, pavedPaths, riverWidth, riverZ, smooth, squareBank, squares, streetLamps, teaHouse, terraceRail, terraceWalls, tree, treeSquare,
  upperTerrace, viewpoints, waterY
} from './layout.js';

const TAU = Math.PI * 2;
function rng(seed) {
  let value = seed;
  return () => ((value = (Math.imul(1664525, value) + 1013904223) >>> 0) / 4294967296);
}
const matte = (color, extra) => new T.MeshLambertMaterial({color, ...extra});

function canvasTexture(paint, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  paint(canvas.getContext('2d'), size);
  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function surfaces() {
  const random = rng(29);
  const fleck = (g,n,count) => {
    for(let i=0;i<count;i++) {
      g.fillStyle = i%2 ? '#472a2311' : '#fff0cd16';
      g.fillRect(random()*n,random()*n,1+5*random(),1+3*random());
    }
  };
  const plaster = canvasTexture((g,n)=>{
    g.fillStyle='#f8efe1';g.fillRect(0,0,n,n);
    for(let i=0;i<52;i++){
      const x=random()*n,y=random()*n,r=16+random()*47,grad=g.createRadialGradient(x,y,0,x,y,r);
      grad.addColorStop(0,i%3===0?'#996f5525':'#f1d8af44');grad.addColorStop(1,'#c9a98800');
      g.fillStyle=grad;g.fillRect(0,0,n,n);
    }
    fleck(g,n,2600);
  });
  const wood = canvasTexture((g,n)=>{
    g.fillStyle='#d9c3ad';g.fillRect(0,0,n,n);
    for(let i=0;i<145;i++){
      const y=random()*n,x=random()*n,bend=(random()-.5)*7;
      g.lineWidth=.55+random()*1.8;g.strokeStyle=i%4?'#52352236':'#fff2c541';
      g.beginPath();g.moveTo(-5,y);g.bezierCurveTo(x*.72,y+bend,x+10,y-bend,n+5,y+bend*.3);g.stroke();
    }
    fleck(g,n,640);
  });
  const glass = canvasTexture((g,n)=>{
    const color=g.createLinearGradient(0,0,n*.21,n);
    color.addColorStop(0,'#8b4933');color.addColorStop(.38,'#c68142');
    color.addColorStop(.75,'#ffd88c');color.addColorStop(1,'#edac65');
    g.fillStyle=color;g.fillRect(0,0,n,n);
    g.fillStyle='#ffcf8080';g.fillRect(9,0,6,n);
    g.fillStyle='#9e5839a0';g.fillRect(n-18,0,18,n);
    g.fillStyle='#522d2640';g.fillRect(0,n-14,n,14);
  },96);
  const road = canvasTexture((g,n)=>{
    g.fillStyle='#9a8172'; g.fillRect(0,0,n,n);
    const tones=['#c1a18e','#be9f89','#b7a394','#cbb09d','#c9ab91','#d1b6a0','#b9a297'];
    const cell=n/9,rows=10,height=n/rows;
    for(let row=0;row<rows;row++){
      for(let col=0;col<9;col++){
        const x=(col+(row%2)*.5)*cell, y=row*height;
        const fill=tones[Math.floor(random()*tones.length)], tilt=(random()-.5)*3.4;
        for(const offset of [0,-n]){
          const px=x+offset;
          g.fillStyle=fill;
          g.beginPath();
          g.moveTo(px+3,y+1.5);g.lineTo(px+cell-3,y+1.6+tilt);g.lineTo(px+cell-1.3,y+5+tilt);
          g.lineTo(px+cell-2.6,y+height-2);g.lineTo(px+4,y+height-1.9);
          g.lineTo(px+1.1,y+height-6);g.lineTo(px+1.2,y+4);g.closePath();g.fill();
          g.strokeStyle='#eed5b66b';g.lineWidth=1.2;g.beginPath();
          g.moveTo(px+3.8,y+height-5.2);g.lineTo(px+3.7,y+4.5);g.lineTo(px+cell-4,y+3.8+tilt);g.stroke();
        }
      }
    }
    fleck(g,n,1400);
  });
  const tile=canvasTexture((g,n)=>{
    g.fillStyle='#8a5141'; g.fillRect(0,0,n,n);
    const colors=['#bf6a50','#bc7255','#b45d47','#c27b5e','#a95e4b','#ae684d','#cc8261'];
    const w=n/8,h=n/10;
    for(let j=-1;j<=10;j++) for(let i=-1;i<=8;i++) {
      const x=i*w+(j%2)*w*.5, y=j*h;
      g.fillStyle=colors[(i+8*j+80+Math.floor(random()*9))%colors.length];
      g.beginPath(); g.roundRect(x+1,y+1,w-2,h*1.02,[2,2,8,8]); g.fill();
      g.strokeStyle='#ecac8058';g.lineWidth=1.4; g.beginPath();
      g.moveTo(x+4,y+2);g.quadraticCurveTo(x+2,y+h*.63,x+5,y+h*.8);g.stroke();
    }
    fleck(g,n,1000);
  });
  const grass=canvasTexture((g,n)=>{
    g.fillStyle='#dad6ba';g.fillRect(0,0,n,n);
    for(let i=0;i<160;i++){
      const a=8+random()*31,x=random()*n,y=random()*n;
      g.fillStyle=i%2?'#5c643811':'#f5dfb522';
      g.beginPath();g.ellipse(x,y,a,a*.38,random()*TAU,0,TAU);g.fill();
    }
    fleck(g,n,2000);
  });
  return {plaster,road,tile,grass,wood,glass};
}

function tilePosition(x,z) { return `${Math.floor(x/20)}:${Math.floor(z/20)}`; }
class Batch {
  constructor(scene) { this.scene=scene; this.tiles=new Map(); this.dummy=new T.Object3D(); }
  add(geo,material,color,x,y,z,w=1,h=1,d=1, yaw=0,roll=0,pitch=0,seasonal=false) {
    const key=[tilePosition(x,z),geo.id,material.id,seasonal].join('/');
    if(!this.tiles.has(key)) this.tiles.set(key,{geo,material,seasonal,items:[]});
    const o=this.dummy;
    o.position.set(x,y,z);o.rotation.set(pitch,yaw,roll,'YXZ');o.scale.set(w,h,d);o.updateMatrix();
    this.tiles.get(key).items.push([o.matrix.clone(), new T.Color(color)]);
  }
  build(winter) {
    for(const {geo,material,seasonal,items} of this.tiles.values()) {
      const group=new T.InstancedMesh(geo,material,items.length);
      items.forEach(([matrix,color],i)=>{group.setMatrixAt(i,matrix);group.setColorAt(i,color);});
      group.instanceMatrix.needsUpdate=true; group.instanceColor.needsUpdate=true;
      group.computeBoundingSphere();
      (seasonal ? winter : this.scene).add(group);
    }
    this.tiles.clear();
  }
}

function geometry(positions, uv, index, colors) {
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  if(uv)g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  if(colors)g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  if(index)g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

function ribbon(points,width,material,surface, offset=.068) {
  const pos=[],uv=[],ind=[];
  const count=points.length, columns=7;
  for(let i=0;i<count;i++) {
    const [x,z]=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(count-1,i+1)];
    const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz)||1;
    for(let col=0;col<columns;col++) {
      const side=mix(-1,1,col/(columns-1)),r=width*.5;
      const xx=x+side*dz/len*r,zz=z-side*dx/len*r;
      pos.push(xx,surface(xx,zz)+offset,zz);uv.push(xx*.23,zz*.23);
      if(i&&col){const j=i*columns+col,k=j-columns;ind.push(k-1,k,j-1,k,j,j-1);}
    }
  }
  return new T.Mesh(geometry(pos,uv,ind),material);
}
function samples(points,spacing=.65) {
  const out=[points[0]];
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/spacing);
    for(let k=1;k<=n;k++)out.push([mix(a[0],b[0],k/n),mix(a[1],b[1],k/n)]);
  }
  return out;
}

function snowNoise(x,z) {
  const ix=Math.floor(x),iz=Math.floor(z);
  const sample=(a,b)=>{
    const hash=Math.imul(a,374761393)^Math.imul(b,668265263);
    return ((Math.imul(hash^(hash>>>13),1274126177)>>>8)&0xffff)/65535;
  };
  const fx=smooth(0,1,x-ix),fz=smooth(0,1,z-iz);
  return mix(mix(sample(ix,iz),sample(ix+1,iz),fx),mix(sample(ix,iz+1),sample(ix+1,iz+1),fx),fz);
}

function terrain(textures,snowCover) {
  const m=matte(0xffffff,{map:textures.grass,vertexColors:true});
  m.onBeforeCompile=shader=>{
    shader.uniforms.groundSnow=snowCover;
    shader.vertexShader='attribute float snowPatch; varying float vSnowPatch;\n'+shader.vertexShader.replace(
      '#include <begin_vertex>','#include <begin_vertex>\n vSnowPatch=snowPatch;');
    shader.fragmentShader='uniform float groundSnow; varying float vSnowPatch;\n'+shader.fragmentShader.replace(
      '#include <color_fragment>',`#include <color_fragment>
        vec3 snowColor=vec3(.79,.82,.82)*(.88+.12*vSnowPatch);
        diffuseColor.rgb=mix(diffuseColor.rgb,snowColor,smoothstep(.04,.87,vSnowPatch)*groundSnow);
      `);
  };
  const group=new T.Group();
  for(let startZ=-174;startZ<-27;startZ+=20) for(let startX=-66;startX<65;startX+=20) {
    const pos=[],uv=[],col=[],idx=[],snow=[],count=startZ<-134?20:32;
    const low=new T.Color(0x869076),high=new T.Color(0x657752),bank=new T.Color(0x8a725b),verge=new T.Color(0xb3a092);
    for(let j=0;j<=count;j++)for(let i=0;i<=count;i++) {
      const x=startX+i*20/count,z=startZ+j*20/count,y=groundHeight(x,z);
      pos.push(x,y,z);uv.push(x*.2,z*.2);
      const blend=.5+.25*Math.sin(x*.45+z*.12)+.18*Math.sin(-z*.76+x*.52);
      const bankDistance=Math.abs(z-riverZ(x))-riverWidth(x);
      const c=low.clone().lerp(high,blend).lerp(bank,(1-smooth(0,2,bankDistance))*.94);
      let onPavement=false,atEdge=false;
      if(x>-25&&x<46&&z<-38&&z>castle.z+1){
        onPavement=pavedAt(x,z,.27);
        atEdge=!onPavement&&pavedAt(x,z,1.05);
        if(onPavement)c.lerp(verge,.93);
        else if(atEdge)c.lerp(verge,.31);
      }
      const drift=.74*snowNoise(x*.19+2,z*.21)+.26*snowNoise(x*.59,z*.53+4);
      const dust=smooth(.24,.56,drift);
      const shore=smooth(.32,1.3,bankDistance);
      snow.push(onPavement?0:(.26+dust*(atEdge?.53:.66))*shore);
      c.multiplyScalar(.84+.16*blend); col.push(c.r,c.g,c.b);
      if(i<count&&j<count){const a=j*(count+1)+i,b=a+count+1;idx.push(a,b,a+1,b,b+1,a+1);}
    }
    const mesh=geometry(pos,uv,idx,col);
    mesh.setAttribute('snowPatch',new T.Float32BufferAttribute(snow,1));
    group.add(new T.Mesh(mesh,m));
  }
  return group;
}

function ellipseGround(area,mat,paving=false) {
  const count=56,rows=Math.max(8,Math.ceil(area.rx/.44)),positions=[],uv=[],index=[];
  const put=(x,z)=>{positions.push(x,groundHeight(x,z)+(paving?.121:.061),z);uv.push(x*.23,z*.23);};
  for(let row=0;row<=rows;row++)for(let i=0;i<=count;i++){
    const a=i*TAU/count, r=row/rows*(paving?1:1+.038*Math.sin(a*5)+.056*Math.cos(a*3));
    put(area.x+area.rx*Math.cos(a)*r,area.z+area.rz*Math.sin(a)*r);
    if(row&&i){const j=row*(count+1)+i,k=j-count-1;index.push(k-1,k,j-1,k,j,j-1);}
  }
  return new T.Mesh(geometry(positions,uv,index),mat);
}

const roofProfiles={
  mill:{ridge:.43,bend:.38,bow:.15},
  bakery:{ridge:.51,bend:.29,bow:.19},
  gift:{ridge:.40,bend:.49,bow:.24},
  shop:{ridge:.46,bend:.32,bow:.19},
  lanterns:{ridge:.52,bend:.23,bow:.11,hip:.32},
  books:{ridge:.52,bend:.23,bow:.12},
  bay:{ridge:.53,bend:.19,bow:.12},
  balcony:{ridge:.48,bend:.24,bow:.10},
  workshop:{ridge:.29,bend:.20,bow:.11},
  letter:{ridge:.55,bend:.37,bow:.19},
  tower:{ridge:.50,bend:.41,bow:.15},
  hip:{ridge:.50,bend:.16,bow:.10,hip:.44}
};

function roofPoint(u,v,span,depth,rise,profile) {
  const r=profile.ridge, slope=u<r?u/r:(1-u)/(1-r);
  const y=rise*(slope*(1-profile.bend)+slope*slope*profile.bend);
  const sweep=profile.bow*(.5+.5*Math.cos(v*TAU+.32))*((1-slope)**2);
  const drift=.07*Math.sin(v*TAU*.68+.75)*slope;
  const eave=1-(profile.hip||0)*slope;
  return [(u-.5)*span,y+sweep+drift,(v-.5)*depth*eave];
}

function laidTiles(span,depth,rise,profile,tile,material){
  const random=rng(62), rows=8, columns=Math.ceil(depth/.33);
  const tiles=new T.InstancedMesh(tile,material,2*rows*columns);
  const colors=[0xa9654b,0xbe7957,0xad5e47,0xb36e50,0xc88560].map(c=>new T.Color(c));
  const part=new T.Object3D(),basis=new T.Matrix4();
  const surface=(u,v)=>new T.Vector3(...roofPoint(u,v,span,depth,rise,profile));
  let index=0;
  for(const side of [-1,1]){
    const edge=side<0?0:1, run=Math.abs(edge-profile.ridge)*span;
    for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
      const u=mix(profile.ridge,edge,(row+.48)/rows);
      const v=(col+.5+(row%2?.15:-.15))/columns;
      const p=surface(u,v);
      const down=surface(u+side*.005,v).sub(p).normalize();
      const along=surface(u,v+.005).sub(p).normalize().multiplyScalar(-side);
      const normal=new T.Vector3().crossVectors(down,along).normalize();
      along.crossVectors(normal,down).normalize();
      part.position.copy(p).addScaledVector(normal,.038);
      part.quaternion.setFromRotationMatrix(basis.makeBasis(along,normal,down));
      const rowDepth=profile.hip?surface(u,1).z-surface(u,0).z:depth;
      part.scale.set(rowDepth/columns*1.04,.73,Math.hypot(run,rise)/rows*1.09);
      part.updateMatrix();
      tiles.setMatrixAt(index,part.matrix);
      tiles.setColorAt(index++,colors[Math.floor(random()*colors.length)]);
    }
  }
  return tiles;
}

function roofMeshGeometry(span,depth,rise,profile,snow=false,snowDepth=.074) {
  const pos=[],uv=[],idx=[],cols=15,rows=snow?15:11;
  for(const [a,b] of [[0,profile.ridge],[profile.ridge,1]]) {
    const start=pos.length/3,end=a===0;
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
      const v=j/rows,t=i/cols;
      const snowEdge=.218+.094*Math.sin(v*TAU*1.74)+.055*Math.cos(v*TAU*4.1+.8);
      const u=mix(a,b,snow?(end?mix(snowEdge,1,t):mix(0,1-snowEdge,t)):t);
      const [x,y,z]=roofPoint(u,snow?mix(.036,.957,v):v,span,depth,rise,profile);
      const drift=.046*(.5+.5*Math.sin(v*TAU*2.37+u*9.3))+.018*Math.sin(v*TAU*5.1+u*13.1);
      pos.push(x,y+(snow?snowDepth+drift:0),z);uv.push(x*.55,z*.52);
      const k=start+j*(cols+1)+i;
      if(i&&j){const q=k-cols-1;idx.push(q-1,k-1,q,q,k-1,k);}
    }
    if(snow){
      const face=pos.length/3;
      for(let j=0;j<=rows;j++){
        const edge=start+j*(cols+1)+(end?0:cols),x=pos[edge*3],y=pos[edge*3+1],z=pos[edge*3+2];
        const drop=.084+.035*(.5+.5*Math.sin(j*.94));
        pos.push(x,y,z,x+(end?.032:-.032),y-drop,z);
        uv.push(x*.55,z*.52,x*.55,z*.52+.025);
        const k=face+j*2;
        if(j)idx.push(k-2,k-1,k,k-1,k+1,k);
      }
    }
  }
  if(profile.hip&&!snow){
    for(const side of [-1,1]){
      const start=pos.length/3;
      for(let i=0;i<=30;i++){
        const u=i/30,[x,y,z]=roofPoint(u,side===1?1:0,span,depth,rise,profile);
        const bz=side*depth*.5;
        pos.push(x,y,z,x,profile.bow*.96,bz);uv.push(x*.55,z*.52,x*.55,bz*.52);
        const k=start+i*2;
        if(i)idx.push(k-2,k-1,k,k,k-1,k+1);
      }
    }
  }
  return geometry(pos,uv,idx);
}

function gable(w,d,rise,profile) {
  const pos=[],uv=[],idx=[],n=24;
  for(const side of [-1,1]){
    const start=pos.length/3;
    for(let i=0;i<=n;i++){
      const u=i/n,[x,y]=roofPoint(u,side===1?.94:.06,w,d,rise,profile);
      const z=side*(d/2-.02);
      pos.push(x,-.05,z,x,y-.055,z);uv.push(u*1.8,0,u*1.8,y*.53);
      const k=start+i*2;
      if(i)idx.push(k-2,k,k-1,k-1,k,k+1);
    }
  }
  return geometry(pos,uv,idx);
}

function bevelBlock(corners) {
  const shape=new T.Shape(corners.map(([x,y])=>new T.Vector2(x,y)));
  const g=new T.ExtrudeGeometry(shape,{depth:.78,bevelEnabled:true,bevelSize:.06,bevelThickness:.09,bevelSegments:1});
  g.translate(0,0,-.39);
  return g;
}

function archContour(path, width=1, height=1, lift=0) {
  const y=value=>value*height+lift;
  path.moveTo(-width/2,y(-.5));path.lineTo(width/2,y(-.5));path.lineTo(width/2,y(.18));
  path.bezierCurveTo(width/2,y(.38),width*.30,y(.50),0,y(.50));
  path.bezierCurveTo(-width*.30,y(.50),-width/2,y(.38),-width/2,y(.18));
  path.closePath();
  return path;
}

function archDoor(shape=archContour(new T.Shape()), bevelSize=.023) {
  const g=new T.ExtrudeGeometry(shape,{depth:.68,bevelEnabled:true,bevelSegments:1,bevelSize,bevelThickness:.13,curveSegments:12});
  g.translate(0,0,-.34);
  return g;
}

function shutterHalf(side){
  const outline=new T.Shape();
  outline.moveTo(0,-.5);
  outline.lineTo(-side*.5,-.5);
  outline.lineTo(-side*.5,.50);
  // The opening's control points, measured from the hinge at its outer edge.
  outline.bezierCurveTo(-side*.20,.50,0,.38,0,.18);
  outline.closePath();
  return new T.ExtrudeGeometry(outline,{depth:.8,bevelEnabled:true,bevelThickness:.1,bevelSize:.014,
    bevelSegments:1,curveSegments:8}).translate(0,0,-.4);
}

function evergreenSprig() {
  const vertices=[],faces=[];
  function leaf(x,y,tipX,tipY,width,depth) {
    const dx=tipX-x,dy=tipY-y,l=Math.hypot(dx,dy);
    const u=-dy/l*width,v=dx/l*width;
    const cx=mix(x,tipX,.43),cy=mix(y,tipY,.43),i=vertices.length/3;
    vertices.push(x,y,0,cx+u,cy+v,depth*.17,tipX,tipY,depth*.43,cx-u,cy-v,depth*.17,cx,cy,depth);
    faces.push(i,i+1,i+4,i+1,i+2,i+4,i+2,i+3,i+4,i+3,i,i+4);
  }
  leaf(0,-.50,0,.50,.045,.13);
  for(let i=0;i<4;i++){
    const y=-.40+i*.21,w=.38-i*.068;
    leaf(0,y,-w,y+.30-i*.028,.042,.089);
    leaf(0,y+.064,w*.94,y+.34-i*.035,.039,.10);
  }
  return geometry(vertices,null,faces);
}

function lanternGeometry(sides, roof) {
  const lower=.21, upper=.295, bottom=-.30, top=.245;
  const lathe=(profile,segments=sides)=>new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),segments);
  const footRim=lathe([[.244,-.425],[.265,-.417],[.264,-.397],[.249,-.39]]);
  const shoulder=lathe([[.300,.236],[.325,.246],[.325,.263],[.312,.275]]);
  const handle=new T.TorusGeometry(.081,.013,5,14).translate(0,.596,0);
  const foot=[[0,-.452],[.255,-.452],[.255,-.427],[.265,-.413],[.246,-.391],[.225,-.375],[.222,-.299],[0,-.299]];
  const frame=[lathe(roof),lathe(foot),handle];
  const trim=[footRim,shoulder];
  for(let i=0;i<sides;i++){
    const angle=i*TAU/sides, sin=Math.sin(angle), cos=Math.cos(angle);
    const start=new T.Vector3(lower*sin,bottom,lower*cos);
    const end=new T.Vector3(upper*sin,top,upper*cos);
    const axis=end.clone().sub(start);
    frame.push(new T.CylinderGeometry(.015,.017,axis.length()+.02,5)
      .applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),axis.normalize()))
      .translate(...start.lerp(end,.5)));
  }
  trim.push(lathe([[0,-.308],[.104,-.308],[.103,-.273],[.071,-.25],[0,-.25]],10));
  const candle=lathe([[0,-.267],[.053,-.267],[.053,-.064],[.047,-.052],[0,-.052]],12);
  const flame=lathe([[0,-.049],[.038,-.028],[.042,.001],[.025,.035],[.012,.076],[0,.105]],10);
  const panes=new T.CylinderGeometry(upper,lower,top-bottom,sides,1,true).translate(0,(bottom+top)/2,0);
  const merge=pieces=>{
    const mesh=mergeGeometries(pieces);
    pieces.forEach(piece=>piece.dispose());
    return mesh;
  };
  return {frame:merge(frame),trim:merge(trim),candle,flame,panes};
}

function buildHouses(scene,batch,winter,tex,G,M) {
  const letterDoors=new Map();
  const deliverable=new Set(santaDestinations.map(santa=>santa.houseId??santa.id));
  const mats={
    plaster:matte(0xffffff,{map:tex.plaster,side:T.DoubleSide}),
    timber:matte(0xffffff,{map:tex.wood}),
    roofTrim:matte(0x76523c,{map:tex.wood}),
    glass:new T.MeshBasicMaterial({map:tex.glass}),
    roofs:[matte(0xffffff,{map:tex.tile,side:T.DoubleSide}),matte(0xd59a99,{map:tex.tile,side:T.DoubleSide}),matte(0xad878e,{map:tex.tile,side:T.DoubleSide})]
  };
  const random=rng(120);
  const blocks=[
    bevelBlock([[-.44,-.38],[.43,-.44],[.44,.39],[-.41,.44]]),
    bevelBlock([[-.43,-.40],[.43,-.38],[.40,.42],[-.44,.34]])
  ];
  const arch=archDoor();
  const doorProfile=archContour(new T.Shape());
  const doorFrameProfile=archContour(new T.Shape(),1.24,1.065,.028);
  doorFrameProfile.holes.push(archContour(new T.Path()));
  const doorFrame=archDoor(doorFrameProfile,.009);
  const plankSeams=[-.36,-.18,0,.18,.36].map(x=>{
    const roof=doorProfile.getPoints(32).filter(p=>p.y>0&&Math.abs(p.x)>=Math.abs(x));
    return {x,top:Math.max(...roof.map(p=>p.y))-.020};
  });
  const curvedShutters=[shutterHalf(-1),shutterHalf(1)];
  const bricks=[0xa39684,0xb8a18a,0xc4ad98,0xa38674,0xc7b8a2];
  const mold=new T.CylinderGeometry(.5,.5,1,7);
  const signDisk=new T.CylinderGeometry(.5,.5,1,20);
  const wheatRing=new T.TorusGeometry(.31,.070,5,15,Math.PI*1.33);
  const wreathRing=new T.TorusGeometry(.34,.082,5,18);
  const flowerGeometry=new T.IcosahedronGeometry(.5,0);
  const displayGlass=new T.MeshBasicMaterial({color:0xf5d9a9,transparent:true,opacity:.10,depthWrite:false});
  const walls=[0xf4dbab,0xf5e1bf,0xe8c6a6,0xeedbb5,0xffe8be,0xe7caaa];
  const wood=0x583c34, stone=0xaca093;
  const tile=roofTileGeometry(3,4),tileMaterial=matte(0xffffff,{side:T.DoubleSide});
  for(const [i,h] of houses.entries()){
    if(h.id===letterHouse){
      letterDoors.set(h.id,buildLetterHouse(h,groundHeight,scene,winter,tex,G.roses));
      continue;
    }
    if(h===teaHouse){
      buildTeaHouse(h,scene,winter,tex,G.roses);
      continue;
    }
    const {x,z,w,d,yaw,style}=h, y=groundHeight(x,z);
    const paired=Boolean(h.doorways);
    const giftShop=h.id==='gift';
    const marketShop=['herbs','tailor','lanterns','books'].includes(h.id);
    const plazaHouse=['atelier','cottager','terrace'].includes(h.id);
    const shapedWindows=giftShop||marketShop||plazaHouse||paired;
    const height=h.h,profile=roofProfiles[h.id]??roofProfiles[style],hero=['mill','bakery','gift','letter','workshop'].includes(style);
    const rise=style==='tower'?3.0:style==='workshop'?1.43:style==='mill'?2.14:style==='letter'?2.23:1.63+(i%5)*.235;
    const c=Math.cos(yaw),s=Math.sin(yaw);
    const hasAwning=style==='bakery'||style==='shop'||style==='gift';
    const f=hasAwning||style==='workshop';
    const hasBalcony=!paired&&(style==='bay'||style==='balcony');
    const storyBeamY=2.158,storyBeamHeight=.087;
    const entries=entrancesFor(h),entry=entries[0];
    const doorLimit=Math.min(storyBeamY-storyBeamHeight/2-.17,hasBalcony?height*.55-.20:Infinity);
    const doorHeightAt=threshold=>Math.min(height*.50,(doorLimit-threshold)/1.07);
    const local=(px,py,pz)=>[x+px*c+pz*s,y+py,z-px*s+pz*c];
    const add=(geo,m,color,px,py,pz,a,b,k,rot=0,roll=0,pitch=0,snow=false)=>{
      batch.add(geo,m,color,...local(px,py,pz),a,b,k,yaw+rot,roll,pitch,snow);
    };
    const box=(color,px,py,pz,a,b,k)=>add(G.box,M.plain,color,px,py,pz,a,b,k);
    const snowBox=(px,py,pz,a,b,k)=>add(G.box,M.plain,0xf2f4ed,px,py,pz,a,b,k,0,0,0,true);
    const shade=walls[i%walls.length];
    const cornerYs=[-1,1].flatMap(sx=>[-1,1].map(sz=>{
      const [xx,,zz]=local(sx*w/2,0,sz*d/2);
      return groundHeight(xx,zz);
    }));
    const footing=Math.min(y-.7,style==='mill'?waterY-.62:Infinity,...cornerYs)-.34;
    batch.add(G.box,M.plain,0xa48f7e,x,(y+.20+footing)/2,z,w+.10,y+.20-footing,d+.10,yaw);
    const timber=(color,px,py,pz,a,b,k,ry=0,rz=0,rx=0)=>add(G.box,mats.timber,color,px,py,pz,a,b,k,ry,rz,rx);
    const stoneBlock=(px,py,pz,a,b,k,q,angle=0)=>{
      add(blocks[q%2],M.plain,bricks[q%bricks.length],px,py,pz,a,b,k,angle,(random()-.5)*.075);
    };
    const frontZ=d/2;
    const masonryTop=style==='mill'?.75:hero?.48:.31;
    const levels=style==='mill'?Math.ceil((y+masonryTop-footing)/.222):hero?4:3;
    for(const side of [-1,1]) for(let row=0;row<levels;row++){
      const band=hero?.222:.195, yy=masonryTop-band*row;
      for(const [edge,dist,angle] of [[w,d/2,0],[d,w/2,Math.PI/2]]){
        const count=Math.ceil(edge/.61);
        for(let q=0;q<count+1;q++){
          const blockWidth=edge/count;
          const lo=Math.max(-edge*.5,-edge*.5+(q-(row%2)*.52)*blockWidth);
          const hi=Math.min(edge*.5,-edge*.5+(q+1-(row%2)*.52)*blockWidth);
          if(hi-lo<.09)continue;
          const p=(lo+hi)/2, at=side*(dist+.029);
          const xx=angle?at:p,zz=angle?p:at;
          stoneBlock(xx,yy+(random()-.5)*.036,zz,(hi-lo)*.94,band*.98,.24,q+row*3+i,angle);
        }
      }
    }
    const openings=entries.filter(entry=>deliverable.has(entry.id??h.id));
    if(openings.length){
      let edge=-w/2;
      for(const {x,doorWidth,threshold} of openings){
        const width=doorWidth*.82,left=x-width/2;
        const top=paired?threshold+doorHeightAt(threshold)*.82:1.80;
        add(G.box,mats.plaster,shade,(edge+left)/2,.24+height/2,0,left-edge,height,d);
        add(G.box,mats.plaster,shade,x,(top+height+.24)/2,0,width,height+.24-top,d);
        add(G.box,mats.plaster,shade,x,.24+height/2,-d/2+.14,width,height,.28);
        edge=x+width/2;
      }
      add(G.box,mats.plaster,shade,(edge+w/2)/2,.24+height/2,0,w/2-edge,height,d);
    }else add(G.box,mats.plaster,shade,0,.24+height/2,0,w,height,d);
    const span=w+(h.id==='workshop'?.33:.73),depth=d+.82;
    if(!profile.hip){
      const ends=new T.Mesh(gable(w,d,rise,profile),matte(shade,{map:tex.plaster,side:T.DoubleSide}));
      ends.position.set(...local(0,height+.19,0));ends.rotation.y=yaw;scene.add(ends);
    }
    const roofMat=mats.roofs[i%7===2?1:i%8===4?2:0];
    const roofMesh=new T.Mesh(roofMeshGeometry(span,depth,rise,profile),roofMat);
    roofMesh.position.set(...local(0,height+.19,0));roofMesh.rotation.y=yaw;scene.add(roofMesh);
    const tiledRoof=style==='mill'||style==='bakery'||shapedWindows;
    if(tiledRoof){
      const tiles=laidTiles(span,depth,rise,profile,tile,tileMaterial);
      tiles.position.copy(roofMesh.position);tiles.rotation.y=yaw;scene.add(tiles);
    }
    const snowy=new T.Mesh(roofMeshGeometry(span,depth,rise,profile,true,tiledRoof?.215:.074),M.snow);
    snowy.position.copy(roofMesh.position);snowy.rotation.y=yaw;winter.add(snowy);

    const roofTrim=[];
    const eaveHeight=(px,pz)=>{
      const u=.5+px/span;
      const end=roofPoint(u,1,span,depth,rise,profile)[2];
      return height+.19+roofPoint(u,.5+pz/(2*end),span,depth,rise,profile)[1];
    };
    for(const side of [-1,1]){
      const edge=side===1?.99:.01;
      const rail=Array.from({length:12},(_,j)=>{
        const [xx,yy,zz]=roofPoint(edge,j/11,span,depth,rise,profile);
        return new T.Vector3(xx,height+.135+yy,zz);
      });
      roofTrim.push(new T.TubeGeometry(new T.CatmullRomCurve3(rail),14,.052,5,false));
      timber(wood,side*(w/2-.082),(.59+height)*.5,frontZ+.039,.144,height-.35,.12);
      timber(wood,0,height+.16,side*(d/2+.036),w-.085,.12,.13);
      const rafterCount=Math.max(5,Math.round(d/.65));
      const innerX=side*(w/2-.065),outerX=side*(span/2-.064);
      for(let j=0;j<rafterCount;j++){
        const zz=mix(-d/2+.31,d/2-.31,(j+.5)/rafterCount);
        const outerY=eaveHeight(outerX,zz)-.065;
        const innerY=Math.min(height+.208,eaveHeight(innerX,zz)-.066);
        const dx=outerX-innerX,dy=outerY-innerY;
        timber(0x75523c,(outerX+innerX)*.5,(outerY+innerY)*.5,zz,
          Math.hypot(dx,dy),.073,.085,0,Math.atan(dy/dx));
      }
      if(!profile.hip){
        // Keep the gable trim tucked behind the roof edge at the eave and ridge.
        for(const [lo,hi] of [[.01,profile.ridge],[profile.ridge,.99]]){
          const trim=Array.from({length:13},(_,j)=>{
            const [xx,yy,zz]=roofPoint(mix(lo,hi,j/12),side===1?.989:.011,span,depth,rise,profile);
            return new T.Vector3(xx,height+.128+yy,zz);
          });
          roofTrim.push(new T.TubeGeometry(new T.CatmullRomCurve3(trim),16,.043,6,false));
        }
      }
    }
    const fascia=new T.Mesh(mergeGeometries(roofTrim),mats.roofTrim);
    fascia.position.set(...local(0,0,0));fascia.rotation.y=yaw;scene.add(fascia);
    const ridgeCount=Math.ceil(depth/.35);
    for(let j=0;j<ridgeCount;j++){
      const [xx,yy,zz]=roofPoint(profile.ridge,(j+.5)/ridgeCount,span,depth,rise,profile);
      add(mold,M.plain,[0xa85d48,0xb56950,0xa6624b][(i+j)%3],xx,height+.24+yy,zz,.20,depth/ridgeCount*.99*(1-(profile.hip||0)),.19,0,0,Math.PI/2);
    }
    if(h.id==='tower'){
      const cupolaX=(profile.ridge-.5)*span, top=height+rise;
      add(mold,mats.plaster,shade,cupolaX,top+.48,0,1.01,1.16,1.01);
      add(mold,M.plain,0x7a5440,cupolaX,top+.98,0,1.13,.13,1.13);
      const cap=new T.LatheGeometry([[.62,0],[.55,.13],[.42,.37],[.22,.62],[.06,.82],[0,.91]].map(p=>new T.Vector2(...p)),8);
      add(cap,roofMat,0xb2634e,cupolaX,top+1.045,0,1,1,1);
      add(G.ball,M.plain,0xb88458,cupolaX,top+2,0,.14,.15,.14);
      for(let k=0;k<7;k++){
        const angle=k*TAU/7;
        add(arch,mats.glass,0xe6b780,cupolaX+.49*Math.sin(angle),top+.55,.49*Math.cos(angle),.27,.43,.03,angle);
      }
    }
    if(!f){
      timber(wood,0,storyBeamY,frontZ+.034,w+.052,storyBeamHeight,.104);
      for(const side of [-1,1]){
        timber(wood,side*(w/2+.024),storyBeamY,.103,d-.132,storyBeamHeight,.086,Math.PI/2);
      }
    }
    const chimneyX=(i%2?1:-1)*w*.28,chimneyZ=-d*.22;
    box(0x98796c,chimneyX,height+rise*.68,chimneyZ,.56,1.7,.62);
    for(let row=0;row<5;row++){
      const cy=height+rise*.68+.70-row*.224;
      stoneBlock(chimneyX+(row%2===0?.12:-.12),cy,chimneyZ+.31,.31,.20,.105,row+i);
      stoneBlock(chimneyX-.24,cy,chimneyZ+(row%2?.14:-.13),.29,.193,.106,row+i+2,Math.PI/2);
    }
    box(0x795f50,chimneyX,height+rise*.68+.86,chimneyZ,.73,.19,.79);
    box(0x4e3b33,chimneyX,height+rise*.68+.96,chimneyZ,.43,.023,.47);
    snowBox(chimneyX,height+rise*.68+.99,chimneyZ,.71,.11,.76);

    const windowAt=(px,py,pz,ww,hh,role,angle=0)=>{
      const ax=Math.sin(angle),az=Math.cos(angle);
      const detail=(color,mm,xx,yy,zz,a,b,k,geo=G.box,turn=0)=>{
        add(geo,mm,color,px+xx*az+zz*ax,py+yy,pz-xx*ax+zz*az,a,b,k,angle+turn);
      };
      if(shapedWindows){
        detail(0xb39375,M.plain,0,0,-.014,ww+.21,hh+.20,.259,arch);
        detail(0x815235,mats.timber,0,0,.105,ww+.07,hh+.065,.13,arch);
        detail(0xffffff,mats.glass,0,0,.150,ww,hh,.037,arch);
      }else{
        detail(0x50382e,M.plain,0,0,-.035,ww+.17,hh+.17,.167);
        detail(0xffffff,mats.glass,0,0,.060,ww,hh,.022);
        for(const side of [-1,1]){
          detail(wood,mats.timber,side*(ww/2+.035),0,.082,.094,hh+.16,.18);
          detail(0x7f533b,mats.timber,0,side*(hh/2+.035),.080,ww+.025,.09,.165);
        }
        detail(0x634632,M.plain,0,hh/2+.066,.072,ww+.22,.063,.23);
      }
      detail(0x9a6647,mats.timber,0,0,.175,ww+(shapedWindows?.025:.06),shapedWindows?.033:.054,.045);
      detail(wood,mats.timber,0,0,.178,shapedWindows?.031:.055,hh,.047);
      detail(stone,M.plain,0,-hh/2-.075,.12,ww+.23,.093,.29);
      if(role==='postcards'){
        detail(0x80573d,mats.timber,0,-hh/2-.057,.229,ww+.19,.052,.409);
        detail(0xa47750,mats.timber,0,-hh/2-.025,.425,ww+.19,.030,.026);
      }
      if(role==='shutters'){
        for(const side of [-1,1]){
          const hinge=side*(ww/2+.044);
          const hingeDepth=shapedWindows?.148:.115;
          const turn=Math.PI-side*.15, c=Math.cos(turn),s=Math.sin(turn);
          const shutterDetail=(color,material,x,y,z,w,h,d,geo=G.box)=>
            detail(color,material,hinge+x*c+z*s,y,hingeDepth-x*s+z*c,w,h,d,geo,turn);
          const mid=-side*ww*.25;
          if(shapedWindows)shutterDetail(h.trim,mats.timber,0,0,0,ww,hh,.054,curvedShutters[side===1?1:0]);
          else shutterDetail(h.trim,mats.timber,mid,0,0,ww*.5,hh,.056);
          for(const cy of [-.31,.105]){
            shutterDetail(wood,mats.timber,mid,cy*hh,-.032,ww*.44,.034,.021);
            for(const u of [.11,.40]){
              shutterDetail(0xb49863,M.plain,-side*ww*u,cy*hh,-.046,.020,.020,.015);
            }
          }
          for(const [u,top] of [[.17,.34],[.33,.44]]){
            const y=shapedWindows?top:.48;
            shutterDetail(wood,mats.timber,-side*ww*u,(y-.48)*hh/2,-.028,.008,(y+.48)*hh,.008);
          }
        }
      }
      if(role==='flowers'){
        detail(0x80523b,M.plain,0,-hh/2-.06,.24,ww+.26,.19,.31);
        for(let k=0;k<4;k++){
          const xx=(k-1.5)*ww*.265,depth=.226+(k%2)*.044;
          const cx=px+xx*az+depth*ax,cz=pz-xx*ax+depth*az,cy=py-hh/2+.029;
          const size=.266+((i+k)%3)*.038;
          add(G.roses.plants[(k+2*i)%3],G.roses.material,0xffffff,cx,cy,cz,size,size,size,angle+(k-1.5)*.23);
        }
      }
    };
    const face=d/2+.09;
    const {doorWidth}=entry;
    const jambEdge=doorWidth*.629;
    const doorClear=Math.max(.81,jambEdge+.15);
    const room=w/2-.23-doorClear;
    const shopWindowX=doorClear+room/2;
    const shopWindowW=Math.min(w*.29,room-.37);
    if(paired){
      for(const side of [-1,1])windowAt(side*.98,1.33,face,1.58,1.30,'postcards');
    }else if(f){
      if(!giftShop)windowAt(-shopWindowX,1.47,face,shopWindowW,1.24,'plain');
      windowAt(shopWindowX,1.46,face,shopWindowW*.87,1.20,'plain');
    }else{
      // An open shutter spans a full window width from its centre, plus the hinge.
      const shutterWidth=Math.min(.76,shopWindowX-jambEdge-.14-.063,w/2-.22-shopWindowX-.063);
      const roomForShutters=shutterWidth>=.58;
      const ww=roomForShutters?shutterWidth:Math.min(.76,room-.36);
      const role=roomForShutters?'shutters':'plain';
      windowAt(-shopWindowX,1.51,face,ww,.93,role);
      windowAt(shopWindowX,1.51,face,ww,.93,role);
    }
    const upperHeight=Math.max(hasAwning?3.12:f?2.97:2.81,height*.74);
    const shortUpper=hasAwning?(height<4.03?.65:.87):height<3.75?.85:1.07;
    const upperWidths=[.76+random()*.35,.76+random()*.35];
    if(style==='bay'){
      // The projecting bay replaces the left sash. Leave the right sash on the wall.
      windowAt(w*.263,upperHeight,face,upperWidths[1],shortUpper,'flowers');
    }else if(style==='mill'||style==='tower'){
      windowAt(0,upperHeight,face,upperWidths[0],shortUpper,'flowers');
    }else{
      for(const side of [-1,1]) windowAt(side*w*.235,upperHeight,face,upperWidths[side===1?1:0],shortUpper,'flowers');
    }
    windowAt(-w/2-.075,Math.max(2.88,height*.73),-d*.16,.85,1.00,'shutters',-Math.PI/2);
    windowAt(w/2+.075,Math.max(2.82,height*.67),d*.12,.82,.94,'plain',Math.PI/2);
    const steepTowerSide=h.id==='tower';
    windowAt(-w/2-.079,steepTowerSide?1.52:1.39,d*.15,.92,steepTowerSide?.93:1.00,'shutters',-Math.PI/2);
    windowAt(w/2+.079,1.37,-d*.12,.87,.99,i%2?'flowers':'shutters',Math.PI/2);
    windowAt(w*.16,height*.72,-face,.76,1.12,'shutters',Math.PI);
    if(!profile.hip&&h.id!=='terrace')windowAt((profile.ridge-.5)*w,height+.69,face,.54,.73,'plain');

    const doorFace=face+.114;
    const doorHeight=doorHeightAt(entry.threshold);
    const doorY=portion=>entry.threshold+portion*doorHeight;
    for(const doorway of entries){
      const {id=h.id,x,trim,threshold,steps}=doorway;
      const heightOfDoor=doorHeightAt(threshold);
      const atHeight=portion=>threshold+portion*heightOfDoor;
      add(doorFrame,mats.timber,giftShop?0x906140:0x71503a,x,atHeight(.5),face+.035,doorWidth,heightOfDoor,.325);
      let addDoor=add;
      if(deliverable.has(id)){
        const house=new T.Group();house.position.set(h.x,y,h.z);house.rotation.y=yaw;scene.add(house);
        const hinge=new T.Group();hinge.position.set(x-doorWidth/2,0,doorFace);house.add(hinge);
        addDoor=(geo,material,color,px,py,pz,sx,sy,sz)=>{
          const mat=material.clone();mat.color.set(color);
          const mesh=new T.Mesh(geo,mat);
          mesh.position.set(px-x+doorWidth/2,py,pz-doorFace);mesh.scale.set(sx,sy,sz);
          hinge.add(mesh);
        };
        letterDoors.set(id,{house,entry:doorway,frontZ:doorFace,setOpen(angle){hinge.rotation.y=-angle;}});
      }
      addDoor(arch,mats.timber,trim??h.trim,x,atHeight(.5),doorFace,doorWidth,heightOfDoor,.13);
      for(const {x:offset,top} of plankSeams){
        const base=-.47;
        addDoor(G.box,M.plain,0x3a4839,x+offset*doorWidth,atHeight(.5+(base+top)/2),doorFace+.059,.013,(top-base)*heightOfDoor,.012);
      }
      addDoor(G.ball,M.plain,0xcc9a5f,x+.33*doorWidth,atHeight(.47),doorFace+.106,.075,.075,.088);
      if(paired){
        addDoor(G.box,M.plain,0x684232,x,atHeight(.63),doorFace+.071,.34,.111,.035);
        addDoor(G.box,M.plain,0xc5985b,x,atHeight(.63),doorFace+.091,.305,.082,.025);
        addDoor(G.box,M.plain,0x43352f,x,atHeight(.64),doorFace+.105,.247,.024,.011);
      }
      for(const {near,far,top,bottom,width} of steps){
        add(G.box,mats.plaster,stone,x,(top+bottom)/2-y,(near+far)/2,width,top-bottom,far-near);
      }
    }
    buildHouseMarker(h,face,add,G,M);

    const awningTop=Math.min(2.89,upperHeight-shortUpper/2-.232);
    if(hasAwning){
      const count=style==='bakery'?13:giftShop?7:9;
      const shortAwning=giftShop||marketShop;
      const aw=shortAwning?1.86:w*.69,segment=aw/count;
      const center=giftShop?giftWindowX:marketShop?-shopWindowX:0;
      const depth=shortAwning?.65:1.06;
      const drop=Math.min(shortAwning?.245:.31,awningTop-2.37);
      const slopingY=t=>awningTop-drop*t-.036*Math.sin(t*Math.PI);
      const frontEdge=slopingY(1);
      const points=[],colors=[],indices=[];
      const canvasMat=matte(0xffffff,{vertexColors:true,side:T.DoubleSide});
      const fold=[0,.19,.38,.57,.76,1], along=[0,.18,.36,.54,.72,.86,1], down=[.20,.44,.76,.91,1];
      for(let k=0;k<count;k++){
        const origin=segment*k-aw*.5;
        const color=new T.Color(giftShop?(k%2===0?0x41645d:0x65877a):k%2===0?h.trim:0xf3dfb6);
        const base=points.length/3,columns=fold.length;
        for(let j=0;j<=along.length+down.length;j++){
          const hem=j===along.length+down.length;
          const skirt=j>=along.length, t=hem?1:skirt?down[j-along.length]:along[j];
          for(const [col,u] of fold.entries()){
            const xx=origin+segment*u,ridge=Math.sin(Math.PI*u),sag=Math.sin(xx*1.2)*.021;
            const hang=.115+.061*ridge+.012*Math.sin(xx*1.2+.77);
            const y=(skirt?frontEdge-t*hang:slopingY(t))+sag;
            const z=skirt?depth+.025+.047*Math.sin(t*Math.PI*.85)+.034*ridge*t:.025+t*depth;
            points.push(xx,y+(hem?.013:0),z-(hem?.018:0));
            const tone=color.clone().multiplyScalar((.86+.17*ridge)*(skirt?(t>=.91?.74:.89+.09*t):1));
            colors.push(tone.r,tone.g,tone.b);
            if(j&&col){
              const v=base+j*columns+col,p=v-columns;
              indices.push(p-1,p,v-1,p,v,v-1);
            }
          }
        }
      }
      const awning=new T.Mesh(geometry(points,null,indices,colors),canvasMat);
      awning.position.set(...local(center,0,face));awning.rotation.y=yaw;scene.add(awning);
      timber(0x805a3e,center,awningTop-.026,face-.034,aw-.055,.067,.145);
      timber(0x805a3e,center,frontEdge-.047,face+depth+.003,aw-.062,.053,.053);
      for(const side of [-1,1]){
        const xx=center+side*aw*.435;
        const up=frontEdge-.055,down=frontEdge-.323,run=depth+.028;
        timber(0x75523c,xx,down,face-.060,.082,.111,.112);
        timber(0x78573e,xx,(up+down)*.5,face-.025+run*.5,.046,.052,Math.hypot(run,up-down),
          0,0,-Math.atan2(up-down,run));
      }
      const signX=w*.38,signY=Math.max(height*.65+.34,shortAwning?2.73:awningTop+.63);
      timber(wood,signX,signY+.229,face-.062,.106,.323,.130);
      timber(wood,signX,signY+.35,face+.48,.075,.085,.98);
      timber(wood,signX,signY+.15,face+.196,.075,.079,.51,0,0,-.65);
      add(mold,M.plain,0x63503b,signX,signY+.19,face+.91,.046,.34,.046);
      add(signDisk,mats.timber,0x624230,signX,signY-.23,face+.93,.98,.145,.98,0,0,Math.PI/2);
      add(signDisk,M.plain,0xa5714c,signX,signY-.23,face+1.014,.855,.05,.855,0,0,Math.PI/2);
      if(style==='bakery'){
        add(wheatRing,M.plain,0xf0c779,signX,signY-.16,face+1.047,.78,.71,.64,0,.54);
        const shelves=[1.03,1.44];
        for(const [row,yy] of shelves.entries()){
          timber(0x885434,-shopWindowX,yy-.105,face+.149,shopWindowW,.070,.20);
          for(let k=0;k<4;k++){
            const px=-shopWindowX+(k-1.5)*shopWindowW*.213,zz=face+.264;
            add(G.ball,M.plain,[0xc98343,0xd69b55,0xe4b56c][(k+row)%3],px,yy,zz,.33,.171,.192,0,.13);
            add(G.ball,M.plain,0xf0cd8c,px+.008,yy+.064,zz+.012,.14,.045,.135,0,-.52);
          }
        }
        for(const side of [-1,1]){
          const xx=side*w*.35;
          timber(0x744e38,xx,.54,face+.44,w*.18,.34,.51);
          for(let k=0;k<4;k++)add(G.ball,M.plain,k%2===0?0xdcab63:0xa66538,xx+(k-1.5)*.145,.72+(k%2)*.069,face+.46,.21,.22,.29);
        }
      }else if(giftShop){
        add(G.ball,M.plain,0xf2d2a0,signX,signY-.21,face+1.049,.34,.29,.052);
        add(G.ball,M.plain,0xce9e69,signX,signY-.263,face+1.076,.16,.104,.029);
        add(G.ball,M.plain,0x49322a,signX,signY-.251,face+1.091,.044,.039,.017);
        for(const side of [-1,1]){
          add(G.ball,M.plain,0xf2d2a0,signX+side*.13,signY-.087,face+1.049,.115,.111,.048);
          add(G.ball,M.plain,0x49322a,signX+side*.074,signY-.197,face+1.076,.026,.03,.016);
        }
      }else if(marketShop){
        const iy=signY-.22,iz=face+1.05;
        if(h.id==='herbs'){
          add(G.box,M.plain,0xecd5a0,signX,iy,iz,.032,.37,.034,0,-.30);
          for(const side of [-1,1])for(let k=0;k<2;k++){
            add(G.ball,M.plain,0xecd5a0,signX+side*.074+(k-.5)*.055,iy+(k-.5)*.127,iz+.018,
              .082,.168,.032,0,side*.77);
          }
          timber(0xa6754c,center,1.05,face+.26,shopWindowW+.17,.12,.37);
          for(const [j,color] of [0xa26a33,0xc38e45,0x84966e,0xcb834f,0xc09c65].entries()){
            const xx=center+(j-2)*.174, scale=j%2?.26:.19;
            add(mold,M.plain,color,xx,1.104+scale*.50,face+.30,.132,scale,.135);
            add(mold,M.plain,0xe0c59d,xx,1.119+scale,face+.30,.094,.042,.094);
          }
          for(const side of [-1,1]){
            const xx=center+side*.57;
            box(0x977a57,xx,2.311,face+.38,.019,.18,.018);
            add(G.sprig,M.foliage,side===1?0x8c8662:0x8e7168,xx,2.10,face+.38,.22,.41,.19,0,Math.PI+side*.16);
          }
        }else if(h.id==='tailor'){
          add(mold,M.plain,0xe8c496,signX,iy,iz,.221,.265,.07);
          for(const side of [-1,1]){
            add(mold,M.plain,0xf2d9a6,signX,iy+side*.126,iz,.325,.056,.077);
          }
          for(let j=-2;j<=2;j++)box(0xa56051,signX,iy+j*.034,iz+.033,.18,.013,.028);
          timber(0xa67552,center,1.03,face+.26,shopWindowW+.17,.12,.37);
          for(const [j,color] of [0xa14e58,0x537475,0xd6b884,0x685281].entries()){
            const xx=center+(j-1.5)*.221,yy=1.245+(j%2)*.035;
            add(mold,M.plain,color,xx,yy,face+.29,.153,.31,.135,0,(j-1.5)*.13);
            add(mold,M.plain,0xcb9c69,xx,yy+.15,face+.29,.087,.043,.078,0,(j-1.5)*.13);
          }
        }else if(h.id==='lanterns'){
          const domed=lanternGeometry(10,[[.296,.235],[.347,.255],[.343,.291],[.296,.33],[.265,.405],
            [.199,.454],[.109,.493],[.106,.524],[.038,.541],[0,.542]]);
          const square=lanternGeometry(4,[[.295,.239],[.371,.259],[.372,.29],[.282,.314],[.202,.345],
            [.129,.436],[.09,.482],[.046,.524],[0,.531]]);
          const lantern=(model,[x,y,z],scale,metal,brass,tint,turn,depth=1)=>{
            const part=(mesh,mat,color)=>add(mesh,mat,color,x,y,z,scale,scale,scale*depth,turn);
            part(model.frame,M.plain,metal);
            part(model.trim,M.plain,brass);
            part(model.candle,M.plain,0xffdfaa);
            part(model.flame,M.glow,0xffca71);
            part(model.panes,M.lanternGlass,tint);
          };
          lantern(G.hexLantern,[signX,iy-.022,iz+.050],.52,0x624236,0xf0cb83,0xf6b75f,0,.42);
          timber(0x8c624b,center,1.045,face+.30,shopWindowW+.17,.12,.46);
          lantern(domed,[center-.275,1.24,face+.359],.30,0x54756d,0xc4a172,0xdcce83,-.24);
          lantern(G.hexLantern,[center-.008,1.316,face+.372],.47,0x95613f,0xe3b573,0xffb963,.13);
          lantern(square,[center+.265,1.25,face+.373],.325,0x805458,0xcba97a,0xf0af89,.33);
        }else{
          for(const side of [-1,1]){
            add(G.box,M.plain,0xe7c690,signX+side*.094,iy,iz,.18,.212,.043,0,side*.18);
            add(G.box,M.plain,0xffe0a7,signX+side*.088,iy+.021,iz+.028,.153,.175,.019,0,side*.18);
            for(const dy of [-.01,.042])add(G.box,M.plain,0x9f7356,signX+side*.088,iy+dy,iz+.041,.097,.011,.015,0,side*.18);
          }
          timber(0x8e6148,center,1.045,face+.26,shopWindowW+.17,.12,.36);
          for(const [j,color] of [0x984b57,0x5b8379,0xc68a55,0x736586,0xac784c].entries()){
            const xx=center+(j-2)*.148, bookHeight=.27+(j%3)*.058, yy=1.099+bookHeight/2;
            add(G.box,M.plain,color,xx,yy,face+.29,.119,bookHeight,.15,0,(j-2)*.035);
            box(0xe6c096,xx,yy+.037,face+.369,.085,.042,.016);
          }
        }
      }else if(h.id==='cider'){
        add(G.ball,M.plain,0xb94f44,signX,signY-.239,face+1.064,.34,.31,.084);
        add(G.box,M.plain,0x653f2b,signX+.021,signY-.077,face+1.096,.029,.092,.023,0,-.22);
        add(G.ball,M.plain,0x728454,signX+.085,signY-.080,face+1.106,.144,.061,.036,0,.35);
      }else{
        add(G.ball,M.plain,0xf5d597,signX,signY-.21,face+1.049,.31,.31,.053);
        for(const side of [-1,1])add(G.ball,M.plain,0xf5d597,signX+side*.093,signY+.017,face+1.044,.105,.26,.052,0,side*-.20);
      }
      if(giftShop){
        const tx=giftWindowX,yy=1.57,zz=face+.29,fur=0xc28a62,muzzle=0xf0c198;
        const displayWidth=1.59;
        add(G.box,mats.timber,0xbe8256,tx,1.65,face+.014,displayWidth,1.29,.054);
        add(G.box,M.glow,0xf5c579,tx,2.185,face+.28,1.27,.051,.19);
        for(const side of [-1,1]){
          timber(0x81573c,tx+side*displayWidth/2,1.642,face+.26,.11,1.40,.57);
          timber(0x997054,tx+side*.28,1.64,face+.551,.036,1.28,.074);
          add(blocks[0],M.plain,0xad9681,tx+side*.59,.85,face+.22,.17,.205,.27);
        }
        timber(0x925d3c,tx,2.31,face+.28,1.72,.16,.62);
        timber(0x9d6946,tx,1.00,face+.31,1.80,.17,.71);
        timber(0xc08a5b,tx,1.34,face+.283,displayWidth,.055,.48);
        add(G.box,displayGlass,0xffffff,tx,1.655,face+.531,1.51,1.237,.012);
        add(G.ball,M.plain,fur,tx,yy-.017,zz,.40,.36,.23);
        add(G.ball,M.plain,fur,tx,yy+.256,zz,.43,.36,.28);
        const headY=yy+.214;
        add(G.ball,M.plain,muzzle,tx,headY,zz+.12,.22,.13,.12);
        add(G.ball,M.plain,0x523832,tx,headY+.028,zz+.172,.057,.045,.027);
        for(const side of [-1,1]){
          add(G.ball,M.plain,fur,tx+side*.15,headY+.202,zz,.142,.145,.115);
          add(G.ball,M.plain,muzzle,tx+side*.15,headY+.207,zz+.049,.081,.085,.025);
          add(G.ball,M.plain,0x392d2b,tx+side*.092,headY+.088,zz+.121,.036,.044,.030);
          add(G.ball,M.plain,fur,tx+side*.175,1.414,zz+.07,.155,.15,.19);
          add(G.ball,M.plain,0xb34e50,tx+side*.066,yy+.10,zz+.109,.15,.077,.06,0,side*.28);
          const px=tx+side*.49,c=side===1?0xab5e59:0x638279;
          box(c,px,1.187,zz,.27,.21,.30);
          box(0xedc18b,px,1.19,zz,.044,.225,.307);
          add(G.ball,M.plain,0xedc18b,px,1.303,zz,.16,.071,.10);
        }
        snowBox(tx,1.092,face+.572,1.65,.045,.14);
      }
    }
    // A low dormer gives the larger shops a second roofline.
    if(style==='bakery'||style==='gift'||style==='letter'||h.id==='books'||(style==='bay'&&i%2===0)){
      const side=i%2===0?1:-1, dx=side*w*.25,dz=d*(h.id==='books'?.12:.28);
      const u=.5+dx/span,[,localY]=roofPoint(u,.78,span,depth,rise,profile);
      const eave=height+.2+localY+.78, dw=style==='gift'?1.63:1.37, dd=1.17;
      const corners=[
        [dx-dw/2,dz-dd/2],[dx+dw/2,dz-dd/2],[dx+dw/2,dz+dd/2],[dx-dw/2,dz+dd/2]
      ];
      const walls=[],uv=[],indices=[];
      const foot=(x,z)=>height+.16+roofPoint(.5+x/span,.5+z/depth,span,depth,rise,profile)[1]-.09;
      for(let i=0;i<corners.length;i++){
        const [px,pz]=corners[i],[qx,qz]=corners[(i+1)%corners.length];
        const lowP=foot(px,pz),lowQ=foot(qx,qz),base=walls.length/3,len=Math.hypot(qx-px,qz-pz);
        walls.push(px,lowP,pz,qx,lowQ,qz,qx,eave+.034,qz,px,eave+.034,pz);
        uv.push(0,lowP*.57,len*.59,lowQ*.57,len*.59,eave*.57,0,eave*.57);
        indices.push(base,base+1,base+2,base,base+2,base+3);
      }
      const dormer=new T.Mesh(geometry(walls,uv,indices),matte(shade,{map:tex.plaster,side:T.DoubleSide}));
      dormer.position.set(...local(0,0,0));dormer.rotation.y=yaw;scene.add(dormer);
      const cap={ridge:.47,bend:.19,bow:.047};
      const frame=new T.Mesh(gable(dw,dd,.56,cap),matte(shade,{map:tex.plaster,side:T.DoubleSide}));
      frame.position.set(...local(dx,eave,dz));frame.rotation.y=yaw;scene.add(frame);
      const top=new T.Mesh(roofMeshGeometry(dw+.22,dd+.26,.57,cap),roofMat);
      top.position.copy(frame.position);top.rotation.y=yaw;scene.add(top);
      const snowCap=new T.Mesh(roofMeshGeometry(dw+.22,dd+.26,.57,cap,true),M.snow);
      snowCap.position.copy(frame.position);snowCap.rotation.y=yaw;winter.add(snowCap);
      const roomBelow=eave-foot(dx,dz+dd*.50);
      if(roomBelow>.40){
        const sashH=Math.min(.53,roomBelow-.18);
        windowAt(dx,eave-.10-sashH*.5,dz+dd*.51,.48,sashH,'shutters');
      }
    }
    if(style==='workshop'||style==='mill'){
      const side=style==='mill'?1:-1, xx=side*w*.42;
      timber(wood,xx,1.325,face+.55,.095,1.93,.105);
      timber(wood,xx,2.335,face+.29,.66,.095,.72,0,0,.17);
      timber(wood,xx,.59,face+.27,.76,.39,.43);
      if(style==='workshop'){
        const tools=[[-.16,.73],[.02,.77],[.19,.81]];
        for(const [off,yy] of tools){
          timber(0x7f5236,xx+off,yy,face+.34,.048,.38,.065,0,.17);
          box(0x89817c,xx+off-.012,yy+.17,face+.36,.18,.085,.097);
        }
      }
    }
    if(hero&&style!=='mill'&&h.id!=='shelter'){
      const wy=doorY(.69),wz=doorFace+.107,knotZ=wz+.04;
      const size=Math.min(.62,doorWidth*.64);
      add(wreathRing,M.plain,0x4b7450,0,wy,wz,size,size,.58,0,0,0,true);
      for(let k=0;k<7;k++){
        const a=k*TAU/7;
        add(flowerGeometry,M.plain,k%2===0?0x945055:0xa73542,
          Math.cos(a)*size*.34,wy+Math.sin(a)*size*.34,knotZ,.065,.076,.068,0,0,0,true);
      }
      for(const side of [-1,1]){
        add(G.ball,M.plain,0xb65657,side*size*.122,wy-size*.325,knotZ,.145,.075,.064,0,side*.23,0,true);
      }
    }
    if(hasBalcony){
      const bay=style==='bay';
      const center=bay?-w*.18:0;
      const floor=bay?upperHeight-.81:height*.55;
      const floorWidth=w*(bay?.43:.65);
      timber(wood,center,floor,face+.352,floorWidth,.128,.91);
      for(const side of [-1,1]){
        const run=.68,rise=.268;
        const support=center+floorWidth*(bay?(side===1?.18:-.35):side*.345);
        timber(0x75553e,support,floor-.187,face+.21,
          .084,.087,Math.hypot(run,rise),0,0,-Math.atan2(rise,run));
      }
      if(bay){
        add(G.box,mats.plaster,shade,center,upperHeight,face+.24,w*.37,1.54,.54);
        windowAt(center,upperHeight,face+.57,1.12,.95,'flowers');
        const hoodWidth=w*.41;
        timber(0xa6654c,center,upperHeight+.876,face+.317,hoodWidth,.074,.803,0,0,.235);
        timber(0x70503a,center,upperHeight+.771,face+.695,hoodWidth-.016,.075,.061);
        for(const side of [-1,1]){
          timber(0x7d583c,center+side*(hoodWidth*.5-.047),upperHeight+.819,face+.329,
            .073,.069,.73,0,0,.235);
        }
      }else{
        for(let k=0;k<7;k++)box(wood,center+(k-3)*w*.088,height*.55+.35,face+.82,.065,.68,.065);
        box(wood,center,height*.55+.7,face+.82,w*.65,.12,.1);
      }
    }
    if(style==='letter'){
      const lanternX=0,lanternY=2.38;
      box(0xba8459,lanternX,lanternY+.20,face+.20,.34,.09,.28);
      add(G.ball,M.glow,0xffcc7b,lanternX,lanternY,face+.20,.25,.31,.27);
      const points=[];
      for(let k=0;k<10;k++){
        const a=k*TAU/10, r=k%2?.14:.29;points.push(new T.Vector2(Math.sin(a)*r,Math.cos(a)*r));
      }
      const shape=new T.Shape(points);
      const star=new T.Mesh(new T.ShapeGeometry(shape),new T.MeshBasicMaterial({color:0xffe4a0,side:T.DoubleSide}));
      star.position.set(...local(lanternX,lanternY,face+.36));star.rotation.y=yaw;scene.add(star);
    }
  }
  return letterDoors;
}

function bridgeModel(scene,batch,tex,G,M,winter,addSurface) {
  const {a,b,x,halfWidth:w}=bridge;
  const mid=(a+b)/2, span=3.40, rise=1.25, spring=waterY-.42;
  const across=w+.115;
  const palette=[0x9e907f,0xbaaa96,0xc3ae98,0xac9986,0xc6b59e,0xb69f8b];
  const mortar=0x827568, stoneLight=0xc6b59f;
  const random=rng(1129);
  const tint=(c,f)=>new T.Color(c).multiplyScalar(f);
  const pos=[],colors=[];
  const tri=(p,q,r,c)=>{
    pos.push(...p,...q,...r);
    for(let i=0;i<3;i++)colors.push(c.r,c.g,c.b);
  };
  const quad=(p,q,r,s,c)=>{tri(p,q,r,c);tri(p,r,s,c);};
  const archCenter=xx=>mid+.24*(xx-x)/across;
  const archPoint=(theta, offset,xx)=>[
    xx,spring+Math.sin(theta)*(rise+offset),archCenter(xx)+Math.cos(theta)*(span+offset)
  ];
  const opening=(z,xx,offset=0)=>{
    const d=Math.abs(z-archCenter(xx)), radius=span+offset;
    return d<radius?spring+(rise+offset)*Math.sqrt(1-(d/radius)**2):4.08;
  };

  // The springers are below the stream. A continuous vault ties the two masonry faces together.
  const archSegments=34;
  for(let i=0;i<archSegments;i++){
    const u=i*Math.PI/archSegments,v=(i+1)*Math.PI/archSegments;
    const left=x-across,right=x+across;
    quad(archPoint(u,0,left),archPoint(v,0,left),archPoint(v,0,right),archPoint(u,0,right),
      tint(palette[(i>>1)%palette.length],.71));
  }

  function facadeStone(outline,side,out,baseColor,bevel=.024) {
    const count=outline.length;
    let dz=0,dy=0;
    for(const [z,y] of outline){dz+=z/count;dy+=y/count;}
    const back=outline.map(([z,y])=>[x+side*(out-.065),y,z]);
    const front=outline.map(([z,y])=>{
      const length=Math.hypot(z-dz,y-dy)||1,k=Math.max(.57,1-bevel/length);
      return [x+side*out,dy+(y-dy)*k,dz+(z-dz)*k];
    });
    const face=tint(baseColor,1);
    for(let i=1;i<count-1;i++)tri(front[0],front[i],front[i+1],face);
    for(let i=0;i<count;i++){
      const j=(i+1)%count, top=(outline[i][1]+outline[j][1])*.5>dy;
      quad(front[i],back[i],back[j],front[j],tint(baseColor,top?1.15:.71));
    }
  }

  const coping=bevelBlock([[-.44,-.36],[.46,-.36],[.43,.40],[-.40,.44]]);
  const fieldstone=bevelBlock([[-.40,-.36],[.39,-.42],[.44,.37],[-.44,.43]]);
  const wreath=new T.TorusGeometry(.36,.095,5,16);
  const sprig=new T.IcosahedronGeometry(.5,0);
  const snowLineMaterial=matte(0xf7f4ed,{side:T.DoubleSide});

  for(const side of [-1,1]){
    const xx=x+side*across;
    // Uprights are paved against a continuous body, with staggered stonework cut to the curve.
    const samplesCount=83, rows=12;
    for(let i=0;i<samplesCount;i++){
      const z0=mix(a,b,i/samplesCount),z1=mix(a,b,(i+1)/samplesCount);
      const low0=opening(z0,xx),low1=opening(z1,xx);
      quad([xx-side*.067,low0,z0],[xx-side*.067,low1,z1],
        [xx-side*.067,bridgeHeight(z1)+.02,z1],[xx-side*.067,bridgeHeight(z0)+.02,z0],
        tint(mortar,.95));
    }
    for(let row=0;row<rows;row++){
      const base=4.12+row*.255, cap=base+.237;
      let left=a+(row%2?-.33:0),k=0;
      while(left<b){
        const size=.46+random()*.30, z0=Math.max(a,left+.016),z1=Math.min(b,left+size-.010);
        left+=size;
        if(z1-z0<.06)continue;
        const inset=.27, top0=Math.min(cap,bridgeHeight(z0)-.041),top1=Math.min(cap,bridgeHeight(z1)-.041);
        const bottom0=Math.max(base,opening(z0,xx,inset)),bottom1=Math.max(base,opening(z1,xx,inset));
        const topLeft=top0-bottom0,topRight=top1-bottom1;
        if(topLeft<.031&&topRight<.031)continue;
        const poly=[[z0,Math.min(bottom0,top0-.014)],[z1,Math.min(bottom1,top1-.014)],[z1,top1],[z0,top0]];
        facadeStone(poly,side,across+.014+random()*.045,palette[(row+k+2)%palette.length],.028);
        k++;
      }
    }

    const stones=17;
    for(let i=0;i<stones;i++){
      const theta0=i*Math.PI/stones+.011,theta1=(i+1)*Math.PI/stones-.011;
      const key=i===Math.floor(stones/2), out=across+(key?.139:.093);
      const edge=x+side*out, inset=key?.36:.275+random()*.037;
      const walkZ=p=>Math.min(p[1],bridgeHeight(p[2])-.024);
      const coords=[
        archPoint(theta0,0,edge),archPoint(theta1,0,edge),
        archPoint(theta1,inset,edge),archPoint(theta0,inset,edge)
      ].map(p=>[p[2],walkZ(p)]);
      facadeStone(coords,side,out,key?0xd0b99a:palette[(i+2)%palette.length],.016);
      const near0=archPoint(theta0,0,edge),near1=archPoint(theta1,0,edge);
      quad(near0,archPoint(theta0,0,x+side*(across-.18)),
        archPoint(theta1,0,x+side*(across-.18)),near1,tint(stoneLight,.61));
    }

    // The rail has a broad base, two offset courses and rolled coping blocks.
    const railX=x+side*across;
    for(let i=0;i<3;i++){
      const count=i===2?18:23, pitch=(b-a-.68)/count;
      for(let j=0;j<count;j++){
        const z=a+.34+pitch*(j+.5), y=bridgeHeight(z);
        const tilt=Math.atan2(bridgeHeight(z-.06)-bridgeHeight(z+.06),.12);
        const offset=i===2?.61:.116+i*.258, h=i===2?.16:.258;
        batch.add(i===2?coping:fieldstone,M.plain,palette[(j+i*2+side+2)%palette.length],
          railX,y+offset,z,i===2?.55:.43,h,pitch*(i===2?.989:1.047),0,0,tilt);
      }
    }
    // Run the snow as a soft broken strip over the set-back coping.
    for(let i=0;i<5;i++){
      const lo=a+.89+i*2.23+(side===1?.18:0),hi=Math.min(lo+1.68+(i%2)*.20,b-.86);
      const positions=[],index=[];
      for(let j=0;j<=13;j++){
        const t=j/13,z=mix(lo,hi,t),edge=Math.sin(t*Math.PI)**.56;
        for(let k=0;k<3;k++){
          const u=k-1, half=.10+.14*edge+.025*Math.sin(t*36+i);
          positions.push(railX+u*half,bridgeHeight(z)+.690+
            .074*edge*(k===1?1:.55)+.012*Math.sin(t*31+k),z);
        }
        if(j){const q=j*3;index.push(q-3,q-2,q,q-2,q+1,q,q-2,q-1,q+1,q-1,q+2,q+1);}
      }
      const mesh=new T.Mesh(geometry(positions,null,index),snowLineMaterial);winter.add(mesh);
    }

    // Matched enclosed lanterns sit directly on the bridge piers.
    for(const [j,z] of [a+.43,b-.43].entries()){
      const y=bridgeHeight(z), pillarX=x+side*(w+.18);
      batch.add(coping,M.plain,0xa69787,pillarX,y+.115,z,.76,.26,.79);
      for(let k=0;k<4;k++){
        batch.add(fieldstone,M.plain,palette[(j+k+2)%palette.length],pillarX,y+.285+k*.228,z,
          .65-k*.031,.25,.65-k*.025,k%2*.035);
      }
      batch.add(coping,M.plain,0xc1ab94,pillarX,y+1.10,z,.75,.20,.74);
      {
        const scale=.61,center=y+1.229+.452*scale;
        const place=(geo,mat,color)=>batch.add(geo,mat,color,pillarX,center,z,scale,scale,scale,.32*side);
        const {frame,trim,candle,flame,panes}=G.hexLantern;
        place(frame,M.plain,0x604235);
        place(trim,M.plain,0xc48f5e);
        place(candle,M.plain,0xffe3b9);
        place(flame,M.glow,0xffcb6d);
        place(panes,M.lanternGlass,0xffca82);
        const glow=new T.Sprite(M.halo);
        glow.position.set(pillarX,center-.034,z);glow.scale.set(.64,.64,1);scene.add(glow);
        batch.add(coping,M.snow,0xffffff,pillarX,y+1.214,z,.68,.062,.65,0,0,0,true);
      }

      // Angled wing walls give each end a broad footing in the shore.
      const direction=j===0?-1:1;
      for(let k=0;k<6;k++){
        const t=k/5,px=x+side*(w+.44+t*1.55),pz=z+direction*t*1.23;
        const ground=groundHeight(px,pz);
        for(let level=0;level<2;level++){
          const h=(.34-level*.04)*(1-.42*t);
          batch.add(fieldstone,M.plain,palette[(level+k+j)%palette.length],px,ground+h*(.24+level*.83),pz,
            .42,h,.44,side*direction*-.64);
        }
      }
    }

    // Seasonal greenery is hung on both outer faces, leaving the walkway clear.
    const garlandX=railX+side*.271, crown=bridgeHeight(mid);
    for(let k=0;k<22;k++){
      const t=k/21,z=mix(mid-2.87,mid+2.87,t), dip=Math.sin(t*Math.PI);
      const y=bridgeHeight(z)+.53-.21*dip;
      const shade=[0x36594a,0x4a704f,0x567356,0x657b53][k%4];
      for(const [n,tilt] of [[0,-.71],[1,.65]]){
        batch.add(G.sprig,M.foliage,shade,garlandX+side*.024,y+.018*n,z+(n-.5)*.13,
          .32,.42,.40,side*Math.PI/2,tilt,.12*n,true);
      }
      if(k%3===1)batch.add(G.ball,M.glow,0xf5bf71,garlandX+side*.103,y-.02,z,.073,.080,.082,0,0,0,true);
      if(k%5===2)batch.add(G.ball,M.plain,0xa74546,garlandX+side*.126,y+.045,z+.03,.103,.091,.105,0,0,0,true);
    }
    batch.add(wreath,M.plain,0x426e51,garlandX+side*.073,crown+.225,mid,.67,.71,.71,Math.PI/2,0,0,true);
    for(const k of [-1,1]){
      batch.add(G.ball,M.plain,0xaf4849,garlandX+side*.19,crown+.43,mid+k*.135,.15,.13,.30,0,0,k*.21,true);
      batch.add(G.ball,M.plain,0x983b43,garlandX+side*.152,crown+.30,mid+k*.062,.103,.28,.11,0,0,k*.58,true);
    }

    // Tumbled stones and winter foliage tie the masonry into the banks.
    for(let i=0;i<24;i++){
      const px=x+side*(w+.58+random()*3.4);
      const bankSide=i%2===0?1:-1;
      const pz=riverZ(px)+bankSide*(riverWidth(px)+.23+random()*.89);
      const y=groundHeight(px,pz),q=.20+random()*.6;
      if(pavedAt(px,pz,q*.56+.14))continue;
      batch.add(G.stone,M.plain,palette[i%palette.length],px,y-q*.035,pz,q,q*.81,q*(.80+random()*.36),random()*TAU);
      if(i%3!==0)batch.add(sprig,M.plain,0x647145,px,y+q*.23,pz,q*.68,q*.28,q*.71,0);
      if(i%4===0)batch.add(sprig,M.plain,0xe0e9e0,px-.04,y+q*.31,pz,q*.60,q*.29,q*.66,0,0,0,true);
      if(i%7===0){
        for(let j=0;j<5;j++){
          const dx=(j-2)*.072, hue=j%2===0?0x7d8552:0x596b48;
          batch.add(G.box,M.plain,hue,px+dx,y+.20,pz+.14,.023,.37,.025,0,dx*2.1,.14);
        }
      }
    }
  }

  scene.add(new T.Mesh(geometry(pos,null,null,colors),matte(0xffffff,{side:T.DoubleSide,vertexColors:true})));
  const deck=matte(0xfdf5ee,{map:tex.road,side:T.DoubleSide});
  addSurface(ribbon(samples([[x,b],[x,a]],.21),(w+.13)*2,deck,(_,z)=>bridgeHeight(z),.031));
  // Fit the deck to the two existing roads without a visible gap around the end stones.
  const threshold=matte(0xf0dcc8,{map:tex.road,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1});
  for(const [z,dir] of [[a,-1],[b,1]]){
    const join=samples([[x,z],[x,z+dir*.65]],.16);
    addSurface(ribbon(join,w*1.88,threshold,(xx,zz)=>{
      const t=Math.abs(zz-z)/.65;
      return mix(bridgeHeight(z),groundHeight(xx,zz),t);
    },.040));
  }
}

function shrubGeometry() {
  const g=new T.SphereGeometry(.5,9,7), xyz=g.getAttribute('position');
  for(let i=0;i<xyz.count;i++){
    const x=xyz.getX(i),y=xyz.getY(i),z=xyz.getZ(i);
    const ridges=1+.14*Math.sin(x*11+y*8)*Math.cos(z*10-y*6);
    xyz.setXYZ(i,(x+y*.12)*ridges,y*ridges,z*ridges);
  }
  g.computeVertexNormals();
  return g;
}

function snowyRiverBanks(batch,G,M){
  const random=rng(5731);
  const shrub=[0x3d6a55,0x517958,0x627b4f,0x44694e];
  const snow=[0xf4eee8,0xe9e9ee,0xf2f0e9];
  const berry=[0xb85159,0x9f4550,0xcd6d69];
  const pillow=new T.SphereGeometry(.5,11,7);
  for(const [x,side,depth,width] of [
    [-13.1,1,.72,1.39],[-10.25,-1,.90,1.28],[-2.50,-1,.98,1.27],[-.24,1,.91,.88],
    [1.34,-1,1.20,.95],[8.75,-1,.98,1.04],[10.11,1,1.12,1.33],[13.30,-1,.72,1.19],[16.05,1,1.16,1.18]
  ]){
    for(let i=0;i<9;i++){
      const px=x+(random()-.5)*2*width,pz=riverZ(px)+side*(riverWidth(px)+depth+(random()-.5)*.76);
      const y=groundHeight(px,pz),size=.27+random()*.47,turn=random()*TAU;
      if(y<waterY+.08||pavedAt(px,pz,size*.68+.16)||houses.some(h=>inHouse(px,pz,h,size*.7)))continue;
      batch.add(G.shrub,M.plain,shrub[i%shrub.length],px,y+size*.25,pz,size,size*.69,size*.86,turn);
      batch.add(G.sprig,M.foliage,shrub[(i+1)%shrub.length],px,y+size*.37,pz,size*.64,size*.70,size*.62,turn,.55,.34);
      if(i%3!==2){
        for(const [j,offset] of [-.14,.08,.20].entries()){
          batch.add(pillow,M.snow,snow[(i+j)%3],px+offset*size,y+size*(.54+j*.035),pz+(j-1)*size*.084,
            size*(.41-.049*j),size*(.235-.02*j),size*.45,turn+j*.09,0,0,true);
        }
      }
      if(i%3===1){
        for(let k=0;k<4;k++){
          const xx=px+Math.cos(k*2.2)*size*.22,zz=pz+Math.sin(k*2.2)*size*.25;
          batch.add(G.ball,M.plain,berry[k%3],xx,y+size*(.46+.034*k),zz,.081,.080,.081);
        }
      }
    }
  }
}

function leaves(scene,batch,winter,G,M,props) {
  const rand=rng(8731);
  const palette=[0x4f6b57,0x62795d,0x68886b,0x526e60,0x799176];
  batch.add(props.fir.geometry,props.fir.material,0xf6eee2,
    northFir.x,groundHeight(northFir.x,northFir.z)-.11,northFir.z,5.9,4.65,5.1,-.37);
  for(let i=0;i<210;i++) {
    const x=(rand()-.5)*125,z=-37-rand()*126;
    if(Math.abs(z-riverZ(x))<riverWidth(x)+1.25 || houses.some(h=>inHouse(x,z,h,2)))continue;
    if(z<castle.z+22&&Math.abs(x-castle.x)<16)continue;
    if(viewpoints.some(v=>{
      const [ax,az]=nearestPoint(x,z,[[v.x,v.z],[v.look[0],v.look[2]]]);
      return Math.hypot(x-ax,z-az)<3.75;
    }))continue;
    if(z< -72&&z>court.z+1&&Math.abs(x-(11+(z+85)*-.16))<5.7)continue;
    if(z>-80&&z<-69&&Math.abs(x-3)<11)continue;
    if(z>-58&&z<-36&&Math.abs(x)<22)continue;
    if(pavedAt(x,z,1.75))continue;
    const h=2.9+rand()*4.9, y=groundHeight(x,z), rot=rand()*TAU;
    const close=x>-40&&x<53&&z>court.z-11;
    if(close){
      const sink=Math.min(.36,.04+Math.abs(groundHeight(x+.5,z)-groundHeight(x-.5,z))*.68);
      batch.add(props.fir.geometry,props.fir.material,0xffffff,x,y-sink,z,h,h,h,rot);
    }else{
      // Simplified crowns fill the distant forest beyond the streets.
      for(let j=0;j<3;j++){
        const w=h*(.29-j*.042), yy=y+h*(.43+j*.21);
        batch.add(G.pine,M.plain,palette[(i+j)%palette.length],x,yy,z,w,h*.50,w,rot+j*.79);
      }
    }
  }
  for(let i=0;i<285;i++){
    const x=-38+rand()*88,z=-42-rand()*82,y=groundHeight(x,z);
    const bank=Math.abs(z-riverZ(x))-riverWidth(x);
    if(bank<.17||houses.some(h=>inHouse(x,z,h,1.1))||Math.abs(x)<3&&z>-50)continue;
    const s=.22+rand()*.85;
    if(pavedAt(x,z,s*.79+.22))continue;
    const kind=i%5,turn=rand()*TAU;
    if(kind===0){
      batch.add(G.stone,M.plain,0x8f8275,x,y+s*.19,z,s*.92,s*.59,s,turn);
      batch.add(G.stone,M.plain,0xe6eae1,x,y+s*.38,z,s*.73,s*.29,s*.84,turn,0,0,true);
    }
    const branches=kind===1?9:kind===0?3:5;
    for(let j=0;j<branches;j++){
      const a=turn+j*2.399,r=s*(.09+rand()*.31), px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r;
      const by=groundHeight(px,pz),size=s*(.37+rand()*.41),leafColor=palette[(i+j)%palette.length];
      if(kind>=2){
        batch.add(G.shrub,M.plain,leafColor,px,by+size*.31,pz,size*(1.10+rand()*.23),size*.74,size*.77,a);
      }
      if(kind===1||kind===3||j%2===0){
        const spread=kind===1?.38:.49;
        batch.add(G.sprig,M.foliage,kind===1?0x748558:leafColor,
          px,by+size*.42,pz,size*spread,size*(kind===1?1.12:.88),size*.56,a,(j%2?.44:-.51),.26);
      }
      if(kind===3||kind===4&&j%2===0){
        const color=[0xb87e83,0xd99c9f,0xe8c5ab,0xcd9691][(i+j)%4];
        const top=by+size*(.71+rand()*.14);
        batch.add(G.box,M.plain,0x65804e,px,(top+by)*.5,pz,.021,top-by,.021,a,.10);
        for(let k=0;k<3;k++){
          const rot=a+k*TAU/3, rr=size*.050;
          batch.add(G.stone,M.plain,color,px+Math.sin(rot)*rr,top+(k===1?-.022:.015),pz+Math.cos(rot)*rr,
            size*.20,size*.145,size*.19,rot);
        }
      }
    }
  }
  for(const [i,[x,z]] of streetLamps.entries()) {
    if(pavedAt(x,z,.24)||houses.some(h=>inHouse(x,z,h,.39)))continue;
    const y=groundHeight(x,z), scale=.79+(i%3)*.027, h=props.lamp.height*scale;
    batch.add(props.lamp.geometry,props.lamp.material,0xffffff,x,y-.025,z,scale,scale,scale,i*.57);
    const sprite=new T.Sprite(M.halo);
    sprite.position.set(x,y+h*.845,z);sprite.scale.set(1.88,1.88,1);scene.add(sprite);
  }
  for(const p of [[-16,-76.4,-15.2,-77.65],[5.2,-89,7.85,-88.7],[29.8,-103.2,32.3,-102.5],[21,-112,24,-111.8]]) {
    const [ax,az,bx,bz]=p, len=Math.hypot(bx-ax,bz-az),n=Math.ceil(len/.55);
    for(let j=0;j<n;j++){
      const t=(j+.5)/n,x=mix(ax,bx,t),z=mix(az,bz,t),y=groundHeight(x,z);
      if(pavedAt(x,z,.22)||houses.some(h=>inHouse(x,z,h,.24)))continue;
      batch.add(G.box,M.plain,0xafa395,x,y+.16,z,len/n*.97,.47,.42,Math.atan2(az-bz,bx-ax));
      if(j%2)batch.add(G.box,M.plain,0xeeeae1,x,y+.42,z,len/n*.99,.06,.44,Math.atan2(az-bz,bx-ax),0,0,true);
    }
  }

  const {x,z,height,sink}=tree,soilY=treeSoilHeight(),y=soilY-sink,width=height*.935;
  batch.add(props.fir.geometry,props.fir.material,0xf3fff6,x,y,z,width,height,width,.36);
  for(let j=0;j<5;j++){
    const yy=y+height*(.26+j*.126),r=width*(.230-j*.031);
    for(let i=0;i<10;i++){
      const a=i*TAU/10+j*.72;
      batch.add(G.ball,M.glow,i%3===0?0xde6253:0xffc77c,x+Math.cos(a)*r,yy+(i%3)*.10,z+Math.sin(a)*r,.17,.16,.17,0,0,0,true);
    }
  }
  for(let layer=0;layer<6;layer++){
    const count=29-layer*3,r=width*[.236,.224,.181,.148,.111,.077][layer];
    for(let i=0;i<count;i++){
      const a=i*TAU/count+layer*1.56, radius=r*(1+.067*Math.sin(a*5+layer));
      const yy=y+height*(.226+layer*.122)+.21*Math.sin(a*3+layer);
      const size=i%6===0?.106:.069;
      batch.add(G.ball,M.glow,i%6===0?0xffba60:0xffda84,x+Math.cos(a)*radius,yy,z+Math.sin(a)*radius,
        size,size,size,0,0,0,true);
    }
  }
  for(const [a,level] of [[.62,.42],[1.93,.53],[4.4,.38],[5.60,.61]]){
    const r=width*(.290-.277*level),yy=y+height*level;
    const xx=x+Math.sin(a)*r,zz=z+Math.cos(a)*r;
    for(const side of [-1,1]){
      const u=side*.16;
      batch.add(G.ball,M.plain,0xb8463f,xx+Math.cos(a)*u,yy+.036,zz-Math.sin(a)*u,.35,.211,.095,a,side*-.32,0,true);
      batch.add(G.box,M.plain,0xab3e3c,xx+Math.cos(a)*u*.76,yy-.19,zz-Math.sin(a)*u*.76,.113,.31,.068,a,side*.23,0,true);
    }
    batch.add(G.ball,M.plain,0xd36453,xx,yy,zz,.13,.125,.133,a,0,0,true);
  }
  for(let i=0;i<8;i++){
    const a=i*TAU/8,r=1.14+(i%3)*.23, px=x+Math.sin(a)*r,pz=z+Math.cos(a)*r,h=.27+(i%3)*.11;
    const py=soilY+h*.5;
    batch.add(G.box,M.plain,[0xad4d4e,0x5f8475,0xc39b62][i%3],px,py,pz,.38,h,.4,a,0,0,true);
    batch.add(G.box,M.plain,0xf2d69a,px,py+.01,pz,.09,h+.025,.414,a,0,0,true);
    batch.add(G.box,M.plain,0xf2d69a,px,py+.013,pz,.393,h+.026,.085,a,0,0,true);
  }
  const starShape=new T.Shape(Array.from({length:10},(_,i)=>{
    const a=i*TAU/10,r=i%2?.27:.59;return new T.Vector2(Math.sin(a)*r,Math.cos(a)*r);
  }));
  const star=new T.Mesh(new T.ShapeGeometry(starShape),new T.MeshBasicMaterial({color:0xffdb95,side:T.DoubleSide}));
  star.position.set(x,y+height+.30,z);star.rotation.y=.3;winter.add(star);
  const halo=new T.Sprite(M.halo);halo.position.copy(star.position);halo.scale.set(2.3,2.3,1);winter.add(halo);
}

function landscape(scene,batch,G,M,tex,fir){
  const stoneGeo=bevelBlock([[-.43,-.39],[.44,-.38],[.43,.42],[-.44,.32]]);
  const grey=[0xb8a48b,0x9f9585,0xb2a38f,0xc0a88b,0x9f8b76];
  const petal=new T.IcosahedronGeometry(.5,0);
  const benchWood=matte(0xffffff,{map:tex.wood});
  const mulch=matte(0x936d52,{map:tex.grass,side:T.DoubleSide});
  const random=rng(93721);
  for(const [i,line] of terraceWalls.entries()){
    const rows=(i===2?2:3),height=.235;
    for(let j=1;j<line.length;j++){
      const [az0,az1]=[line[j-1],line[j]], dx=az1[0]-az0[0],dz=az1[1]-az0[1],len=Math.hypot(dx,dz);
      const count=Math.ceil(len/.55),angle=Math.atan2(-dz,dx);
      for(let row=0;row<=rows;row++){
        for(let k=0;k<count+1;k++){
          const l=Math.max(0,(k-(row%2? .46:0))/count),r=Math.min(1,(k+1-(row%2?.46:0))/count);
          if(r-l<.056)continue;
          const x=mix(az0[0],az1[0],(l+r)*.5),z=mix(az0[1],az1[1],(l+r)*.5),y=groundHeight(x,z);
          if(pavedAt(x,z,.07)||houses.some(h=>inHouse(x,z,h,.12)))continue;
          const top=row===rows, heightScale=top?.16:height;
          batch.add(stoneGeo,M.plain,grey[(j+k*3+row)%5],x,y+.084+row*height,z,
            (r-l)*len*.997,heightScale,top?.50:.43,angle,(random()-.5)*.058);
          if(top&&(k+i)%3!==1)batch.add(stoneGeo,M.plain,0xf2f2ee,x,y+.172+row*height,z,
            (r-l)*len*.79,.072,.44,angle,0,0,true);
        }
      }
    }
  }
  for(const [j,p] of gardens.entries()){
    scene.add(ellipseGround(p,mulch));
    const shrubColors=[0x47694f,0x5a7655,0x71875a];
    const count=p.kind==='grove'?28:26;
    for(let i=0;i<count;i++){
      const a=i*2.39996,v=.18+.73*Math.sqrt(random()),x=p.x+Math.cos(a)*p.rx*v,z=p.z+Math.sin(a)*p.rz*v;
      const y=groundHeight(x,z),h=.18+random()*(p.kind==='grove'?.62:.39);
      if(y<waterY+.13||pavedAt(x,z,h*.62+.15)||houses.some(h=>inHouse(x,z,h,.24)))continue;
      const lean=random()*.8-.4;
      if(p.kind==='grove'||i%3===2){
        batch.add(G.sprig,M.foliage,shrubColors[i%3],x,y+h*.45,z,h*.58,h,h*.52,a,lean,.25);
        if(i%3!==1)batch.add(G.shrub,M.plain,shrubColors[(i+1)%3],x,y+h*.32,z,h*.81,h*.55,h*.76,a);
      }else{
        const scale=.35+h*.81;
        batch.add(G.roses.plants[(i+j)%3],G.roses.material,0xffffff,x,y+.018,z,scale,scale,scale,a,lean*.32);
        if(i%7===0)batch.add(petal,M.snow,0xffffff,x+.060,y+.08,z,.18,.062,.12,a,0,0,true);
      }
    }
    if(p.kind==='grove')for(const [k,[dx,dz]] of [[-.31,.13],[.46,-.26],[.05,.51]].entries()){
      const x=p.x+dx*p.rx,z=p.z+dz*p.rz,y=groundHeight(x,z),h=2.2+k*.62;
      if(pavedAt(x,z,h*.38)||houses.some(h=>inHouse(x,z,h,.65)))continue;
      batch.add(fir.geometry,fir.material,0xf1f6ed,x,y-.065,z,h*.84,h,h*.86,j+k*1.62);
    }
    for(let i=0;i<17;i++){
      const a=i*TAU/17, x=p.x+Math.cos(a)*p.rx*.96,z=p.z+Math.sin(a)*p.rz*.96,y=groundHeight(x,z);
      if(y>waterY+.13&&(i+j)%3!==1&&!pavedAt(x,z,.24)){
        batch.add(stoneGeo,M.plain,grey[(i+j)%grey.length],x,y+(p.kind==='river'?.022:.07),z,.32,.16,.23,a,0);
      }
    }
    if(p.kind==='river'){
      for(let i=0;i<22;i++){
        const a=i*2.39996,v=.92*Math.sqrt((i+.5)/22);
        const x=p.x+Math.cos(a)*p.rx*v,z=p.z+Math.sin(a)*p.rz*v,y=groundHeight(x,z);
        if(y<waterY+.12||pavedAt(x,z,.29)||houses.some(h=>inHouse(x,z,h,.22)))continue;
        const width=.32+(i%4)*.113;
        batch.add(G.ball,M.snow,0xffffff,x,y+.081,z,width,.075,width*.81,a,0,0,true);
      }
    }
  }

  for(const [i,{x,z,yaw}] of benches.entries()){
    const y=groundHeight(x,z),s=Math.sin(yaw),c=Math.cos(yaw);
    const put=(geo,mat,col,u,v,n,w,h,d,roll=0,pitch=0,snow=false)=>{
      batch.add(geo,mat,col,x+u*c+n*s,y+v,z-u*s+n*c,w,h,d,yaw,roll,pitch,snow);
    };
    for(const u of [-.63,.63]){
      for(const v of [-.18,.18])put(G.box,M.plain,0x544438,u,.225,v,.087,.50,.11,v*.32);
      put(G.box,M.plain,0x59463b,u,.65,-.227,.082,.52,.092,0,-.14);
    }
    for(let j=0;j<3;j++){
      put(G.box,benchWood,0xae805b,0,.492,-.17+j*.166,1.695,.079,.155);
      put(G.box,benchWood,0xaa7652,0,.66+j*.115,-.225-j*.018,1.67,.093,.082,0,-.14);
    }
    if(i===benches.length-1){
      for(let j=0;j<5;j++)put(G.box,benchWood,j%2?0xad5055:0x9c414a,.46+(j-2)*.053,.528,.09,.058,.035,.31,0,0,true);
    }
  }
}

function buildStreets(batch,tex,G,M,addSurface){
  const road=matte(0xffffff,{map:tex.road,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1});
  const bridgeEntrance=pavedPaths[0].points.findIndex(([x,z])=>x===bridge.x&&z===bridge.a);
  for(const [i,path] of pavedPaths.entries()){
    const lines=i===0?[path.points.slice(0,bridgeEntrance).concat([[bridge.x,bridge.b]]),path.points.slice(bridgeEntrance)]:[path.points];
    for(const line of lines){
      const points=samples(line,.31);
      addSurface(ribbon(points,path.width,road,groundHeight,i===0?.124:.109));
      if(i!==0)continue;
      for(let j=1;j<points.length-1;j+=2){
        const [cx,cz]=points[j],[ax,az]=points[j-1],[bx,bz]=points[j+1];
        const dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz),edge=path.width/2-.10;
        if(cz>-43.4||Math.abs(cz-bridge.a)<.5||Math.abs(cz-bridge.b)<.5)continue;
        const yaw=Math.atan2(dx,dz),pitch=-Math.atan2(groundHeight(bx,bz)-groundHeight(ax,az),len);
        for(const side of [-1,1]){
          const x=cx+dz/len*edge*side,z=cz-dx/len*edge*side;
          if(pavedAt(x,z,.24,path)||houses.some(h=>inHouse(x,z,h,.31)))continue;
          const y=groundHeight(x,z);
          batch.add(G.box,M.plain,[0xbbb09e,0xc4b39d,0xbba68e][(j+2+side)%3],x,y+.136,z,.25,.11,len*.95,yaw,0,pitch);
          if((j+(side===1?0:2))%7<2)batch.add(G.stone,M.plain,0xedeeea,x,y+.197,z,.28,.069,len*.87,yaw,0,pitch,true);
        }
      }
    }
  }
  for(const a of squares)if(!a.outline)addSurface(ellipseGround(a,road,true));
  for(const area of forecourts){
    const line=[front(area,-area.d),front(area,0)];
    addSurface(ribbon(samples(line,.27),area.w,road,groundHeight,.117));
  }
}

const squarePavingHeight=(x,z)=>groundHeight(x,z)+.161;
const treeSoilHeight=()=>squarePavingHeight(tree.x,tree.z)+tree.planterHeight-.095;

function buildUpperTerrace(scene,batch,tex,G,M,addSurface){
  const {x,z,outline}=upperTerrace;
  const edge=samples([...outline,outline[0]],.26);
  const paving=meshGrid(13,edge.length-1,(u,v)=>{
    const [a,b]=edge[Math.round(u*(edge.length-1))];
    const px=mix(x,a,v),pz=mix(z,b,v);
    return [px,squarePavingHeight(px,pz),pz];
  });
  const pos=paving.getAttribute('position'),uv=paving.getAttribute('uv');
  for(let i=0;i<pos.count;i++)uv.setXY(i,pos.getX(i)*.29,pos.getZ(i)*.29);
  addSurface(new T.Mesh(paving,matte(0xe5ccb8,{map:tex.road,side:T.DoubleSide})));

  const block=bevelBlock([[-.44,-.34],[.42,-.40],[.44,.37],[-.39,.40]]);
  const baluster=new T.LatheGeometry([[.09,0],[.10,.07],[.066,.12],[.058,.23],[.087,.31],[.080,.41],[.054,.49],[.09,.53],[.09,.57]].map(p=>new T.Vector2(...p)),7);
  const stones=[0xad9b89,0xc4b39e,0xb7a48f,0xcdb9a3];
  for(const [i,[ax,az]] of terraceRail.slice(0,-1).entries()){
    const [bx,bz]=terraceRail[i+1],length=Math.hypot(bx-ax,bz-az),yaw=Math.atan2(az-bz,bx-ax);
    const outwardX=(az-bz)/length,outwardZ=(bx-ax)/length;
    const bays=Math.ceil(length/.48);
    for(let j=0;j<bays;j++){
      const t=(j+.5)/bays,px=mix(ax,bx,t),pz=mix(az,bz,t),y=squarePavingHeight(px,pz);
      const span=length/bays;
      const foot=groundHeight(px+outwardX*.92,pz+outwardZ*.92);
      const courses=Math.max(4,Math.ceil((y-foot+.38)/.234));
      for(let row=0;row<courses;row++){
        const setback=row===0?0:.24;
        batch.add(block,M.plain,stones[(j+i+row)%4],px+outwardX*setback,y+.07-row*.234,pz+outwardZ*setback,
          span*1.004,.267,row===0?.47:.95,yaw);
      }
      batch.add(baluster,M.plain,stones[(j+i+2)%4],px,y+.178,pz);
      batch.add(G.box,M.plain,0xcab7a1,px,y+.805,pz,span*1.007,.14,.37,yaw);
      if(j%3!==1)batch.add(block,M.snow,0xffffff,px,y+.893,pz,span*.85,.07,.27,yaw,0,0,true);
    }
  }
  for(const [i,[px,pz]] of terraceRail.entries()){
    const y=squarePavingHeight(px,pz);
    batch.add(G.box,M.plain,stones[i%4],px,y+.40,pz,.39,.98,.42);
    batch.add(block,M.plain,0xd0bfa8,px,y+.914,pz,.50,.14,.51);
    if(i===0||i===terraceRail.length-1){
      batch.add(G.box,M.plain,0x594a3d,px,y+1.01,pz,.25,.10,.25);
      batch.add(G.box,M.glow,0xffd995,px,y+1.163,pz,.185,.22,.185);
      batch.add(G.box,M.plain,0x594a3d,px,y+1.30,pz,.28,.09,.28);
    }
  }
  const [flagX,flagZ]=terraceRail[0].map((start,i)=>mix(start,terraceRail[1][i],.26));
  const base=squarePavingHeight(flagX,flagZ);
  batch.add(G.box,M.plain,0x604a3b,flagX,base+2.15,flagZ,.095,2.89,.095);
  batch.add(G.ball,M.plain,0xc49e64,flagX,base+3.62,flagZ,.16,.16,.16);
  const flag=meshGrid(7,5,(u,v)=>[
    u*.89,.06-.47*v+.17*u*Math.abs(v-.5),.12*Math.sin(u*5.1+v*.74)*u
  ]);
  const banner=new T.Mesh(flag,matte(0xa45154,{side:T.DoubleSide}));
  banner.position.set(flagX,base+3.38,flagZ);banner.rotation.y=.12;scene.add(banner);
  batch.add(G.box,M.plain,0x5b4439,flagX,base+2.52,flagZ+.15,.19,.30,.31);
  batch.add(G.box,M.glow,0xffc980,flagX,base+2.52,flagZ+.159,.145,.21,.306);
}

function buildHillGate(batch,G,M){
  const {x,z,halfOpening:radius,width,depth}=hillGate;
  const y=groundHeight(x,z), spring=1.91, band=.43, count=13;
  const tones=[0xb9a18d,0xc8b4a0,0xb8aa98,0xcfbaa5];
  const block=bevelBlock([[-.44,-.36],[.44,-.39],[.43,.42],[-.41,.38]]);
  const pierWidth=width/2-radius;
  for(const side of [-1,1]){
    const px=x+side*(radius+pierWidth*.50);
    batch.add(G.box,M.plain,0xb19e8a,px,y+1.82,z,pierWidth,4.15,depth);
    for(let row=0;row<10;row++){
      for(const face of [-1,1]){
        const yy=y+.10+row*.38;
        for(const q of [-1,1])batch.add(block,M.plain,tones[(row+q+side+6)%4],
          px+q*(pierWidth*.235)+(row%2?.032:-.032),yy,z+face*depth*.495,pierWidth*.495,.38,.25,0);
      }
    }
    batch.add(G.box,M.plain,0xc4af97,px,y+4.00,z,pierWidth+.16,.165,depth+.12);
    batch.add(block,M.snow,0xffffff,px,y+4.11,z,pierWidth+.12,.095,depth+.095,0,0,0,true);
    const face=z+depth*.68;
    batch.add(G.box,M.plain,0x644736,px,y+1.97,face,.27,.11,.25);
    batch.add(G.box,M.glow,0xffd69a,px,y+2.13,face,.20,.245,.185);
    batch.add(G.box,M.plain,0x644736,px,y+2.30,face,.32,.10,.27);
  }
  for(let j=0;j<count;j++){
    const a=(j+.5)*Math.PI/count;
    const shape=new T.Shape();
    const points=[[radius,a-.50*Math.PI/count],[radius+band,a-.50*Math.PI/count],
      [radius+band,a+.50*Math.PI/count],[radius,a+.50*Math.PI/count]];
    shape.setFromPoints(points.map(([r,t])=>new T.Vector2(r*Math.cos(t),r*Math.sin(t))));
    shape.closePath();
    const geometry=new T.ExtrudeGeometry(shape,{depth:depth+.08,bevelEnabled:false}).translate(0,0,-depth*.5-.04);
    batch.add(geometry,M.plain,tones[j%4],x,y+spring,z);
  }
  batch.add(block,M.plain,0xc4af97,x,y+spring+radius+band+.09,z,1.57,.23,depth+.15);
  batch.add(block,M.snow,0xffffff,x,y+spring+radius+band+.238,z,1.47,.09,depth+.085,0,0,0,true);
}

function buildTreeSquare(scene,batch,tex,G,M,addSurface){
  const square=treeSquare,edge=[...square.outline,square.outline[0]];
  const boundary=samples(edge,.28),rows=25;
  const base=meshGrid(rows,boundary.length-1,(u,v)=>{
    const [a,b]=boundary[Math.round(u*(boundary.length-1))];
    const x=mix(square.x,a,v),z=mix(square.z,b,v);
    return [x,squarePavingHeight(x,z),z];
  });
  const coord=base.getAttribute('position'),uv=base.getAttribute('uv');
  for(let i=0;i<coord.count;i++){
    const x=coord.getX(i)-tree.x,z=coord.getZ(i)-tree.z;
    uv.setXY(i,(.937*x+.35*z)*.31,(-.35*x+.937*z)*.31);
  }
  const plazaStone=matte(0xe0ceba,{map:tex.road,side:T.DoubleSide});
  addSurface(new T.Mesh(base,plazaStone));
  const landing=samples([[bridge.x,bridge.a+.69],[bridge.x,bridge.a-.71]],.13);
  addSurface(ribbon(landing,bridge.halfWidth*1.86,plazaStone,(x,z)=>{
    const t=smooth(bridge.a-.52,bridge.a+.58,z);
    return mix(Math.max(groundHeight(x,z),bridgeHeight(z))+.173,bridgeHeight(z)+.047,t);
  },0));

  const stoneGeo=bevelBlock([[-.43,-.36],[.40,-.40],[.46,.29],[.33,.42],[-.43,.34]]);
  const greys=[0xb2a293,0xbfac95,0xcbb8a0,0xa99583,0xbfa890];
  const chance=rng(1924);
  const polar=(r,a)=>[tree.x+Math.sin(a)*r,tree.z+Math.cos(a)*r];

  // Cut stone follows the curved river edge. The opening stays clear at the bridge.
  for(let i=1;i<squareBank.length;i++){
    const [ax,az]=squareBank[i-1],[bx,bz]=squareBank[i],length=Math.hypot(bx-ax,bz-az);
    const n=Math.ceil(length/.48),yaw=Math.atan2(az-bz,bx-ax);
    for(let row=0;row<3;row++)for(let j=0;j<n;j++){
      const t=(j+.5)/n,x=mix(ax,bx,t),z=mix(az,bz,t);
      const y=groundHeight(x,z)+.117+row*.13,w=length/n;
      batch.add(stoneGeo,M.plain,greys[(i+j+row*2)%5],x,y,z,w,.139,row===2?.42:.32,yaw,(chance()-.5)*.048);
      if(row===2&&j%3!==1)batch.add(stoneGeo,M.snow,0xffffff,x,y+.081,z,w*.83,.063,.36,yaw,0,0,true);
    }
  }

  const soilY=treeSoilHeight(),pavingY=squarePavingHeight(tree.x,tree.z);
  const foundationY=pavingY-.24,wallRadius=tree.radius-.13;
  const planterWall=new T.CylinderGeometry(wallRadius-.045,wallRadius-.04,soilY-foundationY,56);
  const planterMesh=new T.Mesh(planterWall,matte(0xa89480,{map:tex.plaster}));
  planterMesh.position.set(tree.x,(soilY+foundationY)*.5,tree.z);
  scene.add(planterMesh);
  const soil=new T.Mesh(new T.CircleGeometry(wallRadius-.09,48),matte(0x786352,{map:tex.grass}));
  soil.rotation.x=-Math.PI/2;soil.position.set(tree.x,soilY+.009,tree.z);scene.add(soil);
  for(let row=-1;row<=4;row++){
    const coping=row===4,count=coping?36:32;
    const width=TAU*wallRadius/count,y=pavingY+.033+row*.165;
    for(let i=0;i<count;i++){
      const a=(i+Math.abs(row%2)*.5)*TAU/count;
      const [x,z]=polar(wallRadius+(coping?.006:0),a);
      batch.add(stoneGeo,M.plain,greys[(i*3+row+greys.length+Math.floor(chance()*3))%greys.length],x,y,z,
        width*(coping?.986:1.014),coping?.151:.181,coping?.305:.209,a,(chance()-.5)*.051);
      if(coping&&(i%9<3||i%13===8)){
        batch.add(stoneGeo,M.snow,0xffffff,x,y+.096,z,width*.75,.053,.22,a,0,0,true);
      }
    }
  }
  for(const [row,[count,radius]] of [[33,1.985],[21,1.76]].entries()){
    for(let i=0;i<count;i++){
      const a=(i+row*.5)*TAU/count+(chance()-.5)*.074;
      const [x,z]=polar(radius+(chance()-.5)*.14,a);
      const scale=.46+chance()*.18;
      batch.add(G.roses.plants[(i+Math.floor(i/4))%3],G.roses.material,0xffffff,
        x,soilY+.027,z,scale,scale,scale,a+(chance()-.5)*.64);
      if(i%4===0){
        const [sx,sz]=polar(radius-.04,a+.052);
        batch.add(G.ball,M.snow,0xffffff,sx,soilY+.078,sz,.19,.060,.13,a,0,0,true);
      }
    }
  }

  // Small radial setts distinguish the tree's sitting area from the diagonal paving.
  const pos=[],uvs=[],indices=[],colors=[];
  const shades=[0xad9384,0xc5ae96,0xb89c89,0xceb397,0xb4a190].map(c=>new T.Color(c));
  for(let row=0;row<5;row++){
    const inner=tree.radius-.041+row*.274,n=Math.round(TAU*(inner+.13)/.29);
    for(let i=0;i<n;i++){
      const skew=(row%2)*.48,a=(i+skew+.041)/n*TAU,b=(i+skew+.958)/n*TAU;
      const color=shades[(i+row*3+Math.floor(chance()*3))%shades.length],outer=inner+.254,start=pos.length/3;
      for(const [r,t] of [[inner,a],[inner,b],[outer,b],[outer,a]]){
        const [x,z]=polar(r,t);
        pos.push(x,squarePavingHeight(x,z)+.015,z);uvs.push(x*.6,z*.6);colors.push(color.r,color.g,color.b);
      }
      indices.push(start,start+1,start+2,start,start+2,start+3);
    }
  }
  addSurface(new T.Mesh(geometry(pos,uvs,indices,colors),
    matte(0xffffff,{map:tex.plaster,vertexColors:true,side:T.DoubleSide})));

  const {yaw}=teaHouse,c=Math.cos(yaw),s=Math.sin(yaw);
  const frontPoint=(x,n)=>[teaHouse.x+x*c+n*s,teaHouse.z-x*s+n*c];
  const facade=teaHouse.d/2;
  const [p0,p1]=[frontPoint(-2.72,facade+.63),frontPoint(2.73,facade+.63)];
  const teaPaving=matte(0xc4ae98,{map:tex.road,side:T.DoubleSide});
  addSurface(ribbon(samples([p0,p1],.21),1.25,teaPaving,groundHeight,.184));

  const washTexture=canvasTexture((g,n)=>{
    const fill=g.createRadialGradient(n*.5,n*.5,0,n*.5,n*.5,n*.50);
    fill.addColorStop(0,'#ffffffde');fill.addColorStop(.28,'#ffffff99');
    fill.addColorStop(.66,'#ffffff34');fill.addColorStop(1,'#ffffff00');
    g.fillStyle=fill;g.fillRect(0,0,n,n);
  },64);
  const warm=new T.MeshBasicMaterial({color:0xffad53,map:washTexture,side:T.DoubleSide,opacity:.29,
    transparent:true,depthWrite:false,blending:T.AdditiveBlending});
  const shade=new T.MeshBasicMaterial({color:0x654b40,map:washTexture,side:T.DoubleSide,opacity:.30,
    transparent:true,depthWrite:false});
  function wash(x,z,w,d,angle,material,height=.198,surface=groundHeight){
    const c=Math.cos(angle),s=Math.sin(angle);
    const mesh=meshGrid(12,14,(u,v)=>{
      const a=(u-.5)*w,b=(v-.5)*d,xx=x+a*c+b*s,zz=z-a*s+b*c;
      return [xx,surface(xx,zz)+height,zz];
    });
    const uv=mesh.getAttribute('uv');
    for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*.5,uv.getY(i)*.5);
    scene.add(new T.Mesh(mesh,material));
  }
  wash(...frontPoint(.03,facade+.17),6.6,1.8,yaw,shade,.193);
  wash(...frontPoint(1.42,facade+1.14),3.1,3.9,yaw,warm);
  wash(...frontPoint(-.79,facade+.62),2.72,2.3,yaw,warm);
  wash(tree.x,tree.z,5.65,5.65,0,shade,.181);
  for(const {x,z,yaw} of benches.slice(0,2))wash(x,z,2.18,1,yaw,shade,.191);
  for(const side of [-1,1]){
    wash(bridge.x+side*1.67,bridge.a+1.25,1.29,2.14,0,warm,.095,(_x,z)=>bridgeHeight(z));
  }
}

const riverSurfaceHalfWidth=x=>riverWidth(x)+.92;

function water(scene,mill,flowSpeed) {
  const verts=[],uv=[],inds=[];
  const n=154;
  for(let i=0;i<=n;i++) {
    const x=-65+i*130/n,z=riverZ(x),r=riverSurfaceHalfWidth(x);
    verts.push(x,waterY,z-r,x,waterY,z+r); uv.push(x,0,x,1);
    if(i){const a=i*2;inds.push(a-2,a-1,a,a-1,a+1,a);}
  }
  const mat=new T.ShaderMaterial({
    uniforms:{time:{value:0},flowSpeed:{value:flowSpeed},mill:{value:mill},fogColor:{value:new T.Color(0x887fa4)},
      bridgeFootprint:{value:new T.Vector2(bridge.x,bridge.halfWidth)}},
    vertexShader:`
      varying vec2 vUv; varying float dist; varying vec3 worldPosition;
      void main() {
        vUv=uv; worldPosition=(modelMatrix*vec4(position,1.)).xyz;
        vec4 p=modelViewMatrix*vec4(position,1.0);
        dist=-p.z; gl_Position=projectionMatrix*p;
      }
    `,
    fragmentShader:`
      uniform float time,flowSpeed; uniform vec3 fogColor; uniform vec2 bridgeFootprint,mill;
      varying vec2 vUv; varying float dist; varying vec3 worldPosition;
      void main() {
        float u=vUv.x-time*flowSpeed;
        float v=vUv.y;
        float sw=sin(v*24.+u*2.35+sin(u*.46)*1.9);
        float tw=sin(v*83.+u*5.8+sin(v*22.+u*.53)*1.6);
        vec3 normal=normalize(vec3(.038*sw+.024*tw,1.,.050*tw-.027*sw));
        vec3 viewDirection=normalize(cameraPosition-worldPosition);
        float reflection=.23+.49*pow(1.-max(0.,dot(normal,viewDirection)),3.);
        float edge=smoothstep(.62,.99,abs(v-.5)*2.);
        vec3 deep=vec3(.032,.155,.199), shallows=vec3(.109,.250,.235);
        vec3 skyColor=mix(vec3(.34,.30,.43),vec3(.68,.46,.37),.34+sw*.11+tw*.049);
        vec3 c=mix(mix(deep,shallows,edge*(.84+.16*sw)),skyColor,reflection);
        float glint=pow(max(0.,dot(reflect(-viewDirection,normal),normalize(vec3(-.72,.21,-.65)))),34.);
        c+=vec3(.65,.40,.20)*glint*(.28+.72*pow(max(0.,sw*tw),4.));
        c+=.07*pow(max(0.,sw*tw),6.)*vec3(.55,.60,.54);
        float dx=abs(vUv.x-bridgeFootprint.x);
        float sheltered=1.-smoothstep(bridgeFootprint.y-.14,bridgeFootprint.y+.88,dx);
        c=mix(c,c*vec3(.42,.52,.55),sheltered*.85);
        float lip=1.-smoothstep(.05,.58,abs(dx-bridgeFootprint.y-.37));
        float bubbles=pow(max(0.,sin(v*91.+u*6.)*sin(v*33.-u*8.)),8.);
        c+=lip*bubbles*smoothstep(.43,.92,abs(v-.5)*2.)*vec3(.24,.33,.31);
        float travel=(vUv.x-mill.x)*sign(flowSpeed);
        float wake=smoothstep(-.4,.45,travel)*(1.-smoothstep(.7,3.4,travel));
        float band=abs(v-mill.y+.012*travel+sin(u*4.)*.025);
        float foam=pow(max(0.,sin(u*16.+v*62.)*sin(u*8.-v*87.)),4.);
        c+=wake*(1.-smoothstep(.017,.10,band))*(.07+.82*foam)*vec3(.49,.58,.57);
        gl_FragColor=vec4(mix(c,fogColor,smoothstep(25.,117.,dist)),1.0);
        #include <colorspace_fragment>
      }
    `,
    side:T.DoubleSide
  });
  scene.add(new T.Mesh(geometry(verts,uv,inds),mat));
  return mat.uniforms.time;
}

function wheel(scene,G,tex) {
  const pivot=new T.Group(),base=new T.Group();
  const mill=houses.find(h=>h.id==='mill');
  const wheelOffset=mill.d/2+1.34, lateral=1.53;
  const c=Math.cos(mill.yaw),s=Math.sin(mill.yaw);
  base.position.set(mill.x+c*lateral-s*wheelOffset,waterY+1.23,mill.z-s*lateral-c*wheelOffset);
  base.rotation.y=mill.yaw;
  base.add(pivot);scene.add(base);
  const wood=matte(0x936849,{map:tex.wood}), highlight=matte(0xc19464,{map:tex.wood}), iron=matte(0x594a40);
  const fixed=(geometry,material,x,y,z,sx,sy,sz,parent=base)=>{
    const part=new T.Mesh(geometry,material);
    part.position.set(x,y,z);part.scale.set(sx,sy,sz);parent.add(part);
    return part;
  };
  // The wall plate and axle are fixed. The rims, spokes and buckets rotate around them.
  fixed(G.box,wood,0,0,1.29,.62,.67,.16);
  fixed(G.trunk,highlight,0,0,.43,.24,1.76,.24).rotation.x=Math.PI/2;
  const footing=matte(0xa48c74);
  for(let j=0;j<7;j++){
    fixed(G.box,footing,0,-2.59+j*.27,-.69,.83-j*.043,.262,.56-j*.025);
  }
  fixed(G.box,wood,0,-.40,-.69,.29,.97,.30);
  fixed(G.trunk,iron,0,0,-.38,.39,.095,.39).rotation.x=Math.PI/2;
  const ring=new T.TorusGeometry(1.32,.105,5,28);
  for(const k of [-1,1]){
    const rim=new T.Mesh(ring,wood);rim.position.z=k*.23;pivot.add(rim);
  }
  for(let i=0;i<12;i++){
    const a=i*TAU/12;
    const x=Math.sin(a),y=Math.cos(a);
    fixed(G.box,i%3===0?highlight:wood,x*.73,y*.73,0,.11,1.25,.17,pivot).rotation.z=-a;
    fixed(G.box,highlight,x*1.31,y*1.31,0,.42,.105,.62,pivot).rotation.z=-a;
    fixed(G.box,wood,x*1.37,y*1.37,0,.092,.18,.59,pivot).rotation.z=-a;
  }
  fixed(G.trunk,highlight,0,0,0,.49,.68,.49,pivot).rotation.x=Math.PI/2;
  return pivot;
}

function flakes(scene,count) {
  const rand=rng(15),array=new Float32Array(count*3),vel=[];
  for(let i=0;i<count;i++){
    array[3*i]=(rand()-.5)*25;array[3*i+1]=rand()*12;array[3*i+2]=(rand()-.5)*25;
    vel.push(.48+rand()*.82);
  }
  const geo=new T.BufferGeometry();
  const loc=new T.BufferAttribute(array,3).setUsage(T.DynamicDrawUsage);
  geo.setAttribute('position',loc);
  const tex=canvasTexture((g,n)=>{
    const grad=g.createRadialGradient(n*.5,n*.5,1,n*.5,n*.5,n*.46);
    grad.addColorStop(0,'#ffffff');grad.addColorStop(.55,'#f9ede999');grad.addColorStop(1,'#ffffff00');
    g.fillStyle=grad;g.fillRect(0,0,n,n);
  },32);
  const field=new T.Points(geo,new T.PointsMaterial({size:.14,map:tex,transparent:true,depthWrite:false,opacity:.78}));
  field.frustumCulled=false;scene.add(field);
  return {field,update(dt,t,p) {
    field.position.set(p.x,p.y,p.z);
    for(let i=0;i<count;i++){
      let h=array[3*i+1]-vel[i]*dt;
      if(h<-.1)h+=12;
      array[3*i+1]=h; array[3*i]+=.16*dt*(1+Math.cos(t+i));
      if(array[3*i]>12.5)array[3*i]-=25;
    }
    loc.needsUpdate=true;
  }};
}

function sky(scene, keep) {
  const gradient=new T.ShaderMaterial({
    side:T.BackSide,depthWrite:false,depthTest:false,
    uniforms:{top:{value:new T.Color(0x796db3)},horizon:{value:new T.Color(0xf0baaa)},sun:{value:new T.Color(0xffd4a2)}},
    vertexShader:`
      varying vec3 v;
      void main(){
        v=position;
        vec4 clip=projectionMatrix*modelViewMatrix*vec4(position,1.);
        gl_Position=clip.xyww;
      }
    `,
    fragmentShader:`
      varying vec3 v; uniform vec3 top,horizon,sun;
      void main(){
        vec3 d=normalize(v);
        float t=smoothstep(-.13,.75,d.y);
        vec3 col=mix(horizon,top,t);
        float glow=pow(max(0.,dot(d,normalize(vec3(-.77,.16,-.65)))),5.);
        col=mix(col,sun,glow*.82);
        gl_FragColor=vec4(col,1.);
        #include <colorspace_fragment>
      }
    `
  });
  const dome=new T.Mesh(new T.SphereGeometry(177,24,15),gradient);
  dome.position.set(5,10,-77);dome.renderOrder=-100;dome.frustumCulled=false;scene.add(dome);

  const far=matte(0x857f9f);const g=new T.SphereGeometry(1,14,8);
  const castleBounds=new T.Box3().setFromObject(keep);
  for(const [x,z,w,h] of [[-66,-134,25,16],[-44,-172,39,29],[1,-177,32,24],[49,-166,42,27],[84,-133,30,19]]){
    const depth=w*.76;
    const behindCastle=x+w>castleBounds.min.x-8&&x-w<castleBounds.max.x+8;
    const back=behindCastle?Math.min(z,castleBounds.min.z-8-depth):z;
    const hill=new T.Mesh(g,far);hill.scale.set(w,h,depth);hill.position.set(x,12,back);scene.add(hill);
  }
}

const loader=new GLTFLoader();
async function villageProp(name,place={x:0,y:0,z:0}) {
  const {scene}=await loader.loadAsync(new URL(`./assets/${name}.glb`,import.meta.url).href);
  scene.position.set(place.x,place.y,place.z);
  scene.scale.setScalar(place.scale??1);
  scene.traverse(o=>{
    if(!o.isMesh)return;
    o.geometry.computeVertexNormals();
    const map=o.material.map;
    o.material=matte(0xffffff,{map,side:T.DoubleSide,emissive:0x695452,emissiveMap:map,emissiveIntensity:.24});
  });
  return scene;
}

async function reusableVillageProp(name) {
  const source=await villageProp(name);
  let mesh;
  source.traverse(o=>{if(o.isMesh)mesh=o;});
  mesh.geometry.computeBoundingBox();
  return {geometry:mesh.geometry,material:mesh.material,height:mesh.geometry.boundingBox.max.y};
}

function winterCastle(castle,cover) {
  castle.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const material=mesh.material;
    material.emissiveIntensity=.035;
    material.onBeforeCompile=shader=>{
      shader.uniforms.castleSnow=cover;
      shader.vertexShader='varying vec3 vCastlePoint; varying float vCastleUp;\n'+shader.vertexShader.replace(
        '#include <begin_vertex>','#include <begin_vertex>\n vCastlePoint=position; vCastleUp=normalize(mat3(modelMatrix)*normal).y;');
      shader.fragmentShader='uniform float castleSnow; varying vec3 vCastlePoint; varying float vCastleUp;\n'+
        shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
          vec3 paint=diffuseColor.rgb;
          float purple=smoothstep(.012,.13,paint.b-paint.g)*smoothstep(-.04,.10,paint.r-paint.g);
          float stone=smoothstep(.27,.62,paint.r)*(1.-purple)*smoothstep(-.03,.10,paint.g-paint.b);
          paint=mix(paint,mix(paint,vec3(dot(paint,vec3(.31,.51,.18))),.31),purple);
          paint=mix(paint,paint*vec3(1.02,1.08,.98),stone*.48);
          float drift=sin(vCastlePoint.x*.93+vCastlePoint.y*.83)*sin(vCastlePoint.z*1.46-vCastlePoint.y*.31);
          float cap=smoothstep(.41,.72,vCastleUp+drift*.19);
          diffuseColor.rgb=mix(paint,vec3(.84,.87,.89),cap*castleSnow*.68);
        `);
    };
  });
}

function winterFir(material,cover) {
  material.onBeforeCompile=shader=>{
    shader.uniforms.snowCover=cover;
    shader.vertexShader='varying vec3 vFirPoint; varying float vFirUp;\n'+shader.vertexShader.replace(
      '#include <begin_vertex>','#include <begin_vertex>\n vFirPoint=position; vFirUp=normal.y;');
    shader.fragmentShader='uniform float snowCover; varying vec3 vFirPoint; varying float vFirUp;\n'+
      shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        vec2 snowGrid=vFirPoint.xz*9.2+vec2(vFirPoint.y*1.81,-vFirPoint.y*2.39);
        vec2 cell=floor(snowGrid), f=fract(snowGrid);
        f=f*f*(3.-2.*f);
        vec4 seed=dot(cell,vec2(29.13,17.93))+vec4(0.,29.13,17.93,47.06);
        vec4 hash=fract(sin(seed)*4827.539);
        float drift=mix(mix(hash.x,hash.y,f.x),mix(hash.z,hash.w,f.x),f.y);
        float branch=smoothstep(.29,.64,vFirUp+(drift-.5)*.26)*smoothstep(.12,.29,vFirPoint.y);
        vec3 snowHoney=mix(vec3(.65,.72,.70),vec3(.87,.91,.87),drift);
        diffuseColor.rgb=mix(diffuseColor.rgb,snowHoney,branch*snowCover*.88);
      `);
  };
}

export async function buildTown(scene,coarse) {
  const models=Promise.all([
    villageProp('gate',{x:0,y:4.6,z:-41}),
    villageProp('castle',castle),
    reusableVillageProp('fir'),
    reusableVillageProp('lamp')
  ]);
  const tex=surfaces(),batch=new Batch(scene),winter=new T.Group();
  scene.add(winter);
  const G={box:new T.BoxGeometry(),ball:new T.SphereGeometry(.5,9,6),stone:new T.DodecahedronGeometry(.5),sprig:evergreenSprig(),shrub:shrubGeometry(),
    roses:winterFlowers(),
    pine:new T.LatheGeometry([[0,-.50],[.85,-.46],[1,-.35],[.83,-.23],[.57,-.04],[.33,.16],[.12,.38],[0,.51]].map(p=>new T.Vector2(...p)),11),trunk:new T.CylinderGeometry(.48,.58,1,9),
    hexLantern:lanternGeometry(6,[[.292,.235],[.344,.248],[.346,.294],[.293,.317],[.246,.355],
      [.142,.442],[.071,.469],[.072,.505],[.038,.531],[0,.535]])};
  const halo=canvasTexture((g,n)=>{
    const gradient=g.createRadialGradient(n/2,n/2,0,n/2,n/2,n*.49);
    gradient.addColorStop(0,'#ffc06c90');gradient.addColorStop(.35,'#ffb05e43');gradient.addColorStop(1,'#ffa25000');
    g.fillStyle=gradient;g.fillRect(0,0,n,n);
  },64);
  const M={plain:matte(0xffffff),foliage:matte(0xffffff,{side:T.DoubleSide}),snow:matte(0xf3f1ea,{side:T.DoubleSide}),
    lanternGlass:new T.MeshBasicMaterial({side:T.DoubleSide,transparent:true,opacity:.27,depthWrite:false}),
    glow:new T.MeshBasicMaterial({color:0xffffff}),halo:new T.SpriteMaterial({map:halo,transparent:true,depthWrite:false,opacity:.73})};
  scene.fog=new T.Fog(0x9586a5,33,158);
  scene.add(new T.HemisphereLight(0xfff2f6,0xc19380,1.85));
  const sunset=new T.DirectionalLight(0xffdfb4,2.05);sunset.position.set(-34,40,-14);scene.add(sunset);
  const snowCover={value:1};
  const walkableMeshes=[];
  const addSurface=object=>{
    scene.add(object);
    object.traverse(mesh=>{if(mesh.isMesh)walkableMeshes.push(mesh);});
  };
  addSurface(terrain(tex,snowCover));
  const mill=wheel(scene,G,tex);
  const flowSpeed=.86;
  const wheelX=mill.parent.position.x,wheelZ=mill.parent.position.z;
  const wheelV=.5+(wheelZ-riverZ(wheelX))/(2*riverSurfaceHalfWidth(wheelX));
  // Winter river surface (river-water.js). Revert: restore `const time=water(scene,new T.Vector2(wheelX,wheelV),flowSpeed);`
  const time=createRiverWater(T,scene,{riverZ,riverWidth,waterY,groundHeight,bridge,coarse,
    mill:{x:wheelX,z:wheelZ},flowSpeed,snow:snowCover}).time;
  const wheelSpeed=flowSpeed/(1.23*Math.cos(mill.parent.rotation.y));
  buildStreets(batch,tex,G,M,addSurface);
  buildTreeSquare(scene,batch,tex,G,M,addSurface);
  buildUpperTerrace(scene,batch,tex,G,M,addSurface);
  buildHillGate(batch,G,M);
  const letterDoors=buildHouses(scene,batch,winter,tex,G,M);
  const letterDoor=letterDoors.get(letterHouse);
  buildTeaStall(batch,G,M,tex.wood);
  const [gate,keep,fir,lamp]=await models;
  winterCastle(keep,snowCover);
  sky(scene,keep);
  bridgeModel(scene,batch,tex,G,M,winter,addSurface);
  snowyRiverBanks(batch,G,M);
  winterFir(fir.material,snowCover);
  leaves(scene,batch,winter,G,M,{fir,lamp});
  landscape(scene,batch,G,M,tex,fir);
  batch.build(winter);
  const snow=flakes(scene,coarse?115:185);
  scene.add(gate,keep);
  return {winter,snow,mill,time,wheelSpeed,letterDoor,letterDoors,firSnow:snowCover,walkHeight:createWalkHeight(walkableMeshes)};
}

export async function buildPlayer(scene) {
  const {scene:avatar}=await loader.loadAsync(new URL('./assets/piyo.glb',import.meta.url).href);
  avatar.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromObject(avatar);
  const scale=1.32/(bounds.max.y-bounds.min.y);
  avatar.scale.multiplyScalar(scale);
  avatar.position.y=-bounds.min.y*scale;
  const player=new T.Group(),body=new T.Group();
  body.add(avatar);player.add(body);scene.add(player);
  // Include the toe and heel edges so they can catch the lip of a stair.
  const soles=[];
  avatar.traverse(mesh=>{
    if(!mesh.isSkinnedMesh)return;
    const vertex=new T.Vector3(),indices=[];
    for(let i=0;i<mesh.geometry.attributes.position.count;i++){
      mesh.getVertexPosition(i,vertex).applyMatrix4(mesh.matrixWorld);
      if((vertex.y-bounds.min.y)*scale<=.09)indices.push(i);
    }
    soles.push({mesh,indices});
  });

  const foot=new T.Vector3();
  function groundedY(walkHeight){
    const {x,y,z}=player.position;
    player.updateMatrixWorld(true);
    // Place the lowest point of the supporting foot on its own surface.
    let height=-Infinity;
    for(const {mesh,indices} of soles){
      for(const i of indices){
        mesh.getVertexPosition(i,foot).applyMatrix4(mesh.matrixWorld);
        height=Math.max(height,walkHeight(foot.x,foot.z)-(foot.y-y));
      }
    }
    return height===-Infinity?walkHeight(x,z):height;
  }
  return {player,body,groundedY};
}
