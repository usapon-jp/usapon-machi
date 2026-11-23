import * as T from 'three';

// Adapted from manabi-town js/plants.js: the leaf, stem and cup strip meshes.
const TAU=Math.PI*2;
const green=0x415f46;
const leafTip=0x748950;

function plantGeometry(tint) {
  const positions=[],colors=[];
  const add=(point,color)=>{
    positions.push(...point);
    colors.push(color.r,color.g,color.b);
  };
  function strip(rows){
    for(let i=1;i<rows.length;i++){
      const [left,right,shade]=rows[i-1];
      const [nextLeft,nextRight,nextShade]=rows[i];
      add(left,shade);add(right,shade);add(nextLeft,nextShade);
      add(right,shade);add(nextRight,nextShade);add(nextLeft,nextShade);
    }
  }

  function leaf(angle,length,width,lift){
    const dx=Math.cos(angle),dz=Math.sin(angle);
    const rows=Array.from({length:6},(_,i)=>{
      const t=i/5,r=length*t;
      const y=.045+lift*t-.55*lift*t*t;
      const w=width*Math.sin(Math.PI*t)**.8;
      const color=new T.Color(green).lerp(new T.Color(leafTip),t*.66);
      return [[dx*r+dz*w,y+w*.34,dz*r-dx*w],
        [dx*r-dz*w,y-w*.22,dz*r+dx*w],color];
    });
    strip(rows);
  }
  for(let i=0;i<7;i++)leaf(i*TAU/7,(i%2?.37:.46),i%2?.066:.088,.23+(i%3)*.06);
  for(let i=0;i<4;i++)leaf(i*TAU/4+.24,.28,.060,.37);

  const stemColor=new T.Color(0x58734a),stemHeight=.47;
  for(let i=0;i<3;i++){
    const a=i*TAU/3;
    strip(Array.from({length:5},(_,j)=>{
      const t=j/4,x=.065*t*t,z=.025*t,y=stemHeight*t,w=.015-.004*t;
      return [[x+Math.sin(a)*w,y,z+Math.cos(a)*w],
        [x+Math.sin(a+TAU/3)*w,y,z+Math.cos(a+TAU/3)*w],stemColor];
    }));
  }

  const flowerColor=new T.Color(tint),throat=new T.Color(0xdac590);
  // A half-open, forward-facing cup with a darker throat and five broad petals.
  const turn=.96,cos=Math.cos(turn),sin=Math.sin(turn);
  const blossom=(x,y,z)=>[x+.065,stemHeight+y*cos-z*sin,.025+y*sin+z*cos];
  for(let i=0;i<5;i++){
    const a=i*TAU/5+.23,dx=Math.cos(a),dz=Math.sin(a);
    const r=.274+(i%3)*.014;
    const petal=Array.from({length:7},(_,j)=>{
      const t=j/6,reach=r*(.10+.90*t);
      const w=r*.49*Math.sin(Math.PI*(.14+.86*t))**.49;
      const y=r*(.56*t-.25*t*t);
      const tone=throat.clone().lerp(flowerColor,t<.5?.24+1.46*t:1).multiplyScalar(.83+.20*t);
      return [blossom(dx*reach+dz*w,y,dz*reach-dx*w),
        blossom(dx*reach,y-w*.37,dz*reach),
        blossom(dx*reach-dz*w,y,dz*reach+dx*w),tone];
    });
    strip(petal.map(([left,mid,,tone])=>[left,mid,tone]));
    strip(petal.map(([,mid,right,tone])=>[mid,right,tone]));
  }

  const tip=new T.OctahedronGeometry(1,0);
  const p=tip.getAttribute('position');
  const gold=new T.Color(0xf0ca74),cream=new T.Color(0xffe6a1);
  for(let i=0;i<10;i++){
    const a=i*TAU/10,r=i%2?.051:.034;
    for(let j=0;j<p.count;j++){
      add(blossom(Math.sin(a)*r+p.getX(j)*.014,.049+p.getY(j)*.025,Math.cos(a)*r+p.getZ(j)*.014),i%2?gold:cream);
    }
  }
  tip.dispose();
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  return geometry;
}

export function winterFlowers() {
  const material=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide});
  const plants=[0xffebd5,0xe4b4b1,0xb06e82].map(plantGeometry);
  return {material,plants};
}
