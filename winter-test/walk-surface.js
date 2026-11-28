import * as T from 'three';
import { entranceHeight, groundHeight } from './layout.js';

// Index the rendered terrain and paving triangles by horizontal cell.
export function createWalkHeight(meshes) {
  const cells=new Map();
  const key=(x,z)=>`${x},${z}`;
  for(const mesh of meshes){
    mesh.updateWorldMatrix(true,false);
    const {index,attributes:{position}}=mesh.geometry;
    const vertices=Array.from({length:position.count},(_,i)=>
      new T.Vector3().fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld));
    for(let i=0;i<index.count;i+=3){
      const a=vertices[index.getX(i)],b=vertices[index.getX(i+1)],c=vertices[index.getX(i+2)];
      const minX=Math.floor(Math.min(a.x,b.x,c.x)),maxX=Math.floor(Math.max(a.x,b.x,c.x));
      const minZ=Math.floor(Math.min(a.z,b.z,c.z)),maxZ=Math.floor(Math.max(a.z,b.z,c.z));
      const triangle=new T.Triangle(a,b,c);
      for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){
        const id=key(x,z);
        if(!cells.has(id))cells.set(id,[]);
        cells.get(id).push(triangle);
      }
    }
  }

  const ray=new T.Ray(new T.Vector3(),new T.Vector3(0,-1,0));
  const hit=new T.Vector3();
  return (x,z)=>{
    ray.origin.set(x,100,z);
    let height=entranceHeight(x,z);
    const triangles=cells.get(key(Math.floor(x),Math.floor(z)))??[];
    for(const {a,b,c} of triangles){
      if(ray.intersectTriangle(a,b,c,false,hit))height=Math.max(height,hit.y);
    }
    return height===-Infinity?groundHeight(x,z):height;
  };
}
