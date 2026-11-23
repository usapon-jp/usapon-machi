import * as T from 'three';
import { groundHeight, teaStall } from './layout.js';

export function buildTeaStall(batch,G,M,texture) {
  const {x,z,yaw}=teaStall;
  const y=groundHeight(x,z),c=Math.cos(yaw),s=Math.sin(yaw);
  const floor=(u,n)=>groundHeight(x+u*c+n*s,z-u*s+n*c)-y;
  const wood=new T.MeshLambertMaterial({color:0xffffff,map:texture});
  const disk=new T.CylinderGeometry(.5,.5,1,12);
  const put=(geo,mat,color,u,v,n,w,h,d,tilt=0,roll=0)=>{
    batch.add(geo,mat,color,x+u*c+n*s,y+v,z-u*s+n*c,w,h,d,yaw,roll,tilt);
  };
  const timber=(color,...args)=>put(G.box,wood,color,...args);
  for(const side of [-1,1]){
    for(const front of [-1,1]){
      const u=side*1.03,n=front*.54,bottom=floor(u,n)-.105,top=2.13;
      timber(0x70513d,u,(bottom+top)*.5,n,.094,top-bottom,.097);
    }
    timber(0x885e44,side*1.03,2.09,0,.103,.093,1.34,.20);
    timber(0x8b6749,side*1.03,.40,0,.082,.67,1.03);
  }
  for(let i=0;i<8;i++){
    const xx=(i-3.5)*.259,bottom=Math.min(.04,floor(xx,.505)-.062);
    timber(i%2?0x956a4a:0x8a6044,xx,(.70+bottom)*.5,.47,.25,.70-bottom,.095);
    put(G.box,M.plain,i%2?0xbc705c:0xe1c499,xx,2.21,0,.263,.043,1.45,.20);
    put(G.box,M.plain,i%2?0xb26655:0xd4ba92,xx,2.008,.722,.259,.104,.038);
  }
  timber(0xb38255,0,.76,.02,2.27,.105,1.27);
  timber(0x74523d,0,2.23,-.70,2.16,.075,.095);

  // Tea tins, paper parcels and a kettle echo the teahouse next door.
  for(const [i,color] of [0xa56c4e,0x73907a,0xbd8751,0x647e7c].entries()){
    const xx=-.81+i*.228,high=.16+(i%3)*.045;
    put(disk,M.plain,color,xx,.813+high*.5,.20,.147,high,.147);
    put(disk,M.plain,0xcfa96f,xx,.813+high,.20,.157,.048,.157);
    put(G.box,M.plain,0xe3c89b,xx,.82+high*.51,.278,.081,.067,.014);
  }
  put(G.ball,M.plain,0x658977,.49,1.012,.01,.31,.26,.27);
  put(disk,M.plain,0x507761,.49,1.140,.01,.194,.031,.194);
  put(G.ball,M.plain,0xd0a978,.49,1.169,.01,.041,.058,.041);
  const handle=new T.TorusGeometry(.091,.020,5,13);
  put(handle,M.plain,0x658977,.647,1.033,.01,1,1,1);
  put(G.box,M.plain,0x658977,.338,1.078,.017,.141,.049,.073,0,-.55);
  timber(0x986b48,.78,.88,.26,.292,.17,.27);
  put(G.box,M.plain,0xd6b679,.78,.891,.267,.052,.187,.277);
}
