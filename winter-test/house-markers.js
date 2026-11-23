import * as T from 'three';

export const houseClues={
  loom:'毛糸玉の看板の家',
  cider:'りんごの木箱がある家',
  porter:'大きな鍵がかかる家',
  garden:'白い鳥の巣箱がある家',
  atelier:'青い絵付けの壺が並ぶ家',
  cottager:'窓辺に猫がいる家',
  terrace:'正面に丸い時計がある家',
  chimney:'軒下に薪が並ぶ家',
  lookout:'バルコニーに望遠鏡がある家',
  keeper:'玄関脇に真鍮の鐘がある家',
  shelter:'交差した杖の看板の家'
};

const disc=new T.CylinderGeometry(.5,.5,1,24).rotateX(Math.PI/2);
const crossEnd=new T.CylinderGeometry(.5,.5,1,7).rotateX(Math.PI/2);
const ring=new T.TorusGeometry(.40,.067,6,18);
const ear=new T.ConeGeometry(.5,1,5);
const roof=new T.CylinderGeometry(.07,.52,1,4).rotateY(Math.PI/4);
const vase=new T.LatheGeometry([[0,0],[.33,0],[.42,.11],[.55,.33],[.52,.58],[.33,.76],
  [.23,.84],[.27,.99],[.21,1],[.18,.85],[0,.78]].map(p=>new T.Vector2(...p)),12);
const bell=new T.LatheGeometry([[.50,0],[.50,.08],[.37,.20],[.32,.68],[.26,.85],[.11,.95],[0,.96],
  [0,.88],[.20,.75],[.23,.24],[.43,.07],[.46,0]].map(p=>new T.Vector2(...p)),14);

export function buildHouseMarker(h,face,add,G,M){
  if(!houseClues[h.id])return;
  const part=(geo,color,x,y,z,w,height,d,yaw=0,roll=0,pitch=0)=>{
    add(geo,M.plain,color,x,y,face+z,w,height,d,yaw,roll,pitch);
  };
  const box=(...args)=>part(G.box,...args),orb=(...args)=>part(G.ball,...args);
  const plaque=(color,x,y,w,height=w)=>{
    part(disc,0x614438,x,y,.105,w+.08,height+.08,.12);
    part(disc,color,x,y,.176,w,height,.033);
  };
  const shelf=(x,y,w)=>box(0x8c6448,x,y,.18,w,.083,.38);
  const right=h.w*.32;
  switch(h.id){
    case 'loom': {
      const x=.41,y=3.08;
      plaque(0x805153,x,y,.58);
      for(const [i,color] of [0xf0bb9c,0xe5d9af,0xa8a2cf].entries()){
        const xx=x+(i-1)*.15, yy=y+(i===1?.086:-.054);
        orb(color,xx,yy,.223,.223,.216,.13);
        for(const turn of [-.44,.38])part(ring,0x9e796b,xx,yy,.284,.18,.169,.30,0,turn);
      }
      break;
    }
    case 'cider': {
      const x=-right*.92;
      box(0x926846,x,.29,.33,.72,.35,.40);
      for(const y of [.19,.31,.45])box(0xac8057,x,y,.546,.75,.056,.046);
      for(let i=0;i<7;i++){
        const px=x+(i%4-1.5)*.147,pz=.254+Math.floor(i/4)*.16,py=.51+(i%2)*.035;
        orb(i%2?0xc85e49:0xb3463c,px,py,pz,.152,.137,.148);
        box(0x605039,px,py+.071,pz,.018,.045,.017,0,.21);
      }
      break;
    }
    case 'porter': {
      const x=0,y=2.96;
      plaque(0x465f68,x,y,.66);
      part(ring,0xefd08b,x-.13,y+.098,.214,.28,.28,.45);
      box(0xe8bd74,x+.052,y-.035,.22,.43,.063,.053,0,-.58);
      box(0xe8bd74,x+.187,y-.061,.231,.068,.16,.047,0,-.58);
      box(0xe8bd74,x+.120,y-.106,.231,.064,.12,.047,0,-.58);
      break;
    }
    case 'garden': {
      const x=-h.w*.423,y=2.63;
      box(0xb2a291,x,y-.29,.075,.075,.66,.14);
      box(0xf4e5c9,x,y,.183,.35,.405,.23);
      part(roof,0x698579,x,y+.29,.192,.48,.205,.43);
      part(disc,0x6e5948,x,y+.045,.307,.146,.146,.023);
      part(crossEnd,0x947c67,x,y-.062,.337,.041,.041,.104);
      break;
    }
    case 'atelier': {
      const x=right*.81;
      shelf(x,1.08,.91);
      for(const [dx,scale,color] of [[-.26,.244,0xb1cfd0],[.045,.315,0x7197ac],[.294,.207,0xd2d9c6]]){
        part(vase,color,x+dx,1.12,.248,scale,scale*1.16,scale);
        orb(0x425e83,x+dx,1.12+scale*.43,.248+scale*.522,.080,.038,.014);
        orb(0x426c8d,x+dx,1.12+scale*.62,.248+scale*.464,.055,.035,.012);
      }
      break;
    }
    case 'cottager': {
      const x=right*.82;
      shelf(x,1.01,.62);
      orb(0xbd8b65,x,1.195,.245,.24,.33,.18);
      orb(0xc99469,x-.034,1.392,.287,.23,.19,.174);
      for(const side of [-1,1]){
        part(ear,0xb47653,x-.032+side*.071,1.495,.293,.084,.13,.095,0,side*-.20);
        orb(0x49382f,x-.032+side*.043,1.407,.368,.026,.032,.022);
      }
      orb(0xead0aa,x-.030,1.353,.366,.101,.061,.038);
      part(ring,0xbd8b65,x+.153,1.18,.239,.24,.24,.57,0,.43);
      break;
    }
    case 'terrace': {
      const y=h.h+.68;
      plaque(0xe8dbb8,0,y,.65);
      part(ring,0xa07755,0,y,.207,.76,.76,.31);
      for(let i=0;i<12;i++){
        const a=i*Math.PI/6;
        orb(0x76583d,Math.sin(a)*.244,y+Math.cos(a)*.244,.225,.038,.042,.020);
      }
      box(0x604539,-.053,y+.063,.237,.039,.173,.025,0,.62);
      box(0x604539,.061,y+.021,.247,.035,.169,.023,0,-1.23);
      orb(0xba8954,0,y,.263,.062,.062,.034);
      break;
    }
    case 'chimney': {
      const x=-right;
      for(let row=0;row<3;row++){
        for(let i=0;i<4-row;i++){
          const px=x+(i-(3-row)*.5)*.158,y=.151+row*.135;
          part(crossEnd,0x76513c,px,y,.214,.156,.152,.437);
          part(crossEnd,0xc79a72,px,y,.441,.128,.126,.023);
          part(ring,0xa07756,px,y,.455,.101,.096,.16);
        }
      }
      box(0x8b6348,x,.074,.22,.71,.065,.51);
      break;
    }
    case 'lookout': {
      const x=.34,y=h.h*.55+1.00,turn=-.62;
      for(const side of [-1,1])box(0x695141,x+side*.13,y-.453,.46,.061,.76,.064,0,side*.30);
      part(crossEnd,0xaa7948,x,y,.57,.148,.144,.61,turn,0,-.25);
      part(crossEnd,0xe2b87b,x-.161,y+.069,.797,.212,.206,.112,turn,0,-.25);
      part(disc,0x779aa7,x-.196,y+.079,.844,.152,.144,.028,turn,0,-.25);
      break;
    }
    case 'keeper': {
      const x=-right,y=1.94;
      box(0x6e4b38,x,y+.47,.143,.09,.082,.31);
      part(bell,0xc89b5c,x,y,.25,.37,.44,.37);
      orb(0x785741,x,y-.027,.25,.096,.10,.096);
      part(ring,0xab794d,x,y+.443,.247,.123,.142,.37);
      break;
    }
    case 'shelter': {
      const x=.065,y=2.65;
      plaque(0x6e7758,x,y,.59,.64);
      for(const side of [-1,1]){
        box(0xf0cb89,x,y,.217,.042,.51,.044,0,side*.53);
        part(ring,0xf0cb89,x-side*.128,y+.2,.234,.128,.121,.34,0,side*.4);
      }
      break;
    }
  }
}
