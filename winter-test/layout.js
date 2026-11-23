export const spawn = { x: 1.2, z: -45.5 };
export const castle = { x: 18, y: 14.8, z: -139.2, scale: .80 };
export const court = { x: 18, z: -121 };
export const hillGate = { x: 18, z: -117.7, halfOpening: 1.83, width: 6.35, depth: 1.16 };
export const upperTerrace = {
  x:23.65, z:-107.2, rx:4.80, rz:3.55, level:13.72,
  outline:[[28.4,-107.0],[27.2,-109.26],[24.13,-110.27],[20.7,-109.75],[19.0,-108.45],
    [19.15,-106.23],[20.26,-104.68],[22.09,-103.77],[24.28,-103.63],[26.39,-104.18],[27.68,-105.1]]
};
export const terraceRail=upperTerrace.outline.slice(5,-1);
export const bridge = { x: 4.8, a: -66, b: -54, halfWidth: 2.35 };
export const bounds = { west: -38, east: 50, south: -36, north: -124.2 };
export const letterHouse = 'letter';
export const northFir = { x:1.77,z:-50.66 };
export const teaStall = { x:18.12,z:-73.9,yaw:-.68,w:2.18,d:1.18 };
const plazaExit=[5.4,-70];

export const mainRoad = [
  [0, -36.5], [0, -42], [2.35, -47], [4.65,-50.4], [4.8, -53], [4.8, -66],
  plazaExit, [8.25, -74.5], [9.45, -78.25], [10.34,-80.15], [12.42, -82.15], [14.7, -85.25],
  [18.6, -88.95], [24.5, -92.5], [29.25, -95.3], [30.55,-100.95],
  [30.22,-104.0], [28.55,-106.1], [26.48,-107.25], [23.32,-108.0],
  [20.66,-109.65], [19.15,-112.4], [18.2,-115.45], [hillGate.x,hillGate.z], [court.x,court.z], [court.x,-123.5]
];
export const paths = [
  { width: 4.4, points: mainRoad },
  { width: 2.3, points: [[-18,-50],[-12,-48],[-4,-47],[1.2,-47],[9,-45.45],[15.8,-46.75],[20,-48.8]] },
  { width: 1.8, points: [[-17,-49.7],[-13,-50.8],[-8.6,-50.05],[-5.6,-50.55],[-1.0,-52.1],[4.8,-53.65]] },
  { width: 2.5, points: [[-17,-71],[-12,-73],[-8,-72.75],[-4,-73.35],[-3.0,-70.7],[-1.8,-68.65],[1.45,-68.47],[5.4,-70],[10,-66.2],[14.3,-66.7],[21,-68.9],[27,-69.5]] },
  { width: 1.75, points: [[17.22,-67.66],[16.83,-69.38],[16.67,-70.99],[17.18,-72.72]] },
  { width: 2.3, points: [[-15,-74.05],[-11,-74],[-8.69,-76.31],[-8.28,-76.65],[-7.85,-76.87],
    [-7.39,-76.97],[-6.90,-76.96],[-6.38,-76.83],[-4.8,-76.27],[-1.3,-75.3],[3.25,-75.59],[6.6,-76.28],[8.4,-74.5]] },
  { width: 1.95, points: [[29.25,-95.3],[25.5,-96.4],[19.8,-97.5],[10.1,-98],[8.4,-98]] },
  { width: 2.1, points: [[8.4,-98],[4.1,-96],[-.2,-95.5],[-4.5,-101],[-2.5,-107],[-.65,-111.8],[4.5,-112.8],[10,-113.4],[14,-115.4],[18.2,-115.45]] },
  { width: 1.85, points: [[30.22,-104.0],[34.45,-104.8],[38,-109.6],[35.7,-114.35],[31,-118],[26,-119],[18,-119]] },
  { width: 1.65, points: [[34.45,-104.8],[31.2,-108.4],[29.80,-110.47]] },
  { width: 3.8, points: [[court.x,-122.8],[castle.x,castle.z+1.4]] },
  { width: 1.46, points: [[12.42,-82.15],[9.95,-82.6],[7.85,-83.33],[4.80,-83.67]] }
];

export const houses = [
  { id: 'mill',     x:-5.8,z:-54.0, yaw:.25,  w:5.4, d:4.0, h:3.65, style:'mill',    trim:0x526f64 },
  { id: 'bakery',   x:11.5,z:-51.1, yaw:-1.16,w:6.8, d:4.8, h:4.9,  style:'bakery',  trim:0x9d4b48 },
  { id: 'loom',     x:-8.6,z:-43.8, yaw:3.20, w:5.0, d:4.2, h:4.1,  style:'bay',     trim:0x537178 },
  { id: 'cider',    x:-15.5,z:-44.8,yaw:2.93, w:5.8, d:4.2, h:4.3,  style:'shop',    trim:0x90633e },
  { id: 'porter',   x:8.9, z:-42.0, yaw:3.10, w:4.1, d:4.3, h:4.1,  style:'hip',     trim:0x715c86 },
  { id: 'garden',   x:17.5,z:-43.6, yaw:3.02, w:5.7, d:4.0, h:4.5,  style:'balcony', trim:0x567865 },
  { id: 'gift',     x:-6.35,z:-70.10,yaw:1.56, w:5.4, d:4.4, h:4.65, style:'gift',    trim:0x527759 },
  { id: 'workshop', x:-11.67,z:-68.5,yaw:3.03,w:5.3, d:3.8, h:3.55, style:'workshop',trim:0x916038 },
  { id: 'letter',   x:-.82,z:-79.60,yaw:.08,  w:5.4, d:4.0, h:4.1,  style:'letter',  trim:0x4f795d },
  { id: 'atelier',  x:-6.85,z:-80.25,yaw:.16, w:5.4, d:4.7, h:4.8,  style:'bay',     trim:0x625a83 },
  { id: 'cottager', x:-13.2,z:-78.32,yaw:.09, w:5.0, d:4.7, h:4.15, style:'hip',     trim:0x53767c },
  { id: 'tea',      x:12.85,z:-71.0,yaw:-1.39,w:5.94,d:3.5, h:4.2,  style:'shop',    trim:0x66834e },
  { id: 'herbs',    x:13.94,z:-77.95,yaw:-1.13,w:4.6, d:3.72,h:3.7,  style:'shop',    trim:0x657961 },
  { id: 'tailor',   x:18.96,z:-82.6, yaw:-1.40,w:4.7, d:3.75,h:3.85, style:'shop',    trim:0x9b5456 },
  { id: 'terrace',  x:4.36,z:-87.0, yaw:.21,  w:4.4, d:4.3, h:4.2,  style:'balcony', trim:0x797553 },
  { id: 'chimney',  x:24.85,z:-86.8,yaw:-1.18, w:5.5, d:4.4, h:4.02, style:'hip',     trim:0x804e54 },
  { id: 'tower',    x:35.5,z:-99.85,yaw:-.95, w:4.5, d:4.1, h:5.02, style:'tower',   trim:0x715d7f },
  { id: 'lookout',  x:10.1,z:-101.4,yaw:.15, w:5.1, d:4.3, h:3.62, style:'balcony', trim:0x59796e },
  { id: 'keeper',   x:3.3, z:-108.5,yaw:2.92, w:3.9, d:4.6, h:3.6,  style:'tower',   trim:0x7a597f },
  { id: 'shelter',  x:29.75,z:-113.4,yaw:.03,w:4.0, d:3.7, h:3.3,  style:'workshop',trim:0x567160 },
  { id: 'lanterns', x:31.6,z:-91.7,yaw:-1.02,w:4.5,d:3.6,h:3.48,style:'shop',trim:0x72638b },
  { id: 'books',    x:1.45,z:-91.96,yaw:2.92,w:4.9,d:3.8,h:3.6,style:'shop',trim:0x557c80 }
];

export const teaHouse=houses.find(h=>h.id==='tea');
const teaBay={
  x:teaHouse.x+Math.cos(teaHouse.yaw)*1.56+Math.sin(teaHouse.yaw)*(teaHouse.d/2+.19),
  z:teaHouse.z-Math.sin(teaHouse.yaw)*1.56+Math.cos(teaHouse.yaw)*(teaHouse.d/2+.19),
  yaw:teaHouse.yaw,w:1.80,d:.56
};
const giftShop=houses.find(h=>h.id==='gift');
export const giftWindowX=-1.665;
const giftDisplay={
  x:giftShop.x+giftWindowX*Math.cos(giftShop.yaw)+(giftShop.d/2+.40)*Math.sin(giftShop.yaw),
  z:giftShop.z-giftWindowX*Math.sin(giftShop.yaw)+(giftShop.d/2+.40)*Math.cos(giftShop.yaw),
  yaw:giftShop.yaw,w:1.8,d:.71
};
export const treeSquare = {
  x:2.7, z:-70.55, rx:8.9, rz:6.6,
  outline:[
    [11.2,-69.08],[10.96,-67.85],[9.5,-67.02],[7.15,-67.15],[6.25,-65.94],[3.20,-65.94],
    [1.55,-66.60],[-.90,-66.62],[-3.25,-66.95],[-4.10,-68.18],[-4.10,-70.52],
    [-4.36,-72.04],[-3.86,-74.15],[-2.50,-76.26],[-.35,-77.03],[1.58,-76.90],[3.52,-75.83],[5.08,-74.47],
    [6.72,-73.92],[9.27,-73.31],[10.73,-72.97],[11.62,-72.03],[11.58,-70.67]
  ]
};
export const squareBank=[[-3.12,-66.92],[-1.03,-66.64],[.91,-66.64]];
export const squares = [
  treeSquare,
  { x:.82,z:-45.7,rx:5.02,rz:2.95 },
  { x:17.36,z:-72.59,rx:1.15,rz:.75 },
  { ...court, rx:6.8, rz:3.85 },
  { x:11.6,z:-79.4,rx:3.45,rz:2.4 },
  upperTerrace
];
export const viewpoints = [
  { x:3.15, z:-63.25, radius:2.25, eye:[3.02,-64.05], name:'橋から見る水車', look:[-14,6.45,-52.25] },
  { x:13.51, z:-83.46, radius:1.25, name:'曲がり角から見るお城', look:[18,21.1,-139] },
  { x:23.58, z:-105.26, radius:1.1, eye:[23.58,-104.25], eyeHeight:1.73, name:'展望テラスから見る城下町', look:[5.8,7.5,-67.5] },
  { x:21.55, z:-108.62, radius:1.1, eye:[20.2,-109.22], eyeHeight:1.48, name:'展望テラスから見る城門', look:[18,19.8,-134] }
];
export const gardens=[
  { x:1.76,z:-50.7,rx:1.04,rz:.70,kind:'flowers' },
  { x:6.32,z:-49.1,rx:.60,rz:.63,kind:'flowers' },
  { x:8.9,z:-63.5,rx:2.0,rz:1.25,kind:'river' },
  { x:13.7,z:-64.5,rx:2.75,rz:1.04,kind:'river' },
  { x:17.25,z:-65.12,rx:1.35,rz:.84,kind:'river' },
  { x:.55,z:-65.95,rx:1.8,rz:.78,kind:'flowers' },
  { x:6.0,z:-76.85,rx:.70,rz:.74,kind:'flowers' },
  { x:28.5,z:-88.9,rx:1.48,rz:2.0,kind:'flowers' },
  { x:16.1,z:-90.8,rx:1.45,rz:2.6,kind:'flowers' },
  { x:7.45,z:-80.6,rx:1.7,rz:1.02,kind:'flowers' },
  { x:16.0,z:-104.4,rx:2.15,rz:2.0,kind:'flowers' },
  { x:39.0,z:-114.7,rx:2.43,rz:3.14,kind:'grove' }
];
export const terraceWalls=[
  [[-1.85,-83.03],[.1,-82.4],[2.7,-82.1],[4.4,-81.45]],
  [[14.98,-89.2],[16.58,-90.8],[18.44,-92.36],[21.55,-93.8]],
  [[10.24,-65.54],[12.43,-65.98],[14.65,-66.31],[16.8,-66.49],[18.43,-66.68]],
  [[7.9,-119.5],[9.4,-120.3],[10.95,-121.45]],
  [[25.45,-121.7],[27.4,-121.3],[29.25,-120.15]]
];
export const benches=[
  {x:-2.93,z:-74.15,yaw:1.37},
  {x:2.82,z:-77.65,yaw:.30},
  {x:25.25,z:-104.95,yaw:.22}
];
export const streetLamps = [
  [-6.6,-49.05], [5.0,-43.8], [-10,-70.98], [3.05,-77.55],
  [12.14,-74.4], [11.4,-85.15], [20.5,-94.1], [32.78,-97.2],
  [18.63,-105.75], [23.1,-112.9], [14.4,-116.9], [22.35,-117.55]
];
export const tree = { x:1.45,z:-73.25,radius:2.34,height:10.82,sink:1.98,planterHeight:.76 };

export const mix = (a,b,t) => a+(b-a)*t;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi,v));
export const smooth = (a,b,v) => {
  const t=clamp((v-a)/(b-a),0,1);
  return t*t*(3-2*t);
};

export function riverZ(x) {
  return -60 + 1.5*Math.sin((x-4.8)*.17) + 1.2*(1-Math.cos((x-4.8)*.105))
    + 2.8*Math.exp(-((x+6)**2)/36);
}
export const riverWidth = x => 2.55+.4*Math.cos(x*.145);
export const waterY = 5.05;

const hillProfile=[
  [35,4.6], [44,4.75], [54,6.1], [66,6.65], [73,7.5], [81,8.35],
  [94,9.45], [106,10.55], [118,11.75], [125,castle.y], [160,castle.y], [180,10]
];

function hillHeight(x,z) {
  const n=-z;
  for(let i=1;i<hillProfile.length;i++){
    const [s,y0]=hillProfile[i-1], [e,y1]=hillProfile[i];
    if(n<=e){
      const ripple=(Math.sin(x*.145+n*.07)*.5+Math.cos(x*.31-n*.12)*.21)*smooth(44,53,n);
      const rim=smooth(32,64,Math.abs(x-7))*smooth(67,101,n);
      return mix(y0,y1,clamp((n-s)/(e-s),0,1))+ripple*(1-.78*smooth(68,83,n))*(1-smooth(108,125,n))+rim*2.3;
    }
  }
  return 10;
}
// Three low terraces interrupt the ascent with nearly level stretches.
// Their transitions are ramps shared by the streets and neighbouring plots.
const approachY=hillHeight(...plazaExit);
const terraceY=castle.y-.35;
const terraces=[[70,0],[73,.02],[84,.255],[87,.273],[99,.535],[102,.55],[116,.89],[122,1]];
function terraceFraction(n){
  for(let i=1;i<terraces.length;i++){
    const [a,u]=terraces[i-1],[b,v]=terraces[i];
    if(n<=b){
      const t=clamp((n-a)/(b-a),0,1);
      return mix(u,v,t);
    }
  }
  return 1;
}

function slopeHeight(x,z){
  const n=-z,rise=mix(approachY,terraceY,terraceFraction(n));
  const influence=smooth(67,74,n)*(1-smooth(27,45,Math.abs(x-12)))*(1-smooth(124,139,n));
  const castleShoulder=1.65*smooth(10.5,24,Math.abs(x-castle.x))*smooth(117,135,n);
  const base=mix(hillHeight(x,z),rise,influence)-castleShoulder;
  const tx=(x-upperTerrace.x)/upperTerrace.rx,tz=(z-upperTerrace.z)/upperTerrace.rz;
  const terraceFace=smooth(.28,.70,tz)*(1-smooth(.58,1.02,Math.abs(tx)));
  const shelf=1-smooth(1.00,mix(2.35,1.23,terraceFace),Math.hypot(tx,tz));
  const hill=mix(base,upperTerrace.level,shelf);
  if(n<91||n>109||x<20)return hill;
  const laneX=mix(25.9,30.6,smooth(91,101,n));
  const laneGrade=mix(9.63,upperTerrace.level,clamp((n-91)/16.2,0,1));
  const blend=(1-smooth(2.4,7.5,Math.abs(x-laneX)))*smooth(91,95,n)*(1-smooth(107.2,109,n));
  return mix(hill,laneGrade,blend);
}

export function groundHeight(x,z) {
  const bank=Math.abs(z-riverZ(x))-riverWidth(x);
  const hill=slopeHeight(x,z);
  const bridgeBank=mix(waterY-1.35,hill,smooth(-.55,1.5,bank));
  const waterline=mix(waterY-1.35,waterY-.085,smooth(-1.06,0,bank));
  const plantedBank=mix(waterline,hill,smooth(0,2.58,bank));
  const ground=mix(bridgeBank,plantedBank,smooth(2.75,5.65,Math.abs(x-bridge.x)));
  const dx=x-tree.x,dz=z-tree.z;
  const distance=Math.hypot(dx*(dx<0?.58:1),dz*(dz>0?.89:1));
  const plaza=distance>=6.25?ground:mix(treePlazaLevel,ground,
    Math.max(smooth(3.62,6.25,distance),1-smooth(.30,2.05,bank)));

  // Carry the square's level across the bear shop frontage. The riverward
  // edge descends beyond the corner, leaving the riverbed at its own height.
  const gx=x-giftShop.x,gz=z-giftShop.z;
  const along=gx*giftCos-gz*giftSin,depth=gx*giftSin+gz*giftCos;
  const endFade=along<0?3.8:2.1;
  if(Math.abs(along)>=giftShop.w/2+endFade||bank<=.12)return plaza;
  const frontage=1-smooth(giftShop.w/2+.20,giftShop.w/2+endFade,Math.abs(along));
  const approach=smooth(-giftShop.d/2-1.35,-giftShop.d/2,depth)
    *(1-smooth(giftShop.d/2+2.50,giftShop.d/2+4.45,depth));
  return mix(plaza,treePlazaLevel,frontage*approach*smooth(.12,2.6,bank));
}

const treePlazaLevel=slopeHeight(tree.x,tree.z);
const giftCos=Math.cos(giftShop.yaw),giftSin=Math.sin(giftShop.yaw);

function buildEntrance(house) {
  const {d,yaw,id,style}=house,s=Math.sin(yaw),c=Math.cos(yaw);
  const letter=id===letterHouse,tea=house===teaHouse;
  const base=groundHeight(house.x,house.z)-(letter?.24:0);
  const doorWidth=style==='bakery'?1.02:style==='gift'||style==='mill'||style==='workshop'?.96:.89;
  const x=letter?.04:tea?-.13:0;
  const width=letter?1.60:tea?1.55:doorWidth*1.46;
  const start=d/2+(letter?-.08:tea?-.067:.075);
  const landingEnd=d/2+(letter?.33:tea?.52:.46);
  const tread=letter?.27:tea?.29:.25;
  const pavement=tea?.184:letter||id==='gift'?.161:.117;
  const ground=(u,v)=>groundHeight(house.x+u*c+v*s,house.z-u*s+v*c);
  const crossSection=(z,span=width)=>[x-span/2,x,x+span/2].map(u=>ground(u,z));
  const threshold=letter?.28:tea?.34:Math.max(.238,
    Math.max(...crossSection(start),...crossSection(landingEnd))+pavement+.024-base);
  const top=base+threshold;

  const bank=crossSection(landingEnd);
  const acrossSlope=Math.max(...bank)-Math.min(...bank)>.25;
  for(let count=1;count<=10;count++){
    const end=landingEnd+(count-1)*tread;
    const landing=ground(x,end)+pavement;
    const rise=Math.max(0,(top-landing)/count);
    if(rise>.158&&count<10)continue;
    const steps=Array.from({length:count},(_,index)=>{
      const near=index===0?start:landingEnd+(index-1)*tread;
      const far=landingEnd+index*tread;
      // On a side slope, lower treads taper to meet the path at its centre.
      const span=acrossSlope?Math.max(.83,width-index*.23):width;
      const groundSamples=[...crossSection(near,span),...crossSection((near+far)/2,span),...crossSection(far,span)];
      const surface=index===0?top:Math.min(top,Math.max(top-index*rise,Math.max(...groundSamples)+pavement+.012));
      const footing=Math.min(...groundSamples,surface)-.045;
      return {near,far,width:span,top:surface,bottom:footing};
    });
    if(steps.at(-1).top-landing<=.17||count===10)return {base,threshold,doorWidth,x,s,c,start,end,pavement,steps};
  }
}
const entrances=new Map(houses.map(h=>[h,buildEntrance(h)]));
export const entranceFor=house=>entrances.get(house);

export function bridgeHeight(z) {
  const h=clamp((z-bridge.a)/(bridge.b-bridge.a),0,1);
  return mix(groundHeight(bridge.x,bridge.a),groundHeight(bridge.x,bridge.b),h)+.22*Math.sin(Math.PI*h);
}
export function walkHeight(x,z) {
  if(onBridge(x,z))return bridgeHeight(z);
  const ground=groundHeight(x,z);
  for(const [house,entry] of entrances){
    const dx=x-house.x,dz=z-house.z;
    if(Math.abs(dx)>entry.end+1||Math.abs(dz)>entry.end+1)continue;
    const along=dx*entry.s+dz*entry.c;
    if(along<entry.start||along>=entry.end)continue;
    const step=entry.steps.find(step=>along<step.far);
    if(step&&Math.abs(dx*entry.c-dz*entry.s-entry.x)<=step.width/2)return Math.max(ground,step.top-entry.pavement);
  }
  return ground;
}
export function onBridge(x,z,pad=0) {
  return Math.abs(x-bridge.x)<=bridge.halfWidth-pad && z>=bridge.a && z<=bridge.b;
}
export function front(h, distance=.85) {
  return [h.x+Math.sin(h.yaw)*(h.d/2+distance),h.z+Math.cos(h.yaw)*(h.d/2+distance)];
}
export function inHouse(x,z,h,r=0) {
  const dx=x-h.x,dz=z-h.z,s=Math.sin(h.yaw),c=Math.cos(h.yaw);
  return Math.abs(dx*c-dz*s)<h.w/2+r && Math.abs(dx*s+dz*c)<h.d/2+r;
}
export function canWalk(x,z,r=.29) {
  if (x<bounds.west+r || x>bounds.east-r || z<bounds.north+r || z>bounds.south-r) return false;
  if (z>-42.3 && z<-39.7 && Math.abs(x)>2.05-r) return false;
  if (z>bridge.a && z<bridge.b && !onBridge(x,z,r) && onBridge(x,z,-r-.28)) return false;
  if (Math.abs(z-riverZ(x))<riverWidth(x)+.53+r && !onBridge(x,z,r)) return false;
  if (Math.hypot(x-tree.x,z-tree.z)<tree.radius+r) return false;
  if (Math.hypot(x-northFir.x,z-northFir.z)<.25+r) return false;
  if(inHouse(x,z,teaBay,r)||inHouse(x,z,giftDisplay,r))return false;
  if(inHouse(x,z,teaStall,r))return false;
  if(benches.some(h=>inHouse(x,z,{...h,w:1.72,d:.56},r)))return false;
  if(Math.abs(z-hillGate.z)<hillGate.depth/2+r && Math.abs(x-hillGate.x)<hillGate.width/2+r &&
    Math.abs(x-hillGate.x)>hillGate.halfOpening-r)return false;
  if(squaredDistanceToPath(x,z,squareBank)<(.22+r)**2 || squaredDistanceToPath(x,z,terraceRail)<(.22+r)**2 || terraceWalls.some(line=>{
    const [a,b]=nearestPoint(x,z,line);
    return Math.hypot(x-a,z-b)<.235+r;
  }))return false;
  return !houses.some(h=>inHouse(x,z,h,r));
}

export function nearestPoint(x,z,line) {
  let nearest, min=Infinity;
  for (let i=1;i<line.length;i++) {
    const [ax,az]=line[i-1],[bx,bz]=line[i], dx=bx-ax,dz=bz-az;
    const t=clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz),0,1);
    const px=ax+t*dx,pz=az+t*dz, d=(px-x)**2+(pz-z)**2;
    if (d<min) { min=d; nearest=[px,pz]; }
  }
  return nearest;
}

function distanceToPath(x,z,points) {
  return Math.sqrt(squaredDistanceToPath(x,z,points));
}

function squaredDistanceToPath(x,z,points) {
  const [a,b]=nearestPoint(x,z,points);
  return (x-a)**2+(z-b)**2;
}

function entrancePath(house) {
  const step=front(house,.22), arrival=front(house,.94);
  const candidates=paths.map(({points})=>nearestPoint(...arrival,points))
    .sort((a,b)=>Math.hypot(a[0]-arrival[0],a[1]-arrival[1])-Math.hypot(b[0]-arrival[0],b[1]-arrival[1]));
  for(const end of candidates){
    const run=Math.hypot(end[0]-arrival[0],end[1]-arrival[1]);
    if(run>6.5)break;
    const count=Math.max(1,Math.ceil(run/.24));
    let previous=groundHeight(...arrival),clear=true;
    for(let i=0;i<=count;i++){
      const x=mix(arrival[0],end[0],i/count),z=mix(arrival[1],end[1],i/count),y=groundHeight(x,z);
      if(houses.some(h=>inHouse(x,z,h,h===house?0:.24))||Math.abs(z-riverZ(x))<riverWidth(x)+.83||
        (i>0&&Math.abs(y-previous)>.015+run/count*.34)){
        clear=false;
        break;
      }
      previous=y;
    }
    if(clear)return {width:1.34,points:[step,arrival,end],house:house.id};
  }
  return null;
}

export const doorstepPaths=houses.map(entrancePath).filter(Boolean);
export const pavedPaths=[...paths,...doorstepPaths];
const apronDepths={bakery:2.3,mill:1.35,gift:2.4,letter:1.65,herbs:1.22,tailor:1.25,terrace:1.55,chimney:1.4,lanterns:1.15,books:1.0};
export const forecourts=houses.filter(h=>apronDepths[h.id]).map(h=>{
  const d=apronDepths[h.id];
  const [x,z]=front(h,d/2-.06);
  return {x,z,yaw:h.yaw,w:h.w+.28,d};
});

export function pavedAt(x,z,pad=0,ignorePath=null) {
  if(onBridge(x,z,-pad))return true;
  if(squares.some(area=>{
    if(!area.outline)return Math.hypot((x-area.x)/(area.rx+pad),(z-area.z)/(area.rz+pad))<=1;
    if(Math.abs(x-area.x)>area.rx+pad+.3||Math.abs(z-area.z)>area.rz+pad+.18)return false;
    let inside=false;
    const contour=area.outline;
    for(let i=0,j=contour.length-1;i<contour.length;j=i++){
      const [a,b]=contour[j],[c,d]=contour[i];
      if((b>z)!==(d>z)&&x<a+(c-a)*(z-b)/(d-b))inside=!inside;
    }
    const edge=area===treeSquare?treeSquareEdge:upperTerraceEdge;
    return inside||(pad>0&&distanceToPath(x,z,edge)<=pad);
  }))return true;
  if(forecourts.some(a=>inHouse(x,z,a,pad)))return true;
  return pavedPaths.some(p=>p!==ignorePath&&distanceToPath(x,z,p.points)<=p.width/2+pad);
}

const treeSquareEdge=[...treeSquare.outline,treeSquare.outline[0]];
const upperTerraceEdge=[...upperTerrace.outline,upperTerrace.outline[0]];
