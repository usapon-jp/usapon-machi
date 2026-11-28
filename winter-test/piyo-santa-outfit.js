import * as T from 'three';

export function createSantaOutfit(body){
  const outfit=new T.Group();
  outfit.name='Santa outfit';
  body.add(outfit);
  const red=new T.MeshStandardMaterial({color:0xc52636,roughness:.88,side:T.DoubleSide});
  const cream=new T.MeshStandardMaterial({color:0xfff6e8,roughness:.95});
  function mesh(geometry,material,parent,x,y,z){
    const item=new T.Mesh(geometry,material);
    item.position.set(x,y,z);parent.add(item);return item;
  }
  const hat=new T.Group();hat.position.set(-.035,1.19,-.035);hat.rotation.z=.24;body.add(hat);
  mesh(new T.CylinderGeometry(.29,.30,.085,32),cream,hat,0,.02,0).scale.z=.86;
  const cloth=mesh(new T.ConeGeometry(.277,.43,24),red,hat,-.06,.24,0);
  cloth.rotation.z=.30;cloth.scale.z=.82;
  mesh(new T.SphereGeometry(.073,16,10),cream,hat,-.126,.443,0);

  // Leave the front open so Piyo's chest and wings can move freely.
  const cape=mesh(new T.CylinderGeometry(.26,.49,.53,32,6,true,Math.PI*.30,Math.PI*1.40),
    red,outfit,0,.55,0);
  cape.scale.z=.79;
  const hemPoints=Array.from({length:25},(_,i)=>{
    const angle=Math.PI*(.30+1.40*i/24);
    return new T.Vector3(Math.sin(angle)*.49,.287,Math.cos(angle)*.49*.79);
  });
  mesh(new T.TubeGeometry(new T.CatmullRomCurve3(hemPoints),32,.027,8,false),cream,outfit,0,0,0);
  mesh(new T.TorusGeometry(.258,.033,10,30),cream,outfit,0,.82,0).rotation.x=Math.PI/2;
  const clasp=new T.MeshStandardMaterial({color:0xffd983,roughness:.42});
  mesh(new T.SphereGeometry(.037,12,8),clasp,outfit,0,.79,.247);
  function show(on){hat.visible=outfit.visible=on;}
  show(false);
  return {show};
}
